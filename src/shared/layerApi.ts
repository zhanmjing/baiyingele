/**
 * 五层 IPC 契约的唯一类型定义。
 *
 * preload 的实现、渲染层 window.baiying 的声明都从这里派生，
 * 因此方法名写错会在 typecheck 阶段直接暴露，而不是运行时才 undefined。
 */
import type { LayerKey } from './layerKeys'
import type {
  LayerClassSeed,
  LayerInstanceRecord,
  LayerRunRecord,
  LayerStatus
} from './layerTypes'

export interface LayerCatalogSnapshot {
  classes: LayerClassSeed[]
  instances: LayerInstanceRecord[]
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
  status?: LayerStatus
}

export interface RunPayload {
  classId?: string
  instanceId: string
}

/**
 * 运行语义。入口统一为 `run<Layer>`（自动化友好），
 * 但五层做的事不是一回事，靠这个字段区分，避免把 render 当成 execute。
 */
export type RunKind = 'execute' | 'render' | 'assemble' | 'advise'

export const RUN_KIND_OF: Record<LayerKey, RunKind> = {
  point: 'execute',
  line: 'execute',
  surface: 'render',
  body: 'assemble',
  field: 'advise'
}

export interface RunResult {
  ok: boolean
  /** 这次跑的是哪一层 */
  layer: LayerKey
  /** 这次跑的语义：execute / render / assemble / advise */
  kind: RunKind
  runId: string
  classId: string
  instanceId: string
  output: string
  elapsedMs: number
  at: string
  evidence?: Record<string, unknown>
}

/** 由层名映射出 getPointCatalog / runPoint 这类方法名 */
export type LayerApi = {
  [K in LayerKey as `get${Capitalize<K>}Catalog`]: () => Promise<LayerCatalogSnapshot>
} & {
  [K in LayerKey as `get${Capitalize<K>}Runs`]: (limit?: number) => Promise<LayerRunRecord[]>
} & {
  [K in LayerKey as `create${Capitalize<K>}Instance`]: (
    input: CreateInstancePayload
  ) => Promise<LayerInstanceRecord>
} & {
  [K in LayerKey as `update${Capitalize<K>}Instance`]: (
    instanceId: string,
    patch: UpdateInstancePayload
  ) => Promise<LayerInstanceRecord>
} & {
  [K in LayerKey as `archive${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<LayerInstanceRecord>
} & {
  [K in LayerKey as `restore${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<LayerInstanceRecord>
} & {
  [K in LayerKey as `duplicate${Capitalize<K>}Instance`]: (
    instanceId: string
  ) => Promise<LayerInstanceRecord>
} & {
  [K in LayerKey as `run${Capitalize<K>}`]: (payload: RunPayload) => Promise<RunResult>
}
