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
  ...layerApi
}

contextBridge.exposeInMainWorld('baiying', api)

export type BaiyingApi = typeof api
