import { elapsed, type Capability } from './_shared'

export const id = 'field.critique'
export const summary = '结构审查：流程图有没有环 / 悬空边 / 未绑定节点，体层零件齐不齐，权限有没有超范围'

/**
 * A0 · 审查（纯规则，只读，不产生任何副作用）
 *
 * 三个实例：
 *   flow        流程图结构缺陷
 *   body        体层零件与清单缺陷
 *   permission  权限超范围
 *
 * 这个能力存在的直接原因：`lineRuntime.orderNodes` 是个 BFS，不是拓扑排序。
 * 遇到环它不报错，遇到悬空边它静默丢弃 —— 一个带环的流程会「正常运行」，
 * 执行顺序由数组遍历顺序决定。所以审查必须独立于执行，先于执行。
 */

export interface CritiqueFinding {
  severity: 'error' | 'warn' | 'info'
  /** 机器可读的缺陷码，便于统计和筛选 */
  code: string
  /** 出问题的位置：节点 id / 边 / 类 id */
  where: string
  message: string
  /** 怎么修 */
  hint?: string
}

export interface LineNodeLike {
  id: string
  kind?: string
  label?: string
  pointClass?: unknown
  pointInstance?: unknown
  gate?: unknown
}

export interface LineEdgeLike {
  from: string
  to: string
  label?: string
}

export interface LineProfileLike {
  classId?: string
  nodes?: LineNodeLike[]
  edges?: LineEdgeLike[]
}

export interface BodyPartLike {
  class?: { layer?: string; name?: string }
  layer?: string
  ref?: string
  role?: string
  required?: boolean
}

export interface BodyProfileLike {
  composition?: BodyPartLike[]
  manifest?: { id?: string; version?: string; permissions?: unknown }
}

/**
 * 审查依赖由主进程注入。
 * 和 setRunHistorySource / setFormSink 同一套模式：能力模块不直接摸各个 store。
 */
let injectedDeps: CritiqueDeps | null = null

/** 由主进程在启动时注入 */
export function setCritiqueDeps(next: CritiqueDeps | null): void {
  injectedDeps = next
}

export interface CritiqueDeps {
  profiles: Record<string, LineProfileLike>
  bodyProfiles: Record<string, BodyProfileLike>
  implementedClassIds: ReadonlySet<string>
  hasClass: (layer: string, name: string) => boolean
}

/** 取引用里的类名（结构化 / 字符串 / 旧形态都吃） */
function refName(ref: unknown): string | null {
  if (!ref) return null
  if (typeof ref === 'string') return ref.includes('.') ? ref.slice(ref.indexOf('.') + 1) : ref
  if (typeof ref === 'object' && 'name' in ref) {
    const name = (ref as { name: unknown }).name
    return name ? String(name) : null
  }
  return null
}

/**
 * 找环。用自环 + DFS 三色标记，返回每一条环的节点序列。
 *
 * 必须独立于 orderNodes —— 那边是 BFS，根本发现不了环。
 */
export function findCycles(nodes: LineNodeLike[], edges: LineEdgeLike[]): string[][] {
  const ids = new Set(nodes.map((node) => node.id))
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue
    if (!adj.has(edge.from)) adj.set(edge.from, [])
    adj.get(edge.from)!.push(edge.to)
  }

  const WHITE = 0, GREY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const id of ids) color.set(id, WHITE)
  const stack: string[] = []
  const cycles: string[][] = []
  const seenCycle = new Set<string>()

  const visit = (node: string): void => {
    color.set(node, GREY)
    stack.push(node)
    for (const next of adj.get(node) ?? []) {
      if (color.get(next) === GREY) {
        // 回边：从栈里切出这一圈
        const start = stack.indexOf(next)
        if (start >= 0) {
          const cycle = stack.slice(start).concat(next)
          // 同一圈可能从不同入口被找到，用排序后的 key 去重
          const key = [...new Set(cycle)].sort().join('|')
          if (!seenCycle.has(key)) {
            seenCycle.add(key)
            cycles.push(cycle)
          }
        }
        continue
      }
      if (color.get(next) === WHITE) visit(next)
    }
    stack.pop()
    color.set(node, BLACK)
  }

  for (const id of ids) if (color.get(id) === WHITE) visit(id)
  return cycles
}

