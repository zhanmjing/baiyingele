/**
 * 命令会话 —— 手势触发后不立刻结束、继续接管滚轮/按键的那类命令。
 *
 * ## 为什么需要它
 *
 * WGestures 用 `IGestureModifiersAware` 表达这件事：
 *
 *   void GestureRecognized(out GestureModifier observeModifiers);  // ① 声明要哪些事件
 *   void ModifierTriggered(GestureModifier modifier);              // ② 后续事件送进来
 *   void GestureEnded();                                           // ③ 抬手收尾
 *
 * 注释原文：「实现此接口的命令将可实现多步执行（一旦触发，便可"接管"特定的
 * Modifier 改变事件）……实现该接口的命令不会被中断（只能被 end）」。
 *
 * 具体体验：画一个 DR，然后继续滚滚轮调音量，抬手才结束。
 * 手势只是触发器，滚轮才是连续输入。
 *
 * ## 两条硬约束
 *
 * 1. **同时只允许一个会话**。WGestures 说「不会被中断」，新手势在会话进行中
 *    必须被拒绝，而不是排队或抢占，否则滚轮事件分不清送给谁。
 * 2. **会话必须能兜底结束**。超时 / Esc / 目标窗口消失都要能收尾，
 *    否则滚轮会被永久劫持。
 */

/** 会话关心的后续事件，对应 WGestures 的 GestureModifier 标志位 */
export type SessionEvent =
  | 'wheel-forward'
  | 'wheel-backward'
  | 'middle-down'
  | 'left-down'
  | 'right-down'
  | 'x1'
  | 'x2'

export type SessionEndReason =
  | 'path-ended'
  | 'timeout'
  | 'cancelled'
  | 'self-closed'

export interface CommandSession {
  id: string
  bindingId: string
  /**
   * 关心的那些事件；可以为空。
   *
   * 空集合对应 WGestures 的 observeModifiers = GestureModifier.None：
   * TaskSwitcherCommand 开一个会话但一个滚轮都不收，只负责
   * 「按下 Alt+Tab」和「松开 Alt」，连续切换交给系统原生。
   *
   * 我第一版把「开会话」和「订阅滚轮」绑成一件事，那是错的：
   * 会话是生命周期（GestureRecognized → GestureEnded），
   * observeModifiers 只是这个生命周期里要不要收事件。
   */
  observes: ReadonlySet<SessionEvent>
  /** 收到关心的事件。返回 true = 继续，false = 自己结束 */
  onEvent(event: SessionEvent): boolean
  /**
   * 结束回调，对应 GestureEnded()。
   * TaskSwitcherCommand 靠它松开 Alt，否则 Alt 一直按着。
   */
  onEnd?: (reason: SessionEndReason) => void
}

export interface SessionRecord {
  id: string
  bindingId: string
  startedAt: number
  endedAt: number | null
  endReason: SessionEndReason | null
  events: number
  seen: SessionEvent[]
}

export interface StartSessionInput {
  bindingId: string
  /** 可以为空数组 = 不订阅任何事件（对应 GestureModifier.None） */
  observes: SessionEvent[]
  onEvent: (event: SessionEvent) => boolean
  /** 结束回调，对应 GestureEnded() */
  onEnd?: (reason: SessionEndReason) => void
  /** 空闲多久自动结束（毫秒）。0 = 不超时。默认 5000 */
  idleTimeoutMs?: number
  now?: () => number
}

export type StartSessionResult =
  | { ok: true; session: CommandSession }
  | { ok: false; reason: 'busy'; activeBindingId: string }

export interface SessionHost {
  active(): CommandSession | null
  /** 开会话。已有会话时**拒绝**（不抢占不排队） */
  start(input: StartSessionInput): StartSessionResult
  dispatch(event: SessionEvent): 'no-session' | 'not-observed' | 'delivered' | 'ended'
  end(reason: SessionEndReason): void
  /** 检查超时；返回 true 表示这次 tick 把它关了 */
  tick(): boolean
  history(): SessionRecord[]
}

/**
 * 滚轮节流窗口，照 WGestures Win32MousePathTracker2.cs:791：
 *   if (now - _modifierEventHappendPrevTime > TimeSpan.FromMilliseconds(100))
 * 高分辨率滚轮一格格发得很快，不节流会把会话刷爆。非滚轮不节流。
 */
export const WHEEL_THROTTLE_MS = 100

export function createSessionHost(options: { historyLimit?: number } = {}): SessionHost {
  const historyLimit = options.historyLimit ?? 50
  const records: SessionRecord[] = []
  let current: CommandSession | null = null
  let currentClock: (() => number) | null = null
  let idleTimeoutMs = 0
  let lastEventAt = 0
  // 初值取 -Infinity：会话刚开时第一个滚轮必须放行
  // （WGestures 的 _modifierEventHappendPrevTime 初值是 DateTime.MinValue）
  let lastWheelAt = Number.NEGATIVE_INFINITY

  const recordOf = () => records.find((item) => item.id === current?.id)

  const close = (reason: SessionEndReason) => {
    const record = recordOf()
    if (record && record.endedAt === null) {
      record.endedAt = (currentClock ?? Date.now)()
      record.endReason = reason
    }
    const closing = current
    current = null
    if (closing?.onEnd) {
      try {
        closing.onEnd(reason)
      } catch {
        /* 结束回调抛错不能把宿主搞坏 */
      }
    }
  }

  return {
    active: () => current,

    start(input) {
      if (current) return { ok: false, reason: 'busy', activeBindingId: current.bindingId }

      const now = input.now ?? Date.now
      const session: CommandSession = {
        id: `sess.${input.bindingId}.${now()}`,
        bindingId: input.bindingId,
        observes: new Set<SessionEvent>(input.observes),
        onEvent: input.onEvent,
        onEnd: input.onEnd
      }
      current = session
      currentClock = now
      idleTimeoutMs = input.idleTimeoutMs ?? 5000
      lastEventAt = now()
      lastWheelAt = Number.NEGATIVE_INFINITY

      records.unshift({
        id: session.id,
        bindingId: input.bindingId,
        startedAt: now(),
        endedAt: null,
        endReason: null,
        events: 0,
        seen: []
      })
      if (records.length > historyLimit) records.length = historyLimit

      return { ok: true, session }
    },

    dispatch(event) {
      if (!current) return 'no-session'
      if (!current.observes.has(event)) return 'not-observed'

      const clockNow = (currentClock ?? Date.now)()
      // 滚轮 100ms 节流（照 WGestures HandleModifier）
      if (event === 'wheel-forward' || event === 'wheel-backward') {
        if (clockNow - lastWheelAt < WHEEL_THROTTLE_MS) return 'not-observed'
        lastWheelAt = clockNow
      }

      lastEventAt = clockNow
      const record = recordOf()
      if (record) {
        record.events += 1
        if (!record.seen.includes(event)) record.seen.push(event)
      }

      if (!current.onEvent(event)) {
        close('self-closed')
        return 'ended'
      }
      return 'delivered'
    },

    end(reason) {
      if (current) close(reason)
    },

    tick() {
      if (!current || idleTimeoutMs <= 0) return false
      const clock = currentClock ?? Date.now
      if (clock() - lastEventAt < idleTimeoutMs) return false
      close('timeout')
      return true
    },

    history: () => records
  }
}
