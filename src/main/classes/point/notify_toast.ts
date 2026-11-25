import { Notification } from 'electron'
import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'point.notify_toast'
export const summary = 'Electron Notification'

/** L1 · 系统通知 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const title = String(ctx.params.title ?? '百应')
  const body = String(ctx.params.body ?? ctx.input ?? '').slice(0, 180)
  if (!Notification.isSupported()) {
    return { status: 'warn', output: '当前系统不支持通知', value: body, elapsedMs: elapsed(startedAt) }
  }
  new Notification({ title, body }).show()
  return { status: 'ok', output: `已发送系统通知 · ${body.length} 字符`, value: body, elapsedMs: elapsed(startedAt) }
}