/** 审查一张流程图 */
export function critiqueFlow(profile: LineProfileLike, deps: CritiqueDeps): CritiqueFinding[] {
  const findings: CritiqueFinding[] = []
  const nodes = profile.nodes ?? []
  const edges = profile.edges ?? []
  const ids = new Set(nodes.map((node) => node.id))

  if (!nodes.length) {
    return [{ severity: 'error', code: 'empty-graph', where: profile.classId ?? '?', message: '流程图没有任何节点' }]
  }

  // 1. 环 —— orderNodes 发现不了，这里必须发现
  //
  // 但要区分两种环，否则会把设计意图当成 bug 报：
  //   loop-construct  环上有个 gate 节点，且该 gate 还有出口通向环外
  //                   → 这是「遍历/重试」的写法。引擎只排一遍，所以只会跑一次，
  //                     不会真的迭代。报 warn：设计意图成立，执行语义不成立。
  //   cycle           没有任何出口 → 真正的死循环，报 error。
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  for (const cycle of findCycles(nodes, edges)) {
    const body = cycle.slice(0, -1) // findCycles 首尾同节点，去掉尾巴
    const inCycle = new Set(body)
    const loopGate = body.find((id) => {
      const node = nodeById.get(id)
      if (node?.kind !== 'gate') return false
      // 这个 gate 有没有一条边通向环外（= 循环的出口）
      return edges.some((edge) => edge.from === id && !inCycle.has(edge.to))
    })

    if (loopGate) {
      const exit = edges.filter((edge) => edge.from === loopGate && !inCycle.has(edge.to)).map((edge) => edge.to)
      findings.push({
        severity: 'warn',
        code: 'loop-construct',
        where: cycle.join(' → '),
        message:
          `循环构造：gate ${loopGate} 的回边是「每个」，出口 ${exit.join('/')} 是「结束」。` +
          `但执行器只排一遍序，循环体只会跑一次就走到出口。`,
        hint: '要么给执行器加迭代支持，要么把批量操作下沉成一个点层能力'
      })
      continue
    }

    findings.push({
      severity: 'error',
      code: 'cycle',
      where: cycle.join(' → '),
      message: `存在环：${cycle.join(' → ')}，且没有任何节点通向环外`,
      hint: '流程必须是有向无环图；要表达重试请用带出口的 gate 节点'
    })
  }

  // 2. 悬空边 —— orderNodes 会静默丢弃
  for (const edge of edges) {
    if (!ids.has(edge.from)) {
      findings.push({
        severity: 'error', code: 'dangling-edge', where: `${edge.from} → ${edge.to}`,
        message: `边的起点 ${edge.from} 不存在`, hint: '删掉这条边，或补上节点'
      })
    }
    if (!ids.has(edge.to)) {
      findings.push({
        severity: 'error', code: 'dangling-edge', where: `${edge.from} → ${edge.to}`,
        message: `边的终点 ${edge.to} 不存在`, hint: '删掉这条边，或补上节点'
      })
    }
  }

  // 3. 自环单独说 —— 它是一环的环，最容易写错
  for (const edge of edges) {
    if (edge.from === edge.to) {
      findings.push({
        severity: 'error', code: 'self-loop', where: edge.from,
        message: `节点 ${edge.from} 有指向自己的边`, hint: '自环在任何执行语义下都是死循环'
      })
    }
  }

  // 4. 点节点没绑定能力
  for (const node of nodes) {
    if (node.kind !== 'point') continue
    if (!node.pointClass) {
      findings.push({
        severity: 'error', code: 'unbound-node', where: node.id,
        message: `点节点 ${node.label ?? node.id} 没有绑定任何 pointClass`,
        hint: '要么绑一个能力，要么把它改成 gate 节点'
      })
      continue
    }
    const name = refName(node.pointClass)
    const classId = name ? `point.${name}` : null
    if (classId && !deps.hasClass('point', name!)) {
      findings.push({
        severity: 'error', code: 'missing-class', where: node.id,
        message: `节点绑定的 ${classId} 在目录里不存在`,
        hint: '这可能是一条需求缺口，先看 requirements.generated.json'
      })
    } else if (classId && !deps.implementedClassIds.has(classId)) {
      findings.push({
        severity: 'warn', code: 'missing-impl', where: node.id,
        message: `节点绑定的 ${classId} 有目录条目但没有真实实现`,
        hint: '运行时会走模拟输出，结果不可信'
      })
    }
  }

  // 5. 孤立节点：既无入边也无出边（单节点图除外）
  if (nodes.length > 1) {
    const hasIn = new Set(edges.map((e) => e.to))
    const hasOut = new Set(edges.map((e) => e.from))
    for (const node of nodes) {
      if (!hasIn.has(node.id) && !hasOut.has(node.id)) {
        findings.push({
          severity: 'warn', code: 'orphan-node', where: node.id,
          message: `节点 ${node.label ?? node.id} 既不接收也不发出任何信号`,
          hint: '它永远不会被执行到'
        })
      }
    }
  }

  // 6. 没有入口
  if (nodes.length > 1) {
    const hasIn = new Set(edges.map((e) => e.to))
    const entries = nodes.filter((node) => !hasIn.has(node.id))
    if (!entries.length) {
      findings.push({
        severity: 'error', code: 'no-entry', where: profile.classId ?? '?',
        message: '没有任何入度为 0 的节点，流程没有起点',
        hint: '这通常意味着图里有环'
      })
    }
  }

  // 7. 重复节点 id
  const dup = new Map<string, number>()
  for (const node of nodes) dup.set(node.id, (dup.get(node.id) ?? 0) + 1)
  for (const [nodeId, count] of dup) {
    if (count > 1) {
      findings.push({
        severity: 'error', code: 'duplicate-node', where: nodeId,
        message: `节点 id ${nodeId} 出现 ${count} 次`, hint: 'id 必须唯一，否则边会连到不确定的节点'
      })
    }
  }

  return findings
}

