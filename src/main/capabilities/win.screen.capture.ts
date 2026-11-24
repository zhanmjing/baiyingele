import { desktopCapturer } from 'electron'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.screen_capture'
export const summary = 'desktopCapturer 枚举屏幕源'

/** L0 · 抓屏（枚举屏幕源，不保存文件） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
    const names = sources.map((source) => source.name).join(', ')
    return {
      status: sources.length ? 'ok' : 'warn',
      output: sources.length ? `已捕获 ${sources.length} 个屏幕源 · ${names}` : '没有可用的屏幕源',
      value: String(sources.length),
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `抓屏失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
