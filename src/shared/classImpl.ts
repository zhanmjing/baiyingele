/**
 * 「一个类一个实现单元」的统一契约。
 *
 * ## 为什么需要这个
 *
 * 实测现状：点层 21 个类、场层 23 个类都是**一类一个文件**；
 * 而线层 13、面层 17、体层 29 个类全部挤在一个 runner 文件里：
 *
 *   lineRuntime.ts     679 行  ← 13 个类
 *   surfaceRuntime.ts  297 行  ← 17 个类
 *   bodyRuntime.ts     148 行  ← 29 个类
 *
 * 后果不是「文件太大」，而是**代码里表达不出「这个类特殊在哪」**：
 * surface.form 和 surface.dashboard 走完全一样的 planRender，
 * body.ocr 这个词在 bodyRuntime.ts 里根本不出现。
 *
 * ## 统一的是形状，不是载荷
 *
 * 五层的输入输出本来就该不同：
 *   point/field  RunContext       → RunOutcome
 *   line         LineRunOptions   → LineRunResult
 *   surface      SurfaceRenderIn  → RenderPlan
 *   body         BodyAssessIn     → AssembleResult
 *
 * 强行让它们返回同一个类型是错的。统一的是这个三件套。
 */

import type { AtomLayer } from './atomId'

export interface ClassImpl<TIn = unknown, TOut = unknown> {
  /** 必须和目录里的类 id 完全一致，例如 'body.ocr' */
  classId: string
  /** 这个类被真实处理的依据，一句话。会进生成的清单 */
  summary: string
  /** 层 runner 调它 */
  run: (input: TIn) => Promise<TOut> | TOut
}

/** 定义实现单元：带泛型推断和形状校验 */
export function defineClassImpl<TIn, TOut>(impl: ClassImpl<TIn, TOut>): ClassImpl<TIn, TOut> {
  return impl
}

/** 从 classId 取层名；不合法直接抛（早失败好过晚失败） */
export function layerOfClassId(classId: string): AtomLayer {
  const layer = String(classId).split('.')[0]
  if (!['point', 'line', 'surface', 'body', 'field'].includes(layer)) {
    throw new Error(`classId 的层名非法：${classId}`)
  }
  return layer as AtomLayer
}

/** 从 classId 取类名段（去掉层前缀） */
export function nameOfClassId(classId: string): string {
  const index = String(classId).indexOf('.')
  return index < 0 ? '' : String(classId).slice(index + 1)
}
