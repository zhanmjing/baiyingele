import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  bodyClassesSeed,
  type BodyClassSeed,
  type BodyInstanceRecord,
  type BodyRunRecord
} from '../shared/bodyCatalog'

interface BodyStoreState {
  version: 1
  instances: BodyInstanceRecord[]
  runs: BodyRunRecord[]
}

export interface CreateBodyInstanceInput {
  classId: string
  name: string
  description?: string
  params?: Record<string, string>
}

export interface UpdateBodyInstanceInput {
  name?: string
  description?: string
  params?: Record<string, string>
  status?: BodyInstanceRecord['status']
}

const OUTPUTS: Record<string, string> = {
  'body.file-preview': '文件预览已加载 · 3 个文件',
  'body.ocr': 'OCR 识别完成 · confidence 0.91',
  'body.batch-rename': '批量重命名预览完成 · 12 个文件'
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'instance'
  )
}

function now(): number {
  return Date.now()
}

function seedState(): BodyStoreState {
  const stamp = now()
  return {
    version: 1,
    instances: bodyClassesSeed.flatMap((lineClass) =>
      lineClass.instances.map((instance) => ({
        ...instance,
        classId: lineClass.id,
        params: { ...(instance.params ?? {}) },
        createdAt: stamp,
        updatedAt: stamp
      }))
    ),
    runs: []
  }
}

export class BodyStore {
  private readonly filePath: string
  private state: BodyStoreState

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
    const currentClassCount = new Set(this.state.instances.map((instance) => instance.classId)).size
    if (currentClassCount < bodyClassesSeed.length) {
      this.state = { ...this.state, instances: seedState().instances }
      this.save()
    }
  }

  private load(): BodyStoreState {
    try {
      if (!existsSync(this.filePath)) return seedState()
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<BodyStoreState>
      if (!Array.isArray(parsed.instances) || !Array.isArray(parsed.runs)) return seedState()
      return {
        version: 1,
        instances: parsed.instances.map((instance) => ({
          ...instance,
          classId: instance.classId,
          params: { ...(instance.params ?? {}) },
          createdAt: instance.createdAt ?? now(),
          updatedAt: instance.updatedAt ?? now()
        })),
        runs: parsed.runs
      }
    } catch {
      return seedState()
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(temp, this.filePath)
  }

  private lineClass(classId: string): BodyClassSeed | undefined {
    return bodyClassesSeed.find((item) => item.id === classId)
  }

  private instance(instanceId: string): BodyInstanceRecord | undefined {
    return this.state.instances.find((item) => item.id === instanceId)
  }

  catalog(): { classes: BodyClassSeed[]; instances: BodyInstanceRecord[] } {
    return {
      classes: bodyClassesSeed,
      instances: this.state.instances
    }
  }

  runs(limit = 20): BodyRunRecord[] {
    return this.state.runs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(limit, 100)))
  }

  create(input: CreateBodyInstanceInput): BodyInstanceRecord {
    const lineClass = this.lineClass(input.classId)
    if (!lineClass) throw new Error(`未知 BodyClass: ${input.classId}`)
    const name = input.name.trim()
    if (!name) throw new Error('实例名称不能为空')

    const base = `${lineClass.id}.${slug(name)}`
    let id = `${base}@r1`
    let suffix = 2
    while (this.instance(id)) {
      id = `${base}-${suffix}@r1`
      suffix += 1
    }

    const stamp = now()
    const record: BodyInstanceRecord = {
      id,
      classId: lineClass.id,
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

  update(instanceId: string, patch: UpdateBodyInstanceInput): BodyInstanceRecord {
    const current = this.instance(instanceId)
    if (!current) throw new Error(`实例不存在: ${instanceId}`)
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('实例名称不能为空')

    const updated: BodyInstanceRecord = {
      ...current,
      name: patch.name?.trim() ?? current.name,
      description: patch.description?.trim() ?? current.description,
      params: patch.params ? { ...current.params, ...patch.params } : current.params,
      status: patch.status ?? current.status,
      rev: current.rev + 1,
      updatedAt: now()
    }
    this.state.instances = this.state.instances.map((item) => (item.id === instanceId ? updated : item))
    this.save()
    return updated
  }

  archive(instanceId: string): BodyInstanceRecord {
    return this.update(instanceId, { status: 'archived' })
  }

  restore(instanceId: string): BodyInstanceRecord {
    return this.update(instanceId, { status: 'active' })
  }

  duplicate(instanceId: string): BodyInstanceRecord {
    const source = this.instance(instanceId)
    if (!source) throw new Error(`实例不存在: ${instanceId}`)
    const base = source.id.replace(/@r\d+$/, '')
    let id = `${base}-copy@r1`
    let suffix = 2
    while (this.instance(id)) {
      id = `${base}-copy-${suffix}@r1`
      suffix += 1
    }
    const stamp = now()
    const copy: BodyInstanceRecord = {
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

  run(instanceId: string): BodyRunRecord {
    const instance = this.instance(instanceId)
    if (!instance) throw new Error(`实例不存在: ${instanceId}`)
    if (instance.status === 'archived') throw new Error(`实例已归档: ${instance.name}`)
    const lineClass = this.lineClass(instance.classId)
    if (!lineClass) throw new Error(`未知 BodyClass: ${instance.classId}`)

    const started = now()
    const record: BodyRunRecord = {
      id: `run-${started}-${Math.floor(Math.random() * 900 + 100)}`,
      classId: instance.classId,
      instanceId: instance.id,
      status: 'ok',
      output: OUTPUTS[instance.classId] ?? `执行完成 · ${instance.name}`,
      elapsedMs: 38 + Math.floor(Math.random() * 240),
      createdAt: started
    }
    this.state.runs = [record, ...this.state.runs].slice(0, 200)
    this.save()
    return record
  }
}
