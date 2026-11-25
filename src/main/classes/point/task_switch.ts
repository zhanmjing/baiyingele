import { elapsed, errorMessage } from '../../capabilities/_shared'
import type { SessionEvent } from '../../../shared/commandSession'

/**
 * point.task_switch —— 任务切换（对应 TaskSwitcherCommand）
 *
 * WGestures 的 TaskSwitcherCommand 是 IGestureModifiersAware —— 它**需要命令会话**：
 * 画完手势后继续滚滚轮，在任务列表里前后切，抬手才确认。
 *
 * 所以这个类有两种用法：一次性 Alt+Tab，或由 commandSession 驱动连续切换。
 */

export const classId = 'point.task_switch'
export const summary = '任务切换：一次性 Alt+Tab 或由会话驱动的连续切换'
export const specialized = true

export interface TaskSwitchResult {
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
}

export interface TaskSwitchSession {
  began(): Promise<TaskSwitchResult>
  step(direction: 1 | -1): Promise<TaskSwitchResult>
  ended(): TaskSwitchResult
  steps(): number
  /** 把滚轮事件转成切换方向；不关心的事件返回 null */
  onEvent(event: SessionEvent): 1 | -1 | null
}

export function createTaskSwitchSession(deps: {
  sendSwitch: (backward: boolean) => Promise<void> | void
}): TaskSwitchSession {
  let count = 0
  return {
    async began() {
      count = 1
      await deps.sendSwitch(false)
      return { status: 'ok', output: '已切到下一个任务（继续滚滚轮可前后选）', elapsedMs: 0 }
    },
    async step(direction) {
      await deps.sendSwitch(direction < 0)
      count += direction
      return { status: 'ok', output: `切换第 ${count} 个`, elapsedMs: 0 }
    },
    ended: () => ({ status: 'ok', output: `任务切换结束，共 ${count} 格`, elapsedMs: 0 }),
    steps: () => count,
    onEvent(event) {
      if (event === 'wheel-forward') return -1
      if (event === 'wheel-backward') return 1
      return null
    }
  }
}

export const run = async (context: any): Promise<TaskSwitchResult> => {
  const startedAt = Date.now()
  const sendSwitch = context?.deps?.sendSwitch
  if (!sendSwitch) {
    return { status: 'warn', output: '没有注入 sendSwitch，无法切换任务', elapsedMs: elapsed(startedAt) }
  }
  try {
    await sendSwitch(Boolean(context?.params?.backward))
    return { status: 'ok', output: '已切换任务', elapsedMs: elapsed(startedAt) }
  } catch (error) {
    return { status: 'warn', output: `切换失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
