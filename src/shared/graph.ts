/**
 * 图算法（五层共用，纯函数，不依赖任何一层）。
 *
 * 从 `lineRuntime.orderNodes` 和 `field.critique.findCycles` 里提出来：
 * 执行器要拒绝带环的图，审查器要报出环在哪，两边必须用**同一套判定**，
 * 否则会出现"审查说没问题、执行器却停住"这种自相矛盾。
 */

export interface GraphNode {
  id: string
  kind?: string
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
}

/** 一条环：首尾是同一个节点 */
export type Cycle = string[]

export interface CycleReport {
  /** 环上有个 gate，且该 gate 有出口通向环外 —— 设计意图是遍历/重试 */
  loopConstructs: Cycle[]
  /** 环上没有任何出口 —— 真正的死循环 */
  deadCycles: Cycle[]
  /** 同时带上判定所依据的出口，便于报错信息说清楚 */
  exits: Map<string, string[]>
}

/** 自环 + DFS 三色标记找所有环（同一圈只报一次） */
export function findCycles(nodes: GraphNode[], edges: GraphEdge[]): Cycle[] {
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
  const cycles: Cycle[] = []
  const seen = new Set<string>()

  const visit = (node: string): void => {
    color.set(node, GREY)
    stack.push(node)
    for (const next of adj.get(node) ?? []) {
      if (color.get(next) === GREY) {
        const start = stack.indexOf(next)
        if (start >= 0) {
          const cycle = stack.slice(start).concat(next)
          const key = [...new Set(cycle)].sort().join('|')
          if (!seen.has(key)) {
            seen.add(key)
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

/**
 * 把环分类：有出口的 gate 环是「循环构造」，其余是「死循环」。
 *
 * 这个区分不是学术洁癖 —— 它决定了该报 warn 还是 error，
 * 也决定了执行器该说「暂不支持迭代」还是「图里有环」。
 */
export function classifyCycles(nodes: GraphNode[], edges: GraphEdge[], cycles = findCycles(nodes, edges)): CycleReport {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const loopConstructs: Cycle[] = []
  const deadCycles: Cycle[] = []
  const exits = new Map<string, string[]>()

  for (const cycle of cycles) {
    const body = cycle.slice(0, -1)
    const inCycle = new Set(body)
    const gate = body.find((id) => {
      if (byId.get(id)?.kind !== 'gate') return false
      return edges.some((edge) => edge.from === id && !inCycle.has(edge.to))
    })
    if (gate) {
      exits.set(gate, edges.filter((edge) => edge.from === gate && !inCycle.has(edge.to)).map((edge) => edge.to))
      loopConstructs.push(cycle)
    } else {
      deadCycles.push(cycle)
    }
  }
  return { loopConstructs, deadCycles, exits }
}

/**
 * 真正的拓扑排序（Kahn）：入度递减，环里的节点留在 remaining 里。
 *
 * 和原来那个 BFS 的区别：BFS 只是从根出发做广度遍历，遇到环会把
 * 环里的节点在末尾兜底塞进去，假装排序成功。这里不会 —— 排不出来的
 * 就是排不出来，调用方必须处理 remaining。
 */
export function topoOrder<T extends { id: string }>(
  nodes: T[],
  edges: GraphEdge[]
): { order: T[]; remaining: T[] } {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const indegree = new Map<string, number>()
  for (const node of nodes) indegree.set(node.id, 0)
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const order: T[] = []
  const seen = new Set<string>()

  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (node) order.push(node)
    for (const edge of edges) {
      if (edge.from !== id) continue
      const next = (indegree.get(edge.to) ?? 0) - 1
      indegree.set(edge.to, next)
      if (next === 0) queue.push(edge.to)
    }
  }

  return { order, remaining: nodes.filter((node) => !seen.has(node.id)) }
}
