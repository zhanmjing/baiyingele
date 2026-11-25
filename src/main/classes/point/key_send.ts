import { focusWindow, isVirtualKeyDown, sendKeyEvents, win32Available, win32LoadError, type KeyEventSpec } from '../../capabilities/_win32'
import { resolveTarget } from './window_control'
import { isWindows } from '../../capabilities/_powershell'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'point.key_send'
export const summary = 'koffi SendInput 真实发送组合键（走系统输入队列，目标程序无法区分真假）'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

export type ModifierName = 'Ctrl' | 'Alt' | 'Shift' | 'Meta'
export type KeyMode = 'press' | 'down' | 'up'

export interface KeyCombo {
  /** 规范化后的显示名，例如 Ctrl+Alt+Shift+A */
  label: string
  /** 按下顺序：Ctrl → Alt → Shift → Meta（与 win.key.trigger 的 parseCombo 一致） */
  modifiers: ModifierName[]
  key: string
}

/** 修饰键统一用左键变体：SendInput 对 VK_L* 的处理比 VK_SHIFT/VK_CONTROL 这类"通用"码更确定 */
export const MODIFIER_VK: Record<ModifierName, number> = {
  Ctrl: 0xa2,
  Alt: 0xa4,
  Shift: 0xa0,
  Meta: 0x5b
}

/** 具名键：别名 → 虚拟键码 + 规范显示名（显示名要能反查回同一个 vk） */
const NAMED: Record<string, { vk: number; display: string }> = {
  space: { vk: 0x20, display: 'Space' },
  enter: { vk: 0x0d, display: 'Enter' },
  return: { vk: 0x0d, display: 'Enter' },
  tab: { vk: 0x09, display: 'Tab' },
  esc: { vk: 0x1b, display: 'Escape' },
  escape: { vk: 0x1b, display: 'Escape' },
  backspace: { vk: 0x08, display: 'Backspace' },
  delete: { vk: 0x2e, display: 'Delete' },
  del: { vk: 0x2e, display: 'Delete' },
  insert: { vk: 0x2d, display: 'Insert' },
  ins: { vk: 0x2d, display: 'Insert' },
  home: { vk: 0x24, display: 'Home' },
  end: { vk: 0x23, display: 'End' },
  pageup: { vk: 0x21, display: 'PageUp' },
  pgup: { vk: 0x21, display: 'PageUp' },
  pagedown: { vk: 0x22, display: 'PageDown' },
  pgdn: { vk: 0x22, display: 'PageDown' },
  up: { vk: 0x26, display: 'ArrowUp' },
  arrowup: { vk: 0x26, display: 'ArrowUp' },
  down: { vk: 0x28, display: 'ArrowDown' },
  arrowdown: { vk: 0x28, display: 'ArrowDown' },
  left: { vk: 0x25, display: 'ArrowLeft' },
  arrowleft: { vk: 0x25, display: 'ArrowLeft' },
  right: { vk: 0x27, display: 'ArrowRight' },
  arrowright: { vk: 0x27, display: 'ArrowRight' },
  capslock: { vk: 0x14, display: 'CapsLock' },
  numlock: { vk: 0x90, display: 'NumLock' },
  scrolllock: { vk: 0x91, display: 'ScrollLock' },
  printscreen: { vk: 0x2c, display: 'PrintScreen' },
  prtsc: { vk: 0x2c, display: 'PrintScreen' },
  pause: { vk: 0x13, display: 'Pause' },
  '-': { vk: 0xbd, display: '-' },
  '=': { vk: 0xbb, display: '=' },
  '[': { vk: 0xdb, display: '[' },
  ']': { vk: 0xdd, display: ']' },
  '\\': { vk: 0xdc, display: '\\' },
  ';': { vk: 0xba, display: ';' },
  "'": { vk: 0xde, display: "'" },
  ',': { vk: 0xbc, display: ',' },
  '.': { vk: 0xbe, display: '.' },
  '/': { vk: 0xbf, display: '/' },
  '`': { vk: 0xc0, display: '`' }
}

const MODIFIER_ALIASES: Record<string, ModifierName> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  win: 'Meta',
  meta: 'Meta',
  cmd: 'Meta',
  super: 'Meta'
}

