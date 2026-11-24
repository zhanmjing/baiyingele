import { lineClassesSeed, lineProfiles } from '../../shared/lineCatalog'
import { pointClassesSeed } from '../../shared/pointCatalog'
import { parseFlowArgs } from '../flowRuntime'
import { classIdOf, instanceIdOf, isExprRef } from '../../shared/atomId'
import { assessRisk } from './field.guard'
import { elapsed, type Capability } from './_shared'

export const id = 'field.simulate'
export const summary = '静态推演：走一遍流程图，算出会碰哪些节点/路径/窗口和最坏副作用，但不执行'

/**
 * A0 · 静态推演（dry-run / impact / rollback）
 *
 * 关键限制必须说清楚：**这是静态分析，不是模拟执行**。
 * 条件分支（if / if-status）在执行前无法判定真假，所以两条分支都算在「可能执行」里 ——
 * 报的是**最坏情况**，不是预测。这样做的原因：宁可高估影响面，也不能漏报一个
 * 会删文件的节点。
 *
 * 不调用任何模型、不执行任何点实例、不读写任何文件。
 */

const EFFECT_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }

/** 这些参数名代表「会碰到的路径」 */
const PATH_PARAMS = ['path', 'from', 'to', 'toDir', 'root', 'target']

export type SimulationMode = 'dry-run' | 'impact' | 'rollback'

export interface TouchPoints {
  paths: string[]
  windows: string[]
}

export interface SimNode {
  id: string
  label: string
  kind: string
  classId?: string
  effect?: string
  /** 这个节点存在的问题：未绑定 / 类没实现 / 子流程缺图 */
  problem?: string
  /** 根据参数推断出来的接触面 */
  touch: TouchPoints
  /** 条件分支：两条路都可能走 */
  branch?: string
}

export interface SimResult {
  classId: string
  mode: SimulationMode
  nodes: SimNode[]
  /** 所有可达节点的最坏副作用 */
  maxEffect: string | null
  /** 条件分支数量（说明结论有多不确定） */
  branchCount: number
  problems: string[]
  /** 需要递归推演的子流程 */
  subflows: string[]
}

function pointClassById(classId: string) {
  return pointClassesSeed.find((item) => item.id === classId)
}

function lineInstanceById(instanceId: string) {
  for (const cls of lineClassesSeed) {
    const found = cls.instances.find((item) => item.id === instanceId)
    if (found) return { classId: cls.id, instance: found }
  }
  return null
}

/**
 * 纯函数：模型参数 → 接触面。
 *
 * 只看参数名，不看语义 —— 所以它是**推断**而不是保证。
 * 比如 file.move 的 from/to/toDir 都是路径，window 系类的 selector 是窗口条件。
 */
export function inferTouchPoints(classId: string, params: Record<string, string>): TouchPoints {
  const paths: string[] = []
  const windows: string[] = []

  for (const [key, rawValue] of Object.entries(params)) {
    const value = String(rawValue ?? '').trim()
    if (!value) continue

    if (PATH_PARAMS.includes(key)) {
      // win.open 的 target 只有在 kind 不是 url 时才是路径
      if (key === 'target' && classId === 'point.open') {
        const kind = String(params.kind ?? '').toLowerCase()
        if (kind === 'url') continue
      }
      paths.push(value)
    }

    if (key === 'selector' && /window/.test(classId)) {
      try {
        const parsed = JSON.parse(value) as { process?: unknown; title?: unknown; hwnd?: unknown }
        if (parsed.process) windows.push(`进程~${String(parsed.process)}`)
        if (parsed.title) windows.push(`标题~${String(parsed.title)}`)
        if (parsed.hwnd) windows.push(`句柄=${String(parsed.hwnd)}`)
      } catch {
        windows.push(`selector=${value.slice(0, 40)}`)
      }
    }
  }

  return { paths, windows }
}

/** 纯函数：把节点 mapping 里的 $args / $input 替换成可读形式，便于推断接触面 */
export function resolveMapping(
  base: Record<string, string>,
  mapping: Record<string, string> | undefined,
  args: Record<string, string>
): Record<string, string> {
  const result = { ...base }
  for (const [key, expression] of Object.entries(mapping ?? {})) {
    if (expression === '$input') result[key] = '<上游输出>'
    else if (expression.startsWith('$args.')) {
      const argKey = expression.slice('$args.'.length)
      result[key] = args[argKey] ?? `<缺少参数 ${argKey}>`
    } else result[key] = expression
  }
  return result
}

/** 纯函数：从节点列表里算出最坏副作用 */
export function worstEffect(nodes: SimNode[]): string | null {
  let worst: string | null = null
  for (const node of nodes) {
    const level = node.effect ? EFFECT_ORDER[node.effect] : undefined
    if (level === undefined) continue
    if (worst === null || level > (EFFECT_ORDER[worst] ?? -1)) worst = node.effect ?? null
  }
  return worst
}

