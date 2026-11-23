/**
 * Win32 直接调用（koffi FFI，零编译、零 native 构建）。
 *
 * 三条铁律：
 *   1. **所有 C 签名只写在这个文件里** —— 签名写错不是抛异常，是整个主进程崩溃
 *   2. koffi 懒加载：require 失败时 ensure() 返回 null，调用方回退到 PowerShell 实现
 *   3. 每个句柄都要 CloseHandle（用 try/finally 保证）
 *
 * 已验证：Node modules=137 与 Electron 45 modules=150 两套 ABI 都能直接加载（Node-API 稳定 ABI）。
 */
import { basename } from 'node:path'

export interface WinWindow {
  hwnd: string
  pid: number
  process: string
  title: string
}

interface Bindings {
  koffi: any
  EnumWindows: (callback: unknown, lParam: number) => boolean
  EnumProc: unknown
  IsWindowVisible: (hwnd: unknown) => boolean
  GetWindowTextW: (hwnd: unknown, buffer: Buffer, max: number) => number
  GetWindowTextLengthW: (hwnd: unknown) => number
  GetWindowThreadProcessId: (hwnd: unknown, pidBuffer: Buffer) => number
  OpenProcess: (access: number, inherit: boolean, pid: number) => unknown
  QueryFullProcessImageNameW: (handle: unknown, flags: number, name: Buffer, size: Buffer) => boolean
  CloseHandle: (handle: unknown) => boolean
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const MAX_TITLE_CHARS = 512
const MAX_PATH_CHARS = 1024

let bindings: Bindings | null = null
let loadError: string | null = null

function ensure(): Bindings | null {
  if (bindings) return bindings
  if (loadError) return null

  try {
    // 懒加载：koffi 是运行时依赖，缺了不能让整个应用起不来
    const koffi = require('koffi')
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')

    const EnumProc = koffi.proto('bool __stdcall EnumProc(void *hwnd, intptr_t lParam)')

    bindings = {
      koffi,
      EnumProc,
      EnumWindows: user32.func('bool __stdcall EnumWindows(EnumProc *cb, intptr_t lParam)'),
      IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(void *hWnd)'),
      GetWindowTextW: user32.func('int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)'),
      GetWindowTextLengthW: user32.func('int __stdcall GetWindowTextLengthW(void *hWnd)'),
      GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, void *lpdwProcessId)'),
      OpenProcess: kernel32.func('void* __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)'),
      QueryFullProcessImageNameW: kernel32.func(
        'bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32_t flags, void *lpExeName, void *lpdwSize)'
      ),
      CloseHandle: kernel32.func('bool __stdcall CloseHandle(void *hObject)')
    }
    return bindings
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
    return null
  }
}

export function win32Available(): boolean {
  return ensure() !== null
}

export function win32LoadError(): string | null {
  return loadError
}

function titleOf(api: Bindings, hwnd: unknown): string {
  const length = api.GetWindowTextLengthW(hwnd)
  if (length <= 0) return ''
  const size = Math.min(length + 1, MAX_TITLE_CHARS)
  const buffer = Buffer.alloc(size * 2)
  const copied = api.GetWindowTextW(hwnd, buffer, size)
  if (copied <= 0) return ''
  return buffer.toString('utf16le', 0, copied * 2)
}

function processOf(api: Bindings, hwnd: unknown): { pid: number; process: string } {
  const pidBuffer = Buffer.alloc(4)
  api.GetWindowThreadProcessId(hwnd, pidBuffer)
  const pid = pidBuffer.readUInt32LE(0)
  if (!pid) return { pid: 0, process: '' }

  const handle = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
  if (!handle) return { pid, process: '' }

  try {
    const sizeBuffer = Buffer.alloc(4)
    sizeBuffer.writeUInt32LE(MAX_PATH_CHARS, 0)
    const nameBuffer = Buffer.alloc(MAX_PATH_CHARS * 2)
    if (!api.QueryFullProcessImageNameW(handle, 0, nameBuffer, sizeBuffer)) return { pid, process: '' }
    const chars = sizeBuffer.readUInt32LE(0)
    const full = nameBuffer.toString('utf16le', 0, chars * 2)
    return { pid, process: basename(full) }
  } finally {
    api.CloseHandle(handle)
  }
}

/** 枚举可见且有标题的窗口。koffi 不可用时返回 null（调用方去走 PowerShell 回退） */
export function enumWindows(limit = 500): WinWindow[] | null {
  const api = ensure()
  if (!api) return null

  const found: WinWindow[] = []
  const callback = api.koffi.register((hwnd: unknown) => {
    try {
      if (api.IsWindowVisible(hwnd)) {
        const title = titleOf(api, hwnd)
        if (title) {
          const { pid, process } = processOf(api, hwnd)
          found.push({ hwnd: String(hwnd), pid, process, title })
        }
      }
    } catch {
      // 单个窗口出错不影响整体枚举
    }
    return found.length < limit
  }, api.koffi.pointer(api.EnumProc))

  try {
    api.EnumWindows(callback, 0)
  } finally {
    api.koffi.unregister(callback)
  }

  return found
}
