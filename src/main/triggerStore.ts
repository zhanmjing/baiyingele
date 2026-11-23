/**
 * 触发器绑定的持久化。
 *
 * 一条绑定 = 「按了什么组合」+「跑哪个实例」。
 * 这和 surface 层的 GestureBinding 是同构的（pattern → target），
 * 区别是这里的 pattern 是键盘组合，且由主进程在钩子命中时直接派发。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type TriggerTargetKind = 'point' | 'line'

export interface TriggerBinding {
  id: string
  combo: string
  targetKind: TriggerTargetKind
  targetId: string
  enabled: boolean
  note: string
  fireCount: number
  lastFiredAt: number | null
}

interface TriggerState {
  version: 1
  bindings: TriggerBinding[]
}

export class TriggerStore {
  private readonly filePath: string
  private state: TriggerState

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
  }

  private load(): TriggerState {
    try {
      if (!existsSync(this.filePath)) return { version: 1, bindings: [] }
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<TriggerState>
      return { version: 1, bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [] }
    } catch {
      return { version: 1, bindings: [] }
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