/** 需要 KEYEVENTF_EXTENDEDKEY 的键；不加这些应用会把方向键当成小键盘 */
const EXTENDED_VKS = new Set([
  0x2d, // Insert
  0x2e, // Delete
  0x24, // Home
  0x23, // End
  0x21, // PageUp
  0x22, // PageDown
  0x25, // Left
  0x26, // Up
  0x27, // Right
  0x28, // Down
  0x90, // NumLock
  0x2c, // PrintScreen
  0xa3, // RCtrl
  0xa5, // RAlt
  0x5c // RWin
])

/** 键名 → 规范显示名。认不出来返回 null（绝不猜） */
export function canonicalKeyName(name: string): string | null {
  const raw = String(name ?? '').trim()
  if (!raw) return null

  if (/^[a-zA-Z]$/.test(raw)) return raw.toUpperCase() // A-Z
  if (/^[0-9]$/.test(raw)) return raw // 0-9
  const fn = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(raw)
  if (fn) return `F${fn[1]}` // F1-F24
  return NAMED[raw.toLowerCase()]?.display ?? null
}

/** 键名 → 虚拟键码。认不出来返回 null（绝不猜） */
export function virtualKeyOf(name: string): number | null {
  const raw = String(name ?? '').trim()
  if (!raw) return null

  if (/^[a-zA-Z]$/.test(raw)) return raw.toUpperCase().charCodeAt(0) // A-Z → 0x41-0x5A
  if (/^[0-9]$/.test(raw)) return 0x30 + Number(raw) // 0-9 → 0x30-0x39
  const fn = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(raw)
  if (fn) return 0x70 + Number(fn[1]) - 1 // F1-F24 → 0x70-0x87
  return NAMED[raw.toLowerCase()]?.vk ?? null
}

export function isExtendedKey(vk: number): boolean {
  return EXTENDED_VKS.has(vk)
}

/** 纯函数：解析 "Ctrl+Alt+A" → 结构化组合。无法解析返回 null */
export function parseKeys(raw: string): KeyCombo | null {
  const tokens = String(raw ?? '')
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
  if (!tokens.length) return null

  const modifiers: ModifierName[] = []
  let key = ''

  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token.toLowerCase()]
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier)
      continue
    }
    if (key) return null // 出现两个主键，不猜用户意图
    const canonical = canonicalKeyName(token)
    if (canonical === null || virtualKeyOf(token) === null) return null
    key = canonical
  }

  if (!key) return null // 只有修饰键
  const ordered = (['Ctrl', 'Alt', 'Shift', 'Meta'] as ModifierName[]).filter((name) => modifiers.includes(name))
  return { label: [...ordered, key].join('+'), modifiers: ordered, key }
}

/**
 * 纯函数：把组合展开成具体的按下/抬起序列。
 *
 * preHeld 是「本来就按着的修饰键」—— 这些键不能替用户按下，更不能替用户松开，
 * 否则自动化跑完用户的 Shift 就"粘住"了。
 */
export function buildKeyEvents(
  combo: KeyCombo,
  mode: KeyMode,
  preHeld: Set<number>,
  repeat = 1
): KeyEventSpec[] {
  const mainVk = virtualKeyOf(combo.key)
  if (mainVk === null) return []

  const modifierVks = combo.modifiers.map((name) => MODIFIER_VK[name])
  const ownModifiers = modifierVks.filter((vk) => !preHeld.has(vk))
  const mainExtended = isExtendedKey(mainVk)

  // up：把整个组合松开（main + 全部修饰键），供 down/up 配对使用
  if (mode === 'up') {
    const events: KeyEventSpec[] = [{ vk: mainVk, extended: mainExtended, up: true }]
    for (const vk of [...modifierVks].reverse()) events.push({ vk, extended: isExtendedKey(vk), up: true })
    return events
  }

  const times = Math.max(1, Math.min(20, Math.trunc(repeat) || 1))
  const events: KeyEventSpec[] = []

  for (let round = 0; round < times; round++) {
    for (const vk of ownModifiers) events.push({ vk, extended: isExtendedKey(vk), up: false })
    events.push({ vk: mainVk, extended: mainExtended, up: false })
    if (mode === 'press') {
      events.push({ vk: mainVk, extended: mainExtended, up: true })
      for (const vk of [...ownModifiers].reverse()) events.push({ vk, extended: isExtendedKey(vk), up: true })
    }
  }
  return events
}

