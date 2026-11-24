import fullCatalogs from './generatedFullCatalogs.json'
import generatedBodyProfiles from './generatedBodyProfiles.json'
import type { PointClassSeed, PointInstanceRecord, PointInstanceSeed, PointRunRecord } from './pointCatalog'

export type BodyClassSeed = PointClassSeed
export type BodyInstanceSeed = PointInstanceSeed
export type BodyInstanceRecord = PointInstanceRecord
export type BodyRunRecord = PointRunRecord

export const bodyClassesSeed = (fullCatalogs.body as unknown) as BodyClassSeed[]

export interface BodyComponentRef {
  layer: 'point' | 'line' | 'surface' | 'field'
  ref: string
  role: string
  required: boolean
}

export interface BodyManifest {
  id: string
  version: string
  channel: 'stable' | 'beta' | 'dev'
  entry: string
  publisher: string
  signature: 'valid' | 'unsigned' | 'unknown'
  digest: string
  permissions: string[]
  resources: { cpu: string; memory: string; disk: string }
}

export interface BodyProfile {
  classId: string
  composition: BodyComponentRef[]
  manifest: BodyManifest
  lifecycle: {
    stage: 'active' | 'draft' | 'update-available' | 'archived'
    installedAt: string
    lastChecked: string
    previousVersion?: string
  }
}

const bodyProfileOverrides: Record<string, BodyProfile> = {
  'body.file_preview': {
    classId: 'body.file_preview',
    composition: [
      { layer: 'surface', ref: 'surface.preview-panel', role: '预览面板', required: true },
      { layer: 'point', ref: 'fs.read', role: '读取文件', required: true },
      { layer: 'line', ref: 'flow.open-file', role: '打开文件流程', required: true },
      { layer: 'field', ref: 'field.prefill', role: '预填视图参数', required: false }
    ],
    manifest: {
      id: 'body.file_preview', version: '1.4.2', channel: 'stable',
      entry: 'body://file-preview/index.html', publisher: 'Baiying Labs', signature: 'valid',
      digest: 'sha256:9f2c4e7…', permissions: ['filesystem.read', 'clipboard.read'],
      resources: { cpu: '2 vCPU', memory: '256 MB', disk: '38 MB' }
    },
    lifecycle: { stage: 'active', installedAt: '2026-11-12', lastChecked: '2 分钟前', previousVersion: '1.4.0' }
  },
  'body.ocr': {
    classId: 'body.ocr',
    composition: [
      { layer: 'point', ref: 'screenshot.capture', role: '截图输入', required: true },
      { layer: 'line', ref: 'flow.ocr-pipeline', role: 'OCR 管线', required: true },
      { layer: 'field', ref: 'field.prefill', role: '语言预填', required: false }
    ],
    manifest: {
      id: 'body.ocr', version: '1.2.0', channel: 'stable',
      entry: 'body://ocr/index.html', publisher: 'Baiying Labs', signature: 'valid',
      digest: 'sha256:3a81bd0…', permissions: ['screen.capture', 'filesystem.read', 'network.outbound'],
      resources: { cpu: '4 vCPU', memory: '512 MB', disk: '96 MB' }
    },
    lifecycle: { stage: 'update-available', installedAt: '2026-10-28', lastChecked: '5 分钟前', previousVersion: '1.1.6' }
  },
  'body.batch_rename': {
    classId: 'body.batch_rename',
    composition: [
      { layer: 'point', ref: 'fs.list', role: '枚举文件', required: true },
      { layer: 'point', ref: 'fs.rename', role: '执行重命名', required: true },
      { layer: 'line', ref: 'flow.rename-batch', role: '批量编排', required: true },
      { layer: 'surface', ref: 'surface.preview-table', role: '预览确认', required: true }
    ],
    manifest: {
      id: 'body.batch_rename', version: '0.9.4', channel: 'beta',
      entry: 'body://batch-rename/index.html', publisher: 'Baiying Labs', signature: 'unsigned',
      digest: 'sha256:bb02e71…', permissions: ['filesystem.read', 'filesystem.write'],
      resources: { cpu: '1 vCPU', memory: '128 MB', disk: '22 MB' }
    },
    lifecycle: { stage: 'draft', installedAt: '2026-11-18', lastChecked: '刚刚' }
  }
}

export const bodyProfiles: Record<string, BodyProfile> = {
  ...(generatedBodyProfiles as unknown as Record<string, BodyProfile>),
  ...bodyProfileOverrides
}
