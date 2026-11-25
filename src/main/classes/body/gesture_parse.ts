import { elapsed } from '../../capabilities/_shared'
import {
  createParseState,
  parse,
  dirsToArrows,
  get4Dir,
  get8Dir,
  getAngle,
  isDiagonal,
  type ParseState
} from '../../../shared/gestureParser'

/**
 * body.gesture_parse —— 手势解析（体层）
 *
 * ## 为什么这在体层
 *
 * 它不是一个原子操作，是**有状态的组合**：
 *   每来一个点 → 算向量 → 按已确定的方向数决定用 4 向还是 8 向
 *   → 判定是否转折（36° 迟滞）→ 必要时改写首方向 → 追加方向
 *
 * 单个点层类表达不了「已确定方向数」「首段末点」「上一条向量」这些跨调用状态。
 * 状态机 = 体层；无状态的判定 = 点层。
 *
 * ## 逐行移植自
 *
 *   WGestures.Core/GestureParser.cs:158-238   Parse
 *   :507-533  Get4DirectionDir
 *   :535-567  Get8DirectionDir（slashRange=50）
 *   :569-596  GetAngle
 *
 * 算法本体在 src/shared/gestureParser.ts，这里只做体层封装：
 * 会话生命周期 + 输入形状 + 输出形状。
 *
 * ## 不做什么
 *
 * 不做降采样、不做分段投票、不做最小段长度。
 * 那些都是之前**自己发明的**，原码没有：
 *   · 原码逐向量处理，方向和上一个不同才追加
 *   · 「首段 8 向」靠的是 count 判断，不是按段取众数
 *   · 转折靠 36° 角度迟滞，不是「至少 N 步才算数」
 */

export const classId = 'body.gesture_parse'
export const summary = '手势解析状态机：逐向量 4/8 向判定 + 36° 转折迟滞 + 首方向改写'
export const specialized = true
/**
 * 体层是「组合」，一般必须声明 requires（组成它的点层原子能力）。
 * 这个类是例外：手势解析是完整状态机，判定函数在同一 shared 模块内，
 * 不组合别的层。如实标 standalone，而不是随便编一个 requires 糊弄校验。
 */
export const requires: string[] = []
export const standalone = true

export interface GestureParsePoint {
  x: number
  y: number
}

export interface GestureParseSession {
  /** 喂一个点；返回方向序列是否变化 */
  feed(point: GestureParsePoint, modifier?: string): boolean
  /** 当前方向串（箭头记法） */
  arrows(): string
  /** 当前方向数（原码 _gesture.Count()） */
  count(): number
  /** 当前 modifier */
  modifier(): string
  /** 本次会话点数 */
  pointCount(): number
}

export function createSession(options: { enable8Dir?: boolean } = {}): GestureParseSession {
  const enable8Dir = options.enable8Dir !== false
  const state: ParseState = createParseState()
  let started = false

  return {
    feed(point, modifier = '') {
      if (!started) {
        state.startPoint = { x: point.x, y: point.y }
        state.lastPoint = { x: point.x, y: point.y }
        state.pointCount = 1
        started = true
        return false
      }
      return parse(state, { x: point.x, y: point.y }, modifier, enable8Dir)
    },
    arrows: () => dirsToArrows(state.dirs),
    count: () => state.dirs.length,
    modifier: () => state.modifier,
    pointCount: () => state.pointCount
  }
}

/** 一次性解析整条轨迹（不需要跨调用状态时用它） */
export function parsePath(points: GestureParsePoint[], options: { enable8Dir?: boolean } = {}): string {
  const session = createSession(options)
  for (const point of points) session.feed(point)
  return session.arrows()
}

export interface GestureParseOutput {
  status: 'ok' | 'warn'
  output: string
  value?: string
  arrows: string
  dirCount: number
  modifier: string
  pointCount: number
  elapsedMs: number
}

export const run = (context: any): GestureParseOutput => {
  const startedAt = Date.now()
  const params = context?.params ?? {}
  const points = (params.points ?? context?.input ?? []) as GestureParsePoint[]
  if (!Array.isArray(points) || !points.length) {
    return { status: 'warn', output: '没有轨迹点', arrows: '', dirCount: 0, modifier: '', pointCount: 0, elapsedMs: 0 }
  }
  const session = createSession({ enable8Dir: params.enable8Dir !== false })
  for (const point of points) session.feed(point, String(params.modifier ?? ''))
  const arrows = session.arrows()
  return {
    status: arrows ? 'ok' : 'warn',
    output: arrows ? `解析出 ${arrows}（${session.pointCount()} 点）` : '轨迹不构成方向',
    value: arrows,
    arrows,
    dirCount: session.count(),
    modifier: session.modifier(),
    pointCount: session.pointCount(),
    elapsedMs: elapsed(startedAt)
  }
}

/** 供测试/调试直接用的底层判定 */
export const judge = { get4Dir, get8Dir, getAngle, isDiagonal }
