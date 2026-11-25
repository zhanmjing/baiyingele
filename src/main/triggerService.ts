/**
 * 触发器服务：把「输入被触发」接到「跑哪个实例」。
 *
 * 对应 design/overview/INPUT-TRIGGER-CLASSES.md：
 *   InputEvent → InputPattern(命中) → InputBinding(作用域/目标) → PointInstance / LineInstance
 *
 * 两种 source 共用同一条 dispatch：
 *   hotkey  —— uiohook-napi 全局钩子，组合键**精确**匹配
 *   gesture —— 渲染层送来轨迹，识别成方向串后**模糊**匹配（编辑距离 ≥ 阈值）
 */
import { onFiring, parseCombo, registerCombo, registeredCombos } from './classes/point/key_trigger'
import { matchPattern, recognize, type GesturePoint } from '../shared/gestureRecognizer'
import type { LayerStore } from './layerStore'
import { createSessionHost } from '../shared/commandSession'
import { formatGestureKey, parseGestureKey, type GestureTriple, type TriggerBinding, type TriggerSource, type TriggerStore, type TriggerTargetKind } from './triggerStore'

export interface FiringRecord {
  at: number
  source: TriggerSource
  pattern: string
  bindingId: string | null
  targetKind: TriggerTargetKind | null
  targetId: string | null
  status: 'ok' | 'warn' | 'skipped'
  output: string
  elapsedMs: number
  /** 手势专用：识别置信度 */
  score?: number
}

export interface AddTriggerInput {
  source: TriggerSource
  /** 文本形式。手势可以是 'LDR' / 'right:U' / 'right:U:wheel-forward' */
  pattern: string
  /** 手势三元组；不填就从 pattern 解析 */
  gesture?: GestureTriple
  /** 只在按住 modifier 时执行（WGestures ExecuteOnModifier） */
  executeOnModifier?: boolean
  /** 是否开命令会话（触发后继续接管滚轮） */
  needsSession?: boolean
  /** 应用作用域；不填 = 全局 */
  appScope?: { exePath: string; inheritGlobal: boolean }
  targetKind: TriggerTargetKind
  targetId: string
  note?: string
  /** 展示名 */
  name?: string
  /** 副作用等级展示 */
  effect?: string
  enabled?: boolean
}

export interface TriggerServiceDeps {
  store: TriggerStore
  pointStore: () => LayerStore
  lineStore: () => LayerStore
  /** 每次派发后回调，用于把结果推给渲染层（让 UI 不用轮询） */
  onFired?: (record: FiringRecord) => void
}

const MAX_FIRINGS = 50
const GESTURE_THRESHOLD = 0.75
// 箭头记法（与 WGestures 一致）。字母记法 'UL' 有歧义，已退役。
const GESTURE_PATTERN = /^(↑|↗|→|↘|↓|↙|←|↖)+$/

/** 派发入口的触发形式。热键与手势是两种独立功能，只共用管线不共用语义。 */
export type TriggerTrigger =
  | { kind: 'hotkey'; combo: string; exePath?: string }
  | { kind: 'gesture'; points: GesturePoint[]; exePath?: string }

/** 统一派发结果。手势多带 directions / session，热键只有 records。 */
export interface DispatchOutcome {
  valid: boolean
  records: FiringRecord[]
  directions?: string
  reason?: string
  session?: unknown
}

export class TriggerService {
  /** 命令会话宿主：整个服务只该有一个，否则会开出两个接管滚轮 */
  private sessionHost = createSessionHost()

  private readonly firings: FiringRecord[] = []
  private unsubscribe: (() => void) | null = null

  constructor(private readonly deps: TriggerServiceDeps) {}

