import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.http_request'
export const summary = 'fetch + 10s 超时，返回状态码与字节数'

/** L1 · HTTP 请求 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const method = String(ctx.params.method ?? 'GET').toUpperCase()
  const url = String(ctx.params.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return { status: 'warn', output: `非法 URL：${url || '(空)'}`, elapsedMs: elapsed(startedAt) }
  }
  try {
    const response = await fetch(url, {
      method,
      body: method === 'GET' || method === 'HEAD' ? undefined : String(ctx.params.body ?? ''),
      signal: AbortSignal.timeout(10_000)
    })
    const bytes = (await response.arrayBuffer()).byteLength
    return {
      status: response.ok ? 'ok' : 'warn',
      output: `HTTP ${response.status} ${response.statusText} · ${bytes} bytes · ${elapsed(startedAt)}ms`,
      value: `HTTP ${response.status}`,
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `请求失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
