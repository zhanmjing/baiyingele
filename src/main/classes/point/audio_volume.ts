import {
  callMethod,
  coInitialize,
  comAvailable,
  comLoadError,
  createInstance,
  guid,
  hresultText,
  succeeded
} from '../../capabilities/_com'
import { isWindows } from '../../capabilities/_powershell'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'point.audio_volume'
export const summary = 'CoreAudio (IAudioEndpointVolume) 精确控制主音量与静音，写完读回校验'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

const CLSID_MMDEVICE_ENUMERATOR = 'BCDE0395-E52F-467C-8E3D-C4579291692E'
const IID_IMMDEVICE_ENUMERATOR = 'A95664D2-9614-4F35-A746-DE8DB63617E6'
const IID_IAUDIO_ENDPOINT_VOLUME = '5CDF2C82-841E-4546-9722-0CF74078229A'

/** vtable 槽位（QueryInterface/AddRef/Release 之后按接口声明顺序） */
const SLOT = {
  /** IMMDeviceEnumerator::GetDefaultAudioEndpoint */
  getDefaultEndpoint: 4,
  /** IMMDevice::Activate */
  activate: 3,
  /** IAudioEndpointVolume::SetMasterVolumeLevelScalar */
  setLevel: 7,
  /** IAudioEndpointVolume::GetMasterVolumeLevelScalar */
  getLevel: 9,
  /** IAudioEndpointVolume::SetMute */
  setMute: 14,
  /** IAudioEndpointVolume::GetMute */
  getMute: 15
} as const

export type VolumeAction = 'get' | 'up' | 'down' | 'set' | 'mute' | 'unmute' | 'toggle'

export interface VolumeState {
  /** 0..1 */
  level: number
  mute: boolean
}

export interface VolumePlan {
  /** 目标音量 0..1；null 表示不改 */
  level: number | null
  /** 目标静音；null 表示不改 */
  mute: boolean | null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * 纯函数：算出「这次要改成什么」。
 * 不认识的动作返回 null —— 绝不猜用户想干什么。
 */
export function planVolumeChange(
  action: string,
  current: VolumeState,
  stepPercent: number,
  targetPercent: number
): VolumePlan | null {
  const step = Number.isFinite(stepPercent) ? Math.abs(stepPercent) / 100 : 0.05
  switch (String(action ?? '').trim().toLowerCase()) {
    case 'get':
      return { level: null, mute: null }
    case 'up':
      return { level: clamp01(current.level + step), mute: null }
    case 'down':
      return { level: clamp01(current.level - step), mute: null }
    case 'set':
      return { level: clamp01(targetPercent / 100), mute: null }
    case 'mute':
      return { level: null, mute: true }
    case 'unmute':
      return { level: null, mute: false }
    case 'toggle':
      return { level: null, mute: !current.mute }
    default:
      return null
  }
}

interface CoreAudioProtos {
  GetDefaultEndpoint: unknown
  Activate: unknown
  GetLevel: unknown
  SetLevel: unknown
  GetMute: unknown
  SetMute: unknown
}

interface VolumeHandle {
  object: bigint
  read: () => VolumeState
  writeLevel: (level: number) => number
  writeMute: (mute: boolean) => number
}

let protos: CoreAudioProtos | null = null
let handle: VolumeHandle | null = null

function ensureProtos(): CoreAudioProtos | null {
  if (protos) return protos
  try {
    const koffi = require('koffi')
    protos = {
      GetDefaultEndpoint: koffi.proto(
        'long __stdcall CoreAudioGetDefaultEP(void *self, int dataFlow, int role, void *ppDevice)'
      ),
      Activate: koffi.proto(
        'long __stdcall CoreAudioActivate(void *self, void *iid, uint32_t ctx, void *params, void *ppv)'
      ),
      GetLevel: koffi.proto('long __stdcall CoreAudioGetLevel(void *self, void *level)'),
      SetLevel: koffi.proto('long __stdcall CoreAudioSetLevel(void *self, float level, void *ctx)'),
      GetMute: koffi.proto('long __stdcall CoreAudioGetMute(void *self, void *mute)'),
      SetMute: koffi.proto('long __stdcall CoreAudioSetMute(void *self, bool mute, void *ctx)')
    }
    return protos
  } catch {
    return null
  }
}

/** 取默认播放设备的主音量接口；失败时返回原因（不抛） */
function open(): { ok: true; handle: VolumeHandle } | { ok: false; reason: string } {
  if (handle) return { ok: true, handle }

  const init = coInitialize()
  if (!init.ok) return { ok: false, reason: init.note }

  const p = ensureProtos()
  if (!p) return { ok: false, reason: 'CoreAudio 函数原型创建失败' }

  const enumerator = createInstance(CLSID_MMDEVICE_ENUMERATOR, IID_IMMDEVICE_ENUMERATOR)
  if (!enumerator) return { ok: false, reason: '创建 MMDeviceEnumerator 失败' }

  // eRender = 0（播放），eConsole = 0（默认用途）
  const deviceOut = Buffer.alloc(8)
  const hrDevice = callMethod(enumerator, SLOT.getDefaultEndpoint, p.GetDefaultEndpoint, 0, 0, deviceOut)
  if (!succeeded(hrDevice)) {
    return { ok: false, reason: `GetDefaultAudioEndpoint 失败 ${hresultText(hrDevice)}（可能没有音频输出设备）` }
  }

  const device = deviceOut.readBigUInt64LE(0)
  const volumeOut = Buffer.alloc(8)
  const hrActivate = callMethod(
    device,
    SLOT.activate,
    p.Activate,
    guid(IID_IAUDIO_ENDPOINT_VOLUME),
    23,
    null,
    volumeOut
  )
  if (!succeeded(hrActivate)) {
    return { ok: false, reason: `Activate(IAudioEndpointVolume) 失败 ${hresultText(hrActivate)}` }
  }

  const object = volumeOut.readBigUInt64LE(0)
  const created: VolumeHandle = {
    object,
    read: () => {
      const levelBuffer = Buffer.alloc(4)
      const muteBuffer = Buffer.alloc(4)
      const hrLevel = callMethod(object, SLOT.getLevel, p.GetLevel, levelBuffer)
      const hrMute = callMethod(object, SLOT.getMute, p.GetMute, muteBuffer)
      if (!succeeded(hrLevel) || !succeeded(hrMute)) {
        throw new Error(`读取音量失败 ${hresultText(hrLevel)}/${hresultText(hrMute)}`)
      }
      return { level: levelBuffer.readFloatLE(0), mute: muteBuffer.readInt32LE(0) !== 0 }
    },
    writeLevel: (level: number) => callMethod(object, SLOT.setLevel, p.SetLevel, level, null),
    writeMute: (mute: boolean) => callMethod(object, SLOT.setMute, p.SetMute, mute, null)
  }

  // 先读一次确认接口真的可用，别把坏指针缓存下来
  try {
    created.read()
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }

  handle = created
  return { ok: true, handle: created }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** L1 · 控制系统音量 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }
  if (!comAvailable()) {
    return { status: 'warn', output: `音量控制需要 koffi：${comLoadError() ?? '未加载'}`, elapsedMs: elapsed(startedAt) }
  }

