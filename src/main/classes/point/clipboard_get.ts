import { clipboard } from 'electron'
import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'point.clipboard_get'
export const summary = 'Electron clipboard.readText / read'

/**
 * L0 · 读取剪贴板。
 * Electron 45 的 clipboard 已改为 W3C 风格异步 API：
 * readText(): Promise<string>、read(): Promise<ClipboardItem[]>，不再有 readImage()。
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const format = String(ctx.params.format ?? 'text').toLowerCase()

  if (format === 'image') {
    const items = await clipboard.read()
    const imageItem = items.find((item) => item.types.some((type) => type.startsWith('image/')))
    if (!imageItem) {
      const available = [...new Set(items.flatMap((item) => item.types))].join(', ')
      return {
        status: 'warn',
        output: available ? `剪贴板里没有图片 · 现有类型：${available}` : '剪贴板为空',
        elapsedMs: elapsed(startedAt)
      }
    }
    const mime = imageItem.types.find((type) => type.startsWith('image/'))!
    const blob = (await imageItem.getType(mime)) as Blob
    return {
      status: 'ok',
      output: `剪贴板图片 · ${mime} · ${blob.size} bytes`,
      value: mime,
      elapsedMs: elapsed(startedAt)
    }
  }

  const text = await clipboard.readText()
  if (!text) return { status: 'warn', output: '剪贴板为空', value: '', elapsedMs: elapsed(startedAt) }
  const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text
  return {
    status: 'ok',
    output: `剪贴板文本 · ${text.length} 字符 · ${JSON.stringify(preview)}`,
    value: text,
    elapsedMs: elapsed(startedAt)
  }
}
