import type { InstanceRunner, RunOutcome } from './layerStore'

/**
 * 体层执行器：装配检查。
 *
 * 体层**没有自己的执行逻辑**。它只有一张零件清单（composition）：
 * 「这个体需要哪些面层页面、哪些线层流程、哪些点层能力」。
 *
 * 所以 `runBody` 做的事是：
 *   1. 读 composition
 *   2. 逐个零件查：类存在吗？有真实实现吗？
 *   3. 齐了 → 给出装配结果（该装载哪些页面 / 绑定哪些流程 / 用到哪些能力）
 *      没齐 → 明确报缺哪几个，并指向 requirements 里的缺口
 *
 * **它不启动任何子功能。** 装配成功只代表「零件齐了，可以启动」，
 * 真正的启动由用户在上层显式触发。这是 runBody 的 `kind = 'assemble'` 的含义。
 */

export interface BodyCompositionPart {
  /** 结构化类引用（新形态） */
  class?: { layer: string; name: string }
  /** 旧形态：{ layer, ref } */
  layer?: string
  ref?: string
  role?: string
  required?: boolean
}

export interface BodyProfileLike {
  classId?: string
  composition?: BodyCompositionPart[]
  manifest?: { id?: string; version?: string }
}

export interface BodyDeps {
  profiles: Record<string, BodyProfileLike>
  /** 某层某类在目录里是否存在 */
  hasClass: (layer: string, name: string) => boolean
  /** 有真实实现的类 id 集合；不在集合里 = 只有目录条目，没有执行体 */
  implementedClassIds: ReadonlySet<string>
}

export interface MissingPart {
  id: string
  layer: string
  role: string
  /** 为什么缺：目录里没有这个类，还是有类但没实现 */
  reason: 'no-class' | 'no-impl'
}

export interface AssembleResult {
  readiness: { total: number; satisfied: number; missing: MissingPart[] }
  /** 只有齐备时才有；按层分组，告诉上层该装载什么 */
  assembly?: { surfaces: string[]; lines: string[]; points: string[]; fields: string[] }
  /** 缺口对应的需求 id（指向 requirements.generated.json） */
  blockedBy: string[]
}

/**
 * 把 composition 的一项解析成 `<layer>.<name>`；解析不了返回 null。
 * 数据已是结构化形态（{class:{layer,name}}），旧形态 {layer, ref} 也兼容。
 */
function partIdOf(part: BodyCompositionPart): { id: string; layer: string } | null {
  const layer = part.class?.layer ?? part.layer ?? ''
  const name = part.class?.name ?? part.ref ?? ''
  if (!layer || !name) return null
  return { id: `${layer}.${name}`, layer }
}

export function assessComposition(profile: BodyProfileLike, deps: BodyDeps): AssembleResult {
  const parts = profile.composition ?? []
  const missing: MissingPart[] = []
  const assembly = { surfaces: [] as string[], lines: [] as string[], points: [] as string[], fields: [] as string[] }

  for (const part of parts) {
    const parsed = partIdOf(part)
    if (!parsed) {
      missing.push({ id: '(无法解析的引用)', layer: part.layer ?? '?', role: part.role ?? '', reason: 'no-class' })
      continue
    }
    const { id, layer } = parsed
    const name = id.slice(layer.length + 1)
    if (!deps.hasClass(layer, name)) {
      missing.push({ id, layer, role: part.role ?? '', reason: 'no-class' })
      continue
    }
    if (!deps.implementedClassIds.has(id)) {
      missing.push({ id, layer, role: part.role ?? '', reason: 'no-impl' })
      continue
    }
    if (layer === 'surface') assembly.surfaces.push(id)
    else if (layer === 'line') assembly.lines.push(id)
    else if (layer === 'point') assembly.points.push(id)
    else if (layer === 'field') assembly.fields.push(id)
  }

  return {
    readiness: { total: parts.length, satisfied: parts.length - missing.length, missing },
    // 齐备才给装配结果：缺零件时的「装配方案」是假方案
    ...(missing.length === 0 ? { assembly } : {}),
    blockedBy: missing.map((item) => `req.${item.id}`)
  }
}

export function createBodyRunner(deps: BodyDeps): InstanceRunner {
  return (ctx): RunOutcome => {
    const startedAt = Date.now()
    const classId = ctx.instance.classId
    const profile = deps.profiles[classId]

    if (!profile) {
      return {
        status: 'warn',
        output: `${classId} 没有 composition，无法装配检查`,
        elapsedMs: Date.now() - startedAt,
        evidence: { kind: 'assemble', classId, problem: 'no-profile' }
      }
    }

    const result = assessComposition(profile, deps)
    const { total, satisfied, missing } = result.readiness
    const elapsedMs = Date.now() - startedAt

    if (missing.length === 0) {
      const { surfaces, lines, points, fields } = result.assembly ?? { surfaces: [], lines: [], points: [], fields: [] }
      return {
        status: 'ok',
        output:
          `装配完成：${satisfied}/${total} 零件齐备 · ` +
          `页面 ${surfaces.length} · 流程 ${lines.length} · 能力 ${points.length} · 场 ${fields.length}`,
        value: JSON.stringify(result),
        elapsedMs,
        evidence: { kind: 'assemble', classId, ...result }
      }
    }

    const head = missing.slice(0, 4).map((item) => `${item.id}(${item.reason === 'no-impl' ? '未实现' : '无此类'})`)
    const more = missing.length > 4 ? ` 等 ${missing.length} 个` : ''
    return {
      // 零件不齐就不能报成功 —— 这是这个能力存在的意义
      status: 'warn',
      output: `装配未完成：${satisfied}/${total} 零件齐备，缺 ${missing.length} 个：${head.join('、')}${more}`,
      value: JSON.stringify(result),
      elapsedMs,
      evidence: { kind: 'assemble', classId, ...result }
    }
  }
}
