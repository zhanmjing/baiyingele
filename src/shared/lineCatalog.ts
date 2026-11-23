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
  /**
   * 参数映射：目标参数名 -> 取值表达式
   *   '$input'      上一个节点的原始输出
   *   '$args.<key>' 流程实例参数（从 instance.description 的 key=value 解析）
   *   其他字符串    字面量
   */
  mapping?: Record<string, string>
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
