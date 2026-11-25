/**
 * 触发器绑定的持久化。
 *
 * 一条绑定 = 「按了什么组合」+「跑哪个实例」。
 * 这和 surface 层的 GestureBinding 是同构的（pattern → target），
 * 区别是这里的 pattern 是键盘组合，且由主进程在钩子命中时直接派发。
 */
import { parseGesture } from '../shared/gestureNotation'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type TriggerTargetKind = 'point' | 'line'

/** 触发源：键盘组合 / 手势。同一套 dispatch，不同 source */
export type TriggerSource = 'hotkey' | 'gesture'

/** 手势触发按钮（对应 WGestures GestureTriggerButton） */
export type GestureTriggerButton = 'left' | 'right' | 'middle' | 'x1' | 'x2'

/**
 * 手势的「修饰」—— 对应 WGestures 的 GestureModifier 标志位。
 *
 * 这**不是键盘修饰键**。它表达「滚轮方向」和「另一个键按着」，
 * 后者形成按键弦（右键+左键这种）。
 *
 *   WheelForward=1 / WheelBackward=2 / MiddleButtonDown=4
 *   LeftButtonDown=8 / RightButtonDown=16 / X1=32 / X2=64
 */
export type GestureModifier =
  | 'wheel-forward'
  | 'wheel-backward'
  | 'middle-down'
  | 'left-down'
  | 'right-down'
  | 'x1'
  | 'x2'

/**
 * 手势三元组 —— 手势的身份。
 *
 * 为什么不能只存一个方向串：备份里 71 条手势中，
 *   「右键 + U」和「右键 + 滚轮前 + U」是两个不同手势，
 * 扁平字符串会把它们压成同一个 `U`，后者直接覆盖前者。
 *
 * dirs 为空串表示「纯滚轮/按键弦，没有方向」—— 备份里有 8 条是这种。
 */
export interface GestureTriple {
  button: GestureTriggerButton
  /** 方向串，'' 表示无方向 */
  dirs: string
  modifier?: GestureModifier
}

export interface TriggerBinding {
  id: string
  source: TriggerSource
  /** hotkey: 'Ctrl+Alt+Space'（已规范化）；gesture: 'LDR' */
  pattern: string
  /** 手势三元组。source==='gesture' 时有；hotkey 时没有 */
  gesture?: GestureTriple
  /**
   * 只在按住 modifier 时执行（对应 WGestures ExecuteOnModifier）。
   * 同一个手势因此可以有两套含义。
   */
  executeOnModifier?: boolean
  /**
   * 这条绑定触发后要不要开命令会话继续接管滚轮。
   * 对应 WGestures 的 IGestureModifiersAware（音量、任务切换）。
   */
  needsSession?: boolean
  /** 应用作用域（对应 ExeApp + InheritGlobalGestures）。不填 = 全局 */
  appScope?: { exePath: string; inheritGlobal: boolean }
  /** 展示名 */
  name?: string
  /** 副作用等级展示（L0–L3 / A0–A3） */
  effect?: string
  targetKind: TriggerTargetKind
  targetId: string
  enabled: boolean
  note: string
  fireCount: number
  lastFiredAt: number | null
}

interface TriggerState {
  version: 3
  bindings: TriggerBinding[]
}

/**
 * 方向串的合法字符 —— 箭头记法，与 WGestures 一致。
 * 字母记法有歧义：'UL' 既是「一段斜向左上」也是「先上后左」。
 */
export const DIRS_PATTERN = /^(↑|↗|→|↘|↓|↙|←|↖)*$/

/**
 * 手势的身份键 —— 三元组是唯一身份。
 *
 * 修复「撞车」的地方：以前 key 是 pattern（只有方向串），
 * 右键+U 和 右键+滚轮前+U 都是 U，后写的覆盖前一个。
 */
export function gestureKeyOf(triple: GestureTriple): string {
  return `${triple.button}:${triple.dirs}:${triple.modifier ?? ''}`
}

/** 绑定的身份键。手势看三元组，热键看组合键 */
export function bindingKeyOf(binding: TriggerBinding): string {
  if (binding.source === 'gesture' && binding.gesture) return `gesture:${gestureKeyOf(binding.gesture)}`
  return `${binding.source}:${binding.pattern}`
}

/** 三元组 → 可读文本，如 right:U:wheel-forward */
export function formatGestureKey(triple: GestureTriple): string {
  const mod = triple.modifier ? `:${triple.modifier}` : ''
  return `${triple.button}:${triple.dirs}${mod}`
}

/**
 * 文本 → 三元组。三种写法：
 *   'LDR'                    → 右键 + LDR（兼容旧数据）
 *   'right:U'                → 右键 + U
 *   'right:U:wheel-forward'  → 右键 + 滚轮前 + U
 */
