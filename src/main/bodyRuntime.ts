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

export interface BodyClassInput {
  profile: BodyProfileLike
  deps: BodyDeps
  /** 这个体要求的角色清单（由各体自己声明） */
  requires?: BodyRequirement[]
}

/**
 * 一个体对「角色」的要求。
 *
 * 装配检查原本只查「零件存在且有实现」，但那只回答了一半：
 * 一个 OCR 体就算零件齐了，如果里面没有任何识别能力，它照样做不了事。
 *
 *   ui         面层（界面承载）
 *   flow       线层（编排）
 *   capability 点层（能真干活的原子能力）
 *   intel      场层（判断/理解）
 */
export interface BodyRequirement {
  role: 'ui' | 'flow' | 'capability' | 'intel'
  /** 这个体为什么需要这个角色 —— 不能省 */
  reason: string
}

const ROLE_LAYER: Record<BodyRequirement['role'], string> = {
  ui: 'surface',
  flow: 'line',
  capability: 'point',
  intel: 'field'
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
  reason: 'no-class' | 'no-impl' | 'missing-role'
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

/**
 * 装配检查（含角色齐备）。
 *
 * 两段分开：
 *   1. 零件检查 —— 每个 composition 项存在且有实现
 *   2. 角色检查 —— 声明的必需角色（ui/flow/capability/intel）至少有一件
 *
 * 零件齐但角色缺（例如 OCR 体里没有任何识别能力）同样做不了事，必须报出来。
 */
export function assessComposition(
  profile: BodyProfileLike,
  deps: BodyDeps,
  requires: BodyRequirement[] = []
): AssembleResult {
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

  // 角色检查：声明的必需角色必须至少有一件对应层的零件。
  // 零件齐但角色缺（例如 OCR 体里没有任何识别能力）同样做不了事。
  const filledRoles = new Set<string>()
  for (const part of parts) {
    const parsed = partIdOf(part)
    if (!parsed) continue
    for (const [role, layer] of Object.entries(ROLE_LAYER)) {
      if (parsed.layer === layer) filledRoles.add(role)
    }
  }
  for (const requirement of requires) {
    if (filledRoles.has(requirement.role)) continue
    missing.push({
      id: `role:${requirement.role}`,
      layer: ROLE_LAYER[requirement.role],
      role: requirement.reason,
      reason: 'missing-role'
    })
  }

  const totalChecks = parts.length + requires.length
  return {
    readiness: { total: totalChecks, satisfied: totalChecks - missing.length, missing },
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