/** L1 · 发送组合键 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }
  if (!win32Available()) {
    return { status: 'warn', output: `发送按键需要 koffi：${win32LoadError() ?? '未加载'}`, elapsedMs: elapsed(startedAt) }
  }

  const keys = String(ctx.params.keys ?? '').trim()
  const modeRaw = String(ctx.params.mode ?? 'press').trim().toLowerCase()
  const repeatRaw = Number(ctx.params.repeat ?? 1)
  const targetRaw = String(ctx.params.target ?? '').trim()

  const combo = parseKeys(keys)
  if (!combo) {
    return {
      status: 'warn',
      output: `无法解析组合键「${keys || '(空)'}」（示例：Ctrl+C / Alt+Tab / F5 / Ctrl+Shift+T）`,
      elapsedMs: elapsed(startedAt)
    }
  }
  if (!['press', 'down', 'up'].includes(modeRaw)) {
    return { status: 'warn', output: `未知 mode：${modeRaw}（支持 press / down / up）`, elapsedMs: elapsed(startedAt) }
  }

  const mode = modeRaw as KeyMode
  const repeat = Number.isFinite(repeatRaw) ? Math.max(1, Math.min(20, Math.trunc(repeatRaw))) : 1

  try {
    // SendInput 只发给前台窗口：需要指定窗口就先聚焦
    let focusNote = ''
    let targetEvidence: Record<string, unknown> | null = null
    if (targetRaw) {
      const resolved = resolveTarget(targetRaw)
      if (!resolved) {
        return { status: 'warn', output: `没有匹配的目标窗口（target=${targetRaw}）`, elapsedMs: elapsed(startedAt) }
      }
      if (!resolved.window.hwnd) {
        return { status: 'warn', output: '目标窗口缺少句柄（koffi 枚举异常）', elapsedMs: elapsed(startedAt) }
      }
      const focused = focusWindow(resolved.window.hwnd)
      if (!focused.ok) {
        return { status: 'warn', output: `聚焦目标窗口失败：${focused.reason}`, elapsedMs: elapsed(startedAt) }
      }
      focusNote = ` → ${resolved.window.process}「${resolved.window.title.slice(0, 24)}」`
      targetEvidence = { hwnd: resolved.window.hwnd, process: resolved.window.process, matchCount: resolved.matchCount }
      // 让系统把焦点真正切过去，否则第一批按键会落在旧窗口
      await new Promise((resolve) => setTimeout(resolve, 80))
    }

    // 用户此刻正按着的修饰键，不能被我们按下或松开
    const preHeld = new Set<number>()
    for (const modifier of combo.modifiers) {
      const vk = MODIFIER_VK[modifier]
      if (isVirtualKeyDown(vk) === true) preHeld.add(vk)
    }

    const events = buildKeyEvents(combo, mode, preHeld, repeat)
    if (!events.length) {
      return { status: 'warn', output: `组合键展开后没有事件：${combo.label}`, elapsedMs: elapsed(startedAt) }
    }

    const result = sendKeyEvents(events)
    const heldNote = preHeld.size ? `（保留用户已按住的 ${preHeld.size} 个修饰键）` : ''
    const modeNote = mode === 'press' ? '' : ` · mode=${mode}`

    return {
      status: result.ok ? 'ok' : 'warn',
      output: result.ok
        ? `已发送 ${combo.label}${repeat > 1 ? ` ×${repeat}` : ''}（${result.sent} 个事件）${focusNote}${modeNote}${heldNote}`
        : `发送失败：${result.reason}`,
      value: combo.label,
      evidence: {
        backend: 'sendinput',
        combo: combo.label,
        mode,
        repeat,
        events: events.length,
        sent: result.sent,
        preHeldModifiers: [...preHeld],
        target: targetEvidence,
        reason: result.reason
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `发送按键失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
