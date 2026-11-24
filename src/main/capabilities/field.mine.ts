import { elapsed, type Capability } from './_shared'
import { readRunHistory, type RunHistoryLike } from './field.observe'
import { detectRepetition } from './field.detect'
import { lineProfiles } from '../../shared/lineCatalog'

export const id = 'field.mine'
export const summary = '历史挖掘：从运行历史与流程图里找可复用套路（连续动作 / 图结构 / 共现能力），纯规则'

/**
 * A1 · 挖掘（纯规则）
 *
 * 三个实例挖三种东西：
 *   action-sequence  反复出现的连续动作 → 建议固化成流程
 *   flow-template    结构相同的流程图     → 建议互为模板
 *   body-candidate   总在一起出现的能力   → 建议包成一个体
 *
 * 挖出来的都是**建议**，不是自动创建的草稿。A1 只出草稿，落地要人确认。
 */

export interface MinedPattern {
  kind: 'action-sequence' | 'flow-template' | 'body-candidate'
  title: string
  evidence: Record<string, unknown>
  confidence: number
}

/** 图结构签名：节点 kind 序列 + 边数，用来判断两张图是不是同一套骨架 */
export function flowShape(profile: { nodes?: Array<{ kind?: string }>; edges?: unknown[] }): string {
  const kinds = (profile.nodes ?? []).map((node) => node.kind ?? '?')
  return `${kinds.join('>')}|${(profile.edges ?? []).length}`
}

/** 纯函数：结构相同的流程分组 */
export function groupByShape(profiles: Record<string, { nodes?: Array<{ kind?: string }>; edges?: unknown[] }>): Array<{ shape: string; ids: string[] }> {
  const groups = new Map<string, string[]>()
  for (const [id, profile] of Object.entries(profiles)) {
    const shape = flowShape(profile)
    if (!groups.has(shape)) groups.set(shape, [])
    groups.get(shape)!.push(id)
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([shape, ids]) => ({ shape, ids }))
    .sort((a, b) => b.ids.length - a.ids.length)
}

/**
 * 纯函数：共现的能力对，按**会话**计数而不是按出现次数。
 *
 * 第一版是「时间窗内两两配对然后累加」，结果两个不同时段各出现一次也会被加成 2，
 * 于是「偶发同时出现」被误判成「总是一起出现」。
 * 现在按固定时间桶切会话，统计的是「这对在几个不同会话里同时出现」。
 */
export function coOccurrence(runs: RunHistoryLike[], windowMs = 5 * 60 * 1000): Array<{ pair: string[]; count: number }> {
  const sessions = new Map<number, Set<string>>()
  for (const run of runs) {
    if (!Number.isFinite(run.createdAt)) continue
    const bucket = Math.floor(run.createdAt / windowMs)
    if (!sessions.has(bucket)) sessions.set(bucket, new Set())
    sessions.get(bucket)!.add(run.classId)
  }

  // key → 出现在几个不同会话里
  const sessionCount = new Map<string, number>()
  for (const classes of sessions.values()) {
    const ids = [...classes].sort()
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]} + ${ids[j]}`
        sessionCount.set(key, (sessionCount.get(key) ?? 0) + 1)
      }
    }
  }

  return [...sessionCount.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => ({ pair: key.split(' + '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'action-sequence').toLowerCase()
  const runs = readRunHistory()
  const patterns: MinedPattern[] = []

  if (mode.includes('template')) {
    for (const group of groupByShape(lineProfiles as never)) {
      patterns.push({
        kind: 'flow-template',
        title: `${group.ids.length} 张图是同一套骨架：${group.ids.join('、')}`,
        evidence: { shape: group.shape, ids: group.ids },
        confidence: 0.9
      })
    }
  } else if (mode.includes('body')) {
    for (const item of coOccurrence(runs ?? [])) {
      patterns.push({
        kind: 'body-candidate',
        title: `${item.pair.join(' 和 ')} 在 5 分钟内一起出现 ${item.count} 次，适合包成一个体`,
        evidence: { pair: item.pair, count: item.count },
        confidence: Math.min(0.85, 0.5 + item.count * 0.1)
      })
    }
  } else {
    for (const signal of detectRepetition(runs ?? [])) {
      patterns.push({ kind: 'action-sequence', title: signal.title, evidence: signal.evidence, confidence: signal.confidence })
    }
  }

  if (mode.includes('template')) {
    // 图结构是本地数据，不依赖运行历史
    if (!patterns.length) {
      return { status: 'ok', output: `检查了 ${Object.keys(lineProfiles).length} 张流程图，没有结构相同的图`, value: '[]', elapsedMs: elapsed(startedAt), evidence: { kind: 'mine', mode, patterns: [] } }
    }
  } else if (!runs) {
    return {
      status: 'warn',
      output: `取不到运行历史（主进程未注入 setRunHistorySource），无法挖掘 ${mode}`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'mine', mode, problem: 'no-history' }
    }
  }

  if (!patterns.length) {
    return { status: 'ok', output: `没有挖到可复用的套路（mode=${mode}）`, value: '[]', elapsedMs: elapsed(startedAt), evidence: { kind: 'mine', mode, patterns: [] } }
  }

  return {
    status: 'ok',
    output: `挖到 ${patterns.length} 条套路（${mode}）：${patterns[0].title}`,
    value: JSON.stringify(patterns),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'mine', mode, patterns }
  }
}
