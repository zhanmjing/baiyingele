import { contextBridge, ipcRenderer } from 'electron'
import type { RunHistoryItem } from '../shared/runHistory'
import type {
  CreateInstancePayload,
  LayerCatalogSnapshot,
  RunPayload,
  RunResult,
  UpdateInstancePayload
} from '../shared/layerApi'
import { LAYER_KEYS, layerMethodSuffix } from '../shared/layerKeys'
import type { PointInstanceRecord, PointRunRecord } from '../shared/pointCatalog'

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  dev: boolean
  dataDir: string
}

/**
 * 五层方法按层名循环生成：新增一层不需要改这个文件。
 * 方法名的类型契约在 src/shared/layerApi.ts，渲染层声明在 index.d.ts。
 */
const layerApi: Record<string, (...args: never[]) => Promise<unknown>> = {}

for (const key of LAYER_KEYS) {
  const suffix = layerMethodSuffix(key)

  layerApi[`get${suffix}Catalog`] = (): Promise<LayerCatalogSnapshot> =>
    ipcRenderer.invoke(`${key}:catalog`)
  layerApi[`get${suffix}Runs`] = (limit = 20): Promise<PointRunRecord[]> =>
    ipcRenderer.invoke(`${key}:runs`, limit)
  layerApi[`get${suffix}Corruption`] = (): Promise<{ backup: string } | null> =>
    ipcRenderer.invoke(`${key}:corruption`)
  layerApi[`create${suffix}Instance`] = (input: CreateInstancePayload): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke(`${key}:instance:create`, input)
  layerApi[`update${suffix}Instance`] = (
    instanceId: string,
    patch: UpdateInstancePayload
  ): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke(`${key}:instance:update`, { instanceId, patch })
  layerApi[`archive${suffix}Instance`] = (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke(`${key}:instance:archive`, instanceId)
  layerApi[`restore${suffix}Instance`] = (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke(`${key}:instance:restore`, instanceId)
  layerApi[`duplicate${suffix}Instance`] = (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke(`${key}:instance:duplicate`, instanceId)
  layerApi[`run${suffix}`] = (payload: RunPayload): Promise<RunResult> =>
    ipcRenderer.invoke(`${key}:run`, payload)
}

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  openDataDir: (): Promise<boolean> => ipcRenderer.invoke('app:open-data-dir'),
  /** 在文件管理器里定位并选中一个文件（只允许数据目录内） */
  reveal: (target: string): Promise<boolean> => ipcRenderer.invoke('app:reveal', target),
  getRunHistory: (limit = 100): Promise<RunHistoryItem[]> =>
    ipcRenderer.invoke('runs:history', limit),
  undoFieldLanding: (token: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('field:undo', token),
  getTriggers: (): Promise<{
    bindings: unknown[]
    firings: unknown[]
    combos: string[]
    failures: string[]
  }> => ipcRenderer.invoke('trigger:list'),
  addTrigger: (input: unknown): Promise<unknown> => ipcRenderer.invoke('trigger:add', input),
  removeTrigger: (id: string): Promise<boolean> => ipcRenderer.invoke('trigger:remove', id),
  simulateTrigger: (combo: string): Promise<unknown[]> => ipcRenderer.invoke('trigger:simulate', combo),
  dispatchGesture: (points: { x: number; y: number; t?: number }[]): Promise<unknown> =>
    ipcRenderer.invoke('trigger:gesture', points),
  onFormRequest: (callback: (request: unknown) => void): (() => void) => {
    const handler = (_event: unknown, request: unknown): void => callback(request)
    ipcRenderer.on('ui:form:request', handler)
    return () => ipcRenderer.removeListener('ui:form:request', handler)
  },
  resolveForm: (requestId: string, answer: unknown): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('ui:form:resolve', requestId, answer),
  /** 轨迹开始：给笔迹层，清画布 */
  onGestureTrailStart: (callback: (payload: unknown) => void): (() => void) => {
    const h = (_e: unknown, p: unknown): void => callback(p)
    ipcRenderer.on('gesture:trail-start', h)
    return () => ipcRenderer.removeListener('gesture:trail-start', h)
  },
  /** 单个新点（逐点流式，不再每帧发整个数组） */
  onGestureTrailPoint: (callback: (payload: unknown) => void): (() => void) => {
    const h = (_e: unknown, p: unknown): void => callback(p)
    ipcRenderer.on('gesture:trail-point', h)
    return () => ipcRenderer.removeListener('gesture:trail-point', h)
  },
  /** 换笔：识别成功后只换颜色，不重发点 */
  onGestureTrailPen: (callback: (payload: unknown) => void): (() => void) => {
    const h = (_e: unknown, p: unknown): void => callback(p)
    ipcRenderer.on('gesture:trail-pen', h)
    return () => ipcRenderer.removeListener('gesture:trail-pen', h)
  },
  /** 轨迹结束：清画布 */
  onGestureTrailEnd: (callback: () => void): (() => void) => {
    const h = (): void => callback()
    ipcRenderer.on('gesture:trail-end', h)
    return () => ipcRenderer.removeListener('gesture:trail-end', h)
  },
  /** 手势轨迹浮层（旧的全量接口，保留兼容） */
  onGestureTrail: (callback: (trail: unknown) => void): (() => void) => {
    const handler = (_event: unknown, trail: unknown): void => callback(trail)
    ipcRenderer.on('gesture:trail', handler)
    return () => ipcRenderer.removeListener('gesture:trail', handler)
  },
  /** 手势动作提示（surface.gesture_hint） */
  onGestureHint: (callback: (hint: unknown) => void): (() => void) => {
    const handler = (_event: unknown, hint: unknown): void => callback(hint)
    ipcRenderer.on('gesture:hint', handler)
    return () => ipcRenderer.removeListener('gesture:hint', handler)
  },
  onTriggerFired: (callback: (record: unknown) => void): (() => void) => {
    const handler = (_event: unknown, record: unknown): void => callback(record)
    ipcRenderer.on('trigger:fired', handler)
    return () => ipcRenderer.removeListener('trigger:fired', handler)
  },
  ...layerApi
}

contextBridge.exposeInMainWorld('baiying', api)

export type BaiyingApi = typeof api
