import { copyFile, mkdir, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { elapsed, errorMessage, expandPath, pathExists, type Capability } from './_shared'

export const id = 'file.move'
export const summary = 'node:fs rename（EXDEV 回落 copy+unlink），overwrite=false 时不覆盖'

/** L1 · 移动 / 重命名文件 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const from = expandPath(String(ctx.params.from ?? ''))
  const to = expandPath(String(ctx.params.to ?? ''))
  const overwrite = String(ctx.params.overwrite) === 'true'

  if (!from || !to) {
    return { status: 'warn', output: '需要 from 和 to 两个参数', elapsedMs: elapsed(startedAt) }
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
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `移动失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
