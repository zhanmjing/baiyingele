import { defineClassImpl } from '../../../shared/classImpl'
import { runLineInstance, type LineClassInput, type RunLineResult } from '../../lineRuntime'

/**
 * line.clipboard_to_file —— 剪贴板写入文件
 *
 * 读剪贴板 → 套模板 → 写文件 → 通知
 *
 * 这张图没有 gate，是一条线性链。
 */

export const classId = 'line.clipboard_to_file'
export const summary = '剪贴板写入文件：读剪贴板 → 套模板 → 写文件 → 通知'

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
