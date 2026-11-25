import { elapsed } from '../../capabilities/_shared'
import { recognize, type GesturePoint } from '../../../shared/gestureRecognizer'

/**
 * point.gesture_sample —— 全局鼠标采样
 *
 * 手势链路的地基：拿到按住的按钮 + 轨迹点，交给 point.gesture_recognize。
 *
 * ## 对应 WGestures 的哪几个配置
 *
 *   PathTrackerTriggerButton       → config.triggerButtons
 *   PathTrackerInitialValidMove    → config.initialValidMove
 *   PathTrackerInitialStayTimeout  → config.initialStayTimeoutMs
 *
 * ## 为什么要「初始有效位移」
 *
 * 右键单击也会产生 mousedown/mouseup。一按下就记轨迹的话，
 * 每次右键菜单都会被当成手势。所以按下后必须移动超过 N px 才算「开始画」；
 * 没超就抬手 = 右键单击，原样放过。
 *
 * ## 为什么要「初始停留超时」
 *
 * 长按右键不动是另一个常见操作。停顿超过 N ms 就判定「这不是手势」。
 *
 * ## 纯函数 + 薄钩子
 *
 * 状态机全是纯函数（onDown / onMove / onUp / onWheel），
 * 钩子只把 uiohook 事件转成入参。这样状态机可以被测。
 */

export type GestureButton = 'left' | 'right' | 'middle' | 'x1' | 'x2'

export interface SampleResult {
  button: GestureButton
  points: Array<{ x: number; y: number; t: number }>
  durationMs: number
  reason?: 'no-move' | 'stay-timeout' | 'too-few-points' | 'aborted'
}

export interface SampleConfig {
  triggerButtons: GestureButton[]
  /** 按下后至少移动多少 px 才算开始画。默认 30 */
  initialValidMove: number
  /** 按下后停顿超过多久判定不是手势。默认 500ms。0 = 关闭 */
  initialStayTimeoutMs: number
  maxPoints: number
}

export const DEFAULT_SAMPLE_CONFIG: SampleConfig = {
  triggerButtons: ['right'],
  initialValidMove: 30,
  initialStayTimeoutMs: 500,
  maxPoints: 2000
}

