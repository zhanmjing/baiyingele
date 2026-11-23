/**
 * 第 0 步验证：koffi 能否直接调 Win32。
 *
 * 两种跑法都支持（脚本不依赖 app.whenReady）：
 *   node scripts/probe-koffi.cjs                                   ← 纯 Node
 *   ELECTRON_RUN_AS_NODE=1 electron.exe scripts/probe-koffi.cjs     ← Electron 自带 Node 运行时（ABI 验证）
 */
const result = { ok: false, runtime: { node: process.versions.node, modules: process.versions.modules, electron: process.versions.electron ?? null }, checks: {} }

try {
  const koffi = require('koffi')
  result.koffiVersion = koffi.version
  const user32 = koffi.load('user32.dll')
  result.checks.loadDll = true

  const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()')
  const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hWnd)')
  const hwnd = GetForegroundWindow()
  result.checks.foreground = { handle: String(hwnd), visible: IsWindowVisible(hwnd) }

  // 回调式枚举：窗口查询真正要用的形态
  try {
    const EnumProc = koffi.proto('bool __stdcall EnumProc(void *hwnd, intptr_t lParam)')
    const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumProc *cb, intptr_t lParam)')
    const handles = []
    const callback = koffi.register((win) => {
      handles.push(String(win))
      return handles.length < 500
    }, koffi.pointer(EnumProc))
    try {
      EnumWindows(callback, 0)
    } finally {
      koffi.unregister(callback)
    }
    result.checks.enumWindows = { count: handles.length, sample: handles.slice(0, 3) }
  } catch (error) {
    result.checks.enumWindows = { error: String(error && error.message) }
  }

  result.ok = true
} catch (error) {
  result.error = String(error && error.message)
}

console.log('KOFFI_PROBE ' + JSON.stringify(result))
