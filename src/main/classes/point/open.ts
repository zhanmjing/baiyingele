import { spawn } from 'node:child_process'
import { shell } from 'electron'
import { elapsed, errorMessage, expandPath, type Capability } from '../../capabilities/_shared'

export const classId = 'point.open'
export const summary = 'Electron shell.openExternal / openPath；带 app 时走 spawn'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

/**
 * L1 · 打开目标。
 * kind 决定处理方式：
 *   url    → shell.openExternal（只允许 http/https）
 *   folder / file → shell.openPath（系统默认方式）
 *   带 app → spawn(app, args ?? [target])
 * target 里的 %VAR% 会按环境变量展开（例如 %USERPROFILE%\Downloads）。
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const kind = String(ctx.params.kind ?? '').trim().toLowerCase()
  const target = expandPath(String(ctx.params.target ?? ''))
  const app = String(ctx.params.app ?? '').trim()
  const args = String(ctx.params.args ?? '').trim()

  if (!target) {
    return { status: 'warn', output: '未提供 target', elapsedMs: elapsed(startedAt) }
  }

  try {
    if (kind === 'url') {
      if (!/^https?:\/\//i.test(target)) {
        return { status: 'warn', output: `不是合法的 http(s) 地址：${target}`, elapsedMs: elapsed(startedAt) }
      }
      await shell.openExternal(target)
      return { status: 'ok', output: `已在默认浏览器打开 ${target}`, value: target, elapsedMs: elapsed(startedAt) }
    }

    if (app) {
      const argv = args ? args.split(/\s+/).filter(Boolean) : [target]
      const child = spawn(app, argv, { detached: true, stdio: 'ignore' })
      child.unref()
      return {
        status: 'ok',
        output: `已启动 ${app}${argv.length ? ` ${argv.join(' ')}` : ''}`,
        value: app,
        elapsedMs: elapsed(startedAt)
      }
    }

    const failure = await shell.openPath(target)
    if (failure) {
      return { status: 'warn', output: `打开失败：${failure}`, elapsedMs: elapsed(startedAt) }
    }
    return { status: 'ok', output: `已用系统默认方式打开 ${target}`, value: target, elapsedMs: elapsed(startedAt) }
  } catch (error) {
    return { status: 'warn', output: `打开失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
