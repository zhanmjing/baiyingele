import fullCatalogs from './generatedFullCatalogs.json'

export type PointPriority = 'P0' | 'P1' | 'P2'
export type PointStatus = 'active' | 'draft' | 'archived'

export interface PointParam {
  key: string
  label: string
  type: string
  required: boolean
  description: string
  defaultValue?: string
}

export interface PointInstanceSeed {
  id: string
  name: string
  rev: number
  status: PointStatus
  description: string
  params?: Record<string, string>
  classId?: string
  createdAt?: number
  updatedAt?: number
}

export interface PointClassSeed {
  id: string
  name: string
  family: string
  priority: PointPriority
  effect: string
  status: 'active' | 'draft'
  description: string
  params: PointParam[]
  instances: PointInstanceSeed[]
}

export interface PointInstanceRecord extends PointInstanceSeed {
  classId: string
  params: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface PointRunRecord {
  id: string
  classId: string
  instanceId: string
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
  createdAt: number
  /** 场层等的运行证据（provider / confidence / attempts 等），可选 */
  evidence?: Record<string, unknown>
}

export const pointClassesSeed = (fullCatalogs.point as unknown) as PointClassSeed[]
