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
  GetForegroundWindow: () => unknown
  SetForegroundWindow: (hwnd: unknown) => boolean
  BringWindowToTop: (hwnd: unknown) => boolean
  ShowWindow: (hwnd: unknown, cmd: number) => boolean
  SetFocus: (hwnd: unknown) => unknown
  AttachThreadInput: (attach: number, attachTo: number, on: boolean) => boolean
  GetCurrentThreadId: () => number
  MoveWindow: (hwnd: unknown, x: number, y: number, w: number, h: number, repaint: boolean) => boolean
  SetWindowPos: (hwnd: unknown, after: number, x: number, y: number, cx: number, cy: number, flags: number) => boolean
  PostMessageW: (hwnd: unknown, msg: number, wParam: number, lParam: number) => boolean
  SystemParametersInfoW: (action: number, param: number, out: unknown, winIni: number) => boolean
  GetWindowLongW: (hwnd: unknown, index: number) => number
  SendInput: (count: number, inputs: Buffer, size: number) => number
  GetAsyncKeyState: (vk: number) => number
  RECT: unknown
  EnumProc: unknown
  IsWindowVisible: (hwnd: unknown) => boolean
  GetWindowTextW: (hwnd: unknown, buffer: Buffer, max: number) => number
  GetWindowTextLengthW: (hwnd: unknown) => number
  GetWindowThreadProcessId: (hwnd: unknown, pidBuffer: Buffer | null) => number
  OpenProcess: (access: number, inherit: boolean, pid: number) => unknown
  QueryFullProcessImageNameW: (handle: unknown, flags: number, name: Buffer, size: Buffer) => boolean
  CloseHandle: (handle: unknown) => boolean
}

export const SW_RESTORE = 9
export const HWND_TOPMOST = -1
export const HWND_NOTOPMOST = -2
export const SWP_NOSIZE = 0x0001
export const SWP_NOMOVE = 0x0002
export const SWP_SHOWWINDOW = 0x0040
export const WM_CLOSE = 0x0010
export const SPI_GETWORKAREA = 0x0030
export const GWL_EXSTYLE = -20
export const WS_EX_TOPMOST = 0x00000008

// SendInput 相关
const INPUT_KEYBOARD = 1
const KEYEVENTF_EXTENDEDKEY = 0x0001
const KEYEVENTF_KEYUP = 0x0002

/**
 * INPUT 结构体在内存里的布局（手工算，不用 koffi.struct —— struct 出参已经证明不可靠）。
 *
 *   x64: type(4) + padding(4) + union(32) = 40 字节，union 从偏移 8 开始
 *   x86: type(4) + union(24)              = 28 字节，union 从偏移 4 开始
 *
 * KEYBDINPUT 在 union 内：wVk(2) wScan(2) dwFlags(4) time(4) [padding] dwExtraInfo(ptr)
 */
const IS_X64 = process.arch === 'x64'
const INPUT_SIZE = IS_X64 ? 40 : 28
const INPUT_OFF_VK = IS_X64 ? 8 : 4
const INPUT_OFF_SCAN = INPUT_OFF_VK + 2
const INPUT_OFF_FLAGS = INPUT_OFF_VK + 4
const INPUT_OFF_TIME = INPUT_OFF_VK + 8

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
      CloseHandle: kernel32.func('bool __stdcall CloseHandle(void *hObject)'),

      GetForegroundWindow: user32.func('void* __stdcall GetForegroundWindow()'),
      SetForegroundWindow: user32.func('bool __stdcall SetForegroundWindow(void *hWnd)'),
      BringWindowToTop: user32.func('bool __stdcall BringWindowToTop(void *hWnd)'),
      ShowWindow: user32.func('bool __stdcall ShowWindow(void *hWnd, int nCmdShow)'),
      SetFocus: user32.func('void* __stdcall SetFocus(void *hWnd)'),
      AttachThreadInput: user32.func('bool __stdcall AttachThreadInput(uint32_t idAttach, uint32_t idAttachTo, bool fAttach)'),
      MoveWindow: user32.func('bool __stdcall MoveWindow(void *hWnd, int x, int y, int w, int h, bool repaint)'),
      SetWindowPos: user32.func(
        'bool __stdcall SetWindowPos(void *hWnd, intptr_t hWndInsertAfter, int x, int y, int cx, int cy, uint32_t flags)'
      ),
      PostMessageW: user32.func('bool __stdcall PostMessageW(void *hWnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)'),
      SystemParametersInfoW: user32.func(
        'bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t param, void *out, uint32_t winIni)'
      ),
      GetCurrentThreadId: kernel32.func('uint32_t __stdcall GetCurrentThreadId()'),
      GetWindowLongW: user32.func('long __stdcall GetWindowLongW(void *hWnd, int nIndex)'),
      SendInput: user32.func('uint32_t __stdcall SendInput(uint32_t cInputs, void *pInputs, int cbSize)'),
      GetAsyncKeyState: user32.func('short __stdcall GetAsyncKeyState(int vKey)'),
      RECT: koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
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
          const key = String(hwnd)
          rawHandles.set(key, hwnd)
          found.push({ hwnd: key, pid, process, title })
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

