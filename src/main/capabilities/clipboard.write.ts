import { clipboard } from 'electron'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.clipboard_write'
export const summary = 'Electron clipboard.writeText（写后回读校验）'

/**
 * L1 · 写剪贴板。
 * 注意 Electron 45 的 clipboard 是 W3C 异步 API：writeText 返回 Promise，readText 也返回 Promise。
 * 空文本直接拒绝——覆盖用户剪贴板是不可逆的，不能拿空串把它清掉。
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const text = String(ctx.params.text ?? ctx.input ?? '')

  if (!text) {
    return { status: 'warn', output: '文本为空，未改动剪贴板', elapsedMs: elapsed(startedAt) }
  }

  try {
    await clipboard.writeText(text)
    // 回读校验：确认真的写进去了（可能被其它程序抢占）
    const readBack = await clipboard.readText()
    const verified = readBack === text
    return {
      status: verified ? 'ok' : 'warn',
      output: verified
        ? `已写入剪贴板 · ${text.length} 字符 · 回读校验通过`
        : `已写入但回读不一致（${readBack.length} 字符，可能被其它程序抢占）`,
      value: text,
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `写剪贴板失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
