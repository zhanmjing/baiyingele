import fullCatalogs from './generatedFullCatalogs.json'

import type {
  LayerClassSeed,
  LayerInstanceRecord,
  LayerInstanceSeed,
  LayerParam,
  LayerPriority,
  LayerRunRecord,
  LayerStatus
} from './layerTypes'

// 形状的真相在 layerTypes.ts（五层共有）；这里保留 Point* 名字供既有代码引用。
export type PointPriority = LayerPriority
export type PointStatus = LayerStatus
export type PointParam = LayerParam
export type PointInstanceSeed = LayerInstanceSeed
export type PointClassSeed = LayerClassSeed
export type PointInstanceRecord = LayerInstanceRecord
export type PointRunRecord = LayerRunRecord

export const pointClassesSeed = (fullCatalogs.point as unknown) as PointClassSeed[]
