import fullCatalogs from './generatedFullCatalogs.json'
import generatedLineProfiles from './generatedLineProfiles.json'
import type { PointClassSeed, PointInstanceRecord, PointInstanceSeed, PointRunRecord } from './pointCatalog'

export type LineClassSeed = PointClassSeed
export type LineInstanceSeed = PointInstanceSeed
export type LineInstanceRecord = PointInstanceRecord
export type LineRunRecord = PointRunRecord

export const lineClassesSeed = (fullCatalogs.line as unknown) as LineClassSeed[]

export interface LineNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  kind: 'point' | 'gate' | 'subflow'
  pointClass?: string
  pointInstance?: string
  gate?: string
  role?: string
}

export interface LineEdge {
  from: string
  to: string
  label?: string
}

export interface LineProfile {
  classId: string
  nodes: LineNode[]
  edges: LineEdge[]
}

export const lineProfiles = (generatedLineProfiles as unknown) as Record<string, LineProfile>
