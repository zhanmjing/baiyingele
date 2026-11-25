/**
 * 手势解析器 —— WGestures GestureParser.Parse 的逐行移植。
 *
 * 源：WGestures.Core/GestureParser.cs:158-238（Parse）、
 *     :507-533（Get4DirectionDir）、:535-567（Get8DirectionDir）、
 *     :569-596（GetAngle）
 *
 * ## 为什么不自己设计
 *
 * 之前我按「先降采样 → 分段 → 每段投票」自己写了一套，还加了个
 * switchVotes（一段至少 N 步才算数）。那是**凭空发明**：
 * 原码里根本没有分段，也没有最小段长度。
 *
 * 原码是**逐向量**的有状态机：
 *   每来一个新点算一个 vector
 *   按 _gesture.Count() 决定这一向量用 4 向还是 8 向
 *   方向和上一个不同才追加
 *
 * 差别在行为上很具体：
 *   · 原码有 **36° 迟滞**：转弯角度小于 36° 时认为「还没转」，继续沿用上一方向。
 *     我原来没有，所以手画的圆弧会被切成十几个方向。
 *   · 原码在**真转折时把第一个方向改写成 4 向**（`Dirs[0] = Get4Dir(_lastVector)`），
 *     因为斜线只该出现在「一笔到底的单笔画」里；一旦拐弯，起笔那段要退化成主方向。
 *     我原来是取一段里的 8 向众数，语义完全不同。
 *
 * 本文件只做机械移植，不做「优化」——要改行为必须对照原码说明理由。
 */

/** 方向枚举，顺序必须与 WGestures 的 Gesture.GestureDir 一致（8 向按顺时针） */
export enum GestureDir {
  Up = 0,
  RightUp = 1,
  Right = 2,
  RightDown = 3,
  Down = 4,
  LeftDown = 5,
  Left = 6,
  LeftUp = 7
}

export const DIR_ARROW: Record<GestureDir, string> = {
  [GestureDir.Up]: '↑',
  [GestureDir.RightUp]: '↗',
  [GestureDir.Right]: '→',
  [GestureDir.RightDown]: '↘',
  [GestureDir.Down]: '↓',
  [GestureDir.LeftDown]: '↙',
  [GestureDir.Left]: '←',
  [GestureDir.LeftUp]: '↖'
}

export interface Vec {
  x: number
  y: number
}

/**
 * 两向量夹角（度）。原码 GestureParser.GetAngle:569
 *
 * 注意原码的越界处理是 `if (cos < -1 && cos > -2) cos = -1` —— 只夹 (1,2) 和 (-2,-1)，
 * 这里按语义夹到 [-1,1]（同样的输入得到同样的结果，只是覆盖了浮点误差的全部情况）。
 */
