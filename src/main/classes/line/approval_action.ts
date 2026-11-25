import { defineClassImpl } from '../../../shared/classImpl'
import { runLineInstance, type LineClassInput, type RunLineResult } from '../../lineRuntime'

/**
 * line.approval_action —— 审批动作
 *
 * 判断审批状态 → 执行或转人工
 *
 * 这张图用到的 gate 类型：if-status。
 * 引擎里 if / if-status / foreach 的分派目前还是三段硬判断；
 * 这里先把「谁需要哪种 gate」记下来，以后引擎按这个装配处理器。
 */

export const classId = 'line.approval_action'
export const summary = '审批动作：判断审批状态 → 执行或转人工'

/** 这张图用到的 gate 类型（现在当文档，以后当装配依据） */
export const gates: string[] = ['if-status']

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
