import { spawn } from 'node:child_process'
import { elapsed, errorMessage } from '../../capabilities/_shared'

/**
 * point.shell_exec —— 执行命令行
 *
 * 对应 WGestures 的 CmdCommand（Code / ShowWindow / AutoSetWorkingDir）。
 *
 * ## %WG_PROCID% 变量
 *
 * WGestures 在 CmdCommand.cs:98 注入环境变量：
 *   process.StartInfo.EnvironmentVariables.Add("WG_PROCID", Context.ProcId.ToString())
 *
 * 所以备份里那条「强制退出」写的
 *   taskkill /f /pid %WG_PROCID% /s localhost
 * 意思是**杀掉手势所在的那个应用**，不是杀一个字面叫 %WG_PROCID% 的进程。
 *
 * 这里做同样的事，并额外支持 %WG_EXE% / %WG_APP%。
 */

export const classId = 'point.shell_exec'
export const summary = '执行命令行，支持 %WG_PROCID% / %WG_EXE% / %WG_APP% 变量替换'
export const specialized = true

export interface ShellResult {
  status: 'ok' | 'warn'
  output: string
  value?: string
  elapsedMs: number
}

/**
 * 变量替换（纯函数）。
 *
 * 目标进程信息缺失时**不静默替换成空串** —— 那样 `taskkill /pid `
 * 会变成看起来合法但完全跑偏的命令。宁可保留原样并让调用方报错。
 */
export function expandVariables(
  code: string,
  vars: { procId?: number | string; exePath?: string; appName?: string }
): { code: string; unresolved: string[] } {
  const unresolved: string[] = []
  let out = String(code ?? '')

  const replace = (token: string, value: string | undefined) => {
    if (!out.includes(token)) return
    if (value === undefined || value === '') {
      unresolved.push(token)
      return
    }
    out = out.split(token).join(String(value))
  }

  replace('%WG_PROCID%', vars.procId === undefined ? undefined : String(vars.procId))
  replace('%WG_EXE%', vars.exePath)
  replace('%WG_APP%', vars.appName)
  return { code: out, unresolved }
}

export async function execCommand(
  code: string,
  options: { cwd?: string; timeoutMs?: number; procId?: number; exePath?: string; appName?: string } = {}
): Promise<ShellResult> {
  const startedAt = Date.now()
  const expanded = expandVariables(code, options)
  const command = expanded.code.trim()
  if (!command) return { status: 'warn', output: '命令为空', elapsedMs: elapsed(startedAt) }
  if (expanded.unresolved.length) {
    return {
      status: 'warn',
      output: `命令里还有无法解析的变量：${expanded.unresolved.join('、')}`,
      elapsedMs: elapsed(startedAt)
    }
  }

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result: ShellResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let child
    try {
      child = spawn(command, { shell: true, cwd: options.cwd, windowsHide: true })
    } catch (error) {
      finish({ status: 'warn', output: `启动失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) })
      return
    }

    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* 杀不掉也不能抛 */
      }
      finish({ status: 'warn', output: `命令超时（${options.timeoutMs ?? 8000}ms）`, elapsedMs: elapsed(startedAt) })
    }, options.timeoutMs ?? 8000)

    child.stdout?.on('data', (chunk) => (stdout += String(chunk)))
    child.stderr?.on('data', (chunk) => (stderr += String(chunk)))
    child.on('error', (error) => {
      clearTimeout(timer)
      finish({ status: 'warn', output: `执行失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) })
    })
    child.on('close', (code2) => {
      clearTimeout(timer)
      const text = (stdout || stderr).trim()
      if (code2 === 0) {
        finish({ status: 'ok', output: text || `已执行：${command.slice(0, 80)}`, value: text, elapsedMs: elapsed(startedAt) })
      } else {
        finish({ status: 'warn', output: `退出码 ${code2}：${(text || command).slice(0, 160)}`, elapsedMs: elapsed(startedAt) })
      }
    })
  })
}

export const run = (context: any): Promise<ShellResult> => {
  const params = context?.params ?? {}
  return execCommand(String(params.code ?? params.command ?? ''), {
    cwd: params.cwd ? String(params.cwd) : undefined,
    timeoutMs: Number(params.timeoutMs ?? 8000),
    procId: context?.pointClass?.targetProcId ?? params.procId,
    exePath: context?.pointClass?.targetExe ?? params.exePath,
    appName: context?.pointClass?.targetApp ?? params.appName
  })
}
