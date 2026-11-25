import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'
import type { GesturePoint } from '../../../shared/gestureRecognizer'

/**
 * surface.gesture_trail —— 手势轨迹浮层
 *
 * 对应 WGestures 的 GestureViewShowPath（CanvasWindowGestureView.ShowPath）。
 *
 * ## 原码行为
 *
 * HandleIntentRecognized 里：
 *   if (!_isCurrentRecognized && ShowPath) {
 *       _isCurrentRecognized = true;
 *       _pathPen = _tempMainPen;      // ← 识别成功后路径换笔
 *   }
 *
 * 也就是说轨迹浮层要表达两件事：
 *   1. 现在画到哪里了（实时折线）
 *   2. **有没有被识别**（换色/换粗细）
 *
 * 只有 1 没有 2，用户看不出「我画的这个到底认没认出来」。
 */

export const classId = 'surface.gesture_trail'
export const summary = '手势轨迹浮层：实时折线 + 识别成功后换色'
export const specialized = true

export interface TrailStyle {
  /** 未识别时的笔 */
  idle: { color: string; width: number; opacity: number }
  /** 识别成功后的笔（对应 _tempMainPen） */
  recognized: { color: string; width: number; opacity: number }
}

/** 默认笔：识别前灰细，识别后亮粗。数值是适配值，不是 WGestures 原值。 */
export const DEFAULT_TRAIL_STYLE: TrailStyle = {
  idle: { color: '#9aa4b2', width: 3, opacity: 0.75 },
  recognized: { color: '#4ade80', width: 5, opacity: 1 }
}

export interface TrailRender {
  /** 折线点（屏幕坐标，原样给渲染层，不做缩放假设） */
  polyline: Array<{ x: number; y: number }>
  /** 是否已被识别（决定用哪支笔） */
  recognized: boolean
  /** 当前笔 */
  pen: { color: string; width: number; opacity: number }
  /** 实时方向串（画在轨迹旁边） */
  directions: string
  /** 点了多少个 */
  pointCount: number
  /** 轨迹包围盒，浮层用它决定画布大小 */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  visible: boolean
}

export interface TrailInput extends SurfaceClassInput {
  points?: GesturePoint[]
  directions?: string
  recognized?: boolean
  style?: Partial<TrailStyle>
}

export function computeTrail(input: TrailInput): TrailRender {
  const points = input.points ?? []
  const style: TrailStyle = {
    idle: { ...DEFAULT_TRAIL_STYLE.idle, ...(input.style?.idle ?? {}) },
    recognized: { ...DEFAULT_TRAIL_STYLE.recognized, ...(input.style?.recognized ?? {}) }
  }
  const recognized = input.recognized === true

  if (!points.length) {
    return {
      polyline: [],
      recognized: false,
      pen: style.idle,
      directions: '',
      pointCount: 0,
      // 空轨迹给一个退化包围盒，渲染层据此直接隐藏
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      visible: false
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  // 点太多时抽稀，避免浮层每帧画几千个点
  const step = points.length > 400 ? Math.ceil(points.length / 400) : 1
  const polyline: Array<{ x: number; y: number }> = []
  for (let i = 0; i < points.length; i += step) {
    const p = points[i]
    polyline.push({ x: p.x, y: p.y })
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  // 收尾点必须保留，否则尾巴会缺一截
  const last = points[points.length - 1]
  if (polyline[polyline.length - 1]?.x !== last.x || polyline[polyline.length - 1]?.y !== last.y) {
    polyline.push({ x: last.x, y: last.y })
  }

  return {
    polyline,
    recognized,
    pen: recognized ? style.recognized : style.idle,
    directions: input.directions ?? '',
    pointCount: points.length,
    bounds: { minX, minY, maxX, maxY },
    visible: true
  }
}

export interface TrailSurfaceRender extends RenderResult {
  trail?: TrailRender
}

export const run = defineClassImpl<TrailInput, TrailSurfaceRender>({
  classId,
  summary,
  run: (input) => {
    const base = planRender(classId, input.instanceId, input.params, input.deps)
    const trail = computeTrail(input)
    return { ...base, blocks: [], trail, intents: [], gaps: base.gaps }
  }
}).run
