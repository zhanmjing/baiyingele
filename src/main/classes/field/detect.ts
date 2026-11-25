import { elapsed, type Capability } from '../../capabilities/_shared'
import { readRunHistory, type RunHistoryLike } from './observe'
import { lineProfiles } from '../../../shared/lineCatalog'

export const classId = 'field.detect'
export const summary = '从运行历史里找重复序列、异常、可自动化机会；纯规则，不调用模型'

/**
 * A0 · 发现（纯规则，只读，不产生任何副作用）
 *
 * 三个实例各查一种信号：
 *   repetition   连续 n-gram 反复出现 → 建议做成流程
 *   anomaly      失败集中 / 耗时离群    → 建议排查
 *   opportunity  高频手动使用但没有任何流程引用 → 建议接入流程
 *
 * 取不到运行历史时**如实报取不到**，不返回「没发现问题」——
 * 「没发现」和「没数据」是两件事，混在一起会让人误判。
 */

export interface DetectedSignal {
  kind: 'repetition' | 'anomaly' | 'opportunity'
  /** 一句话说清发现了什么 */
  title: string
  /** 支撑这条发现的原始数字 */
  evidence: Record<string, unknown>
  /** 0..1，规则越确定分越高 */
  confidence: number
}

/** 连续 n-gram 计数：把 classId 序列切成 n 长窗口 */
export function ngramCounts(seq: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i + n <= seq.length; i += 1) {
    const key = seq.slice(i, i + n).join(' → ')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function detectRepetition(runs: RunHistoryLike[]): DetectedSignal[] {
  const seq = runs.slice().sort((a, b) => a.createdAt - b.createdAt).map((run) => run.classId)
  if (seq.length < 6) return []
  const out: DetectedSignal[] = []
  for (const n of [2, 3]) {
    for (const [pattern, count] of ngramCounts(seq, n)) {
      // 至少要出现 3 次才算「反复」；2 次可能只是巧合
      if (count < 3) continue
      out.push({
        kind: 'repetition',
        title: `「${pattern}」连续出现 ${count} 次，适合固化成流程`,
        evidence: { pattern, count, window: n },
        confidence: Math.min(0.9, 0.4 + count * 0.1)
      })
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

export function detectAnomaly(runs: RunHistoryLike[]): DetectedSignal[] {
  const out: DetectedSignal[] = []
  const failed = runs.filter((run) => run.status !== 'ok')
  if (failed.length) {
    const byClass = new Map<string, number>()
    for (const run of failed) byClass.set(run.classId, (byClass.get(run.classId) ?? 0) + 1)
    const [worstClass, worstCount] = [...byClass.entries()].sort((a, b) => b[1] - a[1])[0]
    out.push({
      kind: 'anomaly',
      title: `${worstClass} 有 ${worstCount} 次运行未成功（占全部失败 ${failed.length} 次）`,
      evidence: { classId: worstClass, failed: worstCount, totalFailed: failed.length, totalRuns: runs.length },
      confidence: runs.length ? Math.min(0.95, 0.5 + (failed.length / runs.length) * 2) : 0.5
    })
  }

  const timings = runs.map((run) => run.elapsedMs).filter((ms) => Number.isFinite(ms) && ms > 0)
  if (timings.length >= 5) {
    const sorted = timings.slice().sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const slow = runs.filter((run) => run.elapsedMs > median * 3 && run.elapsedMs > 500)
    if (slow.length) {
      out.push({
        kind: 'anomaly',
        title: `${slow.length} 次运行为中位耗时 ${median}ms 的 3 倍以上，最慢 ${Math.max(...slow.map((r) => r.elapsedMs))}ms`,
        evidence: { median, slowCount: slow.length, slowest: Math.max(...slow.map((r) => r.elapsedMs)) },
        confidence: 0.7
      })
    }
  }
  return out
}

/** 被任何线层流程引用到的点类 */
function classesUsedInFlows(): Set<string> {
  const used = new Set<string>()
  for (const profile of Object.values(lineProfiles) as Array<{ nodes?: Array<{ pointClass?: unknown }> }>) {
    for (const node of profile.nodes ?? []) {
      const ref = node.pointClass
      if (!ref) continue
      if (typeof ref === 'string') used.add(ref)
      else if (typeof ref === 'object' && 'name' in ref) used.add(String((ref as { name: unknown }).name))
    }
  }
  return used
}

export function detectOpportunity(runs: RunHistoryLike[], minUsage = 3): DetectedSignal[] {
  const usage = new Map<string, number>()
  for (const run of runs) usage.set(run.classId, (usage.get(run.classId) ?? 0) + 1)
  const inFlows = classesUsedInFlows()
  const out: DetectedSignal[] = []
  for (const [classId, count] of usage) {
    if (count < minUsage) continue
    // 已经被流程用到的，不算「没接入」的机会
    if ([...inFlows].some((name) => classId.endsWith(`.${name}`) || classId === name)) continue
    out.push({
      kind: 'opportunity',
      title: `${classId} 被手动运行 ${count} 次，但没有任何流程引用它`,
      evidence: { classId, usage: count },
      confidence: Math.min(0.85, 0.4 + count * 0.05)
    })
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const runs = readRunHistory()
  if (!runs) {
    return {
      status: 'warn',
      output: '取不到运行历史（主进程未注入 setRunHistorySource），无法做任何发现',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'detect', problem: 'no-history' }
    }
  }

  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'repetition').toLowerCase()
  let signals: DetectedSignal[] = []
  if (mode.includes('anomaly')) signals = detectAnomaly(runs)
  else if (mode.includes('opportunity')) signals = detectOpportunity(runs)
  else signals = detectRepetition(runs)

  if (!runs.length) {
    return {
      status: 'warn',
      output: '运行历史是空的，没有可发现的信号',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'detect', mode, runs: 0 }
    }
  }

  if (!signals.length) {
    return {
      status: 'ok',
      output: `查看了 ${runs.length} 条运行记录，未发现 ${mode} 类信号`,
      value: '[]',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'detect', mode, runs: runs.length, signals: [] }
    }
  }

  return {
    status: 'ok',
    output: `查看了 ${runs.length} 条运行记录，发现 ${signals.length} 条 ${mode} 信号：${signals[0].title}`,
    value: JSON.stringify(signals),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'detect', mode, runs: runs.length, signals }
  }
}
