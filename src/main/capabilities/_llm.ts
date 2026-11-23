/**
 * 模型调用的最小底座：一条 provider 降级链。
 *
 * 顺序固定为 本地 → 网络 → API（免费优先），每次取第一个成功的。
 * 三档都用 OpenAI 兼容的 /chat/completions 协议，所以 Ollama / LM Studio / vLLM /
 * DeepSeek / OpenAI 一套代码通吃，换 provider 只改环境变量。
 *
 * 环境变量（都为可选，没配的档位直接跳过）：
 *   BAIYING_TRANSLATE_LOCAL_URL     例如 http://127.0.0.1:11434/v1   (Ollama)
 *   BAIYING_TRANSLATE_NETWORK_URL   例如 http://192.168.1.10:8000/v1  (局域网/自建)
 *   BAIYING_TRANSLATE_API_URL       例如 https://api.deepseek.com/v1 (云端)
 *   BAIYING_TRANSLATE_KEY           云端档的 API key（只从环境变量读，不落库）
 *   BAIYING_TRANSLATE_<TIER>_MODEL  各档模型名，可选
 */

export type LlmTierName = 'local' | 'network' | 'api'

export interface LlmTier {
  name: LlmTierName
  endpoint: string
  apiKey: string
  model: string
  timeoutMs: number
}

export interface ChatAttempt {
  tier: LlmTierName
  ok: boolean
  elapsedMs: number
  reason?: string
}

export interface ChatResult {
  text: string
  tier: LlmTierName
  attempts: ChatAttempt[]
}

const DEFAULT_MODEL: Record<LlmTierName, string> = {
  local: 'qwen2.5:7b',
  network: 'qwen2.5:7b',
  api: 'gpt-4o-mini'
}

/** 本地档要快速失败，云端档可以多等一会 */
const TIMEOUT_MS: Record<LlmTierName, number> = {
  local: 4_000,
  network: 8_000,
  api: 20_000
}

function endpointOf(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return /\/chat\/completions$/.test(trimmed) ? trimmed : `${trimmed}/chat/completions`
}

/** 按「本地 → 网络 → API」解析出实际可用的档位（没配 URL 的跳过） */
export function resolveTiers(): LlmTier[] {
  const tiers: LlmTier[] = []
  const push = (name: LlmTierName, prefix: string, keyEnv: string): void => {
    const baseUrl = (process.env[prefix] ?? '').trim()
    if (!baseUrl) return
    tiers.push({
      name,
      endpoint: endpointOf(baseUrl),
      apiKey: (process.env[keyEnv] ?? '').trim(),
      model: (process.env[`${prefix.replace(/_URL$/, '')}_MODEL`] ?? '').trim() || DEFAULT_MODEL[name],
      timeoutMs: TIMEOUT_MS[name]
    })
  }
  push('local', 'BAIYING_TRANSLATE_LOCAL_URL', 'BAIYING_TRANSLATE_LOCAL_KEY')
  push('network', 'BAIYING_TRANSLATE_NETWORK_URL', 'BAIYING_TRANSLATE_NETWORK_KEY')
  push('api', 'BAIYING_TRANSLATE_API_URL', 'BAIYING_TRANSLATE_KEY')
  return tiers
}

export function describeTierConfig(): string {
  const tiers = resolveTiers()
  return tiers.length ? tiers.map((tier) => `${tier.name}=${tier.endpoint}`).join(' → ') : '（未配置）'
}

/**
 * 依次尝试各档位，返回第一份成功结果。
 * 全部失败时抛错，错误里带每档的失败原因——调用方据此给 warn 文案。
 */
export async function chatOnce(prompt: string, system?: string): Promise<ChatResult> {
  const tiers = resolveTiers()
  if (!tiers.length) {
    throw new Error(
      '未配置任何 provider：请设置 BAIYING_TRANSLATE_LOCAL_URL / BAIYING_TRANSLATE_NETWORK_URL / BAIYING_TRANSLATE_API_URL 之一（OpenAI 兼容）'
    )
  }

  const attempts: ChatAttempt[] = []

  for (const tier of tiers) {
    const startedAt = Date.now()
    try {
      const response = await fetch(tier.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(tier.apiKey ? { authorization: `Bearer ${tier.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: tier.model,
          temperature: 0,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt }
          ]
        }),
        signal: AbortSignal.timeout(tier.timeoutMs)
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new Error('响应里没有 content')

      attempts.push({ tier: tier.name, ok: true, elapsedMs: Date.now() - startedAt })
      return { text, tier: tier.name, attempts }
    } catch (error) {
      attempts.push({
        tier: tier.name,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error)
      })
      // 继续下一档
    }
  }

  throw new Error(
    `所有 provider 都失败：${attempts.map((attempt) => `${attempt.tier}(${attempt.reason})`).join('；')}`
  )
}
