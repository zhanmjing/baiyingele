import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { elapsed, errorMessage, expandPath, pathExists, type Capability } from './_shared'

export const id = 'file.scan'
export const summary = 'node:fs 递归扫描；limit 封顶，不可读目录跳过并计入说明'

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

/** L0 · 扫描目录 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const root = expandPath(String(ctx.params.root ?? ''))
  if (!root) return { status: 'warn', output: '未提供 root 目录', elapsedMs: elapsed(startedAt) }
  if (!(await pathExists(root))) {
    return { status: 'warn', output: `目录不存在：${root}`, elapsedMs: elapsed(startedAt) }
  }

  const matcher = globToRegExp(String(ctx.params.pattern ?? '') || '*')
  const depth = clampInt(ctx.params.depth, 2, 1, 8)
  const limit = clampInt(ctx.params.limit, 200, 1, 5000)

  const found: string[] = []
  let skipped = 0
  let truncated = false

  async function walk(dir: string, level: number): Promise<void> {
    if (found.length >= limit) {
      truncated = true
      return
    }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      // 权限不足等：跳过这个目录，不整体失败
      skipped += 1
      return
    }
    for (const entry of entries) {
      if (found.length >= limit) {
        truncated = true
        return
      }
      if (entry.isDirectory()) {
        if (level < depth) await walk(join(dir, entry.name), level + 1)
        continue
      }
      if (matcher.test(entry.name)) found.push(join(dir, entry.name))
    }
  }

  try {
    await walk(root, 1)
  } catch (error) {
    return { status: 'warn', output: `扫描失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }

  const sample = found.slice(0, 3).map((path) => path.slice(root.length + 1) || path).join(', ')
  const notes = [
    truncated ? `已截断到 limit=${limit}` : '',
    skipped ? `${skipped} 个目录不可读已跳过` : ''
  ].filter(Boolean)

  return {
    status: skipped ? 'warn' : 'ok',
    output: `扫描 ${found.length} 个文件${notes.length ? `（${notes.join('；')}）` : ''}${sample ? ` · 前 3 个：${sample}` : ''}`,
    value: JSON.stringify(found),
    elapsedMs: elapsed(startedAt)
  }
}
