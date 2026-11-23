/**
 * 触发器服务：把「输入被触发」接到「跑哪个实例」。
 *
 * 对应 design/overview/INPUT-TRIGGER-CLASSES.md 的最后一段：
 *   InputEvent → InputPattern(命中) → InputBinding(作用域/目标) → PointInstance / FlowInstance
 *
 * 目前只接了键盘组合这一种 source；手势那套可以复用同一个 dispatch（pattern 换成方向序列即可）。
 */
import { onFiring, parseCombo, registerCombo, registeredCombos } from './capabilities/win.key.trigger'
import type { LayerStore } from './layerStore'
import type { TriggerBinding, TriggerStore, TriggerTargetKind } from './triggerStore'

export interface FiringRecord {
  at: number
  combo: string
  bindingId: string | null
  targetKind: TriggerTargetKind | null
  targetId: string | null
  status: 'ok' | 'warn' | 'skipped'
  output: string
  elapsedMs: number
}

export interface AddTriggerInput {
  combo: string
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

export class TriggerService {
  private readonly firings: FiringRecord[] = []
  private unsubscribe: (() => void) | null = null

  constructor(private readonly deps: TriggerServiceDeps) {}

  /** 订阅钩子事件并把已有绑定挂上去；返回本次实际生效的组合 */
  start(): { combos: string[]; failures: string[] } {
    this.unsubscribe?.()
    this.unsubscribe = onFiring((combo) => {
      void this.dispatch(combo)
    })
    return this.sync()
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** 把 enabled 的绑定重新注册到钩子上（新增/删除/启停后调用） */
  sync(): { combos: string[]; failures: string[] } {
    const failures: string[] = []
    for (const binding of this.deps.store.list()) {
      if (!binding.enabled) continue
      const parsed = parseCombo(binding.combo)
      if (!parsed) {
        failures.push(`${binding.id}: 组合键无法解析 ${binding.combo}`)
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
    const parsed = parseCombo(input.combo)
    if (!parsed) return { ok: false, message: `组合键无法解析：${input.combo}` }

    const targetStore = input.targetKind === 'line' ? this.deps.lineStore() : this.deps.pointStore()
    if (!targetStore.instance(input.targetId)) {
      return { ok: false, message: `目标实例不存在：${input.targetKind}:${input.targetId}` }
    }

    const binding = this.deps.store.upsert({
      id: `${parsed.label}→${input.targetId}`,
      combo: parsed.label,
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

  /**
   * 直接派发一次（不经过键盘）。用于测试与「手动触发」按钮——
   * 走的是和真实按键完全相同的 dispatch 路径。
   */
  async simulate(combo: string): Promise<FiringRecord[]> {
    const parsed = parseCombo(combo)
    return this.dispatch(parsed ? parsed.label : combo)
  }

  private async dispatch(combo: string): Promise<FiringRecord[]> {
    const startedAt = Date.now()
    const matched = this.deps.store.list().filter((binding) => binding.enabled && binding.combo === combo)

    if (!matched.length) {
      const record: FiringRecord = {
        at: startedAt,
        combo,
        bindingId: null,
        targetKind: null,
        targetId: null,
        status: 'skipped',
        output: `没有匹配的绑定：${combo}`,
        elapsedMs: 0
      }
      this.push(record)
      return [record]
    }

    const records: FiringRecord[] = []
    for (const binding of matched) {
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
        combo,
        bindingId: binding.id,
        targetKind: binding.targetKind,
        targetId: binding.targetId,
        status,
        output,
        elapsedMs: Date.now() - startedAt
      })
    }

    for (const record of records) this.push(record)
    return records
  }

  private push(record: FiringRecord): void {
    this.firings.unshift(record)
    if (this.firings.length > MAX_FIRINGS) this.firings.length = MAX_FIRINGS
  }
}