/** 递归推演一张图。静态分析：所有分支都算「可能执行」。 */
export function analyzeFlow(
  classId: string,
  args: Record<string, string>,
  stack: string[] = []
): SimResult {
  const result: SimResult = {
    classId,
    mode: 'dry-run',
    nodes: [],
    maxEffect: null,
    branchCount: 0,
    problems: [],
    subflows: []
  }

  const profile = lineProfiles[classId]
  if (!profile) {
    result.problems.push(`${classId} 没有数据流图谱，无法推演`)
    return result
  }
  if (stack.includes(classId)) {
    result.problems.push(`子流程循环引用：${[...stack, classId].join(' → ')}`)
    return result
  }

  for (const node of profile.nodes) {
    if (node.kind === 'gate') {
      const gateLabel = node.gate ?? '?'
      result.nodes.push({
        id: node.id,
        label: node.label,
        kind: `gate:${gateLabel}`,
        touch: { paths: [], windows: [] },
        ...(gateLabel === 'if' || gateLabel === 'if-status' ? { branch: '两条分支都会计入影响面' } : {})
      })
      if (gateLabel === 'if' || gateLabel === 'if-status') result.branchCount += 1
      continue
    }

    if (node.kind === 'subflow') {
      const rawTarget = node.pointInstance
      const exprText = isExprRef(rawTarget) ? String(rawTarget.expr) : null
      const targetId = exprText
        ? (args[exprText.replace(/^\$args\./, '')] ?? '')
        : (instanceIdOf(rawTarget) ?? '')
      const target = targetId ? lineInstanceById(targetId) : null
      if (!target) {
        result.nodes.push({
          id: node.id,
          label: node.label,
          kind: 'subflow',
          problem: `子流程目标不存在：${targetId || '(未绑定)'}`,
          touch: { paths: [], windows: [] }
        })
        result.problems.push(`${classId}/${node.id} 子流程目标不存在：${targetId || '(未绑定)'}`)
        continue
      }
      const child = analyzeFlow(target.classId, args, [...stack, classId])
      result.subflows.push(target.classId)
      result.nodes.push({
        id: node.id,
        label: node.label,
        kind: 'subflow',
        classId: target.classId,
        effect: child.maxEffect ?? undefined,
        touch: {
          paths: child.nodes.flatMap((item) => item.touch.paths),
          windows: child.nodes.flatMap((item) => item.touch.windows)
        },
        ...(child.problems.length ? { problem: child.problems.join('；') } : {})
      })
      result.problems.push(...child.problems)
      result.branchCount += child.branchCount
      continue
    }

    // point 节点
    const boundId = instanceIdOf(node.pointInstance)
    let instance: { params?: Record<string, string> } | undefined
    for (const cls of pointClassesSeed) {
      const found = cls.instances.find((item) => item.id === boundId)
      if (found) {
        instance = found
        break
      }
    }
    const pointClassName = classIdOf(node.pointClass)
    const pointClass = pointClassName ? pointClassById(pointClassName) : undefined
    const params = resolveMapping(instance?.params ?? {}, node.mapping, args)

    if (!instance || !pointClass) {
      result.nodes.push({
        id: node.id,
        label: node.label,
        kind: `point:${classIdOf(node.pointClass) ?? '?'}`,
        problem: `未绑定点实例 ${boundId || '(空)'}`,
        touch: { paths: [], windows: [] }
      })
      result.problems.push(`${classId}/${node.id} 未绑定点实例 ${boundId || '(空)'}`)
      continue
    }

    result.nodes.push({
      id: node.id,
      label: node.label,
      kind: `point:${pointClass.id}`,
      classId: pointClass.id,
      effect: pointClass.effect,
      touch: inferTouchPoints(pointClass.id, params)
    })
  }

  result.maxEffect = worstEffect(result.nodes)
  return result
}

/** 纯函数：把推演结果变成「哪些层/哪些能力会动」的汇总 */
export function summarizeImpact(result: SimResult): {
  /** 真实层名（point / line / surface / body / field） */
  layers: string[]
  /** 涉及的具体类 id，比层名更能说明这个流程在动什么 */
  classes: string[]
  effects: Record<string, number>
  pathCount: number
  windowCount: number
} {
  const layers = new Set<string>()
  const classes = new Set<string>()
  const effects: Record<string, number> = {}
  let pathCount = 0
  let windowCount = 0
  for (const node of result.nodes) {
    if (node.classId) {
      layers.add(node.classId.split('.')[0])
      classes.add(node.classId)
    }
    if (node.effect) effects[node.effect] = (effects[node.effect] ?? 0) + 1
    pathCount += node.touch.paths.length
    windowCount += node.touch.windows.length
  }
  return { layers: [...layers].sort(), classes: [...classes].sort(), effects, pathCount, windowCount }
}

