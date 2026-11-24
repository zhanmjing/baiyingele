/**
 * 五层共用的实例 / 运行记录存储。
 *
 * 原先是 pointStore / lineStore / surfaceStore / bodyStore / fieldStore 五份
 * 逐字相同的复制（各 236 行，差异只有 OUTPUTS 映射与类名），这里收敛成一份：
 * 层差异全部来自 layerRegistry 的 LayerDef，行为差异全部来自注入的 runner。
 *
 * 持久化格式保持 `{ version: 1, instances, runs }`，与旧 state 文件完全兼容。
 */
import { stringParams } from '../shared/layerTypes'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PointClassSeed, PointInstanceRecord, PointRunRecord } from '../shared/pointCatalog'
import type { LayerDef } from './layerRegistry'

export interface LayerStoreState {
  version: 1
  instances: PointInstanceRecord[]
  runs: PointRunRecord[]
}

export interface CreateInstanceInput {
  classId: string
  name: string
  description?: string
  params?: Record<string, string>
}

export interface UpdateInstanceInput {
  name?: string
  description?: string
  params?: Record<string, string>
  status?: PointInstanceRecord['status']
}

export interface RunOutcome {
  status: PointRunRecord['status']
  /** 人类可读摘要，写入运行历史 */
  output: string
  elapsedMs: number
  /** 原始输出，供线层把上一个节点的结果传给下一个节点（不写入历史） */
  value?: string
  /** 可解释性证据（场层要求 reason + evidence），会随运行记录持久化 */
  evidence?: Record<string, unknown>
  /** 场层落点：由 fieldRuntime 按自主度决定要不要真写进去 */
  landing?: import('../shared/fieldLanding').FieldLanding
}

/** 跨层/跨节点传入的执行上下文（线层给每个节点套用映射时用） */
export interface RunExtras {
  input?: string
  args?: Record<string, string>
  params?: Record<string, string>
}

export interface RunContext {
  def: LayerDef
  instance: PointInstanceRecord
  pointClass: PointClassSeed
  /** 生效参数：实例参数叠加本次映射后的结果 */
  params: Record<string, string>
  input?: string
  args?: Record<string, string>
  /** 按实例 id 取同层内其他实例，供线层解析节点绑定用 */
  findInstance: (instanceId: string) => PointInstanceRecord | undefined
}

export type InstanceRunner = (context: RunContext) => Promise<RunOutcome> | RunOutcome

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'instance'
  )
}

/** 默认 runner：保留旧的模拟行为，真实实现由 capabilities.ts 注入覆盖 */
export const mockRunner: InstanceRunner = ({ def, instance }) => ({
  status: 'ok',
  output: def.outputs[instance.classId] ?? `执行完成 · ${instance.name}`,
  elapsedMs: 38 + Math.floor(Math.random() * 240)
})

export class LayerStore {
  private readonly filePath: string
  private readonly def: LayerDef
  private readonly runner: InstanceRunner
  private state: LayerStoreState

  constructor(filePath: string, def: LayerDef, runner: InstanceRunner = mockRunner) {
    this.filePath = filePath
    this.def = def
    this.runner = runner
    this.state = this.load()

    // 增量补齐：只为「一条实例都没有」的类补种子实例。
    // 旧实现是「类数量不足就整层重灌」——新增一个类会把用户所有本地实例（含改过的参数与归档状态）清空，
    // 而在快速加能力阶段每加一个类都会触发它。
    if (this.backfillMissingClasses()) this.save()
  }

  /** 返回是否补过东西 */
  private backfillMissingClasses(): boolean {
    const covered = new Set(this.state.instances.map((instance) => instance.classId))
    const missing = this.def.classes.filter((pointClass) => !covered.has(pointClass.id))
    if (!missing.length) return false

    const stamp = Date.now()
    const seeded = missing.flatMap((pointClass) =>
      pointClass.instances.map((instance) => ({
        ...instance,
        classId: pointClass.id,
        params: { ...(instance.params ?? {}) },
        createdAt: stamp,
        updatedAt: stamp
      }))
    )
    this.state = { ...this.state, instances: [...this.state.instances, ...seeded] }
    return true
  }

  private seedInstances(): PointInstanceRecord[] {
    const stamp = Date.now()
    return this.def.classes.flatMap((pointClass) =>
      pointClass.instances.map((instance) => ({
        ...instance,
        classId: pointClass.id,
        params: { ...(instance.params ?? {}) },
        createdAt: stamp,
        updatedAt: stamp
      }))
    )
  }

  private seedState(): LayerStoreState {
    return { version: 1, instances: this.seedInstances(), runs: [] }
  }

