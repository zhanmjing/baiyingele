import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'win.key.trigger'
export const summary = 'uiohook-napi 全局热键监听（起钩子后常驻，不同于一次性能力）'

export interface ParsedCombo {
  label: string
  /** 主键的规范名（Ctrl/Alt/Shift/Meta 之外的最后一个 token） */
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

const MODIFIERS: Record<string, 'ctrl' | 'alt' | 'shift' | 'meta'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  win: 'meta',
  meta: 'meta',
  cmd: 'meta',
  super: 'meta'
}

const KEY_ALIASES: Record<string, string> = {
  space: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight'
}

/** 纯函数：把 "Ctrl+Alt+Space" 解析成结构化组合（不解析成数字 keycode） */
export function parseCombo(keys: string): ParsedCombo | null {
  const tokens = String(keys ?? '')
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
  if (!tokens.length) return null

  const combo: ParsedCombo = { label: '', key: '', ctrl: false, alt: false, shift: false, meta: false }

  for (const token of tokens) {
    const modifier = MODIFIERS[token.toLowerCase()]
    if (modifier) {
      combo[modifier] = true
      continue
    }
    if (combo.key) return null // 多个非修饰键：不支持
    const lower = token.toLowerCase()
    combo.key = KEY_ALIASES[lower] ?? (lower.startsWith('f') && /^f\d{1,2}$/.test(lower) ? lower.toUpperCase() : token.length === 1 ? token.toUpperCase() : token)
  }

  if (!combo.key) return null // 只有修饰键
  const parts = [combo.ctrl && 'Ctrl', combo.alt && 'Alt', combo.shift && 'Shift', combo.meta && 'Meta', combo.key].filter(Boolean)
  combo.label = parts.join('+')
  return combo
}

export interface KeyEventLike {
  keycode: number
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/** 纯函数：事件是否匹配组合（keymap 把规范名映射成 uiohook 的 keycode） */
export function matchesCombo(combo: ParsedCombo, event: KeyEventLike, keymap: Record<string, number>): boolean {
  const expected = keymap[combo.key]
  if (expected === undefined) return false
  return (
    event.keycode === expected &&
    Boolean(event.ctrlKey) === combo.ctrl &&
    Boolean(event.altKey) === combo.alt &&
    Boolean(event.shiftKey) === combo.shift &&
    Boolean(event.metaKey) === combo.meta
  )
}

export interface TriggerFiring {
  at: number
  combo: string
}

// 模块级常驻状态：钩子只起一次，组合可注册多个
let hookStarted = false
let uiohookModule: { uIOhook: any; UiohookKey: Record<string, number> } | null = null
const registered = new Map<string, ParsedCombo>()
const firings: TriggerFiring[] = []

/** 读取最近触发记录（供 IPC / 后续触发器服务消费） */
export function recentFirings(limit = 20): TriggerFiring[] {
  return firings.slice(0, Math.max(1, Math.min(limit, 100)))
}

export function registeredCombos(): string[] {
  return [...registered.keys()]
}

export function stopHook(): { stopped: boolean; combos: number } {
  const combos = registered.size
  registered.clear()
  if (!hookStarted || !uiohookModule) return { stopped: false, combos }
  try {
    uiohookModule.uIOhook.stop()
  } catch {
    // 已经停了就忽略
  }
  hookStarted = false
  return { stopped: true, combos }
}

function ensureHook(): { ok: boolean; reason?: string } {
  if (hookStarted && uiohookModule) return { ok: true }
  try {
    // 懒加载：拿不到 native 钩子时不能让主进程起不来
    const mod = require('uiohook-napi')
    uiohookModule = { uIOhook: mod.uIOhook, UiohookKey: mod.UiohookKey }

    mod.uIOhook.on('keydown', (event: KeyEventLike) => {
      for (const [label, combo] of registered) {
        if (!matchesCombo(combo, event, mod.UiohookKey)) continue
        firings.unshift({ at: Date.now(), combo: label })
        if (firings.length > 50) firings.length = 50
      }
    })

    mod.uIOhook.start()
    hookStarted = true
    return { ok: true }
  } catch (error) {
    uiohookModule = null
    hookStarted = false
    return { ok: false, reason: errorMessage(error) }
  }
}

/** L0 · 注册/停止全局热键监听 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const keys = String(ctx.params.keys ?? '').trim()
  const scope = String(ctx.params.scope ?? 'global').trim().toLowerCase()

  if (scope !== 'global') {
    return { status: 'warn', output: `目前只支持 scope=global（收到 ${scope}）`, elapsedMs: elapsed(startedAt) }
  }

  // keys 为空 = 停止监听
  if (!keys) {
    const result = stopHook()
    return {
      status: 'ok',
      output: result.stopped ? `已停止全局钩子（清理 ${result.combos} 个组合）` : '钩子本来就没在运行',
      evidence: { action: 'stop', stopped: result.stopped, cleared: result.combos },
      elapsedMs: elapsed(startedAt)
    }
  }

  const combo = parseCombo(keys)
  if (!combo) {
    return {
      status: 'warn',
      output: `无法解析组合键「${keys}」（示例：Ctrl+Alt+Space / F5 / Ctrl+Shift+A）`,
      elapsedMs: elapsed(startedAt)
    }
  }

  const hook = ensureHook()
  if (!hook.ok) {
    return { status: 'warn', output: `启动全局钩子失败：${hook.reason}`, elapsedMs: elapsed(startedAt) }
  }

  registered.set(combo.label, combo)
  return {
    status: 'ok',
    output: `已开始监听 ${combo.label}（全局）· 当前 ${registered.size} 个组合 · 注意：这是常驻监听，不是一次性执行`,
    value: combo.label,
    evidence: {
      action: 'start',
      combo: combo.label,
      parsed: combo,
      registered: [...registered.keys()],
      note: '钩子常驻；传空 keys 可停止'
    },
    elapsedMs: elapsed(startedAt)
  }
}
