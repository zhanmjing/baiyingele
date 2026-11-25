import { directionsToArrows, type Direction } from './gestureNotation'

/**
 * 手势识别（纯函数，渲染层与主进程共用）。
 *
 * 算法：轨迹 → 距离降采样 → 8 方向分桶 → 去掉「连续帧数不足」的噪声段 → 相邻去重 → 方向串。
 * 相比原来的实现修了四个硬伤：
 *   1. 降采样阈值按**轨迹总长的比例**算，不再用绝对 14px（DPI/画布缩放不再影响识别）
 *   2. 噪声段过滤：一个方向至少连续出现 switchVotes 次才算数（手抖不再多出一个方向）
 *   3. 最小长度/最短最长时长校验（防误触、防发呆）
 *   4. 匹配用编辑距离给**置信度**，配合阈值，不再是精确字符串相等
 */

export interface GesturePoint {
  x: number
  y: number
  /** 时间戳（毫秒），可选；不给就跳过时长校验 */
  t?: number
}

export type GestureInvalidReason =
  | 'too-few-points'
  | 'too-short'
  | 'too-fast'
  | 'too-slow'
  | 'no-direction'
  | 'too-few-segments'
  | 'suppressed-as-drag'

export interface GestureResult {
  /** 方向串，箭头记法（与 WGestures 一致）：'←↓→' */
  directions: string
  valid: boolean
  reason?: GestureInvalidReason
  length: number
  /** -1 表示没有时间戳，未做时长校验 */
  durationMs: number
}

export interface RecognizerOptions {
  /** 轨迹总长低于这个值直接判无效（默认 30） */
  minLength?: number
  /** 低于这个时长视为抖动（默认 80ms） */
  minDurationMs?: number
  /** 高于这个时长视为发呆（默认 3000ms） */
  maxDurationMs?: number
  /** 降采样步长 = 总长 × 这个比例，且不小于 6px（默认 0.02） */
  minStepRatio?: number
  /** 一个方向至少连续出现几段才算数（默认 2） */
  switchVotes?: number
  /** 首段是否允许斜向（默认 true，等同 GestureParserEnable8DirGesture） */
  eightDirections?: boolean
  /** 方向数少于此值视为无效（默认 1，即不限制） */
  minSegments?: number
  /**
   * 拖拽抑制：单个方向且总位移超过此值时判为「拖拽」而不是手势（默认 400，0 = 关闭）。
   *
   * 为什么必须有：拖窗口、拉滚动条都是长距离单向移动，
   * 如果绑了 R / L 这类单方向手势，拖拽会误触发动作。
   */
  dragSuppressPx?: number
}

const DEFAULT_OPTIONS: Required<RecognizerOptions> = {
  minLength: 30,
  minDurationMs: 80,
  maxDurationMs: 3000,
  minStepRatio: 0.02,
  switchVotes: 2,
  eightDirections: true,
  minSegments: 1,
  dragSuppressPx: 400
}

export function pathLength(points: GesturePoint[]): number {
  let total = 0
  for (let index = 1; index < points.length; index++) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
  }
  return total
}

/**
 * 4 方向判定 —— 照抄 WGestures GestureParser.Get4DirectionDir。
 * 只比绝对值大小，不算角度。
 *
 * **入参是数学坐标（y 向上）**。屏幕坐标要先 negate dy ——
 * WGestures 在 GestureParser.cs:165 就是这么做的：
 *   new Point(loc.X - last.X, -loc.Y + last.Y)
 */
export function wgDir4(dx: number, dy: number): string {
  if (dx >= 0 && dy >= 0) return dx > dy ? 'R' : 'U'
  if (dx <= 0 && dy >= 0) return -dx > dy ? 'L' : 'U'
  if (dx <= 0 && dy <= 0) return -dx > -dy ? 'L' : 'D'
  return dx > -dy ? 'R' : 'D'
}

/**
 * 8 方向判定 —— 照抄 WGestures GestureParser.Get8DirectionDir。
 *
 * 关键是 slashRange 滞回带：45° 边界附近不立刻翻向，
 * 免得手在斜线上微抖就被判成两个方向。
 *
 * 原实现：n = floor(angle/45)，slashRange = 50，
 *   if ((n 偶 && mod > 45-25) || (n 奇 && mod > 45+25)) n++
 * 正向扇形 mod>20 就进下一格，斜向扇形要 mod>70。
 */
export function wgDir8(dx: number, dy: number, slashRange = 50): string {
  const NAMES = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL']
  // 从正上方顺时针量角（数学坐标下 (0,1) 是正上方）
  let angle = (Math.atan2(dx, dy) * 180) / Math.PI
  if (angle < 0) angle += 360
  const mod = angle % 90
  let n = Math.floor(angle / 45)
  const nIsEven = (n & 1) === 0
  const half = slashRange / 2
  if ((nIsEven && mod > 45 - half) || (!nIsEven && mod > 45 + half)) {
    n += 1
    if (n === 8) n = 0
  }
  return NAMES[n] ?? 'U'
}

