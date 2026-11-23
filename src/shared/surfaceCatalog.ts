import fullCatalogs from './generatedFullCatalogs.json'

import type { PointClassSeed, PointInstanceRecord, PointInstanceSeed, PointRunRecord } from './pointCatalog'

export type SurfaceClassSeed = PointClassSeed
export type SurfaceInstanceSeed = PointInstanceSeed
export type SurfaceInstanceRecord = PointInstanceRecord
export type SurfaceRunRecord = PointRunRecord

export const surfaceClassesSeed = (fullCatalogs.surface as unknown) as SurfaceClassSeed[]
