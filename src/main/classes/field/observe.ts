import { clipboard } from 'electron'
import { foregroundWindow, idleMilliseconds } from '../../capabilities/_win32'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'field.observe'
export const summary = '上下文快照：前台进程/窗口/时间/空闲、剪贴板、运行历史；只读，绝不改动任何东西'

/**
 * A0 · 观察（只读上下文快照）
 *
 * 实例描述约定（和 field.classify 一样用「·」分隔）：
 *   'global · 前台进程/窗口/时间/空闲'   → 采集这四个切面
 *   'global · 选中文本/剪贴板/文件'       → 只采得动剪贴板，其余如实说明取不到
 *   'run history · 最近运行/失败/耗时'    → 需要注入运行历史源
 *
 * 设计原则：**取不到的切面要明说取不到**，不能静默少给字段。
 */

export interface RunHistoryLike {
  id: string
  classId: string
  status: string
  elapsedMs: number
  createdAt: number
}

type HistorySource = () => RunHistoryLike[]
let historySource: HistorySource | null = null

/** 由主进程注入运行历史读取器（能力模块不直接摸各个 store） */
export function setRunHistorySource(source: HistorySource | null): void {
  historySource = source
}

/** 读当前注入的运行历史；没注入就返回 null（调用方必须如实报「取不到」） */
export function readRunHistory(): RunHistoryLike[] | null {
  return historySource ? historySource() : null
}

/** 从实例描述里取要采集的切面：'global · a/b/c' → ['a','b','c'] */
export function facetsOf(description: string): string[] {
  const parts = String(description ?? '').split('·')
  if (parts.length < 2) return []
  return (parts.pop() ?? '')
    .split('/')
    .map((facet) => facet.trim())
    .filter(Boolean)
}

export interface Snapshot {
  takenAt: string
  /** 实际采到的切面 */
  collected: string[]
  /** 想采但取不到的切面 + 原因 */
  unavailable: { facet: string; reason: string }[]
  desktop?: { process: string; title: string; idleMs: number | null }
  clipboard?: { kind: 'text'; length: number; preview: string } | { kind: 'empty' }
  history?: { total: number; /** 非 ok 的条数（warn 和 failed 都算没成功） */ notOk: number; p50Ms: number; p95Ms: number; slowest: { classId: string; elapsedMs: number } | null }
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))
  return sorted[index]
}

/** 纯函数：把运行记录算成统计（便于测试） */
export function summarizeHistory(
  runs: RunHistoryLike[]
): NonNullable<Snapshot['history']> {
  const durations = runs.map((run) => run.elapsedMs).filter((value) => Number.isFinite(value) && value >= 0)
  const slowestRun = runs.reduce<RunHistoryLike | null>(
    (worst, run) => (worst === null || run.elapsedMs > worst.elapsedMs ? run : worst),
    null
  )
  return {
    total: runs.length,
    notOk: runs.filter((run) => run.status !== 'ok').length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    slowest: slowestRun ? { classId: slowestRun.classId, elapsedMs: slowestRun.elapsedMs } : null
  }
}

/** A0 · 采集上下文快照 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const facets = facetsOf(String(ctx.instance.description ?? ''))
  if (!facets.length) {
    return {
      status: 'warn',
      output: '实例没有声明要观察的切面（约定：描述里用「·」分隔，后半段写 a/b/c）',
      elapsedMs: elapsed(startedAt)
    }
  }

  const snapshot: Snapshot = {
    takenAt: new Date().toISOString(),
    collected: [],
    unavailable: []
  }
  const notes: string[] = []

  // ── 桌面切面 ──
  const desktopWanted = facets.filter((facet) => ['前台进程', '窗口', '时间', '空闲'].includes(facet))
  if (desktopWanted.length) {
    const foreground = foregroundWindow()
    if (!foreground) {
      snapshot.unavailable.push({ facet: '前台进程', reason: '窗口枚举不可用（需要 koffi）' })
    } else {
      snapshot.desktop = {
        process: foreground.process,
        title: foreground.title,
        idleMs: idleMilliseconds()
      }
      if (desktopWanted.includes('前台进程')) snapshot.collected.push('前台进程')
      if (desktopWanted.includes('窗口')) snapshot.collected.push('窗口')
      if (desktopWanted.includes('时间')) snapshot.collected.push('时间')
      if (desktopWanted.includes('空闲')) {
        if (snapshot.desktop.idleMs === null) {
          snapshot.unavailable.push({ facet: '空闲', reason: 'GetLastInputInfo 不可用' })
        } else {
          snapshot.collected.push('空闲')
        }
      }
      notes.push(`${foreground.process}「${foreground.title.slice(0, 24)}」`)
      if (snapshot.desktop.idleMs !== null) notes.push(`空闲 ${Math.round(snapshot.desktop.idleMs / 1000)}s`)
    }
  }

  // ── 剪贴板切面 ──
  if (facets.includes('剪贴板')) {
    try {
      const text = await clipboard.readText()
      if (text) {
        snapshot.clipboard = { kind: 'text', length: text.length, preview: text.slice(0, 60) }
        notes.push(`剪贴板 ${text.length} 字符`)
      } else {
        snapshot.clipboard = { kind: 'empty' }
        notes.push('剪贴板为空')
      }
      snapshot.collected.push('剪贴板')
    } catch (error) {
      snapshot.unavailable.push({ facet: '剪贴板', reason: errorMessage(error) })
    }
  }

  // ── 取不到的切面：如实列出 ──
  if (facets.includes('选中文本')) {
    snapshot.unavailable.push({ facet: '选中文本', reason: '取选中文本需要 UI Automation（ui.getText），点层还没实现' })
  }
  if (facets.includes('文件')) {
    snapshot.unavailable.push({ facet: '文件', reason: '剪贴板里的文件列表解析还没实现' })
  }

  // ── 运行历史切面 ──
  const historyWanted = facets.filter((facet) => ['最近运行', '失败', '耗时'].includes(facet))
  if (historyWanted.length) {
    if (!historySource) {
      snapshot.unavailable.push({ facet: '最近运行', reason: '运行历史源未注入（主进程启动时 setRunHistorySource）' })
    } else {
      try {
        snapshot.history = summarizeHistory(historySource())
        snapshot.collected.push(...historyWanted)
        notes.push(`历史 ${snapshot.history.total} 条，非 ok ${snapshot.history.notOk}，p95 ${snapshot.history.p95Ms}ms`)
      } catch (error) {
        snapshot.unavailable.push({ facet: '最近运行', reason: errorMessage(error) })
      }
    }
  }

  const missing = snapshot.unavailable.map((item) => `${item.facet}（${item.reason}）`)
  return {
    // 只要有切面取不到，就不能报 ok —— 快照不完整这件事必须让上层知道
    status: snapshot.unavailable.length ? 'warn' : 'ok',
    output: `采集 ${snapshot.collected.length}/${facets.length} 个切面${notes.length ? `：${notes.join(' · ')}` : ''}` +
      (missing.length ? `｜取不到：${missing.join('；')}` : ''),
    value: JSON.stringify(snapshot),
    evidence: {
      backend: 'observe',
      facets,
      collected: snapshot.collected,
      unavailable: snapshot.unavailable.map((item) => item.facet),
      takenAt: snapshot.takenAt
    },
    elapsedMs: elapsed(startedAt)
  }
}
