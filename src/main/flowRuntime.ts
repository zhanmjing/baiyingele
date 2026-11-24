/**
 * 线层执行器：把 FlowClass 的数据流图跑起来。
 *
 * 设计依据 ATOM-UNIFIED-MODEL：FlowRun 由若干 slotRun 组成，每个 slotRun
 * 对应一次真实的 PointRun。
 *
 * **执行模型：信号传播，不是「拓扑排序后全跑一遍」。**
 *
 * 早期版本按 edges 拓扑排序然后把每个节点都跑一次，结果 `if` gate 的 true/false
 * 两条分支**都会执行** —— 一个本该拦住流程的 guard 变成了摆设。现在改成：
 * 从入度为 0 的节点开始，节点执行完只把**它自己激活的出边**推给下游，
 * 没被激活的分支不会运行。
 *
 * 节点语义：
 *   point    → 跑绑定的点实例；成功后激活**全部**出边
 *   gate:if  → 判断输入真假，**只**激活 true 或 false 那条边
 *   gate:*   → 未实现的 gate 一律让流程**停下**并标 warn（不能假装通过）
 *   subflow  → 递归跑另一条线实例；成功后激活全部出边
 *
 * 两条明确的能力边界（宁可停下也不猜）：
 *   1. `foreach` 需要 fan-out/fan-in 语义，还没实现 → 遇即停
 *   2. 多个入边汇聚的节点只跑一次（取第一个到达的值），不是真并发 join
 */
import { hasRealImpl } from '../shared/implRegistry'
import type { LineNode, LineProfile } from '../shared/lineCatalog'
import type { InstanceRunner, LayerStore, RunOutcome } from './layerStore'

export interface FlowDeps {
  profiles: Record<string, LineProfile>
  /** 延迟取点层 store，避免构造顺序耦合 */
  pointStore: () => LayerStore
  /** 子流程节点要能从线层查实例；不传则子流程一律记 unsupported */
  lineStore?: () => LayerStore
}

/** 子流程最大嵌套深度，防跑飞 */
const MAX_SUBFLOW_DEPTH = 8

/** 解析流程实例参数：'path=inbox.md；append=true' -> { path, append } */
export function parseFlowArgs(detail: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of String(detail ?? '').split(/[；;]/)) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    if (key) out[key] = part.slice(index + 1).trim()
  }
  return out
}

/** 按 edges 拓扑排序（保留导出：图谱预览与测试仍会用） */
export function orderNodes(profile: LineProfile): LineNode[] {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]))
  const incoming = new Map(profile.nodes.map((node) => [node.id, 0]))
  for (const edge of profile.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)

  const queue = profile.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id)
  const ordered: LineNode[] = []
  const seen = new Set<string>()

  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (node) ordered.push(node)
    for (const edge of profile.edges) {
      if (edge.from === id && !seen.has(edge.to)) queue.push(edge.to)
    }
  }
  for (const node of profile.nodes) if (!seen.has(node.id)) ordered.push(node)
  return ordered
}

/** 套用节点 mapping：$input / $args.x / 字面量 */
export function applyMapping(
  base: Record<string, string>,
  mapping: Record<string, string> | undefined,
  context: { input: string; args: Record<string, string> }
): Record<string, string> {
  const result = { ...base }
  for (const [key, expression] of Object.entries(mapping ?? {})) {
    if (expression === '$input') result[key] = context.input
    else if (expression.startsWith('$args.')) {
      const argKey = expression.slice('$args.'.length)
      result[key] = context.args[argKey] ?? result[key] ?? ''
    } else result[key] = expression
  }
  return result
}

/**
 * 纯函数：判断 `if` gate 的输入是真是假。
 *
 * 只接受明确的值；含糊的值返回 ok:false —— 让流程停下并报错，
 * 而不是替用户决定"空字符串算假"这种默认行为。
 */
export function evaluateIfGate(value: string): { ok: boolean; truthy?: boolean; reason?: string } {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'ok', 'pass'].includes(normalized)) return { ok: true, truthy: true }
  if (['false', '0', 'no', 'n', 'fail', 'failed', 'error', ''].includes(normalized)) return { ok: true, truthy: false }
  return {
    ok: false,
    reason: `if gate 无法判断「${String(value).slice(0, 40)}」的真假（只接受 true/false/1/0/yes/no/ok/fail/空）`
  }
}

