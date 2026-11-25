import { defineClassImpl } from '../../../shared/classImpl'
import { runLineInstance, type LineClassInput, type RunLineResult } from '../../lineRuntime'

/**
 * line.ensure_app —— 确保应用运行
 *
 * 检测目标进程，没起就启动
 *
 * 这张图没有 gate，是一条线性链。
 */

export const classId = 'line.ensure_app'
export const summary = '确保应用运行：检测目标进程，没起就启动'

/** 这张图用到的 gate 类型（现在当文档，以后当装配依据） */
export const gates: string[] = []

export const run = defineClassImpl<LineClassInput, RunLineResult>({
  classId,
  summary,
  run: (input) =>
    runLineInstance({
      profile: input.profile,
      classId,
      description: input.description,
      input: input.input,
      deps: input.deps,
      depth: input.depth ?? 0,
      stack: input.stack ?? []
    })
}).run
