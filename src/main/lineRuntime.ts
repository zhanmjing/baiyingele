/**
 * 线层执行器：把 LineClass 的数据流图跑起来。
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
 *   point        → 跑绑定的点实例；成功后激活**全部**出边
 *   gate:if      → 判断输入真假，**只**激活 true 或 false 那条边
 *   gate:if-status → 判断上游状态，**只**激活 ok 或 warn 那条边
 *   gate:foreach → 按输入列表逐项跑循环体，跑完再激活 done 边
 *   subflow      → 递归跑另一条线实例；成功后激活全部出边
 *
 * foreach 的图约定：
 *   foreach --each--> 循环体入口 …（循环体末端）--> foreach   ← 回边，表示一轮结束
 *   foreach --done--> 循环之后的续作
 *
 * 三条「宁可停下也不猜」：
 *   1. gate 无法判断 / 循环体结构不对 / 超过迭代上限 → 流程停下并记 halted
 *   2. 任何节点 warn，整条流程就是 warn（不能把中间警告吞成 ok）
 *   3. 子流程失败 / 循环引用 / 超层数 → 父流程立刻停
 */
import { stringParams } from '../shared/layerTypes'
import { classIdOf, instanceIdOf, isExprRef } from '../shared/atomId'
import { hasRealImpl } from '../shared/implRegistry'
import type { LineNode, LineProfile } from '../shared/lineCatalog'
import type { InstanceRunner, LayerStore, RunOutcome } from './layerStore'

export interface LineDeps {
  profiles: Record<string, LineProfile>
  /** 延迟取点层 store，避免构造顺序耦合 */
  pointStore: () => LayerStore
  /** 子流程节点要能从线层查实例；不传则子流程一律记 unsupported */
  lineStore?: () => LayerStore
}

/** 子流程最大嵌套深度，防跑飞 */
const MAX_SUBFLOW_DEPTH = 8
/** foreach 单次最多迭代多少项（超了就停下报错，不静默截断） */
const MAX_FOREACH_ITEMS = 100
/** foreach 里循环体最多跑多少个节点（防环） */
const MAX_BODY_STEPS = 200

/** 解析流程实例参数：'path=inbox.md；append=true' -> { path, append } */
export function parseLineArgs(detail: string): Record<string, string> {
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
 * 纯函数：把 foreach 的输入解析成列表。
 *
 * 优先当 JSON 数组解析（file.scan 这类节点返回的就是 JSON 数组），
 * 否则按换行切分。都不成立就返回 null —— 让流程停下，不猜。
 */
export function parseListValue(raw: string): { ok: boolean; items?: string[]; reason?: string } {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: true, items: [] }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return { ok: false, reason: 'foreach 输入是 JSON 但不是数组' }
      return {
        ok: true,
        items: parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      }
    } catch {
      return { ok: false, reason: `foreach 输入看起来是 JSON 数组但解析失败：${text.slice(0, 60)}` }
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > 1) return { ok: true, items: lines }
  return { ok: false, reason: `foreach 输入既不是 JSON 数组也不是多行列表：${text.slice(0, 60)}` }
}

/**
 * 纯函数：给定 gate 结果，算出该激活哪些出边。
 *
 * 分支 gate：
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

/**
 * 纯函数：算出图的入口节点。
 *
 * 普通图就是入度为 0 的节点。但 foreach 的循环体末端会有一条**回边**指回 gate，
 * 这条边不该让 gate 变成「有上游」，否则整图就没有入口了。
 *
 * 判定回边的办法：如果某条边指向一个 foreach gate，而它的起点能从该 gate 的
 * `each` 分支到达，那它就是回边，不计入入度。
 */
