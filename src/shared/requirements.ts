/**
 * 跨层「未满足需求」的读取层。
 *
 * 由 scripts/reconcile-refs.mjs --write 生成，不要手改。
 * 语义：missing 是合法状态（体是蓝图，依赖可以暂时不满足），不是数据错误。
 *   - kind-mismatch / layer-mismatch 才是错误，由 validate 拦
 */
import raw from './requirements.generated.json'

export interface RequirementOwner {
  where: string
  owner: string
  role?: string
  required: boolean
}

import type { AtomLayer, ClassRef, InstanceRef } from './atomId'

/** 需求指向的东西还不存在，所以实例引用一律 rev=null + dangling */
export type RequirementRef = ClassRef | (InstanceRef & { dangling: true })

export interface Requirement {
  /** `req.<layer>.<class>[.<instance>]` —— type 字段已经区分类和实例，id 不再重复编码 */
  id: string
  type: 'class' | 'instance'
  /** 结构化引用：目标不存在，但形状与正常引用一致 */
  ref: RequirementRef
  layer: AtomLayer
  /** 展示用可读串 `<layer>:<refId>`；判断逻辑请用 ref */
  capability: string
  requiredBy: RequirementOwner[]
}

interface RequirementFile {
  version: number
  generatedBy: string
  counts: Record<string, number>
  requirements: Requirement[]
}

const file = raw as unknown as RequirementFile

export const requirements: Requirement[] = file.requirements

/** capability -> 需求，用于 UI 里判断某条引用是否已满足 */
const byCapability = new Map(requirements.map((item) => [item.capability, item]))

export function requirementFor(layer: string, ref: string): Requirement | undefined {
  return byCapability.get(`${layer}:${ref}`)
}

export function isUnmet(layer: string, ref: string): boolean {
  return byCapability.has(`${layer}:${ref}`)
}

/** 按被引用次数排序的缺口（补哪个能力能解锁最多东西） */
export function topGaps(limit = 5): Requirement[] {
  return requirements
    .filter((item) => item.type === 'class')
    .slice()
    .sort((a, b) => b.requiredBy.length - a.requiredBy.length)
    .slice(0, limit)
}

export function gapSummary(): { unmetClasses: number; unmetInstances: number; owners: number } {
  return {
    unmetClasses: requirements.filter((item) => item.type === 'class').length,
    unmetInstances: requirements.filter((item) => item.type === 'instance').length,
    owners: new Set(requirements.flatMap((item) => item.requiredBy.map((owner) => owner.owner))).size
  }
}
