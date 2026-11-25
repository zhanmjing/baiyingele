import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'field.explain'
export const summary = '把结构化证据翻成人话：建议为什么这么给、这次运行发生了什么、权限为什么要、流程每一步干了啥'

/**
 * A0 · 解释（纯模板，只读，不调用模型）
 *
 * 「可解释」不是加一段自然语言，而是**把已有的结构化证据如实翻译**。
 * 所以这个能力的输入必须是一份 evidence，输出必须能逐句对应回证据。
 * 拼不出对应关系的句子就不该说。
 */

export interface Explanation {
  /** 一句话结论 */
  headline: string
  /** 逐条依据，每条都对应 evidence 里的一项 */
  points: string[]
  /** 证据不足时明说缺什么 */
  missing?: string[]
}

function fmtMs(ms: unknown): string {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '耗时未知'
  return n >= 1000 ? `${(n / 1000).toFixed(1)} 秒` : `${n} 毫秒`
}

/** explain.suggestion：为什么给这条建议 */
export function explainSuggestion(evidence: Record<string, unknown>): Explanation {
  const suggestion = (evidence.suggestion ?? evidence) as Record<string, unknown>
  const points: string[] = []
  const missing: string[] = []

  if (suggestion.action) points.push(`选的动作是「${String(suggestion.action)}」`)
  if (suggestion.target) points.push(`目标是 ${String(suggestion.target)}`)
  if (suggestion.why) points.push(`理由：${String(suggestion.why)}`)

  const confidence = Number(suggestion.confidence)
  if (Number.isFinite(confidence)) {
    points.push(`置信度 ${(confidence * 100).toFixed(0)}%`)
    if (confidence < 0.5) points.push('置信度偏低，建议只当参考')
  } else {
    missing.push('confidence')
  }

  if (!suggestion.action && !suggestion.target) {
    return { headline: '没有可解释的建议 —— evidence 里没有 suggestion', points: [], missing: ['suggestion'] }
  }
  return {
    headline: `建议${String(suggestion.action ?? '')}「${String(suggestion.target ?? '')}」`,
    points,
    ...(missing.length ? { missing } : {})
  }
}

/** explain.point-run：这次运行发生了什么 */
export function explainPointRun(evidence: Record<string, unknown>): Explanation {
  const status = String(evidence.status ?? '未知')
  const output = String(evidence.output ?? '').trim()
  const points: string[] = [`状态 ${status}`, `耗时 ${fmtMs(evidence.elapsedMs)}`]
  if (evidence.classId) points.push(`运行的是 ${String(evidence.classId)}`)
  if (output) points.push(`输出：${output.slice(0, 200)}`)

  if (status !== 'ok') {
    points.push(status === 'warn' ? 'warn 表示跑了但有缺口或警告，不是完全成功' : '这次没有跑成功')
  }

  const evidenceKind = evidence.kind
  if (evidenceKind) points.push(`证据类型 ${String(evidenceKind)}`)

  const missing = output ? [] : ['output']
  return {
    headline: output || `${status}（没有输出文本）`,
    points,
    ...(missing.length ? { missing } : {})
  }
}

/** explain.line-run：逐步 trace（mode 兼容旧的 flow） */
export function explainLineRun(evidence: Record<string, unknown>): Explanation {
  const trace = Array.isArray(evidence.nodes) ? (evidence.nodes as Array<Record<string, unknown>>) : []
  if (!trace.length) {
    return { headline: '没有节点轨迹可解释', points: [], missing: ['nodes'] }
  }
  const byStatus = new Map<string, number>()
  for (const node of trace) {
    const status = String(node.status ?? 'unknown')
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
  }
  const summary = [...byStatus.entries()].map(([status, count]) => `${status} ${count}`).join(' · ')
  const points = trace.slice(0, 12).map((node) => {
    const id = String(node.id ?? '?')
    const status = String(node.status ?? '?')
    const out = node.output ? `：${String(node.output).slice(0, 60)}` : ''
    return `${id} → ${status}${out}`
  })
  if (evidence.halted) points.push(`流程在 ${String(evidence.halted)} 处停下`)

  return { headline: `共 ${trace.length} 个节点：${summary}`, points }
}

/** explain.permission：为什么需要这个权限 */
export function explainPermission(evidence: Record<string, unknown>): Explanation {
  const name = String(evidence.permission ?? evidence.name ?? '').trim()
  if (!name) return { headline: '没有说明是哪个权限', points: [], missing: ['permission'] }

  const points: string[] = [`权限：${name}`]
  if (evidence.usedBy) points.push(`被谁用：${String(evidence.usedBy)}`)
  if (evidence.scope) points.push(`范围：${String(evidence.scope)}`)

  // 权限解释最容易说空话，所以对通配权限要直说
  if (name.includes('*') || name === 'all') {
    points.push('这是通配权限，覆盖范围比实际需要大；建议换成具体的权限项')
  }
  if (!evidence.usedBy) {
    return { headline: `需要 ${name}，但没有说明哪个零件用到它`, points, missing: ['usedBy'] }
  }
  return { headline: `需要 ${name}，因为 ${String(evidence.usedBy)} 要用`, points }
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'point-run').toLowerCase()

  let evidence: Record<string, unknown> = {}
  // 三个来源都认：ctx.input（位置参数）、params.evidence、params.input（--input @file）
  const raw = String(ctx.input ?? ctx.params.evidence ?? ctx.params.input ?? '').trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) evidence = parsed as Record<string, unknown>
    } catch {
      return { status: 'warn', output: 'evidence 不是合法 JSON 对象', elapsedMs: elapsed(startedAt) }
    }
  }
  // 注意：不要把 ctx.args 当 evidence。
  // ctx.args 是命令行参数（mode / input 之类），不是被解释的那份证据。
  // 之前这么干过，结果 explain 拿着 {mode:'point-run'} 去解释，
  // 输出「未知（没有输出文本）」而不是如实报「没给证据」。

  if (!Object.keys(evidence).length) {
    return {
      status: 'warn',
      output: `需要 evidence 才能解释（mode=${mode}）：用 ctx.input 传 JSON`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'explain', mode, problem: 'no-evidence' }
    }
  }

  let result: Explanation
  if (mode.includes('suggestion')) result = explainSuggestion(evidence)
  else if (mode.includes('line') || mode.includes('flow')) result = explainLineRun(evidence)
  else if (mode.includes('permission')) result = explainPermission(evidence)
  else result = explainPointRun(evidence)

  return {
    status: result.missing?.length ? 'warn' : 'ok',
    output: `${result.headline}${result.points.length > 1 ? ` · ${result.points[1]}` : ''}`,
    value: JSON.stringify(result),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'explain', mode, explanation: result }
  }
}
