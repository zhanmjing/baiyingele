import { contextBridge, ipcRenderer } from 'electron'
import type { BodyClassSeed, BodyInstanceRecord, BodyRunRecord } from '../shared/bodyCatalog'
import type { FieldClassSeed, FieldInstanceRecord, FieldRunRecord } from '../shared/fieldCatalog'
import type { LineClassSeed, LineInstanceRecord, LineRunRecord } from '../shared/lineCatalog'
import type { SurfaceClassSeed, SurfaceInstanceRecord, SurfaceRunRecord } from '../shared/surfaceCatalog'
import type { RunHistoryItem } from '../shared/runHistory'
import type {
  PointClassSeed,
  PointInstanceRecord,
  PointRunRecord
} from '../shared/pointCatalog'

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

export interface PointRunResult {
  ok: boolean
  runId: string
  classId: string
  instanceId: string
  output: string
  elapsedMs: number
  at: string
}

export interface PointCatalogSnapshot {
  classes: PointClassSeed[]
  instances: PointInstanceRecord[]
}

export interface CreatePointInstancePayload {
  classId: string
  name: string
  description?: string
  params?: Record<string, string>
}

export interface UpdatePointInstancePayload {
  name?: string
  description?: string
  params?: Record<string, string>
  status?: PointInstanceRecord['status']
}

export interface LineCatalogSnapshot {
  classes: LineClassSeed[]
  instances: LineInstanceRecord[]
}

export interface SurfaceCatalogSnapshot {
  classes: SurfaceClassSeed[]
  instances: SurfaceInstanceRecord[]
}

export interface BodyCatalogSnapshot {
  classes: BodyClassSeed[]
  instances: BodyInstanceRecord[]
}

export interface FieldCatalogSnapshot {
  classes: FieldClassSeed[]
  instances: FieldInstanceRecord[]
}

export type CreateFieldInstancePayload = CreatePointInstancePayload
export type UpdateFieldInstancePayload = UpdatePointInstancePayload

export type CreateSurfaceInstancePayload = CreatePointInstancePayload
export type UpdateSurfaceInstancePayload = UpdatePointInstancePayload
export type CreateBodyInstancePayload = CreatePointInstancePayload
export type UpdateBodyInstancePayload = UpdatePointInstancePayload