/** 8 方向分桶，按 45° 划分（旧接口，无滞回） */
export function directionOf(dx: number, dy: number): string {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle >= -22.5 && angle < 22.5) return 'R'
  if (angle >= 22.5 && angle < 67.5) return 'DR'
  if (angle >= 67.5 && angle < 112.5) return 'D'
  if (angle >= 112.5 && angle < 157.5) return 'DL'
  if (angle >= 157.5 || angle < -157.5) return 'L'
  if (angle >= -157.5 && angle < -112.5) return 'UL'
  if (angle >= -112.5 && angle < -67.5) return 'U'
  return 'UR'
}

/** 轨迹 → 方向序列（已降采样 + 去噪 + 去重） */
export function toDirectionSequence(points: GesturePoint[], options: RecognizerOptions = {}): string[] {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const total = pathLength(points)
  const minStep = Math.max(6, total * config.minStepRatio)

  const sampled: GesturePoint[] = []
  for (const point of points) {
    const last = sampled[sampled.length - 1]
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= minStep) sampled.push(point)
  }

  // WGestures 的分段规则：**首段 8 向，之后一律 4 向**。
  // 斜线只出现在开头（起笔时最准），后续段强制回到正十字，避免长轨迹上斜向抖动。
  const raw: string[] = []
  for (let index = 1; index < sampled.length; index++) {
    const dx = sampled[index].x - sampled[index - 1].x
    const dy = sampled[index].y - sampled[index - 1].y
    const isFirstSegment = raw.length === 0
    // 屏幕坐标 y 向下，判定函数吃数学坐标 —— 先 negate dy
    const mathDy = -dy
    raw.push(isFirstSegment && config.eightDirections ? wgDir8(dx, mathDy) : wgDir4(dx, mathDy))
  }

  // 只保留「连续出现 ≥ switchVotes 段」的方向，滤掉拐角处的一帧噪声
  const stable: string[] = []
  let run = 1
  for (let index = 1; index < raw.length; index++) {
    if (raw[index] === raw[index - 1]) {
      run += 1
    } else {
      if (run >= config.switchVotes) stable.push(raw[index - 1])
      run = 1
    }
  }
  if (raw.length && run >= config.switchVotes) stable.push(raw[raw.length - 1])

  return stable.filter((direction, index) => index === 0 || stable[index - 1] !== direction)
}

/** 轨迹 → 识别结果（含无效原因） */
export function recognize(points: GesturePoint[], options: RecognizerOptions = {}): GestureResult {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const length = pathLength(points)
  const first = points[0]?.t
  const last = points[points.length - 1]?.t
  const durationMs = first !== undefined && last !== undefined ? last - first : -1

  if (points.length < 2) return { directions: '', valid: false, reason: 'too-few-points', length, durationMs }
  if (length < config.minLength) return { directions: '', valid: false, reason: 'too-short', length, durationMs }
  if (durationMs >= 0 && durationMs < config.minDurationMs) {
    return { directions: '', valid: false, reason: 'too-fast', length, durationMs }
  }
  if (durationMs > config.maxDurationMs) {
    return { directions: '', valid: false, reason: 'too-slow', length, durationMs }
  }

  const sequence = toDirectionSequence(points, config)
  // 输出转箭头记法 —— 存储和比较都用它
  const directions = directionsToArrows(sequence as Direction[])
  if (!directions) return { directions: '', valid: false, reason: 'no-direction', length, durationMs }

  // 拖拽抑制：单向 + 长距离 = 大概率在拖东西，不是画手势
  if (config.dragSuppressPx > 0 && sequence.length <= 1 && length >= config.dragSuppressPx) {
    return { directions, valid: false, reason: 'suppressed-as-drag', length, durationMs }
  }

  if (sequence.length < config.minSegments) {
    return { directions, valid: false, reason: 'too-few-segments', length, durationMs }
  }

  return { directions, valid: true, length, durationMs }
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/** 相似度 0–1（1 = 完全一致） */
export function scorePattern(candidate: string, pattern: string): number {
  if (!candidate || !pattern) return 0
  return 1 - levenshtein(candidate, pattern) / Math.max(candidate.length, pattern.length)
}

/** 在候选模式里挑最像的一个；都低于阈值返回 null */
export function matchPattern(
  candidate: string,
  patterns: string[],
  threshold = 0.75
): { pattern: string; score: number } | null {
  let best: { pattern: string; score: number } | null = null
  for (const pattern of patterns) {
    const score = scorePattern(candidate, pattern)
    if (score >= threshold && (!best || score > best.score)) best = { pattern, score }
  }
  return best
}
