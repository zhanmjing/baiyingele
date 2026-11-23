/**
 * 线层执行器：把 FlowClass 的数据流图跑起来。
 *
 * 设计依据 ATOM-UNIFIED-MODEL：FlowRun 由若干 slotRun 组成，每个 slotRun
 * 对应一次真实的 PointRun。这里的实现是这条设计的最小可用版本：
 *   - 节点按 edges 拓扑排序执行（当前图谱都是线性链）
 *   - 节点的 mapping 决定上一个节点的输出 / 流程参数怎么落进点实例参数
 *   - 每个节点单独产生 PointRun，聚合成一条 FlowRun
 *   - 未绑定或绑定到不存在实例的节点记为 skipped（不假装成功）
 */
import type { LineNode, LineProfile } from '../shared/lineCatalog'
import type { InstanceRunner, LayerStore, RunOutcome } from './layerStore'

export interface FlowDeps {
  profiles: Record<string, LineProfile>
  /** 延迟取点层 store，避免构造顺序耦合 */
  pointStore: () => LayerStore
}

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

/** 按 edges 拓扑排序；有环或孤立节点追加在末尾，保证每个节点都被执行一次 */
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

    const args = parseFlowArgs(ctx.instance.description)
    const nodes = orderNodes(profile)
    const pointStore = deps.pointStore()
    const trace: string[] = []
    let cursor = ctx.input ?? ''
    let ok = 0
    let skipped = 0
    let failed = 0

    for (const node of nodes) {
      if (node.kind !== 'point') {
        skipped += 1
        trace.push(`${node.label}(skipped:${node.kind})`)
        continue
      }
      const boundId = node.pointInstance
      const bound = boundId ? pointStore.instance(boundId) : undefined
      if (!bound) {
        skipped += 1
        trace.push(`${node.label}(未绑定)`)
        continue
      }

      try {
        const { record, outcome } = await pointStore.runDetailed(bound.id, {
          input: cursor,
          args,
          params: applyMapping(bound.params, node.mapping, { input: cursor, args })
        })
        if (record.status === 'ok') ok += 1
        else failed += 1
        trace.push(`${node.label}: ${record.output}`)
        cursor = outcome.value ?? record.output
      } catch (error) {
        failed += 1
        trace.push(`${node.label}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const outcome: RunOutcome = {
      status: failed > 0 ? 'warn' : 'ok',
      output: `${nodes.length} 节点 · 成功 ${ok} 跳过 ${skipped} 失败 ${failed}｜${trace.join(' → ')}`.slice(0, 500),
      value: cursor,
      elapsedMs: Date.now() - startedAt
    }
    return outcome
  }
}