  const action = String(ctx.params.action ?? '').trim()
  const stepPercent = Number(ctx.params.step ?? 5)
  const targetPercent = Number(ctx.params.level ?? 50)
  const appParam = String(ctx.params.app ?? '').trim()

  if (appParam) {
    return {
      status: 'warn',
      output: `暂不支持应用级音量（app=${appParam}），当前只控制系统主音量`,
      elapsedMs: elapsed(startedAt)
    }
  }

  const opened = open()
  if (!opened.ok) {
    return { status: 'warn', output: `打开音频端点失败：${opened.reason}`, elapsedMs: elapsed(startedAt) }
  }

  try {
    const before = opened.handle.read()
    const plan = planVolumeChange(action, before, stepPercent, targetPercent)
    if (!plan) {
      return {
        status: 'warn',
        output: `未知 action：${action || '(空)'}（支持 up / down / set / mute / unmute / toggle）`,
        evidence: { before },
        elapsedMs: elapsed(startedAt)
      }
    }

    const errors: string[] = []
    if (plan.level !== null) {
      const hr = opened.handle.writeLevel(plan.level)
      if (!succeeded(hr)) errors.push(`设置音量失败 ${hresultText(hr)}`)
    }
    if (plan.mute !== null) {
      const hr = opened.handle.writeMute(plan.mute)
      if (!succeeded(hr)) errors.push(`设置静音失败 ${hresultText(hr)}`)
    }

    // 写完读回校验：不信"调用成功"，只信"值真的变了"
    //
    // 注意：Windows 会把音量对齐到硬件台阶（常见 2%），所以「步进」动作不能要求数值精确相等，
    // 只能要求「方向对了」；只有 set 才要求落在容差内。
    const after = opened.handle.read()
    const normalizedAction = action.trim().toLowerCase()
    const atTop = before.level >= 0.995
    const atBottom = before.level <= 0.005

    if (plan.level !== null) {
      const target = plan.level
      if (normalizedAction === 'set') {
        if (Math.abs(after.level - target) > 0.01) {
          errors.push(`音量读回不一致：期望 ${percent(target)}，实际 ${percent(after.level)}`)
        }
      } else if (normalizedAction === 'up' && !atTop && after.level <= before.level) {
        errors.push(`音量没有上升：${percent(before.level)} → ${percent(after.level)}`)
      } else if (normalizedAction === 'down' && !atBottom && after.level >= before.level) {
        errors.push(`音量没有下降：${percent(before.level)} → ${percent(after.level)}`)
      }
    }
    if (plan.mute !== null && after.mute !== plan.mute) {
      errors.push(`静音读回不一致：期望 ${plan.mute}，实际 ${after.mute}`)
    }

    const summary = [
      `音量 ${percent(before.level)} → ${percent(after.level)}`,
      `${before.mute ? '静音' : '未静音'} → ${after.mute ? '静音' : '未静音'}`
    ].join(' · ')

    if (normalizedAction === 'get') {
      return {
        status: 'ok',
        output: `当前音量 ${percent(after.level)} · ${after.mute ? '已静音' : '未静音'}`,
        value: `${Math.round(after.level * 100)}${after.mute ? ' (muted)' : ''}`,
        evidence: { backend: 'coreaudio', action: 'get', after },
        elapsedMs: elapsed(startedAt)
      }
    }

    const changed = Math.abs(after.level - before.level) > 0.005 || after.mute !== before.mute
    const note = changed ? '' : '（数值没变化，可能已经在边界）'

    return {
      status: errors.length ? 'warn' : 'ok',
      output: errors.length ? `${action} 部分失败：${errors.join('；')}` : `已${actionLabel(action)}：${summary}${note}`,
      value: `${Math.round(after.level * 100)}${after.mute ? ' (muted)' : ''}`,
      evidence: { backend: 'coreaudio', action, before, after, plan, stepPercent, targetPercent, errors },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    // 设备可能被拔掉了：丢掉缓存的接口，下次重新打开
    handle = null
    return { status: 'warn', output: `音量控制失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    get: '读取音量',
    up: '提高音量',
    down: '降低音量',
    set: '设定音量',
    mute: '静音',
    unmute: '取消静音',
    toggle: '切换静音'
  }
  return labels[action] ?? action
}
