import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'field.rank'
export const summary = '确定性排序：按优先度、使用频次、名称给条目排序，不调用模型'

/**
 * A2 · 排序（确定性）
 *
 * 排序是决策，但它不需要模型：优先度是声明好的、使用频次是数出来的、
 * 名称是排出来的。三者都是确定性的，所以这个能力**一行模型调用都没有**。
 *
 * 输入（ctx.input 或 params.items）：JSON 数组，每项至少要有可排序字段
 *   [{ "id": "...", "priority": "P0", "name": "..." , "usage": 3 }]
 *
 * 或者 params.from 从目录里取：
 *   from=classes  layer=point      → 该层的类
 *   from=instances layer=point      → 该层的实例
 *   from=dock                      → 启动坞磁贴
 *
 * 排序键（依次）：
 *   1. priority  P0 > P1 > P2 > 无
 *   2. usage     使用次数，多的在前
 *   3. name      字典序，保证结果稳定可复现
 */

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

export interface Rankable {
  id: string
  name?: string
  priority?: string
  usage?: number
}

export interface RankedItem extends Rankable {
  rank: number
  /** 为什么排在这 —— 便于界面解释，也便于测试 */
  reason: string
}

/** 纯函数：排序。稳定、可复现、理由可解释。 */
export function rankItems(items: Rankable[]): RankedItem[] {
  const scored = items.map((item) => ({
    item,
    p: item.priority && item.priority in PRIORITY_RANK ? PRIORITY_RANK[item.priority] : 99,
    u: Number.isFinite(item.usage) ? Number(item.usage) : 0,
    n: String(item.name ?? item.id ?? '')
  }))
  scored.sort((a, b) => {
    if (a.p !== b.p) return a.p - b.p
    if (a.u !== b.u) return b.u - a.u
    return a.n.localeCompare(b.n, 'zh-Hans-CN')
  })
  return scored.map((row, index) => {
    const bits: string[] = []
    bits.push(row.item.priority ? `优先度 ${row.item.priority}` : '优先度未声明')
    if (row.u > 0) bits.push(`使用 ${row.u} 次`)
    return { ...row.item, rank: index + 1, reason: bits.join(' · ') }
  })
}

/** 从运行历史数出每个类的使用频次 */
function usageOf(runs: { classId: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const run of runs) map.set(run.classId, (map.get(run.classId) ?? 0) + 1)
  return map
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  let items: Rankable[] = []

  const raw = String(ctx.input ?? ctx.params.items ?? '').trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return { status: 'warn', output: 'items 必须是 JSON 数组', elapsedMs: elapsed(startedAt) }
      }
      items = parsed
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          id: String(x.id ?? ''),
          name: x.name === undefined ? undefined : String(x.name),
          priority: x.priority === undefined ? undefined : String(x.priority),
          usage: x.usage === undefined ? undefined : Number(x.usage)
        }))
        .filter((x) => x.id)
    } catch (error) {
      return { status: 'warn', output: `items 不是合法 JSON：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
    }
  } else {
    const from = String(ctx.params.from ?? '').trim().toLowerCase()
    if (!from) {
      return {
        status: 'warn',
        output: '需要 items（JSON 数组）或 params.from（classes / instances / dock）',
        elapsedMs: elapsed(startedAt)
      }
    }
    const layerKey = String(ctx.params.layer ?? '').trim()
    const layer = ctx.def.classes
    if (from === 'classes' || from === 'instances') {
      if (!layer.length) {
        return { status: 'warn', output: '当前层没有类可排', elapsedMs: elapsed(startedAt) }
      }
      items =
        from === 'classes'
          ? layer.map((cls) => ({ id: cls.id, name: cls.name, priority: cls.priority }))
          : layer.flatMap((cls) =>
              cls.instances.map((inst) => ({ id: inst.id, name: inst.name, priority: cls.priority }))
            )
      if (layerKey && layerKey !== ctx.def.key) {
        return {
          status: 'warn',
          output: `params.layer=${layerKey} 与当前层 ${ctx.def.key} 不符`,
          elapsedMs: elapsed(startedAt)
        }
      }
    } else {
      return { status: 'warn', output: `不支持的 from=${from}`, elapsedMs: elapsed(startedAt) }
    }
  }

  if (!items.length) {
    return { status: 'warn', output: '没有可排序的条目', elapsedMs: elapsed(startedAt) }
  }

  const ranked = rankItems(items)
  const head = ranked
    .slice(0, 3)
    .map((item) => `${item.rank}. ${item.name ?? item.id}`)
    .join('、')
  return {
    status: 'ok',
    output: `已排序 ${ranked.length} 条：${head}${ranked.length > 3 ? ` …` : ''}`,
    value: JSON.stringify(ranked),
    evidence: {
      kind: 'rank',
      count: ranked.length,
      // 排序是确定性的：同样输入永远同样输出，所以不需要模型
      deterministic: true,
      top: ranked.slice(0, 5).map((item) => ({ id: item.id, rank: item.rank, reason: item.reason }))
    },
    elapsedMs: elapsed(startedAt)
  }
}

export { usageOf }
