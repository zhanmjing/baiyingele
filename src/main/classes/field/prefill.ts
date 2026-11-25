import { clipboard } from 'electron'
import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'field.prefill'
export const summary = '参数预填：按实例配置的 target/param 从剪贴板取值，产出落点建议'

/**
 * A2 · 参数预填。
 * 只负责「建议什么值、落到哪」，真正的写入与撤销由 fieldRuntime 按自主度决定——
 * 能力本身不碰目标实例，保证 A0/A1 下不可能被顺手写进去。
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const target = String(ctx.params.target ?? '').trim()
  const param = String(ctx.params.param ?? '').trim()
  const source = String(ctx.params.source ?? 'clipboard').trim().toLowerCase()
  const literal = String(ctx.params.literal ?? '')

  if (!target || !param) {
    return {
      status: 'warn',
      output: '实例未配置 target / param，无法给出落点',
      elapsedMs: elapsed(startedAt)
    }
  }

  let value = ''
  let sourceNote = ''
  if (source === 'literal') {
    value = literal
    sourceNote = '字面量'
  } else if (source === 'input') {
    value = String(ctx.input ?? '')
    sourceNote = '上游输出'
  } else {
    value = await clipboard.readText()
    sourceNote = '剪贴板'
  }
  value = value.trim()

  if (!value) {
    return {
      status: 'warn',
      output: `${sourceNote}为空，没有可预填的值`,
      elapsedMs: elapsed(startedAt)
    }
  }

  const preview = value.length > 40 ? `${value.slice(0, 40)}…` : value
  return {
    status: 'ok',
    output: `建议 ${target}.${param} = ${JSON.stringify(preview)}（来源：${sourceNote}）`,
    value,
    landing: { layer: 'point', target: 'param', instanceId: target, param, value },
    evidence: {
      sourceType: source,
      source: sourceNote,
      target,
      param,
      suggestedLength: value.length
    },
    elapsedMs: elapsed(startedAt)
  }
}
