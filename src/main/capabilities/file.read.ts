import { open, stat } from 'node:fs/promises'
import { elapsed, errorMessage, expandPath, type Capability } from './_shared'

export const id = 'point.file_read'
export const summary = 'node:fs 读取，超过 maxBytes 截断；目录或缺失按 warn 处理'

/** L0 · 读文件 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const target = expandPath(String(ctx.params.path ?? ''))
  if (!target) return { status: 'warn', output: '未提供 path', elapsedMs: elapsed(startedAt) }

  const encoding = String(ctx.params.encoding ?? 'utf-8') || 'utf-8'
  const requested = Number(ctx.params.maxBytes ?? 262144)
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 16 * 1024 * 1024) : 262144

  try {
    const info = await stat(target)
    if (info.isDirectory()) {
      return { status: 'warn', output: `是目录而不是文件：${target}`, elapsedMs: elapsed(startedAt) }
    }

    const handle = await open(target, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(limit, info.size))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const text = buffer.subarray(0, bytesRead).toString(encoding as BufferEncoding)
      const truncated = info.size > bytesRead
      const firstLine = (text.split(/\r?\n/)[0] ?? '').slice(0, 60)
      return {
        status: 'ok',
        output: `读取 ${target} · ${bytesRead} bytes${truncated ? `（原文 ${info.size}，已截断）` : ''} · ${JSON.stringify(firstLine)}`,
        value: text,
        elapsedMs: elapsed(startedAt)
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    return { status: 'warn', output: `读取失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
