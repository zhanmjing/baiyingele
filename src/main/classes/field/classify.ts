import { chatOnce, describeTierConfig, resolveTiers } from '../../capabilities/_llm'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'field.classify'
export const summary = '按实例自带的候选标签做一次分类（模型调用，附 confidence 与 reason）'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

/** 从实例描述里取候选标签：'body.ocr · text/math/qr/table' -> 后段按 / 拆开 */
function labelSetOf(description: string): string[] {
  const parts = String(description ?? '').split('·')
  // 约定必须写成「<作用域> · <标签/标签/…>」；没有分隔符就无法区分作用域和标签
  if (parts.length < 2) return []
  const tail = parts.pop() ?? ''
  return tail
    .split('/')
    .map((label) => label.trim())
    .filter(Boolean)
}

/** 模型可能把 JSON 包在 ```json 里，也可能多说两句，这里只捞第一个 {...} */
function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * A2 · 分类（自主度上限 A2，但本实现只产出标签，不落地任何改写）
 * 输入：上游节点的 value，或实例的 detail 文本
 * 输出：{label, confidence, reason}
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const text = String(ctx.input ?? ctx.params.text ?? ctx.params.detail ?? '').trim()

  if (!text) {
    return { status: 'warn', output: '没有要分类的内容', elapsedMs: elapsed(startedAt) }
  }

  const labels = labelSetOf(String(ctx.instance.description ?? ''))
  if (!labels.length) {
    return {
      status: 'warn',
      output: '实例没有声明候选标签（约定：描述里用「·」分隔，后半段写 a/b/c）',
      elapsedMs: elapsed(startedAt)
    }
  }

  if (!resolveTiers().length) {
    return {
      status: 'warn',
      output: '未配置场层 provider（本地/网络/API 三档都没设环境变量），未发起任何请求',
      elapsedMs: elapsed(startedAt)
    }
  }

  try {
    const result = await chatOnce(
      `候选标签：${labels.join(', ')}\n\n待分类内容：\n${text}\n\n` +
        `只输出 JSON：{"label":"<候选标签之一>","confidence":0到1之间的数字,"reason":"一句话理由"}`,
      '你是百应工作台的分类器，只能从给定候选标签里选一个。只输出 JSON，不要解释。'
    )

    const parsed = extractJson(result.text) as
      | { label?: unknown; confidence?: unknown; reason?: unknown }
      | null
    if (!parsed) {
      return {
        status: 'warn',
        output: `模型没返回合法 JSON：${result.text.slice(0, 80)}`,
        evidence: { tier: result.tier, raw: result.text.slice(0, 200), attempts: result.attempts },
        elapsedMs: elapsed(startedAt)
      }
    }

    const label = String(parsed.label ?? '').trim()
    const matched = labels.find((candidate) => candidate.toLowerCase() === label.toLowerCase())
    if (!matched) {
      return {
        status: 'warn',
        output: `模型给了不在候选集里的标签「${label}」，候选：${labels.join('/')}`,
        evidence: { tier: result.tier, labels, rawLabel: label, attempts: result.attempts },
        elapsedMs: elapsed(startedAt)
      }
    }

    const confidenceRaw = Number(parsed.confidence)
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : null
    const reason = String(parsed.reason ?? '').trim().slice(0, 120)

    return {
      status: 'ok',
      output:
        `分类：${matched}${confidence === null ? '' : `（置信度 ${confidence.toFixed(2)}）`}` +
        `${reason ? ` · ${reason}` : ''}｜${describeTierConfig()}`,
      value: JSON.stringify({ label: matched, confidence, reason, labels }),
      evidence: {
        tier: result.tier,
        labels,
        confidence,
        reason,
        attempts: result.attempts,
        confidenceSource: confidence === null ? 'missing' : 'model'
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `分类失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
