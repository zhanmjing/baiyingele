import { isWindows, runPowerShell } from '../../capabilities/_powershell'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'point.display_brightness'
export const summary = 'WMI 控制内屏亮度（WmiSetBrightness），写完读回校验；外接屏需 DDC/CI'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

export type BrightnessAction = 'get' | 'set' | 'up' | 'down'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/**
 * 纯函数：算出目标亮度（0–100）。'get' 与不认识的动作返回 null（= 不改）。
 * 用整数百分比，因为 WMI 的 Brightness 就是 0–100 的整数。
 */
export function planBrightnessChange(
  action: string,
  current: number,
  stepPercent: number,
  targetPercent: number
): number | null {
  const step = Number.isFinite(stepPercent) ? Math.abs(stepPercent) : 10
  switch (String(action ?? '').trim().toLowerCase()) {
    case 'get':
      return null
    case 'set':
      return clampPercent(targetPercent)
    case 'up':
      return clampPercent(current + step)
    case 'down':
      return clampPercent(current - step)
    default:
      return null
  }
}

interface BrightnessRead {
  ok: boolean
  level?: number
  reason?: string
}

/** 读当前亮度。没有内屏（台式机）时返回 ok:false 并说明原因 */
async function readInternal(): Promise<BrightnessRead> {
  const script = [
    '$item = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue | Select-Object -First 1',
    'if ($item) { "BRIGHT:" + [string]$item.CurrentBrightness } else { "NONE" }'
  ].join('\n')

  const raw = await runPowerShell(script)
  if (raw === 'NONE' || !raw) return { ok: false, reason: '本机没有支持 WMI 亮度控制的内置屏幕' }
  const match = /BRIGHT:\s*(-?\d+)/.exec(raw)
  if (!match) return { ok: false, reason: `无法解析亮度输出：${raw.slice(0, 60)}` }
  return { ok: true, level: clampPercent(Number(match[1])) }
}

/** 设亮度。注意 WMI 的 ReturnValue 常常是空的，所以**不能**靠返回值判断成功 */
async function writeInternal(level: number): Promise<{ ok: boolean; reason?: string }> {
  const target = clampPercent(level)
  const script = [
    '$m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue | Select-Object -First 1',
    'if (-not $m) { "NONE"; return }',
    'try {',
    `  $null = Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Brightness = ${target}; Timeout = 0 } -ErrorAction Stop`,
    '  "OK"',
    '} catch { "ERR:" + $_.Exception.Message }'
  ].join('\n')

  const raw = await runPowerShell(script)
  if (raw === 'NONE') return { ok: false, reason: '本机没有 WMI 亮度控制方法（WmiMonitorBrightnessMethods 为空）' }
  if (raw.startsWith('ERR:')) return { ok: false, reason: raw.slice(4).trim() }
  if (raw !== 'OK') return { ok: false, reason: `WMI 返回了意外输出：${raw.slice(0, 60)}` }
  return { ok: true }
}

const DDC_NOTE =
  '外接屏需要 DDC/CI（dxva2 的 GetMonitorBrightness）。本机主显示器实测返回 false，' +
  '这条路径没有可验证的硬件，所以没有实现——不想塞进一段跑不通的代码。'

/** L1 · 控制亮度 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }

  const action = String(ctx.params.action ?? '').trim()
  const stepPercent = Number(ctx.params.step ?? 10)
  const targetPercent = Number(ctx.params.value ?? 60)
  const monitor = String(ctx.params.monitor ?? 'internal').trim().toLowerCase()
  const method = String(ctx.params.method ?? 'auto').trim().toLowerCase()

  if (monitor === 'external') {
    return { status: 'warn', output: `暂不支持外接屏亮度：${DDC_NOTE}`, elapsedMs: elapsed(startedAt) }
  }
  if (monitor !== 'internal' && monitor !== 'auto') {
    return { status: 'warn', output: `未知 monitor：${monitor}（支持 internal / external / auto）`, elapsedMs: elapsed(startedAt) }
  }
  if (method === 'ddc') {
    return { status: 'warn', output: `暂不支持 DDC/CI：${DDC_NOTE}`, elapsedMs: elapsed(startedAt) }
  }

  try {
    const before = await readInternal()
    if (!before.ok) {
      return { status: 'warn', output: `读取亮度失败：${before.reason}`, elapsedMs: elapsed(startedAt) }
    }
    const current = before.level as number

    const plan = planBrightnessChange(action, current, stepPercent, targetPercent)
    if (action.trim().toLowerCase() === 'get') {
      return {
        status: 'ok',
        output: `当前内屏亮度 ${current}%`,
        value: String(current),
        evidence: { backend: 'wmi', action: 'get', monitor, level: current },
        elapsedMs: elapsed(startedAt)
      }
    }
    if (plan === null) {
      return {
        status: 'warn',
        output: `未知 action：${action || '(空)'}（支持 get / set / up / down）`,
        evidence: { backend: 'wmi', before: current },
        elapsedMs: elapsed(startedAt)
      }
    }

    const written = await writeInternal(plan)
    if (!written.ok) {
      return { status: 'warn', output: `设置亮度失败：${written.reason}`, elapsedMs: elapsed(startedAt) }
    }

    // WMI 的返回值不可信，等一小会儿再读回真实值
    await new Promise((resolve) => setTimeout(resolve, 250))
    const after = await readInternal()
    if (!after.ok) {
      return {
        status: 'warn',
        output: `亮度已下发但读回失败：${after.reason}`,
        evidence: { backend: 'wmi', before: current, target: plan },
        elapsedMs: elapsed(startedAt)
      }
    }
    const actual = after.level as number

    const errors: string[] = []
    const normalized = action.trim().toLowerCase()
    if (normalized === 'set' && Math.abs(actual - plan) > 2) {
      errors.push(`亮度读回不一致：期望 ${plan}%，实际 ${actual}%`)
    } else if (normalized === 'up' && current < 100 && actual <= current) {
      errors.push(`亮度没有上升：${current}% → ${actual}%`)
    } else if (normalized === 'down' && current > 0 && actual >= current) {
      errors.push(`亮度没有下降：${current}% → ${actual}%`)
    }

    return {
      status: errors.length ? 'warn' : 'ok',
      output: errors.length
        ? errors.join('；')
        : `亮度 ${current}% → ${actual}%（内屏 · WMI）`,
      value: String(actual),
      evidence: {
        backend: 'wmi',
        action: normalized,
        monitor,
        before: current,
        target: plan,
        after: actual,
        stepPercent,
        targetPercent,
        errors
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `亮度控制失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
