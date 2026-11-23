/**
 * 触发器服务：把「输入被触发」接到「跑哪个实例」。
 *
 * 对应 design/overview/INPUT-TRIGGER-CLASSES.md：
 *   InputEvent → InputPattern(命中) → InputBinding(作用域/目标) → PointInstance / FlowInstance
 *
 * 两种 source 共用同一条 dispatch：
 *   hotkey  —— uiohook-napi 全局钩子，组合键**精确**匹配
 *   gesture —— 渲染层送来轨迹，识别成方向串后**模糊**匹配（编辑距离 ≥ 阈值）
 */
import { onFiring, parseCombo, registerCombo, registeredCombos } from './capabilities/win.key.trigger'
import { matchPattern, recognize, type GesturePoint } from '../shared/gestureRecognizer'
import type { LayerStore } from './layerStore'
import type { TriggerBinding, TriggerSource, TriggerStore, TriggerTargetKind } from './triggerStore'

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
  pattern: string
  targetKind: TriggerTargetKind
  targetId: string
  note?: string
  enabled?: boolean
}

export interface TriggerServiceDeps {
  store: TriggerStore
  pointStore: () => LayerStore
  lineStore: () => LayerStore
}

const MAX_FIRINGS = 50
const GESTURE_THRESHOLD = 0.75
const GESTURE_PATTERN = /^(U|D|L|R|UR|DR|DL|UL)+$/

export class TriggerService {
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
      pattern = String(input.pattern ?? '').toUpperCase().replace(/\s+/g, '')
      if (!pattern || !GESTURE_PATTERN.test(pattern)) {
        return { ok: false, message: `手势模式不合法：${input.pattern}（应为方向串，如 LDR / UD / DLU）` }
      }
    }

    const targetStore = input.targetKind === 'line' ? this.deps.lineStore() : this.deps.pointStore()
    if (!targetStore.instance(input.targetId)) {
      return { ok: false, message: `目标实例不存在：${input.targetKind}:${input.targetId}` }
    }

    const binding = this.deps.store.upsert({
      id: `${input.source}:${pattern}→${input.targetId}`,
      source: input.source,
      pattern,
      targetKind: input.targetKind,
      targetId: input.targetId,
      enabled: input.enabled ?? true,
      note: input.note ?? ''
    })
    this.sync()
    return { ok: true, binding }
  }

  remove(id: string): boolean {
    const removed = this.deps.store.remove(id)
    if (removed) this.sync()
    return removed
  }

  /** 热键路径（模拟真实按键，走完全相同的一跳） */
  async dispatchHotkey(combo: string): Promise<FiringRecord[]> {
    const parsed = parseCombo(combo)
    const pattern = parsed ? parsed.label : combo
    const matched = this.deps.store
      .list()
      .filter((binding) => binding.enabled && binding.source === 'hotkey' && binding.pattern === pattern)
    return this.execute(matched, { source: 'hotkey', pattern })
  }

  /** 手势路径：先识别，再在启用的手势绑定里挑最像的一个 */
  async dispatchGesturePoints(points: GesturePoint[]): Promise<{ directions: string; valid: boolean; reason?: string; records: FiringRecord[] }> {
    const result = recognize(points)
    if (!result.valid) {
      return { directions: '', valid: false, reason: result.reason, records: [] }
    }

    const candidates = this.deps.store
      .list()
      .filter((binding) => binding.enabled && binding.source === 'gesture')
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

  /** 直接按方向串派发（跳过轨迹识别，便于测试） */
  async dispatchGestureDirections(directions: string): Promise<FiringRecord[]> {
    const candidates = this.deps.store
      .list()
      .filter((binding) => binding.enabled && binding.source === 'gesture')
    const best = matchPattern(directions.toUpperCase(), candidates.map((binding) => binding.pattern), GESTURE_THRESHOLD)
    if (!best) return this.execute([], { source: 'gesture', pattern: directions.toUpperCase() })
    const matched = candidates.filter((binding) => binding.pattern === best.pattern)
    return this.execute(matched, { source: 'gesture', pattern: best.pattern, directions: directions.toUpperCase(), score: best.score })
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
  }
}
