import { elapsed } from '../../capabilities/_shared'
import { stopSampling } from './gesture_sample'

/**
 * point.gesture_pause —— 暂停 / 恢复手势（对应 PauseWGesturesCommand）
 *
 * 暂停是必需功能：手势误触发时，用户唯一能做的就是关掉它。
 * 没有暂停，用户只能去删绑定。
 */

export const classId = 'point.gesture_pause'
export const summary = '暂停/恢复手势采样（对应 PauseWGesturesCommand）'
export const specialized = true

export interface PauseState {
  paused: boolean
  pausedAt: number | null
  /** 恢复时用：暂停前是否在采样 */
  wasSampling: boolean
}

let state: PauseState = { paused: false, pausedAt: null, wasSampling: false }
let resumeHandler: (() => void) | null = null

/** 注册「恢复采样」的回调（持有 handlers 的一方来注册） */
export function onResume(handler: () => void): void {
  resumeHandler = handler
}

export function pause(): PauseState {
  if (state.paused) return { ...state }
  const { stopped } = stopSampling()
  state = { paused: true, pausedAt: Date.now(), wasSampling: stopped }
  return { ...state }
}

export function resume(): PauseState {
  if (!state.paused) return { ...state }
  const wasSampling = state.wasSampling
  state = { paused: false, pausedAt: null, wasSampling: false }
  if (wasSampling && resumeHandler) resumeHandler()
  return { ...state }
}

export function toggle(): PauseState {
  return state.paused ? resume() : pause()
}

export function isPaused(): boolean {
  return state.paused
}

export function resetForTest(): void {
  state = { paused: false, pausedAt: null, wasSampling: false }
  resumeHandler = null
}

export function run(context: any) {
  const startedAt = Date.now()
  const action = String(context?.params?.action ?? 'toggle')
  let after: PauseState

  if (action === 'pause') after = pause()
  else if (action === 'resume') after = resume()
  else if (action === 'status') after = { ...state }
  else if (action === 'toggle') after = toggle()
  else {
    return { status: 'warn', output: `未知 action：${action}（应为 pause / resume / toggle / status）`, elapsedMs: elapsed(startedAt) }
  }

  return {
    status: 'ok',
    output: action === 'status' ? (after.paused ? '当前：已暂停' : '当前：运行中') : (after.paused ? '已暂停手势' : '手势已恢复'),
    elapsedMs: elapsed(startedAt)
  }
}
