import { defineClassImpl } from '../../../shared/classImpl'
import { runLineInstance, type LineClassInput, type RunLineResult } from '../../lineRuntime'

/**
 * line.batch_archive —— 批量归档
 *
 * 扫描目录 → 逐项归档 → 汇总通知
 *
 * 这张图用到的 gate 类型：foreach。
 * 引擎里 if / if-status / foreach 的分派目前还是三段硬判断；
 * 这里先把「谁需要哪种 gate」记下来，以后引擎按这个装配处理器。
 */

export const classId = 'line.batch_archive'
export const summary = '批量归档：扫描目录 → 逐项归档 → 汇总通知'

/** 这张图用到的 gate 类型（现在当文档，以后当装配依据） */
export const gates: string[] = ['foreach']

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
