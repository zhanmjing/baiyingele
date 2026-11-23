import { elapsed, type Capability } from './_shared'

export const id = 'text.template'
export const summary = '纯函数：把 {{input}} 替换为上游输出'

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
