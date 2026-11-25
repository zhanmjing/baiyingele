import { elapsed, type Capability } from '../../capabilities/_shared'
import { readRunHistory, type RunHistoryLike } from './observe'

export const classId = 'field.recommend'
export const summary = '建议下一步：按失败率、重复度、缺口排优先级给一条具体建议，纯规则'

/**
 * A1 · 建议（纯规则）
 *
 * 只给**一条**建议，不给一列。列一堆选项等于没建议。
 * 排序依据是「现在做它收益最大」：先修失败，再固化重复，最后才是补缺口。
 */

export interface Suggestion {
  action: string
  target: string
  why: string
  confidence: number
}

/** 纯函数：从运行历史推一条最该做的事 */
export function suggestNext(runs: RunHistoryLike[]): Suggestion | null {
  if (!runs.length) return null

  // 1. 失败率高的类优先修
  const failed = new Map<string, number>()
  const total = new Map<string, number>()
  for (const run of runs) {
    total.set(run.classId, (total.get(run.classId) ?? 0) + 1)
    if (run.status !== 'ok') failed.set(run.classId, (failed.get(run.classId) ?? 0) + 1)
  }
  let worst: { classId: string; rate: number; count: number } | null = null
  for (const [classId, count] of failed) {
    const rate = count / (total.get(classId) ?? count)
    if (!worst || rate > worst.rate || (rate === worst.rate && count > worst.count)) {
      worst = { classId, rate, count }
    }
  }
  if (worst && worst.count >= 2) {
    return {
      action: '诊断失败',
      target: worst.classId,
      why: `${worst.classId} 失败 ${worst.count} 次，失败率 ${(worst.rate * 100).toFixed(0)}%`,
      confidence: Math.min(0.95, 0.6 + worst.rate * 0.4)
    }
  }

  // 2. 用得最多的类，值得封装
  const mostUsed = [...total.entries()].sort((a, b) => b[1] - a[1])[0]
  if (mostUsed && mostUsed[1] >= 5) {
    return {
      action: '封装成流程',
      target: mostUsed[0],
      why: `${mostUsed[0]} 被手动跑了 ${mostUsed[1]} 次`,
      confidence: 0.7
    }
  }

  // 3. 什么毛病都没有：建议先积累样本
  if (runs.length < 10) {
    return {
      action: '继续使用积累样本',
      target: '-',
      why: `目前只有 ${runs.length} 条运行记录，样本太少，建议不可靠`,
      confidence: 0.4
    }
  }
  return null
}

/** 纯函数：从历史推荐一个能省最多点击的体 */
export function recommendBody(runs: RunHistoryLike[], candidates: string[]): Suggestion | null {
  if (!runs.length || !candidates.length) return null
  const usage = new Map<string, number>()
  for (const run of runs) {
    const layer = run.classId.split('.')[0]
    usage.set(layer, (usage.get(layer) ?? 0) + 1)
  }
  const hit = candidates[0]
  const pointUsage = usage.get('point') ?? 0
  if (pointUsage < 5) return null
  return {
    action: '试用体',
    target: hit,
    why: `点层被直接调用了 ${pointUsage} 次，说明你在手工拼装，体可以把它们包起来`,
    confidence: 0.6
  }
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'next-action').toLowerCase()
  const runs = readRunHistory()

  if (!runs) {
    return {
      status: 'warn',
      output: `取不到运行历史（主进程未注入 setRunHistorySource），无法给出 ${mode} 建议`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'recommend', mode, problem: 'no-history' }
    }
  }

  const suggestion =
    mode.includes('body')
      ? recommendBody(runs, ['body.file_preview', 'body.ocr', 'body.clipboard_history'])
      : suggestNext(runs)

  if (!suggestion) {
    return {
      status: 'ok',
      output: `看完了 ${runs.length} 条运行记录，没有值得现在做的事`,
      value: 'null',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'recommend', mode, suggestion: null }
    }
  }

  return {
    status: 'ok',
    output: `建议${suggestion.action}「${suggestion.target}」：${suggestion.why}`,
    value: JSON.stringify(suggestion),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'recommend', mode, suggestion }
  }
}
