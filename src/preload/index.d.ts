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

declare global {
  interface Window {
    baiying: {
      getAppInfo: () => Promise<AppInfo>
      openDataDir: () => Promise<boolean>
      getPointCatalog: () => Promise<PointCatalogSnapshot>
      getPointRuns: (limit?: number) => Promise<PointRunRecord[]>
      getRunHistory: (limit?: number) => Promise<RunHistoryItem[]>
      createPointInstance: (input: CreatePointInstancePayload) => Promise<PointInstanceRecord>
      updatePointInstance: (
        instanceId: string,
        patch: UpdatePointInstancePayload
      ) => Promise<PointInstanceRecord>
      archivePointInstance: (instanceId: string) => Promise<PointInstanceRecord>
      restorePointInstance: (instanceId: string) => Promise<PointInstanceRecord>
      duplicatePointInstance: (instanceId: string) => Promise<PointInstanceRecord>
      runPoint: (payload: { classId?: string; instanceId: string }) => Promise<PointRunResult>
      getLineCatalog: () => Promise<LineCatalogSnapshot>
      getLineRuns: (limit?: number) => Promise<LineRunRecord[]>
      createLineInstance: (input: CreateLineInstancePayload) => Promise<LineInstanceRecord>
      updateLineInstance: (
        instanceId: string,
        patch: UpdateLineInstancePayload
      ) => Promise<LineInstanceRecord>
      archiveLineInstance: (instanceId: string) => Promise<LineInstanceRecord>
      restoreLineInstance: (instanceId: string) => Promise<LineInstanceRecord>
      duplicateLineInstance: (instanceId: string) => Promise<LineInstanceRecord>
      runLine: (payload: { classId?: string; instanceId: string }) => Promise<PointRunResult>
      getSurfaceCatalog: () => Promise<SurfaceCatalogSnapshot>
      getSurfaceRuns: (limit?: number) => Promise<SurfaceRunRecord[]>
      createSurfaceInstance: (input: CreateSurfaceInstancePayload) => Promise<SurfaceInstanceRecord>
      updateSurfaceInstance: (instanceId: string, patch: UpdateSurfaceInstancePayload) => Promise<SurfaceInstanceRecord>
      archiveSurfaceInstance: (instanceId: string) => Promise<SurfaceInstanceRecord>
      restoreSurfaceInstance: (instanceId: string) => Promise<SurfaceInstanceRecord>
      duplicateSurfaceInstance: (instanceId: string) => Promise<SurfaceInstanceRecord>
      runSurface: (payload: { classId?: string; instanceId: string }) => Promise<PointRunResult>
      getBodyCatalog: () => Promise<BodyCatalogSnapshot>
      getBodyRuns: (limit?: number) => Promise<BodyRunRecord[]>
      createBodyInstance: (input: CreateBodyInstancePayload) => Promise<BodyInstanceRecord>
      updateBodyInstance: (instanceId: string, patch: UpdateBodyInstancePayload) => Promise<BodyInstanceRecord>
      archiveBodyInstance: (instanceId: string) => Promise<BodyInstanceRecord>
      restoreBodyInstance: (instanceId: string) => Promise<BodyInstanceRecord>
      duplicateBodyInstance: (instanceId: string) => Promise<BodyInstanceRecord>
      runBody: (payload: { classId?: string; instanceId: string }) => Promise<PointRunResult>
      getFieldCatalog: () => Promise<FieldCatalogSnapshot>
      getFieldRuns: (limit?: number) => Promise<FieldRunRecord[]>
      createFieldInstance: (input: CreateFieldInstancePayload) => Promise<FieldInstanceRecord>
      updateFieldInstance: (instanceId: string, patch: UpdateFieldInstancePayload) => Promise<FieldInstanceRecord>
      archiveFieldInstance: (instanceId: string) => Promise<FieldInstanceRecord>
      restoreFieldInstance: (instanceId: string) => Promise<FieldInstanceRecord>
      duplicateFieldInstance: (instanceId: string) => Promise<FieldInstanceRecord>
      runField: (payload: { classId?: string; instanceId: string }) => Promise<PointRunResult>


    }
  }
}

export {}