export interface SampleState {
  button: GestureButton
  startedAt: number
  points: Array<{ x: number; y: number; t: number }>
  origin: { x: number; y: number }
  activated: boolean
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** 按下。不在触发按钮列表里返回 null */
export function onDown(
  event: { x: number; y: number; t: number; button: GestureButton },
  config: SampleConfig = DEFAULT_SAMPLE_CONFIG
): SampleState | null {
  if (!config.triggerButtons.includes(event.button)) return null
  return {
    button: event.button,
    startedAt: event.t,
    points: [],
    origin: { x: event.x, y: event.y },
    activated: false
  }
}

/** 移动。越过初始有效位移后才记点（并把起点补进去，否则轨迹少开头一段） */
export function onMove(
  state: SampleState,
  event: { x: number; y: number; t: number },
  config: SampleConfig = DEFAULT_SAMPLE_CONFIG
): SampleState {
  if (!state.activated) {
    if (distance(state.origin, event) < config.initialValidMove) return state
    return {
      ...state,
      activated: true,
      points: [
        { ...state.origin, t: state.startedAt },
        { x: event.x, y: event.y, t: event.t }
      ].slice(-config.maxPoints)
    }
  }
  if (state.points.length >= config.maxPoints) return state
  return { ...state, points: [...state.points, { x: event.x, y: event.y, t: event.t }] }
}

/** 停顿检查。true = 这次采样应放弃 */
export function isStayTimedOut(
  state: SampleState,
  now: number,
  config: SampleConfig = DEFAULT_SAMPLE_CONFIG
): boolean {
  if (state.activated) return false
  if (config.initialStayTimeoutMs <= 0) return false
  return now - state.startedAt >= config.initialStayTimeoutMs
}

/** 抬手，给出这次采样的结论 */
export function onUp(state: SampleState, event: { t: number }): SampleResult {
  const durationMs = event.t - state.startedAt
  const base = { button: state.button, points: state.points, durationMs }
  if (!state.activated) return { ...base, reason: 'no-move' }
  if (state.points.length < 2) return { ...base, reason: 'too-few-points' }
  return base
}

/**
 * 滚轮 → 会话事件。
 *
 * 符号是反的（实机测出来的）。WGestures 用原始 Windows delta
 * （Win32MousePathTracker2.cs:502）：delta > 0 即 WheelForward。
 * 而 uiohook 的 rotation 符号与之相反：
 *   mouse_event(WHEEL, +120) → rotation = -1
 *   mouse_event(WHEEL, -120) → rotation = +1
 * 所以这里反着判才对。
 */
export function onWheel(event: { rotation: number }): 'wheel-forward' | 'wheel-backward' | null {
  if (event.rotation < 0) return 'wheel-forward'
  if (event.rotation > 0) return 'wheel-backward'
  return null
}

/**
 * 会话结束后这段时间内滚轮不往目标窗口漏。
 * 照 WGestures Win32MousePathTracker2.cs:504 的 300ms 延迟。
 */
export const WHEEL_SWALLOW_MS = 300

/** uiohook 的 button 数字 → 名字。未知返回 null */
export function buttonName(raw: unknown): GestureButton | null {
  // uiohook 在 Windows 上：1=左 2=右 3=中 4=X1 5=X2
  switch (Number(raw)) {
    case 1:
      return 'left'
    case 2:
      return 'right'
    case 3:
      return 'middle'
    case 4:
      return 'x1'
    case 5:
      return 'x2'
    default:
      return null
  }
}

export interface SamplingHandlers {
  onSample: (result: SampleResult) => void
  onWheel?: (event: 'wheel-forward' | 'wheel-backward') => void
  /**
   * 采样进行中收到的滚轮（对应 WGestures 的 PathTrackerOnPathModifier）。
   * 抬手时如果这手势是「允许修饰符执行」的，它必然已在滚轮那刻执行过，
   * 抬手只调 GestureEnded() 不再执行。所以必须单独上报。
   */
  onWheelDuringSampling?: (event: 'wheel-forward' | 'wheel-backward') => void
  /**
   * 采样过程中方向串变了就上报（对应 WGestures 的 EffectivePathGrow）。
   * 原码里「允许修饰符执行」的手势在滚轮那一刻就去 Find 并执行，
   * 那时路径还没结束，只有实时方向串。没有这个回调整，第一颗滚轮就无法配绑定。
   */
  onPathGrow?: (state: { points: GesturePoint[]; directions: string; button: string }) => void
  /**
   * 轨迹激活时触发一次（对应触发按钮确定的那一刻）。
   * 浮层用它开一条新笔迹，并把按钮对应的三层笔给过去。
   */
  onPathStart?: (state: { button: string }) => void
  /**
   * 每个新点触发一次（对应 WGestures 的 _gPath.AddLine）。
   * 只传一个点，O(1)；浮层 canvas 直接 lineTo。
   * **不要**在这里传整个 points 数组 —— 那是第一版卡顿的原因。
   */
  onPathPoint?: (point: { x: number; y: number }) => void
}

export interface SamplingControl {
  stop: () => void
  started: () => boolean
  state: () => SampleState | null
}

/**
 * uiohook 的 time 是开机以来的毫秒数（单调时钟），不是 epoch。
 * 实测 uiohook time=74,276,500 / Date.now()=1,795,581,907,867，差约 20,780 天。
 *
 * 如果 onDown 存 e.time 而 isStayTimedOut 拿 Date.now() 去减，
 * 差值永远巨大 → 一按下就被判长按超时 → 采样被清掉，一个手势都出不来。
 * 这个 bug 只有接真实钩子才会暴露。
 *
 * 所以：全部用自己的时钟（Date.now）。
 */
export const classId = 'point.gesture_sample'
export const summary = 'uiohook-napi 全局鼠标采样：按下/移动/抬手 → 轨迹点；滚轮 → 会话事件'
export const specialized = true

let hook: any = null
let control: SamplingControl | null = null

export function startSampling(
  handlers: SamplingHandlers,
  config: SampleConfig = DEFAULT_SAMPLE_CONFIG
): { ok: boolean; message: string } {
  if (control?.started()) return { ok: true, message: '已经在采样' }

  try {
    hook = require('uiohook-napi').uIOhook
  } catch (error) {
    return { ok: false, message: `uiohook-napi 加载失败：${error instanceof Error ? error.message : String(error)}` }
  }

  let state: SampleState | null = null
  let lastDirections = ''
  let lastRecognizeAt = 0
  let stayTimer: NodeJS.Timeout | null = null

  const clearStay = () => {
    if (stayTimer) clearTimeout(stayTimer)
    stayTimer = null
  }

  const finish = (reason?: SampleResult['reason']) => {
    if (!state) return
    const result = reason
      ? { button: state.button, points: state.points, durationMs: Date.now() - state.startedAt, reason }
      : onUp(state, { t: Date.now() })
    state = null
    clearStay()
    handlers.onSample(result)
  }

  const onDownHandler = (event: any) => {
    const button = buttonName(event.button)
    if (!button) return
    // 用自己的时钟，不用 uiohook 的单调 time
    const next = onDown({ x: event.x, y: event.y, t: Date.now(), button }, config)
    if (!next) return
    state = next
    clearStay()
    if (config.initialStayTimeoutMs > 0) {
      stayTimer = setTimeout(() => {
        if (state && !state.activated) finish('stay-timeout')
      }, config.initialStayTimeoutMs)
      stayTimer.unref?.()
    }
  }

  const onMoveHandler = (event: any) => {
    if (!state) return
    const wasActivated = state.activated
    const nextState = onMove(state, { x: event.x, y: event.y, t: Date.now() }, config)
    state = nextState
    if (!nextState.activated) return

    clearStay()
    // 刚激活：开一条新笔迹（浮层据此清画布 + 定笔色）
    if (!wasActivated) {
      handlers.onPathStart?.({ button: nextState.button })
    }
    // 逐点流式：O(1)，这是「跟手」的关键
    handlers.onPathPoint?.({ x: event.x, y: event.y })

    /**
     * 识别要节流。
     * recognize() 是 O(点数) 的全量识别，每帧跑一次在 500 点上就是每秒 3 万次运算，
     * 换笔这件事也不需要 60fps。50ms 一次（20fps）足够，用户看不出延迟。
     */
    const now = Date.now()
    if (handlers.onPathGrow && now - lastRecognizeAt >= 50) {
      lastRecognizeAt = now
      try {
        const grown = recognize(nextState.points ?? [])
        if (grown.valid && grown.directions !== lastDirections) {
          lastDirections = grown.directions
          handlers.onPathGrow({ points: nextState.points ?? [], directions: grown.directions, button: nextState.button })
        }
      } catch {
        /* 增量识别失败不能打断采样 */
      }
    }
  }

  const onUpHandler = (event: any) => {
    if (!state) return
    const button = buttonName(event.button)
    if (button && button !== state.button) return
    finish()
  }

  const onWheelHandler = (event: any) => {
    const wheel = onWheel(event)
    if (!wheel) return
    // 采样中 → 会话路径（对应 PathTrackerOnPathModifier）
    if (state) {
      if (handlers.onWheelDuringSampling) handlers.onWheelDuringSampling(wheel)
      return
    }
    if (handlers.onWheel) handlers.onWheel(wheel)
  }

  hook.on('mousedown', onDownHandler)
  hook.on('mousemove', onMoveHandler)
  hook.on('mouseup', onUpHandler)
  hook.on('wheel', onWheelHandler)
  hook.start()

  control = {
    started: () => true,
    state: () => state,
    stop: () => {
      clearStay()
      try {
        hook.removeListener?.('mousedown', onDownHandler)
        hook.removeListener?.('mousemove', onMoveHandler)
        hook.removeListener?.('mouseup', onUpHandler)
        hook.removeListener?.('wheel', onWheelHandler)
        hook.stop()
      } catch {
        /* 停不住也不能抛 */
      }
      control = null
    }
  }

  return {
    ok: true,
    message: `已开始采样（按钮 ${config.triggerButtons.join('/')}，起始位移 ${config.initialValidMove}px）`
  }
}

export function stopSampling(): { stopped: boolean } {
  const was = Boolean(control?.started())
  control?.stop()
  return { stopped: was }
}

export function run(context: any) {
  const startedAt = Date.now()
  const action = String(context?.params?.action ?? 'start')
  if (action === 'stop') {
    const { stopped } = stopSampling()
    return { status: 'ok', output: stopped ? '已停止鼠标采样' : '本来就没在采样', elapsedMs: elapsed(startedAt) }
  }
  const result = startSampling({
    onSample: (sample) => {
      context?.record?.({
        nodeId: context.instance.id,
        label: 'gesture_sample',
        kind: 'point',
        status: sample.reason ? 'warn' : 'ok',
        output: sample.reason ? `采样失败：${sample.reason}` : `采到 ${sample.points.length} 点`,
        real: true,
        fired: []
      })
    }
  })
  return {
    status: result.ok ? 'ok' : 'warn',
    output: result.message,
    elapsedMs: elapsed(startedAt)
  }
}
