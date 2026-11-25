import { defineClassImpl } from '../../../shared/classImpl'
import {
  assessComposition,
  type AssembleResult,
  type BodyClassInput,
  type BodyRequirement
} from '../../bodyRuntime'

/**
 * body.gesture —— 手势识别体
 *
 * 鼠标轨迹 → 方向串 → 匹配绑定 → 派发到点/线实例。
 *
 * ## 为什么它现在是个体，而不是一堆散落的机制
 *
 * 重构前手势识别由四处拼成：共享算法（gestureRecognizer.ts）、
 * 派发（triggerService）、绑定存储（triggerStore）、录制板（面层页面）。
 * 没有任何地方能回答「手势识别这件事现在齐不齐、缺哪块」。
 *
 * 作为体，它声明自己需要哪些零件，然后逐个核对。
 *
 * ## 它的零件目前**全都不存在**
 *
 *   point.gesture_recognize   轨迹 → 方向串   缺
 *   line.gesture_dispatch     识别 → 派发     缺
 *   surface.gesture_recorder  录制板          缺
 *
 * 这不是写错了，是如实反映现状：识别算法是个共享函数、派发在服务里、
 * 录制板是页面里的一段 JSX —— 三者都没有成为可被组合的零件。
 * 体的作用就是把这个缺口显式地报出来，而不是让它继续藏着。
 */

/** 名字里带这些词的才算「能识别轨迹」 */
const RECOGNIZER = /gesture|recognize|trajectory|stroke/i
/** 派发类零件的判定 */
const DISPATCHER = /dispatch|trigger|fire|bind/i

export const classId = 'body.gesture'
export const summary = '手势识别体：采样 → 识别 → 绑定匹配 → 派发'
export const specialized = true

export const requires: BodyRequirement[] = [
  { role: 'ui', reason: '需要录制板与绑定管理：手势得能画出来、能看到绑了哪个目标' },
  { role: 'flow', reason: '需要派发编排：识别完要按绑定把动作送到点/线实例，不能只停在方向串' },
  { role: 'capability', reason: '需要真实能力：轨迹必须被真正的采样与识别，不能靠猜' }
  // 故意不要求 intel：手势匹配是确定性的（编辑距离 + 阈值），
  // 消歧是加分项不是前提。没有场层零件时只在 findings 里提示，不算不齐备。
]

export interface GestureFinding {
  code: string
  message: string
  hint?: string
}

export interface BodyGestureResult extends AssembleResult {
  findings: GestureFinding[]
  /** 这个体的组成概览，供界面显示「缺哪块」 */
  parts: Array<{ layer: string; ref: string; role: string; required: boolean; present: boolean }>
}

export const run = defineClassImpl<BodyClassInput, BodyGestureResult>({
  classId,
  summary,
  run: (input) => {
    const base = assessComposition(input.profile, input.deps, input.requires ?? requires)
    const findings: GestureFinding[] = []
    const parts = (input.profile.composition ?? []).map((part) => {
      const layer = String(part.class?.layer ?? part.layer ?? '')
      const ref = String(part.class?.name ?? part.ref ?? '')
      const present = Boolean(layer && ref && input.deps.hasClass(layer, ref))
      return { layer, ref, role: part.role ?? '', required: part.required !== false, present }
    })

    // 1. 必须有一个真能识别轨迹的零件
    const canRecognize = parts.some((part) => part.layer === 'point' && RECOGNIZER.test(part.ref))
    if (!canRecognize) {
      findings.push({
        code: 'no-recognizer',
        message: '没有任何点层零件能把轨迹识别成方向串',
        hint: '识别算法目前在 src/shared/gestureRecognizer.ts，还没有成为点层能力类'
      })
    }

    // 2. 必须有一个真能派发的零件
    const canDispatch = parts.some((part) => part.layer === 'line' && DISPATCHER.test(part.ref))
    if (!canDispatch) {
      findings.push({
        code: 'no-dispatcher',
        message: '没有任何线层零件能把识别结果派发到点/线实例',
        hint: '派发目前在 triggerService.dispatchGesturePoints，还没有成为线层类'
      })
    }

    // 3. 必需的零件缺失要单独报，不能只靠通用 readiness
    for (const part of parts) {
      if (part.required && !part.present) {
        findings.push({
          code: `missing-part:${part.layer}.${part.ref}`,
          message: `必需的零件 ${part.layer}.${part.ref}（${part.role}）在目录里不存在`,
          hint: '先把这个零件建成对应的层类，体才能真正组装起来'
        })
      }
    }

    // 4. 手势不带消歧能力时，同分手势只能随便挑一个 —— 说清楚
    const hasIntel = parts.some((part) => part.layer === 'field')
    if (!hasIntel) {
      findings.push({
        code: 'no-disambiguation',
        message: '没有场层零件参与消歧：多个绑定分数接近时只能按最高分取一个，无法解释为什么',
        hint: '可选，但绑多了以后会成为痛点'
      })
    }

    return { ...base, findings, parts }
  }
}).run