/**
 * 纯函数：给定 gate 结果，算出该激活哪些出边。
 *
 * 两种分支 gate：
 *   if        → 按**值**分支，边标签 true / false
 *   if-status → 按**上游节点状态**分支，边标签 ok / warn（warn/fail/error 同义）
 */
export function firedEdges(profile: LineProfile, node: LineNode, truthy: boolean): { to: string; label?: string }[] {
  const outgoing = profile.edges.filter((edge) => edge.from === node.id)
  if (node.kind !== 'gate') return outgoing

  if (node.gate === 'if') {
    const wanted = truthy ? 'true' : 'false'
    return outgoing.filter((edge) => (edge.label ?? '').toLowerCase() === wanted)
  }
  if (node.gate === 'if-status') {
    const okLabels = ['ok', 'success', 'true']
    const failLabels = ['warn', 'fail', 'failed', 'error', 'false']
    const wanted = truthy ? okLabels : failLabels
    return outgoing.filter((edge) => wanted.includes((edge.label ?? '').toLowerCase()))
  }
  return outgoing
}

export type NodeStatus = 'ok' | 'warn' | 'skipped' | 'failed'

export interface FlowNodeResult {
  nodeId: string
  label: string
  kind: string
  status: NodeStatus
  output: string
  /** 是否跑的是真实实现（模拟或跳过都为 false） */
  real: boolean
  value?: string
  fired: string[]
}

interface RunFlowOptions {
  profile: LineProfile
  classId: string
  description: string
  input: string
  deps: FlowDeps
  depth: number
  stack: string[]
}

interface RunFlowResult {
  outcome: RunOutcome
  trace: FlowNodeResult[]
  real: number
  simulated: number
  skipped: number
  warned: number
  failed: number
  halted: string | null
}

