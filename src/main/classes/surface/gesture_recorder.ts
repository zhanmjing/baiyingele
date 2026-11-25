import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'
import { recognize, type GesturePoint, type RecognizerOptions } from '../../../shared/gestureRecognizer'

/**
 * surface.gesture_recorder —— 手势录制板
 *
 * 现在这段逻辑埋在 SurfaceManagementPage.tsx 里的一段 JSX + 几个 useState 里，
 * 所以它不能被体层组合、不能被测、也不能被别处复用。
 *
 * 作为面层类，它要回答的问题是三件：
 *   1. 现在画出来的是什么方向串（**实时**，抬笔前就要有）
 *   2. 这个串合不合法（太短 / 太快 / 是拖拽 / 空）
 *   3. 能不能存（合法 + 不与已存在的绑定冲突）
 *
 * 第 3 点尤其重要：录制板如果不查冲突，用户会录出一个永远被覆盖的手势。
 */

export const classId = 'surface.gesture_recorder'
export const summary = '手势录制板：实时方向串 + 合法性 + 冲突检查'
export const specialized = true

export type RecorderPhase = 'idle' | 'drawing' | 'done' | 'invalid'

export interface RecorderState {
  phase: RecorderPhase
  points: GesturePoint[]
  /** 实时识别出的箭头串；画的过程中就该有值 */
  directions: string
  valid: boolean
  /** 无效原因（recognize 的 reason 或冲突原因） */
  reason?: string
  /** 与已存在的绑定冲突时，冲突的是哪一条 */
  conflictWith?: string
  /** 能不能保存 */
  canSave: boolean
}

export interface GestureRecorderRender extends RenderResult {
  recorder?: RecorderState
}

export interface RecorderInput extends SurfaceClassInput {
  points?: GesturePoint[]
  drawing?: boolean
  /** 已存在的绑定（用于冲突检查） */
  existing?: Array<{ id: string; name?: string; dirs: string; modifier?: string }>
  /** 这次要改的绑定 id（改绑自己不算冲突） */
  editingId?: string
  recognizer?: RecognizerOptions
}

export function computeRecorderState(input: RecorderInput): RecorderState {
  const points = input.points ?? []
  const drawing = input.drawing === true

  if (!points.length) {
    return { phase: 'idle', points: [], directions: '', valid: false, canSave: false }
  }

  const result = recognize(points, input.recognizer)
  const directions = result.directions

  // 画的过程中也要给出实时结果 —— 用户不用等抬笔才知道对不对
  if (drawing) {
    return {
      phase: result.valid ? 'drawing' : 'invalid',
      points,
      directions,
      valid: result.valid,
      reason: result.valid ? undefined : result.reason,
      canSave: false
    }
  }

  if (!result.valid) {
    return {
      phase: 'invalid',
      points,
      directions,
      valid: false,
      reason: result.reason,
      canSave: false
    }
  }

  // 冲突检查：同方向串 + 同 modifier 的已有绑定，改自己不算冲突
  const conflict = (input.existing ?? []).find(
    (item) => item.dirs === directions && item.id !== input.editingId
  )
  if (conflict) {
    return {
      phase: 'invalid',
      points,
      directions,
      valid: true,
      reason: 'conflict',
      conflictWith: conflict.name ?? conflict.id,
      canSave: false
    }
  }

  return { phase: 'done', points, directions, valid: true, canSave: true }
}

export const run = defineClassImpl<RecorderInput, GestureRecorderRender>({
  classId,
  summary,
  run: (input) => {
    const base = planRender(classId, input.instanceId, input.params, input.deps)
    const recorder = computeRecorderState(input)
    return {
      ...base,
      blocks: [],
      recorder,
      intents: recorder.canSave ? ['save', 'discard'] : recorder.points.length ? ['discard'] : [],
      gaps: recorder.phase === 'invalid' && recorder.reason === 'conflict'
        ? [...base.gaps, { slot: 'pattern', reason: `与「${recorder.conflictWith}」重复，同一手势不能绑两个目标` }]
        : base.gaps
    }
  }
}).run
