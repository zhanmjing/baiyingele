/**
 * 手势记法 —— 和 WGestures 完全一致。
 *
 * 来源：WGestures 1.8.3.0
 *   Gesture.dirs[]                     ↑ ↗ → ↘ ↓ ↙ ← ↖
 *   GestureTriggerButton.ToMnemonic()  ● / ◑ / X1 / X2
 *   GestureModifier.ToMnemonic()       ▲ ▼ ● ◐ ◑ / X1 / X2
 *   Gesture.ToString()                 = 按钮 + 方向序列 + 修饰
 *
 * ## 为什么必须换成箭头
 *
 * 旧记法用字母：方向串 'UL' 既可能是「一段斜向左上」，也可能是「先上后左」。
 * 迁移备份时实测有 5 条手势因此表示不出来（58 个真手势只剩 53 个键）。
 *
 * 箭头全部是单个码位，拼接天然无歧义：
 *   '↖'  = 一段斜向左上
 *   '↑←' = 先上后左
 */

export const DIRECTIONS = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL'] as const
export type Direction = (typeof DIRECTIONS)[number]

/** 方向 → 箭头（下标与 WGestures GestureDir 枚举一致：0=Up … 7=LeftUp） */
export const DIR_ARROW: Record<Direction, string> = {
  U: '↑',
  UR: '↗',
  R: '→',
  DR: '↘',
  D: '↓',
  DL: '↙',
  L: '←',
  UL: '↖'
}

export const ARROW_DIR: Record<string, Direction> = Object.fromEntries(
  Object.entries(DIR_ARROW).map(([dir, arrow]) => [arrow, dir as Direction])
)

/** 按钮助记符，照抄 GestureTriggerButton.ToMnemonic() */
export const BUTTON_MNEMONIC: Record<string, string> = {
  left: '',
  right: '◑',
  middle: '●',
  x1: 'X1',
  x2: 'X2'
}

/** 修饰助记符，照抄 GestureModifier.ToMnemonic() */
export const MODIFIER_MNEMONIC: Record<string, string> = {
  'wheel-forward': '▲',
  'wheel-backward': '▼',
  'middle-down': '●',
  'left-down': '◐',
  'right-down': '◑',
  x1: 'X1',
  x2: 'X2'
}

export interface GestureTripleLike {
  button: string
  /** 箭头串，如 '←↓→'；空串表示无方向 */
  dirs: string
  modifier?: string
}

/** 三元组 → WGestures 记法，如 `◑←↓→▲` */
export function formatGesture(triple: GestureTripleLike): string {
  const button = BUTTON_MNEMONIC[triple.button] ?? ''
  const modifier = triple.modifier ? MODIFIER_MNEMONIC[triple.modifier] ?? '' : ''
  return `${button}${triple.dirs}${modifier}`
}

/** 箭头串是否合法 */
export function isValidArrows(arrows: string): boolean {
  if (arrows === '') return true
  return [...arrows].every((ch) => ch in ARROW_DIR)
}

export function arrowsToDirections(arrows: string): Direction[] {
  return [...arrows].map((ch) => ARROW_DIR[ch]).filter(Boolean) as Direction[]
}

export function directionsToArrows(dirs: Direction[]): string {
  return dirs.map((d) => DIR_ARROW[d] ?? '?').join('')
}

/**
 * 解析 WGestures 记法 → 三元组。
 *   '◑←↓→'   → right / '←↓→'
 *   '◑↑↓▲'   → right / '↑↓' / wheel-forward
 *   '◑▲'     → right / '' / wheel-forward（纯滚轮）
 *   '←↓→'    → right / '←↓→'（省略按钮默认右键，兼容旧数据）
 */
export function parseGesture(text: string): { button: string; dirs: string; modifier?: string } | null {
  const input = String(text ?? '').trim()
  if (!input) return null

  let rest = input
  let button = 'right'

  for (const [name, symbol] of Object.entries(BUTTON_MNEMONIC)) {
    if (symbol && rest.startsWith(symbol)) {
      button = name
      rest = rest.slice(symbol.length)
      break
    }
  }

  // 修饰符号在最后；● ◑ 同时是按钮与修饰符号，所以先摘开头再摘结尾
  let modifier: string | undefined
  for (const [name, symbol] of Object.entries(MODIFIER_MNEMONIC)) {
    if (symbol && rest.endsWith(symbol)) {
      modifier = name
      rest = rest.slice(0, rest.length - symbol.length)
      break
    }
  }

  if (!isValidArrows(rest)) return null
  if (!rest && !modifier) return null
  return modifier ? { button, dirs: rest, modifier } : { button, dirs: rest }
}