async function runFlow(options: RunFlowOptions): Promise<RunFlowResult> {
  const { profile, description, deps, depth, stack } = options
  const startedAt = Date.now()
  const args = parseFlowArgs(description)
  const pointStore = deps.pointStore()

  const byId = new Map(profile.nodes.map((node) => [node.id, node]))
  const indegree = new Map(profile.nodes.map((node) => [node.id, 0]))
  for (const edge of profile.edges) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)

  const trace: FlowNodeResult[] = []
  let real = 0
  let simulated = 0
  let skipped = 0
  let warned = 0
  let failed = 0
  let halted: string | null = null

  // 只有入度为 0 的节点能拿到初始输入
  const queue: { nodeId: string; input: string; prevStatus: NodeStatus | 'start' }[] = profile.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => ({ nodeId: node.id, input: options.input, prevStatus: 'start' as const }))
  if (!queue.length && profile.nodes.length) {
    // 全图成环：没有入口，没法开始
    halted = '图谱没有入口节点（所有节点都有入边，成环了）'
  }

  const visited = new Set<string>()

  while (queue.length) {
    const { nodeId, input, prevStatus } = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = byId.get(nodeId)
    if (!node) continue
    let cursor = input

    // ── gate ──────────────────────────────────────────
    if (node.kind === 'gate') {
      if (node.gate !== 'if' && node.gate !== 'if-status') {
        // foreach 等还没实现：必须停下。guard 没跑就等于没通过，不能往下走。
        halted = `gate「${node.gate ?? node.label}」尚未实现（需要 fan-out/fan-in 语义），流程在此停止`
        trace.push({ nodeId, label: node.label, kind: `gate:${node.gate ?? '?'}`, status: 'failed', output: halted, real: false, fired: [] })
        failed += 1
        break
      }

      let truthy: boolean
      if (node.gate === 'if-status') {
        // 上游状态分支：没有上游（入口就是 gate）时无法判断
        if (prevStatus === 'start') {
          halted = `if-status gate「${node.label}」没有上游节点，无法按状态分支`
          trace.push({ nodeId, label: node.label, kind: 'gate:if-status', status: 'failed', output: halted, real: false, fired: [] })
          failed += 1
          break
        }
        truthy = prevStatus === 'ok'
      } else {
        const decided = evaluateIfGate(cursor)
        if (!decided.ok) {
          halted = decided.reason ?? 'if gate 无法判断'
          trace.push({ nodeId, label: node.label, kind: 'gate:if', status: 'failed', output: halted, real: false, fired: [] })
          failed += 1
          break
        }
        truthy = decided.truthy === true
      }
      const edges = firedEdges(profile, node, truthy)
      if (!edges.length) {
        halted = `${node.gate} gate「${node.label}」判定为 ${truthy}，但没有对应的出边`
        trace.push({ nodeId, label: node.label, kind: `gate:${node.gate}`, status: 'failed', output: halted, real: false, fired: [] })
        failed += 1
        break
      }
      const gateNote =
        node.gate === 'if-status'
          ? `上游=${prevStatus}`
          : `if(${cursor.slice(0, 30)})`
      trace.push({
        nodeId,
        label: node.label,
        kind: `gate:${node.gate}`,
        status: 'ok',
        output: `${gateNote} = ${truthy} → ${edges.map((edge) => edge.to).join(', ')}`,
        real: true,
        fired: edges.map((edge) => edge.to)
      })
      for (const edge of edges) queue.push({ nodeId: edge.to, input: cursor, prevStatus: 'ok' })
      continue
    }

    // ── subflow ───────────────────────────────────────
    if (node.kind === 'subflow') {
      // 子流程目标支持 $args.x，让同一个类能按实例参数跑不同子流程
      const rawTarget = node.pointInstance ?? ''
      const targetId = rawTarget.startsWith('$args.')
        ? (args[rawTarget.slice('$args.'.length)] ?? '')
        : rawTarget
      const lineStore = deps.lineStore?.()
      const target = targetId && lineStore ? lineStore.instance(targetId) : undefined
      if (!target) {
        halted = `子流程「${node.label}」找不到线实例 ${targetId ?? '(未绑定)'}`
        trace.push({ nodeId, label: node.label, kind: 'subflow', status: 'failed', output: halted, real: false, fired: [] })
        failed += 1
        break
      }
      const childProfile = deps.profiles[target.classId]
      if (!childProfile) {
        halted = `子流程「${node.label}」的目标类 ${target.classId} 还没有数据流图谱`
        trace.push({ nodeId, label: node.label, kind: 'subflow', status: 'failed', output: halted, real: false, fired: [] })
        failed += 1
        break
      }
      if (stack.includes(target.classId) || depth >= MAX_SUBFLOW_DEPTH) {
        halted = `子流程循环引用：${[...stack, target.classId].join(' → ')}（或超过 ${MAX_SUBFLOW_DEPTH} 层）`
        trace.push({ nodeId, label: node.label, kind: 'subflow', status: 'failed', output: halted, real: false, fired: [] })
        failed += 1
        break
      }

      const child = await runFlow({
        profile: childProfile,
        classId: target.classId,
        description: target.description ?? '',
        input: cursor,
        deps,
        depth: depth + 1,
        stack: [...stack, target.classId]
      })
      real += child.real
      simulated += child.simulated
      skipped += child.skipped
      warned += child.warned
      failed += child.failed
      cursor = child.outcome.value ?? child.outcome.output
      trace.push({
        nodeId,
        label: node.label,
        kind: 'subflow',
        status: child.outcome.status === 'ok' ? 'ok' : 'warn',
        output: `${target.classId}: ${child.outcome.output}`.slice(0, 200),
        real: child.real > 0,
        value: cursor,
        fired: profile.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.to)
      })
      if (child.outcome.status !== 'ok' || child.halted) {
        halted = `子流程「${node.label}」未成功：${child.halted ?? child.outcome.output.slice(0, 120)}`
        break
      }
      for (const edge of firedEdges(profile, node, true)) {
        queue.push({ nodeId: edge.to, input: cursor, prevStatus: child.outcome.status })
      }
      continue
    }

    // ── point ─────────────────────────────────────────
    const boundId = node.pointInstance
    const bound = boundId ? pointStore.instance(boundId) : undefined
    if (!bound) {
      // 未绑定不算失败，但下游拿不到值，且必须显式记 skipped
      skipped += 1
      trace.push({
        nodeId,
        label: node.label,
        kind: `point:${node.pointClass ?? '?'}`,
        status: 'skipped',
        output: `未绑定点实例 ${boundId ?? '(空)'}`,
        real: false,
        fired: []
      })
      // 跳过节点不往下传值：下游拿不到输入，链路到此为止
      continue
    }

    const isSimulated = !hasRealImpl(bound.classId)
    try {
      const { record, outcome } = await pointStore.runDetailed(bound.id, {
        input: cursor,
        args,
        params: applyMapping(bound.params, node.mapping, { input: cursor, args })
      })
      cursor = outcome.value ?? record.output
      const status: NodeStatus = record.status === 'ok' ? 'ok' : record.status === 'warn' ? 'warn' : 'failed'
      if (status === 'failed') failed += 1
      else if (status === 'warn') warned += 1
      else if (isSimulated) simulated += 1
      else real += 1
      const fired = status === 'failed' ? [] : firedEdges(profile, node, true).map((edge) => edge.to)
      trace.push({
        nodeId,
        label: node.label,
        kind: `point:${bound.classId}`,
        status,
        output: `${isSimulated ? '(模拟) ' : ''}${record.output}`.slice(0, 200),
        real: !isSimulated,
        value: cursor,
        fired
      })
      if (status === 'failed') {
        halted = `节点「${node.label}」失败：${record.output.slice(0, 120)}`
        break
      }
      for (const edge of firedEdges(profile, node, true)) {
        queue.push({ nodeId: edge.to, input: cursor, prevStatus: status })
      }
    } catch (error) {
      failed += 1
      halted = `节点「${node.label}」抛错：${error instanceof Error ? error.message : String(error)}`
      trace.push({ nodeId, label: node.label, kind: `point:${bound.classId}`, status: 'failed', output: halted, real: false, fired: [] })
      break
    }
  }

  const summary =
    `${trace.length}/${profile.nodes.length} 节点 · 真实 ${real} 模拟 ${simulated} 跳过 ${skipped}` +
    `${warned ? ` 警告 ${warned}` : ''} 失败 ${failed}`
  const detail = trace.map((item) => `${item.label}:${item.output.slice(0, 40)}`).join(' → ')

  const outcome: RunOutcome = {
    // 只有「全部节点都真实跑过且没警告」才算成功。
    // 任何节点 warn / 失败 / guard 没执行 / 全是模拟，都必须如实降到 warn——
    // 不然中间节点的警告会被整条流程的成功状态吞掉。
    status: failed > 0 || warned > 0 || real === 0 || halted !== null ? 'warn' : 'ok',
    output: (halted ? `${halted}｜${summary}｜${detail}` : `${summary}｜${detail}`).slice(0, 600),
    value: trace.length ? trace[trace.length - 1].value ?? '' : options.input,
    evidence: {
      backend: 'line-engine',
      classId: options.classId,
      depth,
      real,
      simulated,
      skipped,
      warned,
      failed,
      halted,
      nodes: trace.map((item) => ({
        id: item.nodeId,
        kind: item.kind,
        status: item.status,
        real: item.real,
        fired: item.fired
      }))
    },
    elapsedMs: Date.now() - startedAt
  }

  return { outcome, trace, real, simulated, skipped, warned, failed, halted }
}

export function createLineRunner(deps: FlowDeps): InstanceRunner {
  return async (ctx) => {
    const startedAt = Date.now()
    const profile = deps.profiles[ctx.instance.classId]
    if (!profile) {
      return {
        status: 'warn',
        output: `${ctx.instance.classId} 还没有数据流图谱，无法执行`,
        elapsedMs: Date.now() - startedAt
      }
    }

    const result = await runFlow({
      profile,
      classId: ctx.instance.classId,
      description: ctx.instance.description ?? '',
      input: ctx.input ?? '',
      deps,
      depth: 0,
      stack: [ctx.instance.classId]
    })
    return result.outcome
  }
}
