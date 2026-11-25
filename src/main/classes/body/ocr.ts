import { defineClassImpl } from '../../../shared/classImpl'
import { assessComposition, type BodyClassInput, type BodyRequirement } from '../../bodyRuntime'

/**
 * body.ocr —— OCR 体
 *
 * 识别文字、数学公式、二维码、表格与手写内容。
 *
 * 齐备条件不只是「零件存在」—— 一个 OCR 体里如果没有任何识别能力，
 * 零件齐了也做不了事。所以它比其他体多要求一个 intel 角色。
 */

export const classId = 'body.ocr'
export const summary = 'OCR 体：识别 + 预处理 + 结果展示'

/** 必需角色。缺任何一个都算不齐备，哪怕零件都在。 */
export const requires: BodyRequirement[] = [
  { role: 'ui', reason: '需要界面承载：结果要能看、能选中、能复制' },
  { role: 'capability', reason: '需要真实能力：最终必须落到某个识别/预处理操作上' },
  { role: 'intel', reason: '需要判断理解：低置信度时要决定重试、换模式还是放弃' }
]

export const run = defineClassImpl<BodyClassInput, ReturnType<typeof assessComposition>>({
  classId,
  summary,
  run: (input) => assessComposition(input.profile, input.deps, input.requires ?? requires)
}).run