export type CreateLineInstancePayload = CreatePointInstancePayload
export type UpdateLineInstancePayload = UpdatePointInstancePayload

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  openDataDir: (): Promise<boolean> => ipcRenderer.invoke('app:open-data-dir'),
  getPointCatalog: (): Promise<PointCatalogSnapshot> => ipcRenderer.invoke('point:catalog'),
  getPointRuns: (limit = 20): Promise<PointRunRecord[]> => ipcRenderer.invoke('point:runs', limit),
  getRunHistory: (limit = 100): Promise<RunHistoryItem[]> => ipcRenderer.invoke('runs:history', limit),
  createPointInstance: (input: CreatePointInstancePayload): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke('point:instance:create', input),
  updatePointInstance: (
    instanceId: string,
    patch: UpdatePointInstancePayload
  ): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke('point:instance:update', { instanceId, patch }),
  archivePointInstance: (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke('point:instance:archive', instanceId),
  restorePointInstance: (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke('point:instance:restore', instanceId),
  duplicatePointInstance: (instanceId: string): Promise<PointInstanceRecord> =>
    ipcRenderer.invoke('point:instance:duplicate', instanceId),
  runPoint: (payload: { classId?: string; instanceId: string }): Promise<PointRunResult> =>
    ipcRenderer.invoke('point:run', payload),
  getLineCatalog: (): Promise<LineCatalogSnapshot> => ipcRenderer.invoke('line:catalog'),
  getLineRuns: (limit = 20): Promise<LineRunRecord[]> => ipcRenderer.invoke('line:runs', limit),
  createLineInstance: (input: CreateLineInstancePayload): Promise<LineInstanceRecord> =>
    ipcRenderer.invoke('line:instance:create', input),
  updateLineInstance: (
    instanceId: string,
    patch: UpdateLineInstancePayload
  ): Promise<LineInstanceRecord> =>
    ipcRenderer.invoke('line:instance:update', { instanceId, patch }),
  archiveLineInstance: (instanceId: string): Promise<LineInstanceRecord> =>
    ipcRenderer.invoke('line:instance:archive', instanceId),
  restoreLineInstance: (instanceId: string): Promise<LineInstanceRecord> =>
    ipcRenderer.invoke('line:instance:restore', instanceId),
  duplicateLineInstance: (instanceId: string): Promise<LineInstanceRecord> =>
    ipcRenderer.invoke('line:instance:duplicate', instanceId),
  runLine: (payload: { classId?: string; instanceId: string }): Promise<PointRunResult> =>
    ipcRenderer.invoke('line:run', payload),
  getSurfaceCatalog: (): Promise<SurfaceCatalogSnapshot> => ipcRenderer.invoke('surface:catalog'),
  getSurfaceRuns: (limit = 20): Promise<SurfaceRunRecord[]> => ipcRenderer.invoke('surface:runs', limit),
  createSurfaceInstance: (input: CreateSurfaceInstancePayload): Promise<SurfaceInstanceRecord> =>
    ipcRenderer.invoke('surface:instance:create', input),
  updateSurfaceInstance: (instanceId: string, patch: UpdateSurfaceInstancePayload): Promise<SurfaceInstanceRecord> =>
    ipcRenderer.invoke('surface:instance:update', { instanceId, patch }),
  archiveSurfaceInstance: (instanceId: string): Promise<SurfaceInstanceRecord> =>
    ipcRenderer.invoke('surface:instance:archive', instanceId),
  restoreSurfaceInstance: (instanceId: string): Promise<SurfaceInstanceRecord> =>
    ipcRenderer.invoke('surface:instance:restore', instanceId),
  duplicateSurfaceInstance: (instanceId: string): Promise<SurfaceInstanceRecord> =>
    ipcRenderer.invoke('surface:instance:duplicate', instanceId),
  runSurface: (payload: { classId?: string; instanceId: string }): Promise<PointRunResult> =>
    ipcRenderer.invoke('surface:run', payload),
  getBodyCatalog: (): Promise<BodyCatalogSnapshot> => ipcRenderer.invoke('body:catalog'),
  getBodyRuns: (limit = 20): Promise<BodyRunRecord[]> => ipcRenderer.invoke('body:runs', limit),
  createBodyInstance: (input: CreateBodyInstancePayload): Promise<BodyInstanceRecord> =>
    ipcRenderer.invoke('body:instance:create', input),
  updateBodyInstance: (instanceId: string, patch: UpdateBodyInstancePayload): Promise<BodyInstanceRecord> =>
    ipcRenderer.invoke('body:instance:update', { instanceId, patch }),
  archiveBodyInstance: (instanceId: string): Promise<BodyInstanceRecord> =>
    ipcRenderer.invoke('body:instance:archive', instanceId),
  restoreBodyInstance: (instanceId: string): Promise<BodyInstanceRecord> =>
    ipcRenderer.invoke('body:instance:restore', instanceId),
  duplicateBodyInstance: (instanceId: string): Promise<BodyInstanceRecord> =>
    ipcRenderer.invoke('body:instance:duplicate', instanceId),
  runBody: (payload: { classId?: string; instanceId: string }): Promise<PointRunResult> =>
    ipcRenderer.invoke('body:run', payload),
  getFieldCatalog: (): Promise<FieldCatalogSnapshot> => ipcRenderer.invoke('field:catalog'),
  getFieldRuns: (limit = 20): Promise<FieldRunRecord[]> => ipcRenderer.invoke('field:runs', limit),
  createFieldInstance: (input: CreateFieldInstancePayload): Promise<FieldInstanceRecord> =>
    ipcRenderer.invoke('field:instance:create', input),
  updateFieldInstance: (instanceId: string, patch: UpdateFieldInstancePayload): Promise<FieldInstanceRecord> =>
    ipcRenderer.invoke('field:instance:update', { instanceId, patch }),
  archiveFieldInstance: (instanceId: string): Promise<FieldInstanceRecord> =>
    ipcRenderer.invoke('field:instance:archive', instanceId),
  restoreFieldInstance: (instanceId: string): Promise<FieldInstanceRecord> =>
    ipcRenderer.invoke('field:instance:restore', instanceId),
  duplicateFieldInstance: (instanceId: string): Promise<FieldInstanceRecord> =>
    ipcRenderer.invoke('field:instance:duplicate', instanceId),
  runField: (payload: { classId?: string; instanceId: string }): Promise<PointRunResult> =>
    ipcRenderer.invoke('field:run', payload)


}

contextBridge.exposeInMainWorld('baiying', api)

export type BaiyingApi = typeof api
