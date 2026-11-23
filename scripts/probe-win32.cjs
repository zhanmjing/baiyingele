/** 验证：枚举窗口 + 标题 + 进程名（Buffer 传指针是否可用） */
const koffi = require('koffi')
const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const EnumWindows = user32.func('bool __stdcall EnumWindows(void *cb, intptr_t lParam)')
const EnumProc = koffi.proto('bool __stdcall EnumProc(void *hwnd, intptr_t lParam)')
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hWnd)')
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)')
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(void *hWnd)')
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, void *lpdwProcessId)')
const OpenProcess = kernel32.func('void* __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)')
const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32_t flags, void *lpExeName, void *lpdwSize)')
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *hObject)')

function windowTitle(hwnd) {
  const length = GetWindowTextLengthW(hwnd)
  if (length <= 0) return ''
  const buffer = Buffer.alloc((length + 1) * 2)
  const copied = GetWindowTextW(hwnd, buffer, length + 1)
  return buffer.toString('utf16le', 0, copied * 2)
}

function processNameOf(hwnd) {
  const pidBuffer = Buffer.alloc(4)
  GetWindowThreadProcessId(hwnd, pidBuffer)
  const pid = pidBuffer.readUInt32LE(0)
  const handle = OpenProcess(0x1000, false, pid) // PROCESS_QUERY_LIMITED_INFORMATION
  if (!handle) return { pid, name: '' }
  try {
    const sizeBuffer = Buffer.alloc(4)
    sizeBuffer.writeUInt32LE(1024, 0)
    const nameBuffer = Buffer.alloc(1024 * 2)
    const okQuery = QueryFullProcessImageNameW(handle, 0, nameBuffer, sizeBuffer)
    if (!okQuery) return { pid, name: '' }
    const chars = sizeBuffer.readUInt32LE(0)
    const full = nameBuffer.toString('utf16le', 0, chars * 2)
    return { pid, name: full.split(/[\\/]/).pop() ?? full }
  } finally {
    CloseHandle(handle)
  }
}

const found = []
const callback = koffi.register((hwnd) => {
  if (IsWindowVisible(hwnd)) {
    const title = windowTitle(hwnd)
    if (title) {
      const { pid, name } = processNameOf(hwnd)
      found.push({ hwnd: String(hwnd), pid, process: name, title: title.slice(0, 40) })
    }
  }
  return found.length < 400
}, koffi.pointer(EnumProc))

try {
  EnumWindows(callback, 0)
} finally {
  koffi.unregister(callback)
}

console.log('WIN32_PROBE ' + JSON.stringify({ total: found.length, sample: found.slice(0, 4) }))
