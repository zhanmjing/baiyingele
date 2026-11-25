import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'field.guard'
export const summary = '确定性风控闸门：自主度上限、副作用等级、置信度、隐私脱敏，全部给得出理由'

/**
 * A0 · 风险 / 权限 / 置信度 / 隐私闸门
 *
 * 这个能力**不调用任何模型**，全是确定性规则 —— 闸门必须可预测。
 * 它执行的是一条设计铁律：
 *   - **A3 一律拒绝**（自主度上限就是 A2，A3 不允许存在）
 *   - **L3（不可逆）必须有人工批准**，没批准就 deny
 *   - L2 在 A2 及以下必须 ask，不能自动放行
 *
 * 输入（优先 ctx.input，其次 params.payload）：一段 JSON 草稿
 *   { "effect": "L2", "autonomy": "A2", "confidence": 0.62, "approved": false,
 *     "text": "要脱敏的文本", "action": "delete" }
 * 输出：{ decision: 'allow'|'ask'|'deny', reasons: [...], redacted?: string }
 */

export type GuardPolicy = 'risk' | 'permission' | 'confidence' | 'privacy'
export type GuardDecision = 'allow' | 'ask' | 'deny' | 'pass' | 'reject' | 'redact' | 'block'

export interface Draft {
  effect: string
  autonomy: string
  confidence: number | null
  approved: boolean
  text: string
  action: string
}

const EFFECT_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }
/** 允许出现的最高自主度；A3 在设计上就是禁止的 */
const MAX_AUTONOMY = 2

export function parseDraft(raw: string): { ok: boolean; draft?: Draft; reason?: string } {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: false, reason: '没有草稿内容（需要 JSON，例如 {"effect":"L2","autonomy":"A2"}）' }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: '草稿必须是 JSON 对象' }
    }
    const confidenceRaw = parsed.confidence
    const confidence =
      typeof confidenceRaw === 'number'
        ? confidenceRaw
        : typeof confidenceRaw === 'string' && confidenceRaw.trim() !== ''
          ? Number(confidenceRaw)
          : null
    return {
      ok: true,
      draft: {
        effect: String(parsed.effect ?? '').trim().toUpperCase(),
        autonomy: String(parsed.autonomy ?? '').trim().toUpperCase(),
        confidence: confidence !== null && Number.isFinite(confidence) ? confidence : null,
        approved: parsed.approved === true || parsed.approved === 'true',
        text: String(parsed.text ?? ''),
        action: String(parsed.action ?? '')
      }
    }
  } catch {
    return { ok: false, reason: `草稿不是合法 JSON：${text.slice(0, 60)}` }
  }
}

/** 纯函数：风险闸门。返回决策 + 每一条理由 */
export function assessRisk(draft: Draft): { decision: 'allow' | 'ask' | 'deny'; reasons: string[] } {
  const reasons: string[] = []

  // 1. A3 禁止 —— 这是硬约束，不看别的条件
  const autonomyLevel = /^A([0-3])$/.exec(draft.autonomy)
  if (autonomyLevel) {
    const level = Number(autonomyLevel[1])
    if (level > MAX_AUTONOMY) {
      return { decision: 'deny', reasons: [`自主度 ${draft.autonomy} 在设计上禁止（上限 A${MAX_AUTONOMY}），不看其他条件`] }
    }
  }

  // 2. 副作用等级
  const effectLevel = EFFECT_ORDER[draft.effect]
  if (effectLevel === undefined) {
    reasons.push(`副作用等级未知（${draft.effect || '空'}），按最保守处理`)
    return { decision: 'deny', reasons }
  }

  if (effectLevel >= 3) {
    if (!draft.approved) return { decision: 'deny', reasons: [...reasons, `${draft.effect} 不可逆，必须有人工批准（approved=true）`] }
    return { decision: 'ask', reasons: [...reasons, `${draft.effect} 已获批准，仍要求二次确认`] }
  }
  if (effectLevel === 2) {
    // L2 不能自动放行，即使自主度允许
    return { decision: 'ask', reasons: [...reasons, `${draft.effect} 会产生改动，需要人工确认`] }
  }
  reasons.push(`${draft.effect} 可直接执行`)
  return { decision: 'allow', reasons }
}

/** 纯函数：权限闸门（allow / deny / ask） */
export function assessPermission(draft: Draft, allowEffectUpTo = 'L1'): { decision: 'allow' | 'ask' | 'deny'; reasons: string[] } {
  const effectLevel = EFFECT_ORDER[draft.effect]
  const limit = EFFECT_ORDER[allowEffectUpTo.toUpperCase()] ?? 1
  if (effectLevel === undefined) return { decision: 'deny', reasons: [`副作用等级未知（${draft.effect || '空'}）`] }
  if (effectLevel === 3) return { decision: 'deny', reasons: ['L3 不在任何自动许可范围内'] }
  if (effectLevel <= limit) return { decision: 'allow', reasons: [`${draft.effect} 在允许范围内（≤ ${allowEffectUpTo}）`] }
  return { decision: 'ask', reasons: [`${draft.effect} 超出自动许可（≤ ${allowEffectUpTo}），需要询问`] }
}

/** 纯函数：置信度闸门 */
export function assessConfidence(
  confidence: number | null,
  passAt = 0.75,
  askAt = 0.5
): { decision: 'pass' | 'ask' | 'reject'; reasons: string[] } {
  if (confidence === null) return { decision: 'ask', reasons: ['没有置信度，按询问处理'] }
  if (confidence >= passAt) return { decision: 'pass', reasons: [`置信度 ${confidence.toFixed(2)} ≥ ${passAt}`] }
  if (confidence >= askAt) return { decision: 'ask', reasons: [`置信度 ${confidence.toFixed(2)} 介于 ${askAt}–${passAt}，需要询问`] }
  return { decision: 'reject', reasons: [`置信度 ${confidence.toFixed(2)} < ${askAt}，拒绝`] }
}