  start(): { combos: string[]; failures: string[] } {
    this.unsubscribe?.()
    this.unsubscribe = onFiring((combo) => {
      void this.dispatchHotkey(combo)
    })
    return this.sync()
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** 只把 hotkey 类绑定挂到原生钩子上（手势由渲染层送进来） */
  sync(): { combos: string[]; failures: string[] } {
    const failures: string[] = []
    for (const binding of this.deps.store.list()) {
      if (!binding.enabled || binding.source !== 'hotkey') continue
      const parsed = parseCombo(binding.pattern)
      if (!parsed) {
        failures.push(`${binding.id}: 组合键无法解析 ${binding.pattern}`)
        continue
      }
      const result = registerCombo(parsed)
      if (!result.ok) failures.push(`${binding.id}: ${result.reason ?? '注册失败'}`)
    }
    return { combos: registeredCombos(), failures }
  }

  list(): TriggerBinding[] {
    return this.deps.store.list()
  }

  recent(limit = 20): FiringRecord[] {
    return this.firings.slice(0, Math.max(1, Math.min(limit, MAX_FIRINGS)))
  }

  add(input: AddTriggerInput): { ok: true; binding: TriggerBinding } | { ok: false; message: string } {
    let pattern: string

    if (input.source === 'hotkey') {
      const parsed = parseCombo(input.pattern)
      if (!parsed) return { ok: false, message: `组合键无法解析：${input.pattern}` }
      pattern = parsed.label
    } else {
      // 箭头没有大小写；这里只去空白，三元组解析在下面统一处理
      pattern = String(input.pattern ?? '').replace(/\s+/g, '')
      if (!pattern || !GESTURE_PATTERN.test(pattern)) {
        return { ok: false, message: `手势模式不合法：${input.pattern}（应为方向串，如 LDR / UD / DLU）` }
      }
    }

    const targetStore = input.targetKind === 'line' ? this.deps.lineStore() : this.deps.pointStore()
    if (!targetStore.instance(input.targetId)) {
      return { ok: false, message: `目标实例不存在：${input.targetKind}:${input.targetId}` }
    }

    // 手势：一个三元组只能有一个目标，改绑时直接覆盖；热键允许多目标
    // id 用三元组而不是方向串 —— 否则右键+U 和 右键+滚轮前+U 会共用一个 id
    const triple =
      input.source === 'gesture'
        ? (input.gesture as GestureTriple | undefined) ?? parseGestureKey(String(input.pattern ?? ''))
        : null
    if (input.source === 'gesture' && !triple) {
      return { ok: false, message: `手势三元组无法解析：${input.pattern}` }
    }
    // 手势绑定的身份 = 三元组 + 应用作用域。
    // 只带三元组的话，同一手势在两个应用里会撞成一条绑定（迁移时实测丢 5 条）。
    const scopeTag = input.appScope?.exePath
      ? `@${String(input.appScope.exePath).replace(/[^a-zA-Z0-9]/g, '_').slice(-24)}`
      : '@global'
    const bindingId =
      input.source === 'gesture' && triple
        ? `gesture:${formatGestureKey(triple)}${scopeTag}`
        : `${input.source}:${pattern}→${input.targetId}`
    const binding = this.deps.store.upsert({
      id: bindingId,
      source: input.source,
      pattern,
      gesture: triple ?? undefined,
      executeOnModifier: input.executeOnModifier === true,
      needsSession: input.needsSession === true,
      appScope: input.appScope,
      targetKind: input.targetKind,
      targetId: input.targetId,
      enabled: input.enabled ?? true,
      note: input.note ?? '',
      name: input.name,
      effect: input.effect
    })
    this.sync()
    return { ok: true, binding }
  }

  remove(id: string): boolean {
    const removed = this.deps.store.remove(id)
    if (removed) this.sync()
    return removed
  }

  /**
   * 唯一派发入口。两种触发形式，一条管线。
   *
   * ## 为什么统一（WGestures 原码给的形态）
   *
   * WGestures 把热角/边缘做成一个 8 元素槽位数组：
   *   HotCornerCommands[0..3]  四个角
   *   HotCornerCommands[4..7]  四条边
   * 同一个数组、不同下标 —— 而不是「每种触发一个 dispatch 函数」。
   * 共享点在 AbstractCommand.Execute()，查找各自做。
   *
   * 我们有键盘热键（WGestures 没有），所以触发器比它多一种，
   * 但管线该是同一套：**查找各自做，之后全一样**。
   *
   *     resolveCandidates(trigger)   ← 唯一分叉点，只有这里知道触发形式
   *            ↓ TriggerBinding[]
   *     scopeCandidates()            ← 应用作用域，只写一次
   *     execute(matches, meta)       ← 执行 + FiringRecord，只写一次
   *
   * 之前热键路径**完全不做作用域筛选**，是两份重复逻辑各自的缺口。
   */
  async dispatch(trigger: TriggerTrigger): Promise<DispatchOutcome> {
    if (trigger.kind === 'hotkey') {
      const records = await this.dispatchHotkey(trigger.combo, trigger.exePath)
      // 热键没有方向串、没有会话 —— 这是它与手势的本质区别，不假装有
      return { valid: records.some((r) => r.status === 'ok') || records.length > 0, records }
    }
    return this.dispatchGesturePoints(trigger.points, trigger.exePath)
  }

  /** 查找层：这是**唯一**按触发形式分叉的地方 */
  private resolveCandidates(trigger: TriggerTrigger): { pattern: string; matched: TriggerBinding[] } | null {
    const all = this.deps.store.list().filter((b) => b.enabled)
    if (trigger.kind === 'hotkey') {
      const parsed = parseCombo(trigger.combo)
      const pattern = parsed ? parsed.label : trigger.combo
      // 热键与手势是**互斥**的绑定来源，不能互相串
      const matched = this.scopeCandidates(all.filter((b) => b.source === 'hotkey' && b.pattern === pattern), trigger.exePath)
      return { pattern, matched }
    }
    return null // 手势的查找要识别 + 三元组 + 模糊兜底，走 dispatchGesturePoints 自己的流程
  }

  /** 热键路径（模拟真实按键，走完全相同的一跳） */
  async dispatchHotkey(combo: string, exePath?: string): Promise<FiringRecord[]> {
    const resolved = this.resolveCandidates({ kind: 'hotkey', combo, exePath })
    if (!resolved) return []
    return this.execute(resolved.matched, { source: 'hotkey', pattern: resolved.pattern })
  }

  /**
   * 手势路径：识别 → 精确三元组匹配 → 模糊兜底 → 派发 → 可能开会话
   *
   * ## 为什么不只用模糊匹配
   *
   * 模糊匹配（编辑距离 ≥0.75）是我们自己的加法，好处是手抖多一段还能命中。
   * 但它**分不清「右键+↑」和「右键+滚轮前+↑」** —— 那两个方向串完全一样。
   *
   * 所以顺序是：
   *   1. 先按三元组**精确**匹配（button + dirs + modifier 全对上）
   *   2. 精确没命中，再按方向串模糊兜底（此时不看 modifier）
   *
   * 第 2 步是为了不丢掉原来能用的场景；它命中时会标注 fuzzy=true。
   */
  async dispatchGesturePoints(points: GesturePoint[], exePath?: string): Promise<{ directions: string; valid: boolean; reason?: string; records: FiringRecord[]; session?: unknown }> {
    const result = recognize(points)
    if (!result.valid) {
      return { directions: '', valid: false, reason: result.reason, records: [] }
    }

    const all = this.deps.store
      .list()
      .filter((binding) => binding.enabled && binding.source === 'gesture')
    // 按应用作用域筛：当前应用有绑定就用应用级的，否则按 inheritGlobal 回落全局。
    // 这一步以前完全没有，所以 15 条应用级绑定永远不命中。
    const candidates = this.scopeCandidates(all, exePath)

    // ① 三元组精确匹配
    const exact = candidates.filter((binding) => binding.gesture && binding.gesture.dirs === result.directions)
    if (exact.length) {
      const records = await this.execute(exact, { source: 'gesture', pattern: result.directions, directions: result.directions, score: 1 })
      this.openSessionIfNeeded(exact)
      return { directions: result.directions, valid: true, records, session: this.activeSession() }
    }

    // ② 模糊兜底
    const best = matchPattern(result.directions, candidates.map((binding) => binding.pattern), GESTURE_THRESHOLD)

    if (!best) {
      const record = this.makeRecord(
        { source: 'gesture', pattern: result.directions },
        null,
        'skipped',
        `识别到 ${result.directions}，但没有匹配的绑定`,
        0
      )
      this.push(record)
      return { directions: result.directions, valid: true, records: [record] }
    }

    const matched = candidates.filter((binding) => binding.pattern === best.pattern)
    const records = await this.execute(matched, { source: 'gesture', pattern: best.pattern, directions: result.directions, score: best.score })
    return { directions: result.directions, valid: true, records }
  }

  /**
   * 命中单个绑定且它声明了 needsSession 时开一个会话。
   * 多个目标同时接管滚轮没有意义，所以只在单个时开。
   */
  private openSessionIfNeeded(matched: TriggerBinding[]): void {
    if (matched.length !== 1) return
    const binding = matched[0]
    if (!binding.needsSession) return
    this.sessionHost.start({
      bindingId: binding.id,
      observes: ['wheel-forward', 'wheel-backward'],
      onEvent: (event) => {
        // 会话期间每次滚轮都记一条 FiringRecord，方便排查
        this.push(this.makeRecord({ source: 'gesture', pattern: `${binding.pattern}·${event}` }, binding.id, 'ok', `会话事件 ${event}`, 0))
        return true
      }
    })
  }

  /**
   * 按应用作用域筛候选，照 AbstractGestureIntentFinder.Find：
   *
   *   if (exeApp != null) {
   *     found = exeApp.Find(gesture);
   *     if (found == null && exeApp.InheritGlobalGestures) found = globalApp.Find(gesture);
   *   } else { found = globalApp.Find(gesture); }
   *
   * 关键：InheritGlobalGestures 是**当前应用自己那条记录**的属性。
   */
  private scopeCandidates(all: TriggerBinding[], exePath?: string): TriggerBinding[] {
    const globalOnly = all.filter((b) => !b.appScope)
    if (!exePath) return globalOnly

    const target = exePath.toLowerCase()
    const atApp = all.filter((b) => b.appScope && b.appScope.exePath.toLowerCase() === target)
    if (atApp.length) return atApp

    // 当前应用没登记 → 直接用全局；登记了但声明不继承 → 不回落
    const registered = all.find((b) => b.appScope && b.appScope.exePath.toLowerCase() === target)
    if (!registered) return globalOnly
    return registered.appScope!.inheritGlobal ? globalOnly : []
  }

  /** 当前会话（「DR + 音量」这类触发后继续接管滚轮的命令） */
  activeSession() {
    return this.sessionHost.active()
  }

  /** 把滚轮事件送给当前会话。返回 'no-session' 表示没人接管，调用方按普通流程走 */
  feedSessionEvent(event: Parameters<typeof this.sessionHost.dispatch>[0]) {
    return this.sessionHost.dispatch(event)
  }

  /**
   * 采样进行中收到滚轮（对应 WGestures 的 PathTrackerOnPathModifier）。
   * 已有会话 → 直接送（ModifierTriggered）。
   * 没有会话 → 这是第一次滚轮，本该在这里「识别 + 执行 + 开会话」；
   *   目前采样中还不带方向串，只能如实返回 needs-directions。
   */
  async feedWheelDuringSampling(
    event: Parameters<typeof this.sessionHost.dispatch>[0],
    directions?: string
  ): Promise<'delivered' | 'not-observed' | 'ended' | 'needs-directions' | 'no-binding'> {
    // ① 已有会话 → 直接送（ModifierTriggered）
    const existing = this.sessionHost.dispatch(event)
    if (existing !== 'no-session') return existing

    // ② 没有会话 → 这是第一颗滚轮，照原码在这里「找意图 + 执行 + 开会话」
    if (!directions) return 'needs-directions'

    const candidates = this.deps.store
      .list()
      .filter((b) => b.enabled && b.source === 'gesture' && b.gesture)
    // 三元组要全对上：方向串 + 这颗滚轮作为 modifier
    const matched = candidates.filter(
      (b) => b.gesture!.dirs === directions && b.gesture!.modifier === event
    )
    if (!matched.length) return 'no-binding'

    const records = await this.execute(matched, {
      source: 'gesture',
      pattern: directions,
      directions,
      score: 1
    })
    this.openSessionIfNeeded(matched)
    const failed = records.some((r) => r.status !== 'ok')
    return failed ? 'not-observed' : 'delivered'
  }

  /** 抬手：结束会话（对应 PathTrackerOnPathEnd 里的 GestureEnded()） */
  endSessionOnPathEnd() {
    if (!this.sessionHost.active()) return false
    this.sessionHost.end('path-ended')
    return true
  }

  /** 直接按方向串派发（跳过轨迹识别，便于测试） */
  async dispatchGestureDirections(directions: string): Promise<FiringRecord[]> {
    const candidates = this.deps.store
      .list()
      .filter((binding) => binding.enabled && binding.source === 'gesture')
    const normalized = String(directions ?? '').replace(/\s+/g, '')

    const exact = candidates.filter(
      (binding) => binding.gesture && binding.gesture.dirs === normalized && !binding.gesture.modifier
    )
    if (exact.length) {
      const records = await this.execute(exact, { source: 'gesture', pattern: normalized, directions: normalized, score: 1 })
      this.openSessionIfNeeded(exact)
      return records
    }

    const best = matchPattern(normalized, candidates.map((binding) => binding.pattern), GESTURE_THRESHOLD)
    if (!best) return this.execute([], { source: 'gesture', pattern: normalized })
    const matched = candidates.filter((binding) => binding.pattern === best.pattern)
    const records = await this.execute(matched, { source: 'gesture', pattern: best.pattern, directions: normalized, score: best.score })
    this.openSessionIfNeeded(matched)
    return records
  }

  private async execute(
    bindings: TriggerBinding[],
    meta: { source: TriggerSource; pattern: string; directions?: string; score?: number }
  ): Promise<FiringRecord[]> {
    if (!bindings.length) {
      const record = this.makeRecord(meta, null, 'skipped', `没有匹配的绑定：${meta.pattern}`, 0)
      this.push(record)
      return [record]
    }

    const startedAt = Date.now()
    const records: FiringRecord[] = []
    for (const binding of bindings) {
      const targetStore = binding.targetKind === 'line' ? this.deps.lineStore() : this.deps.pointStore()
      let status: FiringRecord['status'] = 'ok'
      let output = ''
      try {
        const run = await targetStore.run(binding.targetId)
        status = run.status
        output = run.output
        this.deps.store.markFired(binding.id)
      } catch (error) {
        status = 'warn'
        output = error instanceof Error ? error.message : String(error)
      }
      records.push({
        at: startedAt,
        source: meta.source,
        pattern: meta.pattern,
        bindingId: binding.id,
        targetKind: binding.targetKind,
        targetId: binding.targetId,
        status,
        output,
        elapsedMs: Date.now() - startedAt,
        ...(meta.score !== undefined ? { score: meta.score } : {})
      })
    }
    for (const record of records) this.push(record)
    return records
  }

  private makeRecord(
    meta: { source: TriggerSource; pattern: string },
    bindingId: string | null,
    status: FiringRecord['status'],
    output: string,
    elapsedMs: number
  ): FiringRecord {
    return {
      at: Date.now(),
      source: meta.source,
      pattern: meta.pattern,
      bindingId,
      targetKind: null,
      targetId: null,
      status,
      output,
      elapsedMs
    }
  }

  private push(record: FiringRecord): void {
    this.firings.unshift(record)
    if (this.firings.length > MAX_FIRINGS) this.firings.length = MAX_FIRINGS
    try {
      this.deps.onFired?.(record)
    } catch {
      // 推送失败不能影响派发本身
    }
  }
}