/** 审查体层的零件清单 */
export function critiqueBody(profile: BodyProfileLike, deps: CritiqueDeps): CritiqueFinding[] {
  const findings: CritiqueFinding[] = []
  const parts = profile.composition ?? []
  if (!parts.length) {
    findings.push({
      severity: 'error', code: 'empty-composition', where: profile.manifest?.id ?? '?',
      message: '体层没有任何零件，装配检查永远无法完成'
    })
    return findings
  }
  for (const part of parts) {
    const layer = part.class?.layer ?? part.layer ?? ''
    const name = part.class?.name ?? part.ref ?? ''
    if (!layer || !name) {
      findings.push({
        severity: 'error', code: 'unparsable-part', where: JSON.stringify(part),
        message: '这个零件的引用解析不出层名和类名'
      })
      continue
    }
    const classId = `${layer}.${name}`
    if (!deps.hasClass(layer, name)) {
      findings.push({
        severity: 'error', code: 'missing-class', where: classId,
        message: `零件 ${classId}（${part.role ?? '未标角色'}）在目录里不存在`
      })
    } else if (!deps.implementedClassIds.has(classId)) {
      findings.push({
        severity: 'warn', code: 'missing-impl', where: classId,
        message: `零件 ${classId} 有目录条目但没有真实实现`,
        hint: '装配检查会把它算作未齐备'
      })
    }
  }
  return findings
}

