import fullCatalogs from './generatedFullCatalogs.json'

import type { PointClassSeed, PointInstanceRecord, PointInstanceSeed, PointRunRecord } from './pointCatalog'

export type FieldClassSeed = PointClassSeed
export type FieldInstanceSeed = PointInstanceSeed
export type FieldInstanceRecord = PointInstanceRecord
export type FieldRunRecord = PointRunRecord

export const fieldClassesSeed = (fullCatalogs.field as unknown) as FieldClassSeed[]
