import { defineClassImpl } from '../../../shared/classImpl'
import { assessComposition, type BodyDeps, type BodyProfileLike } from '../../bodyRuntime'

/**
 * body.ocr —— OCR 体
 *
 * 试点文件：验证「一类一个实现单元」这条新轨能不能走通。
 * 现在 run 还是通用装配检查，但这里把 OCR 体**特化要求**的位置留出来了。
 *
 * 以后这个体的齐备条件应该比「零件存在」更强：
 *   - 必须有一个支持视觉/OCR 的点能力（不能只是 clipboard_get）
 *   - 必须有图像预处理（缩放/灰度）作为前置
 *   - 结果展示面要能承载长文本
 * 那些条件写在这里，而不是埋在 bodyRuntime 的通用逻辑里。
 */

export interface BodyClassInput {
  profile: BodyProfileLike
  deps: BodyDeps
}

export const classId = 'body.ocr'
export const summary = 'OCR 体：识别能力 + 图像预处理 + 结果展示（当前走通用装配检查）'

export const run = defineClassImpl<BodyClassInput, ReturnType<typeof assessComposition>>({
  classId,
  summary,
  run: ({ profile, deps }) => assessComposition(profile, deps)
}).run