/** 审查权限：声明了但没用到 = 超范围 */
export function critiquePermission(profile: BodyProfileLike): CritiqueFinding[] {
  const raw = profile.manifest?.permissions
  const perms = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(/[,\s]+/).filter(Boolean) : []
  if (!perms.length) return []

  const findings: CritiqueFinding[] = []
  const parts = profile.composition ?? []
  const usedText = parts.map((p) => `${p.role ?? ''} ${p.class?.name ?? ''} ${p.ref ?? ''}`).join(' ').toLowerCase()

  for (const perm of perms) {
    // 通配权限一律报：它是"想要一切"，不是"需要一个"
    if (perm.includes('*') || perm === 'all' || perm.endsWith(':*')) {
      findings.push({
        severity: 'warn', code: 'over-broad-permission', where: perm,
        message: `权限 ${perm} 是通配的，覆盖范围超出实际需要`,
        hint: '列出真正需要的具体权限项，别用通配'
      })
      continue
    }
    // 具体权限：看有没有零件名/角色沾边
    const stem = perm.split(/[.:/]/).pop()?.toLowerCase() ?? ''
    if (stem.length >= 3 && !usedText.includes(stem)) {
      findings.push({
        severity: 'info', code: 'unused-permission', where: perm,
        message: `权限 ${perm} 声明了，但没有任何零件看起来需要它`,
        hint: '可能可以删掉——权限越少越安全'
      })
    }
  }
  return findings
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'flow').toLowerCase()

  // 依赖由主进程注入，缺就如实报缺
  const deps = injectedDeps
  if (!deps) {
    return {
      status: 'warn',
      output: '审查需要注入 profiles / bodyProfiles / implementedClassIds / hasClass（主进程启动时注入）',
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'critique', problem: 'no-deps' }
    }
  }

  let findings: CritiqueFinding[] = []
  let target = ''

  if (mode.includes('body')) {
    const key = String(ctx.params.classId ?? '').trim()
    const first = Object.entries(deps.bodyProfiles)[0]
    const picked: [string, BodyProfileLike | undefined] = key ? [key, deps.bodyProfiles[key]] : [first?.[0] ?? '', first?.[1]]
    target = picked[0]
    const bodyProfile = picked[1]
    if (!bodyProfile) {
      return { status: 'warn', output: `找不到体层 profile：${target || '(全部为空)'}`, elapsedMs: elapsed(startedAt) }
    }
    findings = critiqueBody(bodyProfile, deps)
  } else if (mode.includes('permission')) {
    for (const [key, profile] of Object.entries(deps.bodyProfiles)) {
      findings.push(...critiquePermission(profile).map((f) => ({ ...f, message: `${key}: ${f.message}` })))
    }
    target = '所有体层'
  } else {
    const key = String(ctx.params.classId ?? '').trim()
    const first = Object.entries(deps.profiles)[0]
    const picked: [string, LineProfileLike | undefined] = key ? [key, deps.profiles[key]] : [first?.[0] ?? '', first?.[1]]
    target = picked[0]
    const lineProfile = picked[1]
    if (!lineProfile) {
      return { status: 'warn', output: `找不到线层 profile：${target || '(全部为空)'}`, elapsedMs: elapsed(startedAt) }
    }
    findings = critiqueFlow(lineProfile, deps)
  }

  const errors = findings.filter((f) => f.severity === 'error')
  const warns = findings.filter((f) => f.severity === 'warn')
  const elapsedMs = elapsed(startedAt)

  if (!findings.length) {
    return {
      status: 'ok',
      output: `审查 ${target}：未发现问题`,
      value: '[]',
      elapsedMs,
      evidence: { kind: 'critique', mode, target, findings: [] }
    }
  }

  const head = findings.slice(0, 3).map((f) => `[${f.severity}] ${f.code} ${f.where}`).join('；')
  return {
    // 有 error 就是 warn：审查的职责是把问题说出来，不是替人决定能不能跑
    status: 'warn',
    output: `审查 ${target}：${errors.length} 个错误 · ${warns.length} 个警告 —— ${head}${findings.length > 3 ? ` 等 ${findings.length} 条` : ''}`,
    value: JSON.stringify(findings),
    elapsedMs,
    evidence: { kind: 'critique', mode, target, errors: errors.length, warns: warns.length, findings }
  }
}