export function entryNodes(profile: LineProfile): LineNode[] {
  const foreachIds = new Set(
    profile.nodes.filter((node) => node.kind === 'gate' && node.gate === 'foreach').map((node) => node.id)
  )

  const reachableFrom = (startIds: string[]): Set<string> => {
    const seen = new Set<string>()
    const stack = [...startIds]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const edge of profile.edges) {
        if (edge.from === id && !seen.has(edge.to)) stack.push(edge.to)
      }
    }
    return seen
  }

  const backEdges = new Set<string>()
  for (const gateId of foreachIds) {
    const eachTargets = profile.edges
      .filter((edge) => edge.from === gateId && (edge.label ?? '').toLowerCase() === 'each')
      .map((edge) => edge.to)
    const bodyNodes = reachableFrom(eachTargets)
    for (const edge of profile.edges) {
      if (edge.to === gateId && bodyNodes.has(edge.from)) backEdges.add(`${edge.from}>${edge.to}`)
    }
  }

  const indegree = new Map(profile.nodes.map((node) => [node.id, 0]))
  for (const edge of profile.edges) {
    if (backEdges.has(`${edge.from}>${edge.to}`)) continue
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  }
  return profile.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0)
}

export type NodeStatus = 'ok' | 'warn' | 'skipped' | 'failed'