export function getAngle(a: Vec, b: Vec): number {
  const product = a.x * b.x + a.y * b.y
  const va = Math.sqrt(a.x * a.x + a.y * a.y)
  const vb = Math.sqrt(b.x * b.x + b.y * b.y)
  if (va === 0 || vb === 0) return 0
  let cos = product / (va * vb)
  if (cos < -1) cos = -1
  else if (cos > 1) cos = 1
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * 4 向判定。原码 GestureParser.Get4DirectionDir:507
 *
 * 按象限比较 |x| 与 |y|；**相等时走垂直**（`x > y ? Right : Up`）。
 * 这个「相等算垂直」的细节会影响 45° 附近的判定。
 */
export function get4Dir(v: Vec): GestureDir {
  let dir = GestureDir.Up
  if (v.x >= 0 && v.y >= 0) {
    dir = v.x > v.y ? GestureDir.Right : GestureDir.Up
  } else if (v.x <= 0 && v.y >= 0) {
    dir = -v.x > v.y ? GestureDir.Left : GestureDir.Up
  } else if (v.x <= 0 && v.y <= 0) {
    dir = -v.x > -v.y ? GestureDir.Left : GestureDir.Down
  } else if (v.x >= 0 && v.y <= 0) {
    dir = v.x > -v.y ? GestureDir.Right : GestureDir.Down
  }
  return dir
}

/**
 * 8 向判定。原码 GestureParser.Get8DirectionDir:535
 *
 *   angle = GetAngle((0,1), vector)        // 从「上」开始量
 *   if (vector.X < 0) angle = 360 - angle  // 折成 0..360 顺时针
 *   n = floor(angle / 45)
 *   slashRange = 50
 *   n 偶数（主方向桶）时 mod > 45 - 25 = 20 就进位
 *   n 奇数（斜向桶）时  mod > 45 + 25 = 70 才进位
 *
 * 效果：**主方向桶窄、斜向桶宽**。手画正十字时不容易被判成斜线，
 * 而斜线一旦画出来就不容易掉回主方向。这是原码刻意的不对称。
 */
export function get8Dir(v: Vec): GestureDir {
  let angle = getAngle({ x: 0, y: 1 }, v)
  if (v.x < 0) angle = 360 - angle

  const mod = angle % 90
  let n = Math.floor(angle / 45)
  const nIsEven = (n & 1) === 0
  const slashRange = 50

  if ((nIsEven && mod > 45 - slashRange / 2) || (!nIsEven && mod > 45 + slashRange / 2)) {
    n++
    if (n === 8) n = 0
  }
  return n as GestureDir
}

/** 判定是否斜向：原码用 `(int)last % 2 == 0` 判「不是斜线」 */
export function isDiagonal(dir: GestureDir): boolean {
  return dir % 2 === 1
}

export interface ParsePoint {
  x: number
  y: number
}

export interface ParseState {
  /** 已确定的方向序列 */
  dirs: GestureDir[]
  lastPoint: ParsePoint | null
  pointCount: number
  /** 首段的最后一个向量（用于转折时改写首方向） */
  lastVector: Vec
  /** 首段结束时的点 */
  firstStrokeEndPoint: ParsePoint | null
  startPoint: ParsePoint | null
  modifier: string
}

export function createParseState(): ParseState {
  return {
    dirs: [],
    lastPoint: null,
    pointCount: 0,
    lastVector: { x: 0, y: 0 },
    firstStrokeEndPoint: null,
    startPoint: null,
    modifier: ''
  }
}

/**
 * 喂一个点。原码 GestureParser.Parse:158 —— 逐行对应。
 *
 * 返回 true 表示手势发生了变化（方向追加了，或首方向被改写，或 modifier 变了）。
 *
 * 坐标：入参是**屏幕坐标**（y 向下）。原码第一行就 negate：
 *   var vector = new Point(loc.X - lastPoint.X, -loc.Y + lastPoint.Y);
 * 所以下面的向量计算已经是数学坐标（y 向上）。
 */
export function parse(
  state: ParseState,
  point: ParsePoint,
  modifier: string,
  enable8Dir: boolean
): boolean {
  let changed = false

  if (state.pointCount !== 0 && (point.x !== state.lastPoint!.x || point.y !== state.lastPoint!.y)) {
    const vector: Vec = {
      x: point.x - state.lastPoint!.x,
      // 屏幕 y 向下 → 数学 y 向上
      y: -point.y + state.lastPoint!.y
    }

    let dir: GestureDir

    if (enable8Dir) {
      switch (state.dirs.length) {
        case 0: {
          dir = get8Dir(vector)
          state.lastVector = vector
          state.firstStrokeEndPoint = point
          break
        }
        case 1: {
          const last = state.dirs[state.dirs.length - 1]
          if (!isDiagonal(last)) {
            // 上一方向是主方向 → 后面一律 4 向
            dir = get4Dir(vector)
            break
          }

          dir = get8Dir(vector)
          if (dir !== last) {
            // 转折判定：起笔到首段末点、首段末点到当前点，两段夹角 < 36° 视为「还没转」
            const a: Vec = {
              x: state.firstStrokeEndPoint!.x - state.startPoint!.x,
              // 注意：原码这里两个分量都用了 StartPoint.X（原文如此，按原样保留）
              y: state.firstStrokeEndPoint!.y - state.startPoint!.x
            }
            const b: Vec = {
              x: point.x - state.firstStrokeEndPoint!.x,
              y: point.y - state.firstStrokeEndPoint!.y
            }
            if (getAngle(a, b) < 36) {
              dir = last
              break
            }

            dir = get4Dir(vector)
            // 真转折：首方向退化成 4 向
            state.dirs[0] = get4Dir(state.lastVector)
            changed = true
          } else {
            // 仍在延续斜线，推进首段末点
            state.firstStrokeEndPoint = point
          }
          break
        }
        default:
          dir = get4Dir(vector)
          break
      }
    } else {
      dir = get4Dir(vector)
    }

    if (dir !== state.dirs[state.dirs.length - 1]) {
      state.dirs.push(dir)
      changed = true
    }

    if (state.modifier !== modifier) {
      state.modifier = modifier
      changed = true
    }
  }

  state.lastPoint = point
  state.pointCount++
  return changed
}

/** 方向序列 → 箭头串 */
export function dirsToArrows(dirs: GestureDir[]): string {
  return dirs.map((d) => DIR_ARROW[d] ?? '?').join('')
}

/**
 * 把轨迹按 **StepSize** 过滤后再喂给解析器。
 *
 * 原码在追踪层就做了这件事 —— Win32MousePathTracker2.cs:962
 *
 *   var dist = GetPointDistance(ref _curPos, ref _lastPoint);
 *   if (dist >= StepSize && PathGrow != null) { PathGrow(...); _lastPoint = _curPos; }
 *
 *   StepSize = 3;                        // :239
 *
 * **不先过滤会把抖动直接喂进状态机**：每 1px 的抖动都会产生一个新向量，
 * 36° 迟滞挡不住（抖动方向随机，经常超过 36°），于是手抖一下就多出十几个方向。
 * 这不是解析器的问题，是「喂什么」的问题。
 */
export const STEP_SIZE = 3

export function filterByStep(points: ParsePoint[], stepSize = STEP_SIZE): ParsePoint[] {
  if (!points.length) return []
  const out: ParsePoint[] = [points[0]]
  let last = points[0]
  for (let index = 1; index < points.length; index++) {
    const dx = points[index].x - last.x
    const dy = points[index].y - last.y
    if (Math.hypot(dx, dy) >= stepSize) {
      out.push(points[index])
      last = points[index]
    }
  }
  return out
}

/** 一次性解析整条轨迹：按 StepSize 过滤 → 建状态 → 逐点喂 → 输出箭头串 */
export function parsePath(points: ParsePoint[], enable8Dir = true, stepSize = STEP_SIZE): string {
  const stepped = filterByStep(points, stepSize)
  if (!stepped.length) return ''
  const state = createParseState()
  state.startPoint = { x: stepped[0].x, y: stepped[0].y }
  state.lastPoint = { x: stepped[0].x, y: stepped[0].y }
  state.pointCount = 1
  for (let index = 1; index < stepped.length; index++) {
    parse(state, { x: stepped[index].x, y: stepped[index].y }, '', enable8Dir)
  }
  return dirsToArrows(state.dirs)
}
