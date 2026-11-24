import { chatOnce, describeTierConfig, resolveTiers } from './_llm'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.translate_text'
export const summary = '翻译文本；provider 链 本地 → 网络 → API 降级，key 走环境变量'

const TARGET_LABEL: Record<string, string> = {
  zh: '简体中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  fr: '法文',
  de: '德文',
  es: '西班牙文',
  ru: '俄文'
}

/** L1 · 翻译文本（网络出口，计入成本） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const text = String(ctx.params.text ?? ctx.input ?? '').trim()

  if (!text) {
    return { status: 'warn', output: '没有可翻译的文本', elapsedMs: elapsed(startedAt) }
  }
  if (!resolveTiers().length) {
    return {
      status: 'warn',
      output: '未配置翻译 provider（本地/网络/API 三档都没设环境变量），未发起任何请求',
      elapsedMs: elapsed(startedAt)
    }
  }

  const source = String(ctx.params.source ?? 'auto')
  const target = String(ctx.params.target ?? 'zh')
  const targetLabel = TARGET_LABEL[target] ?? target
  const sourceLabel = source === 'auto' ? '自动判断' : (TARGET_LABEL[source] ?? source)

  try {
    const result = await chatOnce(
      `把下面的文本翻译成${targetLabel}。只输出译文本身，不要解释、不要加引号。\n\n${text}`,
      `你是翻译引擎。源语言：${sourceLabel}。目标语言：${targetLabel}。只输出译文。`
    )
    if (!result.text.trim()) {
      return {
        status: 'warn',
        output: `模型返回了空译文（${result.tier} 档）`,
        evidence: { tier: result.tier, attempts: result.attempts },
        elapsedMs: elapsed(startedAt)
      }
    }

    const retries = result.attempts.length - 1
    return {
      status: 'ok',
      output: `已翻译 · ${result.tier} 档${retries > 0 ? `（前面 ${retries} 档失败）` : ''} · ${result.text.length} 字符｜${describeTierConfig()}`,
      value: result.text,
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `翻译失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