/** A0 · 静态推演 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  const requested = String(ctx.params.mode ?? '').trim().toLowerCase()
  const mode: SimulationMode =
    requested === 'impact' || requested === 'rollback' || requested === 'dry-run' ? requested : modeFromDescription(String(ctx.instance.description ?? ''))

  const classId = String(ctx.params.classId ?? ctx.instance.classId).trim()
  if (!classId) {
    return { status: 'warn', output: '需要 classId（要推演的流程类）', elapsedMs: elapsed(startedAt) }
  }

  // 目标流程的实例参数：可以直接传 args JSON，也可以用 ctx.args
  let args: Record<string, string> = { ...(ctx.args ?? {}) }
  const argsRaw = String(ctx.params.args ?? '').trim()
  if (argsRaw) {
    try {
      const parsed = JSON.parse(argsRaw) as Record<string, unknown>
      args = { ...args, ...Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)])) }
    } catch {
      return { status: 'warn', output: `args 不是合法 JSON：${argsRaw.slice(0, 60)}`, elapsedMs: elapsed(startedAt) }
    }
  }
  // 也支持 'path=x；pattern=*.pdf' 这种写法
  if (!argsRaw && String(ctx.input ?? '').includes('=')) {
    args = { ...parseFlowArgs(String(ctx.input ?? '')), ...args }
  }

  if (!lineProfiles[classId]) {
    return {
      status: 'warn',
      output: `${classId} 没有数据流图谱，无法推演`,
      evidence: { mode, classId },
      elapsedMs: elapsed(startedAt)
    }
  }

  const analysis = analyzeFlow(classId, args)
  const impact = summarizeImpact(analysis)
  const verdict = assessRisk({
    effect: analysis.maxEffect ?? 'L0',
    autonomy: 'A2',
    confidence: null,
    approved: false,
    text: '',
    action: ''
  })

  const pathList = analysis.nodes.flatMap((node) => node.touch.paths)
  const windowList = analysis.nodes.flatMap((node) => node.touch.windows)
  const riskNote = `${analysis.maxEffect ?? 'L0'} 级（闸门判断：${verdict.decision === 'allow' ? '可放行' : verdict.decision === 'ask' ? '需人工确认' : '会被拒绝'}）`
  const branchNote = analysis.branchCount ? ` · ${analysis.branchCount} 处条件分支（两条路都计入最坏情况）` : ''

  if (mode === 'rollback') {
    const irreversible = analysis.nodes.filter((node) => node.effect === 'L2' || node.effect === 'L3')
    return {
      status: 'ok',
      output:
        (irreversible.length
          ? `回滚不可完整保证：${irreversible.length} 个节点是 L2/L3（${irreversible.map((node) => node.label).join(', ')}）`
          : '全部节点都是 L0/L1，可通过 undo journal 回滚') + `｜最坏 ${riskNote}${branchNote}`,
      value: JSON.stringify({ classId, reversible: irreversible.length === 0, irreversible: irreversible.map((node) => node.id) }),
      evidence: {
        mode,
        classId,
        maxEffect: analysis.maxEffect,
        irreversible: irreversible.map((node) => ({ id: node.id, classId: node.classId, effect: node.effect })),
        needsJournal: irreversible.length === 0
      },
      elapsedMs: elapsed(startedAt)
    }
  }

  const detail =
    mode === 'impact'
      ? `层 ${impact.layers.join('/') || '无'} · 类 ${impact.classes.join('/') || '无'} · 副作用分布 ${Object.entries(impact.effects).map(([k, v]) => `${k}×${v}`).join(' ') || '无'}`
      : `路径 ${pathList.length} 个 · 窗口 ${windowList.length} 个`

  return {
    status: analysis.problems.length ? 'warn' : 'ok',
    output:
      `${mode} ${classId}：${analysis.nodes.length} 节点 · ${detail} · 最坏 ${riskNote}${branchNote}` +
      (analysis.problems.length ? `｜问题：${analysis.problems.slice(0, 3).join('；')}` : ''),
    value: JSON.stringify({ classId, mode, maxEffect: analysis.maxEffect, impact }),
    evidence: {
      mode,
      classId,
      maxEffect: analysis.maxEffect,
      verdict: verdict.decision,
      verdictReasons: verdict.reasons,
      branchCount: analysis.branchCount,
      impact,
      paths: [...new Set(pathList)],
      windows: [...new Set(windowList)],
      subflows: analysis.subflows,
      problems: analysis.problems,
      nodes: analysis.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        classId: node.classId,
        effect: node.effect,
        problem: node.problem
      }))
    },
    elapsedMs: elapsed(startedAt)
  }
}

/** 从实例描述解析模式：'draft/patch · dry-run result' → dry-run */
function modeFromDescription(description: string): SimulationMode {
  const tail = description.toLowerCase()
  if (tail.includes('impact')) return 'impact'
  if (tail.includes('rollback')) return 'rollback'
  return 'dry-run'
}
