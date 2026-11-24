import { copyFile, mkdir, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { elapsed, errorMessage, expandPath, pathExists, type Capability } from './_shared'

export const id = 'file.move'
export const summary = 'node:fs rename（EXDEV 回落 copy+unlink）；支持 to 指定文件名或 toDir 搬进目录'

/**
 * L1 · 移动 / 重命名文件
 *
 * 两种目标写法（二选一）：
 *   to    完整目标路径，可用来重命名
 *   toDir 目标目录，保留原文件名 —— 批量归档时每个文件都要搬到同一个目录，
 *         用 to 的话得先算拼接路径，而流程里没有表达式能力
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const from = expandPath(String(ctx.params.from ?? ''))
  const toRaw = expandPath(String(ctx.params.to ?? ''))
  const toDir = expandPath(String(ctx.params.toDir ?? ''))
  const overwrite = String(ctx.params.overwrite) === 'true'

  if (!from) {
    return { status: 'warn', output: '需要 from 参数（源文件）', elapsedMs: elapsed(startedAt) }
  }
  if (toRaw && toDir) {
    return {
      status: 'warn',
      output: 'to 和 toDir 只能给一个：to 是指定完整目标路径，toDir 是搬进目录并保留文件名',
      elapsedMs: elapsed(startedAt)
    }
  }
  if (!toRaw && !toDir) {
    return { status: 'warn', output: '需要 to 或 toDir 参数', elapsedMs: elapsed(startedAt) }
  }

  const to = toRaw || join(toDir, basename(from))
  if (to === from) {
    return { status: 'warn', output: `源和目标相同，未做任何操作：${from}`, elapsedMs: elapsed(startedAt) }
  }

  if (!(await pathExists(from))) {
    return { status: 'warn', output: `源文件不存在：${from}`, elapsedMs: elapsed(startedAt) }
  }
  if (!overwrite && (await pathExists(to))) {
    return {
      status: 'warn',
      output: `目标已存在且 overwrite=false，未改动任何文件：${to}`,
      elapsedMs: elapsed(startedAt)
    }
  }

  try {
    await mkdir(dirname(to), { recursive: true })
    try {
      await rename(from, to)
    } catch (error) {
      // 跨盘移动会抛 EXDEV：退化成复制 + 删除
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await copyFile(from, to)
        await unlink(from)
      } else {
        throw error
      }
    }
    return {
      status: 'ok',
      output: `已移动 ${from} → ${to}${overwrite ? '（overwrite=true）' : ''}`,
      value: to,
      evidence: { from, to, toDir: toDir || null, overwrite },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `移动失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
