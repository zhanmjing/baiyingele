/**
 * 调用 Windows PowerShell 的最小封装。
 *
 * 为什么不用 native 模块：ffi-napi / win32-api 在现代 Node + Electron 上编译成功率很低，
 * 而窗口枚举、注册表读写这类能力用 PowerShell 就能做到，代价是每次约 200–600ms。
 *
 * 两个必须处理的坑：
 *   1. PowerShell 5.1 默认按控制台代码页输出，中文窗口标题会乱码 → 强制 UTF-8
 *   2. 非 Windows 平台上 powershell.exe 不存在 → 调用方先查 isWindows()
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const UTF8_PRELUDE = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '

export function isWindows(): boolean {
  return process.platform === 'win32'
}

export async function runPowerShell(script: string, timeoutMs = 8000): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_PRELUDE + script],
    { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
  )
  return String(stdout).replace(/^\uFEFF/, '').trim()
}
