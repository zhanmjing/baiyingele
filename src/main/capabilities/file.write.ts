import { app } from 'electron'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { elapsed, expandPath, type Capability } from './_shared'

export const id = 'point.file_write'
export const summary = 'node:fs writeFile / appendFile（~ 展开为主目录）'

/** L1 · 写文件 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const text = String(ctx.params.text ?? ctx.input ?? '')
  const append = String(ctx.params.append) === 'true'
  let note = ''
  let target = expandPath(String(ctx.params.path ?? ctx.args?.path ?? ''))

  // 实例没给有效路径（或只有原型里的占位 "..."）时落到应用数据目录，并在输出里说明
  if (!target || target.includes('...')) {
    const fallbackDir = join(app.getPath('userData'), 'flow-out')
    await mkdir(fallbackDir, { recursive: true })
    target = join(fallbackDir, `clipboard-${Date.now()}.md`)
    note = '（实例未提供有效 path，已写入默认目录）'
  }

  await mkdir(dirname(target), { recursive: true })
  if (append) await appendFile(target, text, 'utf8')
  else await writeFile(target, text, 'utf8')

  return {
    status: 'ok',
    output: `已${append ? '追加' : '写入'} ${target} · ${text.length} 字符${note}`,
    value: target,
    elapsedMs: elapsed(startedAt)
  }
}
