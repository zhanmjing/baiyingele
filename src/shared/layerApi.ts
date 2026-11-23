/**
 * 五层 IPC 契约的唯一类型定义。
 *
 * preload 的实现、渲染层 window.baiying 的声明都从这里派生，
 * 因此方法名写错会在 typecheck 阶段直接暴露，而不是运行时才 undefined。
 */
import type { LayerKey } from './layerKeys'
import type { PointClassSeed, PointInstanceRecord, PointRunRecord } from './pointCatalog'

export interface LayerCatalogSnapshot {
  classes: PointClassSeed[]
  instances: PointInstanceRecord[]
}

export interface CreateInstancePayload {
  classId: string
  name: string
  description?: string
  params?: Record<string, string>
}

export interface UpdateInstancePayload {
  name?: string
  description?: string
  params?: Record<string, string>
  status?: PointInstanceRecord['status']
}

export interface RunPayload {
  classId?: string
  instanceId: string
}

export interface RunResult {
  ok: boolean
  runId: string
  classId: string
  instanceId: string
  output: string
  elapsedMs: number
  at: string
}

/** 由层名映射出 getPointCatalog / runPoint 这类方法名 */
export type LayerApi = {
  [K in LayerKey as `get${Capitalize<K>}Catalog`]: () => Promise<LayerCatalogSnapshot>
} & {
  [K in LayerKey as `get${Capitalize<K>}Runs`]: (limit?: number) => Promise<PointRunRecord[]>
} & {
  [K in LayerKey as `create${Capitalize<K>}Instance`]: (
    input: CreateInstancePayload
  ) => Promise<PointInstanceRecord>
} & {
  [K in LayerKey as `update${Capitalize<K>}Instance`]: (
    instanceId: string,
    patch: UpdateInstancePayload
  ) => Promise<PointInstanceRecord>
} & {
  [K in LayerKey as `archive${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<PointInstanceRecord>
} & {
  [K in LayerKey as `restore${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<PointInstanceRecord>
} & {
  [K in LayerKey as `duplicate${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<PointInstanceRecord>
} & {
  [K in LayerKey as `run${Capitalize<K>}`]: (payload: RunPayload) => Promise<RunResult>
}