  private load(): LayerStoreState {
    try {
      if (!existsSync(this.filePath)) return this.seedState()
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<LayerStoreState>
      if (!Array.isArray(parsed.instances) || !Array.isArray(parsed.runs)) return this.seedState()
      return {
        version: 1,
        instances: parsed.instances.map((instance) => ({
          ...instance,
          classId: instance.classId,
          params: { ...(instance.params ?? {}) },
          createdAt: instance.createdAt ?? Date.now(),
          updatedAt: instance.updatedAt ?? Date.now()
        })),
        runs: parsed.runs
      }
    } catch {
      return this.seedState()
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(temp, this.filePath)
  }

  private pointClass(classId: string): PointClassSeed | undefined {
    return this.def.classes.find((item) => item.id === classId)
  }

  instance(instanceId: string): PointInstanceRecord | undefined {
    return this.state.instances.find((item) => item.id === instanceId)
  }

  catalog(): { classes: PointClassSeed[]; instances: PointInstanceRecord[] } {
    return { classes: this.def.classes, instances: this.state.instances }
  }

  runs(limit = 20): PointRunRecord[] {
    return this.state.runs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(limit, 100)))
  }

  create(input: CreateInstanceInput): PointInstanceRecord {
    const pointClass = this.pointClass(input.classId)
    if (!pointClass) throw new Error(`未知 ${this.def.classLabel}: ${input.classId}`)
    const name = input.name.trim()
    if (!name) throw new Error('实例名称不能为空')

    const base = `${pointClass.id}.${slug(name)}`
    let id = `${base}@r1`
    let suffix = 2
    while (this.instance(id)) {
      id = `${base}-${suffix}@r1`
      suffix += 1
    }

    const stamp = Date.now()
    const record: PointInstanceRecord = {
      id,
      classId: pointClass.id,
      name,
      description: input.description?.trim() ?? '',
      params: { ...(input.params ?? {}) },
      status: 'draft',
      rev: 1,
      createdAt: stamp,
      updatedAt: stamp
    }
    this.state.instances.push(record)
    this.save()
    return record
  }

  update(instanceId: string, patch: UpdateInstanceInput): PointInstanceRecord {
    const current = this.instance(instanceId)
    if (!current) throw new Error(`实例不存在: ${instanceId}`)
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('实例名称不能为空')

    const updated: PointInstanceRecord = {
      ...current,
      name: patch.name?.trim() ?? current.name,
      description: patch.description?.trim() ?? current.description,
      params: patch.params ? { ...current.params, ...patch.params } : current.params,
      status: patch.status ?? current.status,
      rev: current.rev + 1,
      updatedAt: Date.now()
    }
    this.state.instances = this.state.instances.map((item) => (item.id === instanceId ? updated : item))
    this.save()
    return updated
  }

  archive(instanceId: string): PointInstanceRecord {
    return this.update(instanceId, { status: 'archived' })
  }

  restore(instanceId: string): PointInstanceRecord {
    return this.update(instanceId, { status: 'active' })
  }

  duplicate(instanceId: string): PointInstanceRecord {
    const source = this.instance(instanceId)
    if (!source) throw new Error(`实例不存在: ${instanceId}`)
    const base = source.id.replace(/@r\d+$/, '')
    let id = `${base}-copy@r1`
    let suffix = 2
    while (this.instance(id)) {
      id = `${base}-copy-${suffix}@r1`
      suffix += 1
    }
    const stamp = Date.now()
    const copy: PointInstanceRecord = {
      ...source,
      id,
      name: `${source.name} 副本`,
      status: 'draft',
      rev: 1,
      createdAt: stamp,
      updatedAt: stamp,
      params: { ...source.params }
    }
    this.state.instances.push(copy)
    this.save()
    return copy
  }

  async run(instanceId: string, extras: RunExtras = {}): Promise<PointRunRecord> {
    return (await this.runDetailed(instanceId, extras)).record
  }

  /** 与 run 相同，但把原始输出 value 一并返回给调用方（线层要用它串联节点） */
  async runDetailed(
    instanceId: string,
    extras: RunExtras = {}
  ): Promise<{ record: PointRunRecord; outcome: RunOutcome }> {
    const instance = this.instance(instanceId)
    if (!instance) throw new Error(`实例不存在: ${instanceId}`)
    if (instance.status === 'archived') throw new Error(`实例已归档: ${instance.name}`)
    const pointClass = this.pointClass(instance.classId)
    if (!pointClass) throw new Error(`未知 ${this.def.classLabel}: ${instance.classId}`)

    const started = Date.now()
    const outcome = await this.runner({
      def: this.def,
      instance,
      pointClass,
      params: { ...stringParams(instance.params), ...(extras.params ?? {}) },
      input: extras.input,
      args: extras.args,
      findInstance: (id) => this.instance(id)
    })
    const record: PointRunRecord = {
      id: `run-${started}-${Math.floor(Math.random() * 900 + 100)}`,
      classId: instance.classId,
      instanceId: instance.id,
      status: outcome.status,
      output: outcome.output,
      elapsedMs: outcome.elapsedMs,
      createdAt: started,
      ...(outcome.evidence ? { evidence: outcome.evidence } : {})
    }
    this.state.runs = [record, ...this.state.runs].slice(0, 200)
    this.save()
    return { record, outcome }
  }
}
