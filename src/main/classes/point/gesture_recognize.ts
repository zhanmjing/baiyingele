import { elapsed } from '../../capabilities/_shared'
import { recognize, type GesturePoint, type RecognizerOptions } from '../../../shared/gestureRecognizer'

/**
 * point.gesture_recognize —— 轨迹 → 方向串
 *
 * 把 gestureRecognizer 的纯算法包成点层能力，这样它才能被线层编排、被体层组合。
 *
 * 输出是**箭头串**（与 WGestures 一致）：'←↓→'
 */

export const classId = 'point.gesture_recognize'
export const summary = '轨迹 → 箭头方向串（WGestures 4/8 向算法 + 拖拽抑制）'
export const specialized = true

export interface RecognizeResult {
  status: 'ok' | 'warn'
  output: string
  value?: string
  directions: string
  valid: boolean
  reason?: string
  elapsedMs: number
}

export function recognizePoints(points: GesturePoint[], options: RecognizerOptions = {}): RecognizeResult {
  const startedAt = Date.now()
  const result = recognize(points, options)
  if (!result.valid) {
    return {
      status: 'warn',
      output: `未成手势：${result.reason ?? '未知原因'}（${points.length} 点，${Math.round(result.length)}px）`,
      directions: result.directions,
      valid: false,
      reason: result.reason,
      elapsedMs: elapsed(startedAt)
    }
  }
  return {
    status: 'ok',
    output: `识别为 ${result.directions}（${points.length} 点，${Math.round(result.length)}px）`,
    value: result.directions,
    directions: result.directions,
    valid: true,
    elapsedMs: elapsed(startedAt)
  }
}

export const run = (context: any): RecognizeResult => {
  const params = context?.params ?? {}
  const points = (params.points ?? context?.input ?? []) as GesturePoint[]
  if (!Array.isArray(points) || !points.length) {
    return { status: 'warn', output: '没有轨迹点', directions: '', valid: false, reason: 'too-few-points', elapsedMs: 0 }
  }
  return recognizePoints(points, {
    minLength: params.minLength !== undefined ? Number(params.minLength) : undefined,
    minSegments: params.minSegments !== undefined ? Number(params.minSegments) : undefined,
    dragSuppressPx: params.dragSuppressPx !== undefined ? Number(params.dragSuppressPx) : undefined,
    eightDirections: params.eightDirections !== undefined ? Boolean(params.eightDirections) : undefined,
    switchVotes: params.switchVotes !== undefined ? Number(params.switchVotes) : undefined
  })
}