interface RedactionRule {
  name: string
  pattern: RegExp
  replace: string | ((match: string) => string)
}

const REDACTION_RULES: RedactionRule[] = [
  { name: '邮箱', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: (m) => `${m.slice(0, 2)}***@***` },
  { name: '手机号', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g, replace: '1**********' },
  { name: '身份证', pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g, replace: (m) => `${m.slice(0, 4)}**********${m.slice(-2)}` },
  { name: '银行卡', pattern: /(?<!\d)\d{16,19}(?!\d)/g, replace: (m) => `${m.slice(0, 4)} **** **** ${m.slice(-4)}` },
  { name: '私钥块', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace: '[已移除私钥]' },
  { name: 'Bearer token', pattern: /\b(?:Bearer|token)\s+[A-Za-z0-9._-]{16,}/gi, replace: '[已移除令牌]' }
]

/** 纯函数：隐私脱敏。返回脱敏后的文本 + 命中了哪些规则 */
export function redactText(text: string): { ok: boolean; text?: string; hits?: string[]; reason?: string } {
  let output = String(text ?? '')
  if (!output) return { ok: false, reason: '没有要脱敏的文本（草稿里需要 text 字段）' }
  const hits: string[] = []
  for (const rule of REDACTION_RULES) {
    if (!rule.pattern.test(output)) {
      rule.pattern.lastIndex = 0
      continue
    }
    rule.pattern.lastIndex = 0
    output = output.replace(rule.pattern, rule.replace as never)
    hits.push(rule.name)
  }
  return { ok: true, text: output, hits }
}

/** 从实例描述解析策略：'all drafts · L0–L3' 这种后半段用来选策略 */
export function policyOf(description: string, fallback: GuardPolicy = 'risk'): GuardPolicy {
  const tail = String(description ?? '').toLowerCase()
  if (tail.includes('allow/deny') || tail.includes('permission')) return 'permission'
  if (tail.includes('pass/ask') || tail.includes('confidence')) return 'confidence'
  if (tail.includes('redact') || tail.includes('privacy')) return 'privacy'
  if (tail.includes('l0–l3') || tail.includes('l0-l3') || tail.includes('risk')) return 'risk'
  return fallback
}

/** A0 · 执行闸门判断（只判断，不落地任何改动） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  const requested = String(ctx.params.policy ?? '').trim().toLowerCase()
  const policy: GuardPolicy =
    requested === 'risk' || requested === 'permission' || requested === 'confidence' || requested === 'privacy'
      ? requested
      : policyOf(String(ctx.instance.description ?? ''))
  const raw = String(ctx.input ?? ctx.params.payload ?? ctx.params.draft ?? '').trim()
  const parsed = parseDraft(raw)

  if (String(ctx.params.text ?? '').trim() && policy === 'privacy') {
    const redacted = redactText(String(ctx.params.text))
    if (!redacted.ok) return { status: 'warn', output: redacted.reason ?? '脱敏失败', elapsedMs: elapsed(startedAt) }
    return {
      status: 'ok',
      output: `已脱敏：命中 ${redacted.hits?.length || 0} 类（${redacted.hits?.join(', ') || '无'}）`,
      value: redacted.text,
      evidence: { policy, hits: redacted.hits ?? [] },
      elapsedMs: elapsed(startedAt)
    }
  }

  if (!parsed.ok || !parsed.draft) {
    return { status: 'warn', output: parsed.reason ?? '无法解析草稿', elapsedMs: elapsed(startedAt) }
  }
  const draft = parsed.draft

  if (policy === 'privacy') {
    const redacted = redactText(draft.text)
    if (!redacted.ok) {
      return { status: 'warn', output: redacted.reason ?? '脱敏失败', evidence: { policy }, elapsedMs: elapsed(startedAt) }
    }
    const blocked = (redacted.hits ?? []).includes('私钥块')
    return {
      status: 'ok',
      output: blocked
        ? `发现私钥，已阻断并把内容替换为占位符（命中：${redacted.hits?.join(', ')}）`
        : `已脱敏 ${redacted.hits?.length || 0} 类敏感信息${redacted.hits?.length ? `（${redacted.hits.join(', ')}）` : ''}`,
      value: redacted.text,
      evidence: { policy, decision: blocked ? 'block' : 'redact', hits: redacted.hits ?? [] },
      elapsedMs: elapsed(startedAt)
    }
  }

  const thresholds = {
    passAt: Number(ctx.params.passAt ?? 0.75),
    askAt: Number(ctx.params.askAt ?? 0.5),
    allowEffectUpTo: String(ctx.params.allowEffectUpTo ?? 'L1')
  }

  const assessed =
    policy === 'confidence'
      ? assessConfidence(draft.confidence, thresholds.passAt, thresholds.askAt)
      : policy === 'permission'
        ? assessPermission(draft, thresholds.allowEffectUpTo)
        : assessRisk(draft)

  const decision = assessed.decision
  const label: Record<string, string> = {
    allow: '放行',
    pass: '通过',
    ask: '需要确认',
    deny: '拒绝',
    reject: '拒绝'
  }

  return {
    // 闸门「拒绝」是正常判断结果，不是执行失败；只有无法判断才是 warn
    status: 'ok',
    output: `${label[decision] ?? decision}：${assessed.reasons.join('；')}`,
    value: decision,
    evidence: {
      policy,
      decision,
      reasons: assessed.reasons,
      draft: { effect: draft.effect, autonomy: draft.autonomy, confidence: draft.confidence, approved: draft.approved }
    },
    elapsedMs: elapsed(startedAt)
  }
}
