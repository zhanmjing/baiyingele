import {
  Boxes,
  CircleDot,
  PanelsTopLeft,
  Route,
  Sparkles,
  type LucideIcon
} from 'lucide-react'
import { bodyClassesSeed } from '../../shared/bodyCatalog'
import { fieldClassesSeed } from '../../shared/fieldCatalog'
import { lineClassesSeed } from '../../shared/lineCatalog'
import { surfaceClassesSeed } from '../../shared/surfaceCatalog'
import { pointClassesSeed } from '../../shared/pointCatalog'
import type { PointInstanceSeed, PointParam } from '../../shared/pointCatalog'

export type LayerKey = 'point' | 'line' | 'surface' | 'body' | 'field'

export type LayerParam = PointParam

export type LayerInstance = PointInstanceSeed

export interface LayerClass {
  id: string
  name: string
  family: string
  priority: 'P0' | 'P1' | 'P2'
  effect: string
  status: 'active' | 'draft'
  description: string
  params: LayerParam[]
  instances: LayerInstance[]
}

export interface LayerMeta {
  key: LayerKey
  label: string
  en: string
  icon: LucideIcon
  accent: string
  tagline: string
  description: string
  totalClasses: number
  totalInstances: number
  classes: LayerClass[]
}

export interface RunRecord {
  id: string
  layer: LayerKey
  classId: string
  instanceId: string
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
  at: string
  createdAt?: number
}

const p = (key: string, label: string, type: string, required: boolean, description: string): LayerParam => ({
  key,
  label,
  type,
  required,
  description
})

const i = (id: string, name: string, rev: number, description: string, status: LayerInstance['status'] = 'active'): LayerInstance => ({
  id,
  name,
  rev,
  status,
  description
})

export const layers: Record<LayerKey, LayerMeta> = {
  point: {
    key: 'point',
    label: '点层',
    en: 'Point',
    icon: CircleDot,
    accent: '#22d3ee',
    tagline: '原子能力',
    description: '带契约的最小可执行单元。一个点只做一件事，有输入、输出、副作用与权限。',
    totalClasses: 13,
    totalInstances: 32,
    classes: pointClassesSeed.map((item) => ({
      ...item,
      instances: item.instances.map((instance) => ({ ...instance }))
    })) as LayerClass[]
  },
  line: {
    key: 'line',
    label: '线层',
    en: 'Line',
    icon: Route,
    accent: '#a78bfa',
    tagline: '流程编排',
    description: '把点串成有方向、有状态、有错误处理的流程。线可以复用、嵌套、回放。',
    totalClasses: 13,
    totalInstances: 32,
    classes: lineClassesSeed.map((item) => ({
      ...item,
      instances: item.instances.map((instance) => ({ ...instance }))
    })) as LayerClass[]
  },
  surface: {
    key: 'surface',
    label: '面层',
    en: 'Surface',
    icon: PanelsTopLeft,
    accent: '#34d399',
    tagline: '界面承载',
    description: '用户看见和操作的界面：面板、命令面板、启动坞、设置页。面不拥有业务，只承载入口。',
    totalClasses: 16,
    totalInstances: 46,
    classes: surfaceClassesSeed.map((item) => ({
      ...item,
      instances: item.instances.map((instance) => ({ ...instance }))
    })) as LayerClass[]
  },
  body: {
    key: 'body',
    label: '体层',
    en: 'Body',
    icon: Boxes,
    accent: '#fbbf24',
    tagline: '产品蓝图',
    description: '把流程、界面、点组合成一个可安装、可配置、可演进的产品体。',
    totalClasses: 29,
    totalInstances: 82,
    classes: bodyClassesSeed.map((item) => ({
      ...item,
      instances: item.instances.map((instance) => ({ ...instance }))
    })) as LayerClass[]
  },
  field: {
    key: 'field',
    label: '场层',
    en: 'Field',
    icon: Sparkles,
    accent: '#f472b6',
    tagline: '智能介质',
    description: '穿透点、线、面、体的智能能力。有落点、有自主度、有证据、有撤销。',
    totalClasses: 23,
    totalInstances: 78,
    classes: fieldClassesSeed.map((item) => ({
      ...item,
      instances: item.instances.map((instance) => ({ ...instance }))
    })) as LayerClass[]
  }
}

export const layerOrder: LayerKey[] = ['point', 'line', 'surface', 'body', 'field']

export const recentRuns: RunRecord[] = [
  {
    id: 'run-1842',
    layer: 'point',
    classId: 'window.find',
    instanceId: 'i-find-vscode',
    status: 'ok',
    output: '已定位 Visual Studio Code',
    elapsedMs: 42,
    at: '刚刚'
  },
  {
    id: 'run-1841',
    layer: 'field',
    classId: 'field.prefill',
    instanceId: 'field.prefill.ocr-language',
    status: 'ok',
    output: 'ocr.language = zh · confidence 0.84',
    elapsedMs: 118,
    at: '2 分钟前'
  },
  {
    id: 'run-1840',
    layer: 'line',
    classId: 'flow.open-external-site',
    instanceId: 'inst.site-github',
    status: 'ok',
    output: 'GitHub 已打开',
    elapsedMs: 1340,
    at: '8 分钟前'
  },
  {
    id: 'run-1839',
    layer: 'point',
    classId: 'screen.capture',
    instanceId: 'i-capture-region',
    status: 'warn',
    output: '用户取消区域选择',
    elapsedMs: 6000,
    at: '12 分钟前'
  },
  {
    id: 'run-1838',
    layer: 'body',
    classId: 'body.file-preview',
    instanceId: 'pdf',
    status: 'ok',
    output: 'PDF 已加载 · 12 页',
    elapsedMs: 220,
    at: '18 分钟前'
  }
]

export const totalCatalog = {
  classes: Object.values(layers).reduce((sum, layer) => sum + layer.totalClasses, 0),
  instances: Object.values(layers).reduce((sum, layer) => sum + layer.totalInstances, 0),
  aiClasses: 29,
  aiInstances: 124
}