export interface LineNodeResult {
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

interface Counters {
  real: number
  simulated: number
  skipped: number
  warned: number
  failed: number
}

interface NodeOutcome {
  result: LineNodeResult
  value: string
  status: NodeStatus
  /** 要接着跑的 node id 列表 */
  next: string[]
  /** 非 null 表示流程必须停下 */
  halt: string | null
}

interface ExecContext {
  node: LineNode
  profile: LineProfile
  input: string
  prevStatus: NodeStatus | 'start'
  args: Record<string, string>
  deps: LineDeps
  depth: number
  stack: string[]
  counters: Counters
  loopDepth: number
  /** 记录一个节点结果；由发起本次运行的一方提供，避免用模块级共享状态 */
  record: (result: LineNodeResult) => void
}

async function execNode(context: ExecContext): Promise<NodeOutcome> {
  const { node, profile, input, prevStatus, args, deps, counters } = context
  const outgoing = (label?: string): string[] =>
    profile.edges
      .filter((edge) => edge.from === node.id && (label === undefined || (edge.label ?? '').toLowerCase() === label))
      .map((edge) => edge.to)

  const base = (overrides: Partial<NodeOutcome> & { result: LineNodeResult }): NodeOutcome => ({
    value: input,
    status: overrides.result.status,
    next: [],
    halt: null,
    ...overrides
  })

  // ── gate ──────────────────────────────────────────
  if (node.kind === 'gate') {
    if (node.gate === 'foreach') {
      return runForEach(context, base)
    }

    if (node.gate !== 'if' && node.gate !== 'if-status') {
      counters.failed += 1
      const halt = `gate「${node.gate ?? node.label}」尚未实现，流程在此停止`
      return base({
        result: { nodeId: node.id, label: node.label, kind: `gate:${node.gate ?? '?'}`, status: 'failed', output: halt, real: false, fired: [] },
        halt
      })
    }

    let truthy: boolean
    if (node.gate === 'if-status') {
      if (prevStatus === 'start') {
        counters.failed += 1
        const halt = `if-status gate「${node.label}」没有上游节点，无法按状态分支`
        return base({
          result: { nodeId: node.id, label: node.label, kind: 'gate:if-status', status: 'failed', output: halt, real: false, fired: [] },
          halt
        })
      }
      truthy = prevStatus === 'ok'
    } else {
      const decided = evaluateIfGate(input)
      if (!decided.ok) {
        counters.failed += 1
        const halt = decided.reason ?? 'if gate 无法判断'
        return base({
          result: { nodeId: node.id, label: node.label, kind: 'gate:if', status: 'failed', output: halt, real: false, fired: [] },
          halt
        })
      }
      truthy = decided.truthy === true
    }

    const edges = firedEdges(profile, node, truthy)
    if (!edges.length) {
      counters.failed += 1
      const halt = `${node.gate} gate「${node.label}」判定为 ${truthy}，但没有对应的出边`
      return base({
        result: { nodeId: node.id, label: node.label, kind: `gate:${node.gate}`, status: 'failed', output: halt, real: false, fired: [] },
        halt
      })
    }

    const note = node.gate === 'if-status' ? `上游=${prevStatus}` : `if(${input.slice(0, 30)})`
    return base({
      result: {
        nodeId: node.id,
        label: node.label,
        kind: `gate:${node.gate}`,
        status: 'ok',
        output: `${note} = ${truthy} → ${edges.map((edge) => edge.to).join(', ')}`,
        real: true,
        fired: edges.map((edge) => edge.to)
      },
      next: edges.map((edge) => edge.to)
    })
  }

  // ── subflow ───────────────────────────────────────
  if (node.kind === 'subflow') {
    const rawTarget = node.pointInstance
    // pointInstance 现在是三种形态：结构化实例引用 / {expr:'$args.x'} / 旧字符串
    const targetId = isExprRef(rawTarget)
      ? (args[String(rawTarget.expr).replace(/^\$args\./, '')] ?? '')
      : (instanceIdOf(rawTarget) ?? '')
    const lineStore = deps.lineStore?.()
    const target = targetId && lineStore ? lineStore.instance(targetId) : undefined
    const fail = (halt: string): NodeOutcome => {
      counters.failed += 1
      return base({
        result: { nodeId: node.id, label: node.label, kind: 'subflow', status: 'failed', output: halt, real: false, fired: [] },
        halt
      })
    }
    if (!target) return fail(`子流程「${node.label}」找不到线实例 ${targetId || '(未绑定)'}`)
    const childProfile = deps.profiles[target.classId]
    if (!childProfile) return fail(`子流程「${node.label}」的目标类 ${target.classId} 还没有数据流图谱`)
    if (context.stack.includes(target.classId) || context.depth >= MAX_SUBFLOW_DEPTH) {
      return fail(`子流程循环引用：${[...context.stack, target.classId].join(' → ')}（或超过 ${MAX_SUBFLOW_DEPTH} 层）`)
    }

    const child = await runLineInstance({
      profile: childProfile,
      classId: target.classId,
      description: target.description ?? '',
      input,
      deps,
      depth: context.depth + 1,
      stack: [...context.stack, target.classId]
    })
    counters.real += child.real
    counters.simulated += child.simulated
    counters.skipped += child.skipped
    counters.warned += child.warned
    counters.failed += child.failed

    const value = child.outcome.value ?? child.outcome.output
    const status: NodeStatus = child.outcome.status === 'ok' ? 'ok' : 'warn'
    const halted = child.halted ? `子流程「${node.label}」未成功：${child.halted}` : null

    return base({
      result: {
        nodeId: node.id,
        label: node.label,
        kind: 'subflow',
        status,
        output: `${target.classId}: ${child.outcome.output}`.slice(0, 200),
        real: child.real > 0,
        value,
        fired: halted ? [] : outgoing()
      },
      value,
      status,
      next: halted ? [] : outgoing(),
      halt: halted
    })
  }

  // ── point ─────────────────────────────────────────
  const pointStore = deps.pointStore()
  const boundId = instanceIdOf(node.pointInstance)
  const bound = boundId ? pointStore.instance(boundId) : undefined
  if (!bound) {
    // 未绑定不算失败，但下游拿不到值，且必须显式记 skipped
    counters.skipped += 1
    return base({
      result: {
        nodeId: node.id,
        label: node.label,
        kind: `point:${classIdOf(node.pointClass) ?? '?'}`,
        status: 'skipped',
        output: `未绑定点实例 ${boundId ?? '(空)'}`,
        real: false,
        fired: []
      }
    })
  }

  const isSimulated = !hasRealImpl(bound.classId)
  try {
    const { record, outcome } = await pointStore.runDetailed(bound.id, {
      input,
      args,
      params: applyMapping(stringParams(bound.params), node.mapping, { input, args })
    })
    const value = outcome.value ?? record.output
    const status: NodeStatus = record.status === 'ok' ? 'ok' : record.status === 'warn' ? 'warn' : 'failed'
    if (status === 'failed') counters.failed += 1
    else if (status === 'warn') counters.warned += 1
    else if (isSimulated) counters.simulated += 1
    else counters.real += 1

    const halt = status === 'failed' ? `节点「${node.label}」失败：${record.output.slice(0, 120)}` : null
    return base({
      result: {
        nodeId: node.id,
        label: node.label,
        kind: `point:${bound.classId}`,
        status,
        output: `${isSimulated ? '(模拟) ' : ''}${record.output}`.slice(0, 200),
        real: !isSimulated,
        value,
        fired: halt ? [] : outgoing()
      },
      value,
      status,
      next: halt ? [] : outgoing(),
      halt
    })
  } catch (error) {
    counters.failed += 1
    const halt = `节点「${node.label}」抛错：${error instanceof Error ? error.message : String(error)}`
    return base({
      result: { nodeId: node.id, label: node.label, kind: `point:${bound.classId}`, status: 'failed', output: halt, real: false, fired: [] },
      halt
    })
  }
}

/** foreach：按输入列表逐项跑循环体，跑完激活 done 边 */
async function runForEach(
  context: ExecContext,
  base: (overrides: Partial<NodeOutcome> & { result: LineNodeResult }) => NodeOutcome
): Promise<NodeOutcome> {
  const { node, profile, input, args, deps, counters, loopDepth } = context
  const fail = (halt: string): NodeOutcome => {
    counters.failed += 1
    return base({
      result: { nodeId: node.id, label: node.label, kind: 'gate:foreach', status: 'failed', output: halt, real: false, fired: [] },
      halt
    })
  }

  if (loopDepth >= 3) return fail(`foreach 嵌套超过 3 层，流程在此停止`)

  const parsed = parseListValue(input)
  if (!parsed.ok) return fail(parsed.reason ?? 'foreach 无法解析输入列表')
  const items = parsed.items ?? []
  if (items.length > MAX_FOREACH_ITEMS) {
    return fail(`foreach 输入有 ${items.length} 项，超过上限 ${MAX_FOREACH_ITEMS}，流程在此停止（不静默截断）`)
  }

  const eachTargets = profile.edges
    .filter((edge) => edge.from === node.id && (edge.label ?? '').toLowerCase() === 'each')
    .map((edge) => edge.to)
  const doneTargets = profile.edges
    .filter((edge) => edge.from === node.id && (edge.label ?? '').toLowerCase() === 'done')
    .map((edge) => edge.to)

  if (!eachTargets.length) return fail(`foreach「${node.label}」缺少 each 出边（循环体入口）`)

  let iterations = 0
  for (const item of items) {
    iterations += 1
    const queue: { nodeId: string; input: string; prevStatus: NodeStatus | 'ok' }[] = eachTargets.map((targetId) => ({
      nodeId: targetId,
      input: item,
      prevStatus: 'ok'
    }))
    const visited = new Set<string>()
    let steps = 0

    while (queue.length) {
      if (++steps > MAX_BODY_STEPS) return fail(`foreach 循环体执行超过 ${MAX_BODY_STEPS} 步，疑似存在环`)
      const current = queue.shift()!
      if (visited.has(current.nodeId)) continue
      visited.add(current.nodeId)

      const bodyNode = profile.nodes.find((candidate) => candidate.id === current.nodeId)
      if (!bodyNode) return fail(`foreach 循环体引用了不存在的节点 ${current.nodeId}`)

      const outcome = await execNode({
        ...context,
        node: bodyNode,
        input: current.input,
        prevStatus: current.prevStatus,
        loopDepth: loopDepth + 1
      })
      context.record(outcome.result)
      if (outcome.halt) return { ...outcome, halt: `第 ${iterations} 轮：${outcome.halt}` }

      for (const target of outcome.next) {
        // 回边指回 foreach 本身 = 这一轮结束
        if (target === node.id) continue
        queue.push({ nodeId: target, input: outcome.value, prevStatus: outcome.status })
      }
    }
  }

  return base({
    result: {
      nodeId: node.id,
      label: node.label,
      kind: 'gate:foreach',
      status: 'ok',
      output: `遍历 ${iterations}/${items.length} 项，然后进入 ${doneTargets.join(', ') || '(无 done 边)'}`,
      real: true,
      fired: doneTargets
    },
    value: input,
    next: doneTargets
  })
}

interface RunLineOptions {
  profile: LineProfile
  classId: string
  description: string
  input: string
  deps: LineDeps
  depth: number
  stack: string[]
}

interface RunLineResult {
  outcome: RunOutcome
  trace: LineNodeResult[]
  real: number
  simulated: number
  skipped: number
  warned: number
  failed: number
  halted: string | null
}

async function runLineInstance(options: RunLineOptions): Promise<RunLineResult> {
  const { profile, description, deps, depth, stack } = options
  const startedAt = Date.now()
  const args = parseLineArgs(description)
  const counters: Counters = { real: 0, simulated: 0, skipped: 0, warned: 0, failed: 0 }

  const collected: LineNodeResult[] = []
  const record = (result: LineNodeResult): void => {
    collected.push(result)
  }
  let halted: string | null = null

  // 只有入度为 0 的节点能拿到初始输入
  const queue: { nodeId: string; input: string; prevStatus: NodeStatus | 'start' }[] = entryNodes(profile).map(
    (node) => ({ nodeId: node.id, input: options.input, prevStatus: 'start' as const })
  )
  if (!queue.length && profile.nodes.length) {
    halted = '图谱没有入口节点（所有节点都有入边，成环了）'
  }

  const visited = new Set<string>()

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current.nodeId)) continue
    visited.add(current.nodeId)

    const node = profile.nodes.find((candidate) => candidate.id === current.nodeId)
    if (!node) continue

    const before = collected.length
    const outcome = await execNode({
      node,
      profile,
      input: current.input,
      prevStatus: current.prevStatus,
      args,
      deps,
      depth,
      stack,
      counters,
      loopDepth: 0,
      record
    })
    // foreach 这类节点在 execNode 内部就会把循环体逐次记进来；
    // 把 gate 自己那行插到它的循环体之前，读起来才是「先遍历、再逐项」。
    const bodyRecords = collected.splice(before)
    collected.push(outcome.result, ...bodyRecords)
    if (outcome.halt) {
      halted = outcome.halt
      break
    }
    for (const target of outcome.next) {
      queue.push({ nodeId: target, input: outcome.value, prevStatus: outcome.status })
    }
  }

  // 保持执行顺序：foreach 会把同一个节点执行多次，按图位置重排会打乱因果关系
  const orderedTrace = collected

  const repeated = orderedTrace.length !== profile.nodes.length
  const summary =
    (repeated ? `执行 ${orderedTrace.length} 次（图 ${profile.nodes.length} 节点）` : `${profile.nodes.length} 节点`) +
    ` · 真实 ${counters.real} 模拟 ${counters.simulated} 跳过 ${counters.skipped}` +
    `${counters.warned ? ` 警告 ${counters.warned}` : ''} 失败 ${counters.failed}`
  const detail = orderedTrace.map((item) => `${item.label}:${item.output.slice(0, 40)}`).join(' → ')

  const last = orderedTrace[orderedTrace.length - 1]
  const outcome: RunOutcome = {
    // 只有「全部节点都真实跑过且没警告」才算成功。
    // 任何节点 warn / 失败 / guard 没执行 / 全是模拟，都必须如实降到 warn——
    // 不然中间节点的警告会被整条流程的成功状态吞掉。
    status: counters.failed > 0 || counters.warned > 0 || counters.real === 0 || halted !== null ? 'warn' : 'ok',
    output: (halted ? `${halted}｜${summary}｜${detail}` : `${summary}｜${detail}`).slice(0, 600),
    value: last?.value ?? options.input,
    evidence: {
      backend: 'line-engine',
      classId: options.classId,
      depth,
      real: counters.real,
      simulated: counters.simulated,
      skipped: counters.skipped,
      warned: counters.warned,
      failed: counters.failed,
      halted,
      nodes: orderedTrace.map((item) => ({
        id: item.nodeId,
        kind: item.kind,
        status: item.status,
        real: item.real,
        fired: item.fired
      }))
    },
    elapsedMs: Date.now() - startedAt
  }

  return { outcome, trace: orderedTrace, ...counters, halted }
}

export function createLineRunner(deps: LineDeps): InstanceRunner {
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

    const result = await runLineInstance({
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