// ── 控制类操作 ────────────────────────────────────────────────

/** hwnd 字符串 → 原始句柄。枚举时缓存，避免把字符串转数字丢精度 */
const rawHandles = new Map<string, unknown>()

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export function primaryWorkArea(): WorkArea | null {
  const api = ensure()
  if (!api) return null
  try {
    // RECT = 4 个 int32；用 Buffer 传指针（struct 出参在 koffi 里不总可靠）
    const buffer = Buffer.alloc(16)
    const ok = api.SystemParametersInfoW(SPI_GETWORKAREA, 0, buffer, 0)
    if (!ok) return null
    const left = buffer.readInt32LE(0)
    const top = buffer.readInt32LE(4)
    const right = buffer.readInt32LE(8)
    const bottom = buffer.readInt32LE(12)
    if (right <= left || bottom <= top) return null
    return { x: left, y: top, width: right - left, height: bottom - top }
  } catch {
    return null
  }
}

/**
 * 括号里是历史上的坑：后台进程直接调 SetForegroundWindow 会被 Windows 拒绝（只闪任务栏）。
 * 正规做法是把当前线程的输入队列临时挂到目标线程和前台线程上，调完再摘掉。
 */
export function focusWindow(hwnd: string): { ok: boolean; reason?: string } {
  const api = ensure()
  if (!api) return { ok: false, reason: 'koffi 不可用' }
  const target = rawHandles.get(hwnd)
  if (!target) return { ok: false, reason: `窗口句柄未知或已失效：${hwnd}（请重新查询）` }

  const currentThread = api.GetCurrentThreadId()
  const foreground = api.GetForegroundWindow()
  const foregroundThread = foreground ? api.GetWindowThreadProcessId(foreground, null) : 0
  const targetThread = api.GetWindowThreadProcessId(target, null)

  const attached: number[] = []
  const attach = (threadId: number): void => {
    if (!threadId || threadId === currentThread) return
    if (api.AttachThreadInput(currentThread, threadId, true)) attached.push(threadId)
  }

  try {
    attach(foregroundThread)
    attach(targetThread)
    api.ShowWindow(target, SW_RESTORE)
    const activated = api.SetForegroundWindow(target)
    api.BringWindowToTop(target)
    api.SetFocus(target)
    return activated ? { ok: true } : { ok: false, reason: 'SetForegroundWindow 被系统拒绝' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    for (const threadId of attached) api.AttachThreadInput(currentThread, threadId, false)
  }
}

export function moveWindow(
  hwnd: string,
  rect: { x: number; y: number; width: number; height: number }
): { ok: boolean; reason?: string } {
  const api = ensure()
  if (!api) return { ok: false, reason: 'koffi 不可用' }
  const target = rawHandles.get(hwnd)
  if (!target) return { ok: false, reason: `窗口句柄未知或已失效：${hwnd}（请重新查询）` }
  try {
    const moved = api.MoveWindow(target, rect.x, rect.y, rect.width, rect.height, true)
    return moved ? { ok: true } : { ok: false, reason: 'MoveWindow 返回 false' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function setTopmost(hwnd: string, on: boolean): { ok: boolean; reason?: string } {
  const api = ensure()
  if (!api) return { ok: false, reason: 'koffi 不可用' }
  const target = rawHandles.get(hwnd)
  if (!target) return { ok: false, reason: `窗口句柄未知或已失效：${hwnd}（请重新查询）` }
  try {
    const flags = SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW
    const positioned = api.SetWindowPos(target, on ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, flags)
    return positioned ? { ok: true } : { ok: false, reason: 'SetWindowPos 返回 false' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function closeWindow(hwnd: string): { ok: boolean; reason?: string } {
  const api = ensure()
  if (!api) return { ok: false, reason: 'koffi 不可用' }
  const target = rawHandles.get(hwnd)
  if (!target) return { ok: false, reason: `窗口句柄未知或已失效：${hwnd}（请重新查询）` }
  try {
    // 只发 WM_CLOSE，让目标自己决定要不要关（不用 TerminateProcess 那种硬杀）
    const posted = api.PostMessageW(target, WM_CLOSE, 0, 0)
    return posted ? { ok: true } : { ok: false, reason: 'PostMessage 返回 false' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

/** 当前窗口是否置顶（读扩展样式位） */
export function isTopmost(hwnd: string): boolean | null {
  const api = ensure()
  if (!api) return null
  const target = rawHandles.get(hwnd)
  if (!target) return null
  try {
    const style = api.GetWindowLongW(target, GWL_EXSTYLE)
    return (style & WS_EX_TOPMOST) !== 0
  } catch {
    return null
  }
}

// ── 键盘事件发送 ──────────────────────────────────────────────

export interface KeyEventSpec {
  /** 虚拟键码（VK_*） */
  vk: number
  /** 扩展键（方向键、Insert/Delete/Home/End/PgUp/PgDn、NumLock 等） */
  extended: boolean
  /** true = 抬起 */
  up: boolean
}

/**
 * 这个键当前是否被物理按住。
 * 返回 null 表示 koffi 不可用（调用方按"没按住"处理）。
 */
export function isVirtualKeyDown(vk: number): boolean | null {
  const api = ensure()
  if (!api) return null
  try {
    return (api.GetAsyncKeyState(vk) & 0x8000) !== 0
  } catch {
    return null
  }
}

/**
 * 发送一串键盘事件。
 *
 * 用 SendInput 而不是 PostMessage：SendInput 走系统输入队列，目标程序和真实按键无法区分，
 * 兼容性远好于 WM_KEYDOWN（后者对很多现代应用无效）。
 * 代价是它只能发给**当前前台窗口** —— 要指定窗口得先聚焦（见 win.window.control）。
 */
export function sendKeyEvents(events: KeyEventSpec[]): { ok: boolean; sent: number; reason?: string } {
  const api = ensure()
  if (!api) return { ok: false, sent: 0, reason: `koffi 不可用：${win32LoadError() ?? '未知原因'}` }
  if (!events.length) return { ok: true, sent: 0 }

  const buffer = Buffer.alloc(INPUT_SIZE * events.length)
  events.forEach((event, index) => {
    const base = index * INPUT_SIZE
    buffer.writeUInt32LE(INPUT_KEYBOARD, base)
    buffer.writeUInt16LE(event.vk, base + INPUT_OFF_VK)
    buffer.writeUInt16LE(0, base + INPUT_OFF_SCAN) // wScan=0，走 VK 通道
    let flags = 0
    if (event.extended) flags |= KEYEVENTF_EXTENDEDKEY
    if (event.up) flags |= KEYEVENTF_KEYUP
    buffer.writeUInt32LE(flags, base + INPUT_OFF_FLAGS)
    buffer.writeUInt32LE(0, base + INPUT_OFF_TIME)
    // dwExtraInfo 保持 0
  })

  try {
    const sent = Number(api.SendInput(events.length, buffer, INPUT_SIZE))
    if (sent !== events.length) {
      return { ok: false, sent, reason: `SendInput 只被接受 ${sent}/${events.length} 个事件（可能被 UIPI 拦截）` }
    }
    return { ok: true, sent }
  } catch (error) {
    return { ok: false, sent: 0, reason: error instanceof Error ? error.message : String(error) }
  }
}
