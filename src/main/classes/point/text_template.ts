import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'point.text_template'
export const summary = '纯函数：把 {{input}} 替换为上游输出'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

/** L0 · 套模板（纯函数，不碰外部世界） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const template = String(ctx.params.template ?? '{{input}}')
  const input = String(ctx.params.input ?? ctx.input ?? '')
  const rendered = template.split('{{input}}').join(input)
  return {
    status: 'ok',
    output: `模板已套用 · ${rendered.length} 字符`,
    value: rendered,
    elapsedMs: elapsed(startedAt)
  }
}
