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
  /** 识别成功后的笔（对应 WGestures 的 _tempMainPen） */
  recognized: { color: string; width: number; opacity: number }
}

/**
 * 笔色**按触发按钮**区分 —— 照 CanvasWindowGestureView.cs:210。
 *
 *   if ((args.Button & Right) != 0) _tempMainPen = _mainPen;     rgb(50,200,100)
 *   else if ((args.Button & X) != 0) _tempMainPen = _xBtnPen;    rgb(20,100,200)
 *   else                             _tempMainPen = _middleBtnPen; rgb(20,150,200)
 *
 * 我第一版编了「灰→绿」，那是错的：颜色不是表示「认没认出来」，
 * 而是表示「哪个键触发的」。识别与否体现在用哪支笔（idle vs recognized）。
 */
export const BUTTON_PEN: Record<string, { color: string; width: number; opacity: number }> = {
  right: { color: '#32c864', width: 2, opacity: 1 },   // rgb(50,200,100)
  middle: { color: '#1496c8', width: 2, opacity: 1 },  // rgb(20,150,200)
  x1: { color: '#1464c8', width: 2, opacity: 1 },      // rgb(20,100,200)
  x2: { color: '#1464c8', width: 2, opacity: 1 }
}

/** 待定笔（未识别）：WGestures 的 _alternativePen rgb(255,120,20) */
export const ALTERNATIVE_PEN = { color: '#ff7814', width: 2, opacity: 1 }
/** 白边（_borderPen，宽度 ×2.5，alpha 230） */
export const BORDER_PEN = { color: '#ffffff', width: 5, opacity: 0.9 }
/** 阴影（_shadowPen，宽度 ×3，alpha 25） */
export const SHADOW_PEN = { color: '#000000', width: 6, opacity: 0.098 }
/** 每 DPI 的点数上限：_pathMaxPointCount = 512 * dpiFactor */
export const MAX_POINTS_BASE = 512

/** 旧导出保留：等价于「右键 + 未识别 / 右键 + 已识别」 */
export const DEFAULT_TRAIL_STYLE: TrailStyle = {
  idle: ALTERNATIVE_PEN,
  recognized: BUTTON_PEN.right
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
  /** 触发按钮；决定识别后用什么颜色（照原码按按钮选笔） */
  button?: string
  style?: Partial<TrailStyle>
}

export function computeTrail(input: TrailInput): TrailRender {
  const points = input.points ?? []
  // 识别后的笔由按钮决定；认不出来就回退右键色
  const buttonPen = BUTTON_PEN[String(input.button ?? 'right')] ?? BUTTON_PEN.right
  const style: TrailStyle = {
    idle: { ...ALTERNATIVE_PEN, ...(input.style?.idle ?? {}) },
    recognized: { ...buttonPen, ...(input.style?.recognized ?? {}) }
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
