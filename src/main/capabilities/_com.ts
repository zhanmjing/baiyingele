/**
 * 极简 COM 调用层（koffi）。
 *
 * 为什么要自己写：CoreAudio 的音量接口（IAudioEndpointVolume）只有 COM 这一条路，
 * 没有等价的 Win32 导出函数。想"精确设成 30%"就必须走 COM。
 *
 * 三条规矩（和 _win32.ts 一致）：
 *   1. **所有 C 函数签名只写在这个文件里**
 *   2. koffi 懒加载；拿不到时所有函数返回失败，调用方回退或如实报错
 *   3. 调 COM 方法一律走 callMethod()，它自动把 this 作为第一个参数补上
 *
 * 关键语义（都是实测出来的，不是猜的）：
 *   - 接口指针 → vtable：`koffi.decode(对象地址, 'void *')` 读出 vtable 地址
 *   - vtable 槽位：`koffi.decode(vtable地址, 序号*8, 'void *')` 读出函数地址
 *   - 调函数指针：`koffi.call(函数地址, 原型, 参数...)`
 *   - 传 Buffer 当作 `void *` 出参是可行的（写回的是指针值）
 */

export const CLSCTX_ALL = 23
const COINIT_APARTMENTTHREADED = 0x2
/** RPC_E_CHANGED_MODE：本线程已经用另一种套间模型初始化过 COM */
const RPC_E_CHANGED_MODE = -2147417850

interface ComApi {
  koffi: any
  CoInitializeEx: (pv: unknown, coInit: number) => number
  CoCreateInstance: (clsid: Buffer, outer: unknown, context: number, iid: Buffer, out: Buffer) => number
}

let api: ComApi | null = null
let loadError: string | null = null
let initResult: { ok: boolean; hr: number; note: string } | null = null

function ensure(): ComApi | null {
  if (api) return api
  if (loadError) return null
  try {
    const koffi = require('koffi')
    const ole32 = koffi.load('ole32.dll')
    api = {
      koffi,
      CoInitializeEx: ole32.func('long __stdcall CoInitializeEx(void *pv, uint32_t coInit)'),
      CoCreateInstance: ole32.func(
        'long __stdcall CoCreateInstance(void *rclsid, void *pUnkOuter, uint32_t dwClsContext, void *riid, void *ppv)'
      )
    }
    return api
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
    return null
  }
}

export function comAvailable(): boolean {
  return ensure() !== null
}

export function comLoadError(): string | null {
  return loadError
}

/** HTM GUID 文本 → 16 字节 Buffer（纯函数，方便测试） */
export function guid(hex: string): Buffer {
  const compact = String(hex ?? '').replace(/[{}\-\s]/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) throw new Error(`GUID 格式不对：${hex}`)
  const buffer = Buffer.alloc(16)
  buffer.writeUInt32LE(parseInt(compact.slice(0, 8), 16), 0)
  buffer.writeUInt16LE(parseInt(compact.slice(8, 12), 16), 4)
  buffer.writeUInt16LE(parseInt(compact.slice(12, 16), 16), 6)
  for (let index = 0; index < 8; index++) {
    buffer[8 + index] = parseInt(compact.slice(16 + index * 2, 18 + index * 2), 16)
  }
  return buffer
}

/** 每个进程只初始化一次；已经初始化过（S_FALSE）或套间模型不同都算可用 */
export function coInitialize(): { ok: boolean; hr: number; note: string } {
  if (initResult) return initResult
  const com = ensure()
  if (!com) {
    initResult = { ok: false, hr: -1, note: `koffi 不可用：${loadError ?? '未知'}` }
    return initResult
  }
  const hr = Number(com.CoInitializeEx(null, COINIT_APARTMENTTHREADED))
  if (hr === 0) initResult = { ok: true, hr, note: 'STA 初始化成功' }
  else if (hr === 1) initResult = { ok: true, hr, note: 'COM 已经初始化过（S_FALSE）' }
  else if (hr === RPC_E_CHANGED_MODE) initResult = { ok: true, hr, note: '本线程已是 MTA，进程内 COM 不需要封送' }
  else initResult = { ok: false, hr, note: `CoInitializeEx 失败 0x${(hr >>> 0).toString(16)}` }
  return initResult
}

/** 创建 COM 对象，失败返回 null */
export function createInstance(clsid: string, iid: string, context = CLSCTX_ALL): bigint | null {
  const com = ensure()
  if (!com) return null
  const out = Buffer.alloc(8)
  const hr = Number(com.CoCreateInstance(guid(clsid), null, context, guid(iid), out))
  if (hr < 0) return null
  return out.readBigUInt64LE(0)
}

/** 从接口指针取出第 index 个 vtable 槽位的函数地址 */
export function methodOf(object: bigint, index: number): unknown {
  const com = ensure()
  if (!com) throw new Error('koffi 不可用')
  const vtable = com.koffi.decode(object, 'void *')
  return com.koffi.decode(vtable, index * 8, 'void *')
}

/**
 * 调 COM 方法。**this 自动补上**，调用方只写真实参数。
 * 返回 HRESULT（有符号 32 位；>= 0 表示成功）。
 */
export function callMethod(object: bigint, index: number, proto: unknown, ...args: unknown[]): number {
  const com = ensure()
  if (!com) return -1
  const fn = methodOf(object, index)
  return Number(com.koffi.call(fn, proto, object, ...args))
}

/** HRESULT 是否成功（S_OK=0 / S_FALSE=1 都算成功） */
export function succeeded(hr: number): boolean {
  return hr >= 0
}

export function hresultText(hr: number): string {
  return `0x${(hr >>> 0).toString(16)}`
}
