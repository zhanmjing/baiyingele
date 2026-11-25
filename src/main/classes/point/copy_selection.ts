import { elapsed, errorMessage } from '../../capabilities/_shared'

/**
 * point.copy_selection —— 复制当前选区到剪贴板
 *
 * 对应 WGestures WebSearchCommand 的隐式依赖：它内部用 ClipboardMonitor
 * 拿「当前选中文本」，再替换搜索 URL 里的 {0}。
 *
 * 分两步显式表达：
 *   1. 发 Ctrl+C（让目标程序把选区写进剪贴板）
 *   2. 读剪贴板
 *
 * point.clipboard_get 只能读剪贴板，不能"让当前应用复制选区"。
 * 少了第 1 步，搜到的永远是上一次复制的东西。
 */

export const classId = 'point.copy_selection'
export const summary = '发 Ctrl+C 复制当前选区，再读剪贴板（WebSearch 的前置）'
export const specialized = true

export interface CopySelectionResult {
  status: 'ok' | 'warn'
  output: string
  value?: string
  elapsedMs: number
}

export async function copySelection(deps: {
  sendCopy: () => Promise<void> | void
  readClipboard: () => string
  settleMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<CopySelectionResult> {
  const startedAt = Date.now()
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  try {
    await deps.sendCopy()
  } catch (error) {
    return { status: 'warn', output: `发送 Ctrl+C 失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }

  // 目标程序写剪贴板不是同步的 —— 立刻读大概率拿到旧内容
  await sleep(deps.settleMs ?? 120)

  let text = ''
  try {
    text = deps.readClipboard()
  } catch (error) {
    return { status: 'warn', output: `读剪贴板失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }

  const trimmed = String(text ?? '').trim()
  if (!trimmed) {
    return { status: 'warn', output: '选区为空（可能当前应用不支持复制）', elapsedMs: elapsed(startedAt) }
  }
  return { status: 'ok', output: `已复制 ${trimmed.length} 字`, value: trimmed, elapsedMs: elapsed(startedAt) }
}

export const run = async (context: any): Promise<CopySelectionResult> => {
  const { sendCopy, readClipboard } = context?.deps ?? {}
  if (!sendCopy || !readClipboard) {
    return { status: 'warn', output: '没有注入 sendCopy / readClipboard，无法复制选区（主进程启动时注入）', elapsedMs: 0 }
  }
  return copySelection({ sendCopy, readClipboard, settleMs: Number(context?.params?.settleMs ?? 120) })
}
