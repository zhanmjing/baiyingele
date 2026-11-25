import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { shell } from 'electron'
import { elapsed, errorMessage, expandPath, type Capability } from '../../capabilities/_shared'

export const classId = 'point.open'
export const summary = '打开应用 / 文件 / 文件夹 / 网址；一个路径交给系统 shell 决定'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

type TargetKind = 'url' | 'app' | 'folder' | 'file'

/**
 * 打开目标 —— 只需**一个路径**，其余交给系统。
 *
 * ## 照 WGestures 的 OpenFileCommand
 *
 *   var info = new ProcessStartInfo(FilePath);
 *   info.UseShellExecute = true;          // ← 关键
 *   Process.Start(info);
 *
 * 它**不判断类型**：exe 就启动、文档就用默认程序、文件夹就开资源管理器，
 * 全由 Windows shell 决定。Electron 里对应的是 shell.openPath（内部就是
 * ShellExecute + "open" 动词），行为一致。
 *
 * ## 之前为什么要手动指定 kind
 *
 * 旧实现要求 params.kind = url / file / folder，
 * 于是「我只想给个软件路径」也得先想清楚它算哪一类 —— 多余的心智负担，
 * 而且 kind 填错就直接走错分支。
 *
 * 现在：只给 target。以 http(s) 开头走 openExternal，其余一律 openPath。
 *
 * ## 参数名宽容
 *
 * target / path / file / url / app 都认。用户/迁移数据里写哪个都能用，
 * 不再因为字段名差一个字就报「未提供 target」。
 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = String(ctx.params[key] ?? '').trim()
      if (value) return value
    }
    return ''
  }

  const rawTarget = pick('target', 'path', 'file', 'url', 'app')
  const args = String(ctx.params.args ?? '').trim()
  // 显式 app + args 的组合保留（启动带参数的程序需要它）
  const explicitApp = String(ctx.params.app ?? '').trim()

  if (!rawTarget) {
    return {
      status: 'warn',
      output: '未提供 target（给一个应用 / 文件 / 文件夹路径，或 http(s) 网址即可）',
      elapsedMs: elapsed(startedAt)
    }
  }

  // ① URL：交给默认浏览器
  if (/^https?:\/\//i.test(rawTarget)) {
    try {
      await shell.openExternal(rawTarget)
      return {
        status: 'ok',
        output: `已在默认浏览器打开 ${rawTarget}`,
        value: rawTarget,
        evidence: { kind: 'url' as TargetKind, target: rawTarget },
        elapsedMs: elapsed(startedAt)
      }
    } catch (error) {
      return { status: 'warn', output: `打开网址失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
    }
  }

  const target = expandPath(rawTarget)

  // ② 显式 app + 参数：spawn（需要传命令行参数时用）
  if (explicitApp && explicitApp !== target) {
    try {
      const argv = args ? args.split(/\s+/).filter(Boolean) : []
      const child = spawn(explicitApp, argv, { detached: true, stdio: 'ignore' })
      child.unref()
      return {
        status: 'ok',
        output: `已启动 ${basename(explicitApp)}${argv.length ? ` ${argv.join(' ')}` : ''}`,
        value: explicitApp,
        evidence: { kind: 'app' as TargetKind, app: explicitApp, args: argv },
        elapsedMs: elapsed(startedAt)
      }
    } catch (error) {
      return { status: 'warn', output: `启动失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
    }
  }

  /**
   * ③ 先确认路径真的存在。
   *
   * shell.openPath 对不存在的路径也会"调用成功"（返回空字符串），
   * 于是界面报「已打开」但什么都没发生 —— 正是那种查不出来的假成功。
   */
  let kind: TargetKind = 'file'
  let bytes = 0
  try {
    const stat = statSync(target)
    if (stat.isDirectory()) kind = 'folder'
    else {
      bytes = stat.size
      kind = extname(target).toLowerCase() === '.exe' ? 'app' : 'file'
    }
  } catch {
    return {
      status: 'warn',
      output: `路径不存在或不可访问：${target}`,
      elapsedMs: elapsed(startedAt)
    }
  }

  try {
    const failure = await shell.openPath(target)
    if (failure) {
      return { status: 'warn', output: `打开失败：${failure}`, elapsedMs: elapsed(startedAt) }
    }
    const label = kind === 'app' ? '应用' : kind === 'folder' ? '文件夹' : '文件'
    return {
      status: 'ok',
      output: `已打开${label} ${basename(target)}`,
      value: target,
      evidence: { kind, target, bytes },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `打开失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
