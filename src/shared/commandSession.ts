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
  /** 关心的那些事件；不在集合里的不送给会话 */
  observes: ReadonlySet<SessionEvent>
  /** 收到关心的事件。返回 true = 继续，false = 自己结束 */
  onEvent(event: SessionEvent): boolean
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
  observes: SessionEvent[]
  onEvent: (event: SessionEvent) => boolean
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

export function createSessionHost(options: { historyLimit?: number } = {}): SessionHost {
  const historyLimit = options.historyLimit ?? 50
  const records: SessionRecord[] = []
  let current: CommandSession | null = null
  let currentClock: (() => number) | null = null
  let idleTimeoutMs = 0
  let lastEventAt = 0

  const recordOf = () => records.find((item) => item.id === current?.id)

  const close = (reason: SessionEndReason) => {
    const record = recordOf()
    if (record && record.endedAt === null) {
      record.endedAt = (currentClock ?? Date.now)()
      record.endReason = reason
    }
    current = null
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
        onEvent: input.onEvent
      }
      current = session
      currentClock = now
      idleTimeoutMs = input.idleTimeoutMs ?? 5000
      lastEventAt = now()

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

      lastEventAt = (currentClock ?? Date.now)()
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
