import { desktopCapturer } from 'electron'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'point.screen_capture'
export const summary = 'desktopCapturer 枚举屏幕源'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

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
