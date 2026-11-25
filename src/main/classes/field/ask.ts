import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'field.ask'
export const summary = '生成带选项的提问：信息不足时问清、A1/A2 动作前求确认、多个匹配时让人选'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

/**
 * A0 · 提问（纯模板，不调用模型）
 *
 * 提问的质量取决于**选项的质量**。所以这个能力的重点是：
 *   - 每个选项都要说清「选了会发生什么」
 *   - 永远留一条「都不是」的退路，否则就是在逼人选错
 *   - 信息不足时不要编选项，只问最缺的那一个
 */

export interface AskOption {
  value: string
  label: string
  /** 选了这个会发生什么 —— 没有这一项就等于让人盲选 */
  consequence?: string
}

export interface AskQuestion {
  question: string
  options: AskOption[]
  /** 允许自由输入（选项覆盖不全时必须有） */
  allowFreeText: boolean
  /** 为什么现在要问 */
  why: string
}

/**
 * ask.clarify：请求有歧义时，只问最缺的那一个维度。
 *
 * 参数语义必须分清：
 *   dimension  还不确定的**那个维度**（例如「哪个文档」）
 *   candidates 这个维度的**候选取值**（例如 doc-a.md / doc-b.md）
 *
 * 第一版把 ambiguities 数组的第 0 项当维度、其余项当选项 —— 于是问的是
 * 「哪个文档还没确定」，给的选项却是「用什么打开」，答非所问。
 */
export function askClarify(input: string, dimension?: string, candidates: string[] = []): AskQuestion {
  const text = String(input ?? '').trim()
  if (!dimension) {
    return {
      question: `「${text}」需要更多信息才能执行`,
      options: [],
      allowFreeText: true,
      why: '没有指出哪个维度不确定，只能让人补充说明'
    }
  }
  return {
    question: `「${text}」里的${dimension}还没确定，是哪一种？`,
    options: candidates.slice(0, 5).map((candidate) => ({
      value: candidate,
      label: candidate,
      consequence: `按「${candidate}」继续`
    })),
    allowFreeText: candidates.length === 0,
    why:
      candidates.length === 0
        ? `「${dimension}」没有可枚举的候选值，只能自由填写`
        : `只有「${dimension}」这一个维度不确定，列出的都是它的候选值`
  }
}

/** ask.confirm：A1/A2 动作执行前求确认 */
export function askConfirm(action: string, detail: { target?: string; reversible?: boolean }): AskQuestion {
  const reversible = detail.reversible === true
  return {
    question: `要执行「${action}」${detail.target ? `（目标是 ${detail.target}）` : ''}吗？`,
    options: [
      { value: 'yes', label: '执行', consequence: reversible ? '可以撤销' : '**无法撤销**' },
      { value: 'no', label: '取消', consequence: '什么都不做' }
    ],
    allowFreeText: false,
    why: reversible ? '这是可撤销动作，确认后立刻执行' : '这是不可撤销动作，必须先确认'
  }
}

/** ask.choose：多个匹配时让人选一个 */
export function askChoose(input: string, matches: Array<{ id: string; label?: string }>): AskQuestion {
  // 超过 5 个就不列了 —— 列一屏等于没列，让人补充条件更有效
  const shown = matches.slice(0, 5)
  return {
    question: `「${String(input).trim()}」匹配到 ${matches.length} 个，选哪个？`,
    options: shown.map((match) => ({ value: match.id, label: match.label ?? match.id })),
    allowFreeText: true,
    why: matches.length > shown.length ? `只列了前 ${shown.length} 个，可以补充更具体的条件` : '匹配结果有限，直接选'
  }
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'clarify').toLowerCase()
  const input = String(ctx.input ?? ctx.params.input ?? '')

  let question: AskQuestion
  if (mode.includes('confirm')) {
    question = askConfirm(String(ctx.params.action ?? input ?? '这个动作'), {
      target: ctx.params.target,
      reversible: String(ctx.params.reversible ?? '').toLowerCase() === 'true'
    })
  } else if (mode.includes('choose')) {
    const raw = String(ctx.params.matches ?? '').trim()
    let matches: Array<{ id: string; label?: string }> = []
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) matches = parsed.map((x) => ({ id: String(x.id ?? x), label: x.label ? String(x.label) : undefined }))
      } catch {
        return { status: 'warn', output: 'matches 不是合法 JSON 数组', elapsedMs: elapsed(startedAt) }
      }
    }
    if (!matches.length) {
      return { status: 'warn', output: 'choose 模式需要 params.matches（JSON 数组）', elapsedMs: elapsed(startedAt), evidence: { kind: 'ask', mode, problem: 'no-matches' } }
    }
    question = askChoose(input, matches)
  } else {
    if (!input.trim()) {
      return { status: 'warn', output: 'clarify 模式需要输入文本', elapsedMs: elapsed(startedAt), evidence: { kind: 'ask', mode, problem: 'no-input' } }
    }
    const dimension = String(ctx.params.dimension ?? '').trim() || undefined
    const candidates = String(ctx.params.candidates ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    question = askClarify(input, dimension, candidates)
  }

  return {
    // 没有问题就该问 —— 一条选项都没有的提问等于没问
    status: question.options.length ? 'ok' : 'warn',
    output: question.question,
    value: JSON.stringify(question),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'ask', mode, question }
  }
}