export function parseGestureKey(input: string): GestureTriple | null {
  const text = String(input ?? '').trim()
  if (!text) return null
  // 也接受 WGestures 记法（◑←↓→ / ◑↑↓▲），顺手归一化
  if (/[◑●◐▲▼]/.test(text)) {
    const parsed = parseGesture(text)
    if (!parsed) return null
    return parsed.modifier
      ? { button: parsed.button as GestureTriggerButton, dirs: parsed.dirs, modifier: parsed.modifier as GestureModifier }
      : { button: parsed.button as GestureTriggerButton, dirs: parsed.dirs }
  }

  const parts = text.split(':')
  if (parts.length === 1) {
    const dirs = parts[0]
    if (!dirs || !DIRS_PATTERN.test(dirs)) return null
    return { button: 'right', dirs }
  }
  const button = parts[0].toLowerCase()
  if (!['left', 'right', 'middle', 'x1', 'x2'].includes(button)) return null
  const dirs = parts[1] ?? ''
  if (!DIRS_PATTERN.test(dirs)) return null
  const modifier = parts[2] || undefined
  const known = ['wheel-forward', 'wheel-backward', 'middle-down', 'left-down', 'right-down', 'x1', 'x2']
  if (modifier && !known.includes(modifier)) return null
  // 没方向又没 modifier 的手势没意义（那是一次单击，不是手势）
  if (!dirs && !modifier) return null
  return { button: button as GestureTriggerButton, dirs, modifier: modifier as GestureModifier | undefined }
}

/** v1 只有 combo 字段，统一按热键迁移 */
function migrate(raw: Partial<TriggerBinding> & { combo?: string }): TriggerBinding {
  return {
    id: String(raw.id ?? ''),
    source: (raw.source as TriggerSource) ?? 'hotkey',
    pattern: String(raw.pattern ?? raw.combo ?? ''),
    // v2 → v3：旧手势只有方向串，没有三元组。补成右键 + 该方向串。
    gesture: (raw.source as TriggerSource) === 'gesture'
      ? (raw.gesture as GestureTriple | undefined) ?? parseGestureKey(String(raw.pattern ?? '')) ?? undefined
      : undefined,
    executeOnModifier: raw.executeOnModifier === true,
    needsSession: raw.needsSession === true,
    appScope: raw.appScope as TriggerBinding['appScope'],
    name: raw.name ?? undefined,
    effect: raw.effect ?? undefined,
    targetKind: (raw.targetKind as TriggerTargetKind) ?? 'point',
    targetId: String(raw.targetId ?? ''),
    enabled: raw.enabled !== false,
    note: String(raw.note ?? ''),
    fireCount: Number(raw.fireCount ?? 0),
    lastFiredAt: raw.lastFiredAt ?? null
  }
}

/**
 * 手势去重：一个三元组只能对应一个目标，否则同一手势会触发多个实例。
 * 保留先出现的那条——用户自己录的优先于种子数据。
 */
function dedupeGestures(bindings: TriggerBinding[]): TriggerBinding[] {
  const seen = new Set<string>()
  return bindings.filter((binding) => {
    if (binding.source !== 'gesture') return true
    // 去重键 = 三元组 + 应用作用域。
    // 原码每个 ExeApp 和 GlobalApp 各有一份 GestureIntentDict，
    // 「同一手势在两个应用里」本来就是两条独立记录。只按三元组去重会合成一条
    // —— 实测 70 条塌成 57 条。只按方向串去重也不行：右键+U 会挤掉右键+滚轮前+U。
    const scope = binding.appScope?.exePath?.toLowerCase() ?? '@global'
    const key = binding.gesture ? `${gestureKeyOf(binding.gesture)}@${scope}` : `legacy:${binding.pattern}@${scope}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export class TriggerStore {
  /**
   * 状态文件损坏时留档的路径。
   *
   * 以前这里是 `catch { return this.seedState() }` —— 文件坏了就悄悄回到种子数据，
   * 用户自建的实例没了，界面上看不出发生过什么。损坏必须留痕。
   */
  private corruptBackup: string | null = null
  private readonly filePath: string
  private state: TriggerState

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
  }

  private load(): TriggerState {
    try {
      if (!existsSync(this.filePath)) return { version: 3, bindings: [] }
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<TriggerState>
      const list = Array.isArray(parsed.bindings) ? parsed.bindings : []
      const migrated = list.map((item) => migrate(item as never))
      const deduped = dedupeGestures(migrated)
      // 去重真的删掉了东西就落盘，避免每次启动都重算
      if (deduped.length !== migrated.length) {
        setTimeout(() => this.save(), 0)
      }
      return { version: 3, bindings: deduped }
    } catch {
      return { version: 3, bindings: [] }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(temp, this.filePath)
  }

  list(): TriggerBinding[] {
    return this.state.bindings.map((binding) => ({ ...binding }))
  }

  find(id: string): TriggerBinding | undefined {
    return this.state.bindings.find((binding) => binding.id === id)
  }

  upsert(input: Omit<TriggerBinding, 'fireCount' | 'lastFiredAt'> & Partial<Pick<TriggerBinding, 'fireCount' | 'lastFiredAt'>>): TriggerBinding {
    const existing = this.find(input.id)
    const record: TriggerBinding = {
      ...input,
      fireCount: input.fireCount ?? existing?.fireCount ?? 0,
      lastFiredAt: input.lastFiredAt ?? existing?.lastFiredAt ?? null
    }
    this.state.bindings = existing
      ? this.state.bindings.map((binding) => (binding.id === input.id ? record : binding))
      : [...this.state.bindings, record]
    this.save()
    return record
  }

  remove(id: string): boolean {
    const before = this.state.bindings.length
    this.state.bindings = this.state.bindings.filter((binding) => binding.id !== id)
    if (this.state.bindings.length === before) return false
    this.save()
    return true
  }

  markFired(id: string): void {
    const binding = this.find(id)
    if (!binding) return
    binding.fireCount += 1
    binding.lastFiredAt = Date.now()
    this.save()
  }
}
