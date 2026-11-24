import { elapsed, type Capability } from './_shared'
import { readRunHistory, type RunHistoryLike } from './field.observe'

export const id = 'field.personalize'
export const summary = '按使用频率推默认值：高频动作建议快捷键、常用面建议布局、常调参数建议默认值'

/**
 * A2 · 个性化（纯频率统计，不调用模型）
 *
 * A2 意味着可以自动应用，但**必须可撤销**。所以这里只产出「建议值 + 依据」，
 * 真正落盘由 fieldLanding 的 A2 路径负责（会写 undo 日志）。
 *
 * 频率统计的铁律：**样本不够就不给建议**。3 次就推快捷键是在瞎猜。
 */

export interface Personalization {
  kind: 'shortcut' | 'layout' | 'defaults'
  target: string
  suggestedValue: string
  /** 依据，必须可核对 */
  basis: string
  confidence: number
}

/** 最少多少次才算「高频」。低于这个数不推。 */
const MIN_SAMPLES = 5

/** personalize.shortcut：给最高频的动作推快捷键 */
export function suggestShortcut(runs: RunHistoryLike[], minSamples = MIN_SAMPLES): Personalization | null {
  if (runs.length < minSamples) return null
  const usage = new Map<string, number>()
  for (const run of runs) usage.set(run.classId, (usage.get(run.classId) ?? 0) + 1)
  const [top, count] = [...usage.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (!top || count < minSamples) return null
  return {
    kind: 'shortcut',
    target: top,
    // 不编具体组合键 —— 组合键要查冲突，那不是这个能力能决定的
    suggestedValue: '（待分配，需检查冲突）',
    basis: `${top} 被运行 ${count} 次，是使用最多的一项`,
    confidence: Math.min(0.9, 0.5 + count * 0.02)
  }
}

/** personalize.layout：按各层的使用占比推布局 */
export function suggestLayout(runs: RunHistoryLike[], minSamples = MIN_SAMPLES): Personalization | null {
  if (runs.length < minSamples) return null
  const byLayer = new Map<string, number>()
  for (const run of runs) {
    const layer = run.classId.split('.')[0] ?? '?'
    byLayer.set(layer, (byLayer.get(layer) ?? 0) + 1)
  }
  const [topLayer, count] = [...byLayer.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (!topLayer) return null
  const share = count / runs.length
  return {
    kind: 'layout',
    target: `surface.${topLayer}_page`,
    suggestedValue: `把 ${topLayer} 层放主区域`,
    basis: `${topLayer} 层占全部运行的 ${(share * 100).toFixed(0)}%（${count}/${runs.length}）`,
    confidence: Math.min(0.85, 0.5 + share * 0.4)
  }
}

/** personalize.defaults：按最常见的成功参数组合推默认值 */
export function suggestDefaults(runs: Array<RunHistoryLike & { params?: Record<string, unknown> }>, minSamples = MIN_SAMPLES): Personalization | null {
  const usable = runs.filter((run) => run.status === 'ok' && run.params && Object.keys(run.params).length)
  if (usable.length < minSamples) return null
  const target = usable[0].classId
  const same = usable.filter((run) => run.classId === target)
  if (same.length < minSamples) return null

  // 每个参数取出现最多的值
  const values = new Map<string, Map<string, number>>()
  for (const run of same) {
    for (const [key, value] of Object.entries(run.params ?? {})) {
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      if (!values.has(key)) values.set(key, new Map())
      const bucket = values.get(key)!
      bucket.set(text, (bucket.get(text) ?? 0) + 1)
    }
  }
  const suggested = [...values.entries()]
    .map(([key, bucket]) => {
      const [value, count] = [...bucket.entries()].sort((a, b) => b[1] - a[1])[0]
      return { key, value, count, share: count / same.length }
    })
    // 只有明显占多数（>60%）才当默认值，否则是在猜
    .filter((item) => item.share > 0.6)

  if (!suggested.length) return null
  return {
    kind: 'defaults',
    target,
    suggestedValue: suggested.map((item) => `${item.key}=${item.value}`).join(' '),
    basis: `${target} 成功 ${same.length} 次，其中 ${suggested.map((item) => `${item.key} 有 ${(item.share * 100).toFixed(0)}% 用同一个值`).join('，')}`,
    confidence: Math.min(0.9, 0.5 + suggested.length * 0.1)
  }
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'shortcut').toLowerCase()
  const runs = readRunHistory()

  if (!runs) {
    return {
      status: 'warn',
      output: `取不到运行历史（主进程未注入 setRunHistorySource），无法做 ${mode} 个性化`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'personalize', mode, problem: 'no-history' }
    }
  }
  if (runs.length < MIN_SAMPLES) {
    return {
      status: 'warn',
      output: `只有 ${runs.length} 条运行记录，少于 ${MIN_SAMPLES} 条，推不出可靠的${mode}建议`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'personalize', mode, samples: runs.length, minSamples: MIN_SAMPLES }
    }
  }

  const suggestion =
    mode.includes('layout')
      ? suggestLayout(runs)
      : mode.includes('default') || mode.includes('defaults')
        ? suggestDefaults(runs as never)
        : suggestShortcut(runs)

  if (!suggestion) {
    return {
      status: 'ok',
      output: `看完了 ${runs.length} 条记录，没有足够集中的使用模式可以个性化`,
      value: 'null',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'personalize', mode, suggestion: null }
    }
  }

  return {
    status: 'ok',
    output: `建议把 ${suggestion.target} 的${suggestion.kind}设为「${suggestion.suggestedValue}」：${suggestion.basis}`,
    value: JSON.stringify(suggestion),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'personalize', mode, suggestion }
  }
}
