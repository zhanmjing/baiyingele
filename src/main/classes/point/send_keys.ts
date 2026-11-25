import { elapsed } from '../../capabilities/_shared'
import { canonicalKeyName } from './key_send'

/**
 * point.send_keys —— SendKeys 方言（对应 WGestures 的 SendTextCommand）
 *
 * WGestures 直接调 `SendKeys.SendWait(text)`，所以备份里存的是
 * .NET WinForms SendKeys 语法：
 *
 *   ^v{enter}     Ctrl+V 然后 Enter（「粘贴并回车」那条）
 *   %{TAB}        Alt+Tab
 *   +a            Shift+A
 *   {sleep 500}   停顿 500ms —— 这个是 WGestures 自己在 SendKeys 之前切段实现的
 *
 * 我们不复用 SendKeys，而是解析成 KeyStep[]，交给 key_send 的 SendInput 执行。
 * 解析是纯函数可测；执行要碰真键盘。混在一起就测不了语法。
 */

export const classId = 'point.send_keys'
export const summary = 'SendKeys 方言解析 + 发送（^v{enter} / %{TAB} / {sleep 500}）'
export const specialized = true

export type KeyModifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta'

export type KeyStep =
  | { kind: 'keys'; modifiers: KeyModifier[]; key: string }
  | { kind: 'sleep'; ms: number }
  | { kind: 'text'; text: string }

const NAMED_KEYS: Record<string, string> = {
  enter: 'Enter', return: 'Enter', tab: 'Tab',
  esc: 'Escape', escape: 'Escape',
  backspace: 'Backspace', bs: 'Backspace',
  delete: 'Delete', del: 'Delete', insert: 'Insert',
  home: 'Home', end: 'End',
  pageup: 'PageUp', pagedown: 'PageDown',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  space: 'Space', printscreen: 'PrintScreen', prtsc: 'PrintScreen'
}

/**
 * SendKeys 串 → 步骤数组。
 *
 * `^`=Ctrl `%`=Alt `+`=Shift，`{name}`=特殊键，`{sleep N}`=停顿。
 * 未知的 `{xxx}` **不静默忽略** —— 返回 error，免得用户以为动作生效了。
 */
export function parseSendKeys(input: string): { steps: KeyStep[]; error?: string } {
  const text = String(input ?? '')
  const steps: KeyStep[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) {
      steps.push({ kind: 'text', text: buffer })
      buffer = ''
    }
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === '{') {
      const end = text.indexOf('}', i)
      if (end < 0) return { steps, error: `花括号没有闭合：${text.slice(i, i + 20)}` }
      const inner = text.slice(i + 1, end).trim()
      const sleep = /^sleep\s*(\d*)$/i.exec(inner)
      if (sleep) {
        flush()
        steps.push({ kind: 'sleep', ms: Number(sleep[1] || 0) })
        i = end + 1
        continue
      }
      const named = NAMED_KEYS[inner.toLowerCase()]
      if (!named) return { steps, error: `无法识别的特殊键：{${inner}}` }
      flush()
      steps.push({ kind: 'keys', modifiers: [], key: named })
      i = end + 1
      continue
    }

    if (ch === '^' || ch === '%' || ch === '+') {
      flush()
      const modifiers: KeyModifier[] = []
      let j = i
      while (j < text.length && (text[j] === '^' || text[j] === '%' || text[j] === '+')) {
        const mod: KeyModifier = text[j] === '^' ? 'Ctrl' : text[j] === '%' ? 'Alt' : 'Shift'
        if (!modifiers.includes(mod)) modifiers.push(mod)
        j += 1
      }

      let keyName: string | null = null
      if (j < text.length && text[j] === '{') {
        const end = text.indexOf('}', j)
        if (end < 0) return { steps, error: '花括号没有闭合' }
        const inner = text.slice(j + 1, end).trim().toLowerCase()
        keyName = NAMED_KEYS[inner] ?? null
        if (!keyName) return { steps, error: `无法识别的特殊键：{${inner}}` }
        j = end + 1
      } else if (j < text.length) {
        keyName = canonicalKeyName(text[j]) ?? text[j].toUpperCase()
        j += 1
      }

      if (!keyName) return { steps, error: '修饰键后面没有主键' }
      steps.push({ kind: 'keys', modifiers, key: keyName })
      i = j
      continue
    }

    buffer += ch
    i += 1
  }

  flush()
  return { steps }
}

export interface SendKeysResult {
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
}

/** 执行步骤。`send` 由调用方注入，这样这个类可以被测而不碰真键盘。 */
export async function runSteps(
  steps: KeyStep[],
  send: (modifiers: string[], key: string) => Promise<void> | void
): Promise<SendKeysResult> {
  const startedAt = Date.now()
  for (const step of steps) {
    if (step.kind === 'sleep') {
      await new Promise((r) => setTimeout(r, Math.min(step.ms, 10_000)))
      continue
    }
    if (step.kind === 'text') {
      for (const ch of step.text) await send([], ch)
      continue
    }
    await send(step.modifiers, step.key)
  }
  return { status: 'ok', output: `已发送 ${steps.length} 步`, elapsedMs: elapsed(startedAt) }
}

export function run(context: any): Promise<SendKeysResult> {
  const params = context?.params ?? {}
  const parsed = parseSendKeys(String(params.text ?? ''))
  if (parsed.error) {
    return Promise.resolve({ status: 'warn', output: `SendKeys 解析失败：${parsed.error}`, elapsedMs: 0 })
  }
  return runSteps(parsed.steps, async (modifiers, key) => {
    const send = context?.deps?.sendKey
    if (!send) throw new Error('没有注入 sendKey，无法发送按键')
    await send(modifiers, key)
  })
}
