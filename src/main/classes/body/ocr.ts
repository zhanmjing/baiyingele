import { defineClassImpl } from '../../../shared/classImpl'
import {
  assessComposition,
  type AssembleResult,
  type BodyClassInput,
  type BodyRequirement
} from '../../bodyRuntime'

/**
 * body.ocr —— OCR 体
 *
 * 识别文字、数学公式、二维码、表格与手写内容。
 *
 * 通用装配检查只问「有没有一层 ui / capability / intel 的零件」。
 * 对 OCR 体来说那不够：一个剪贴板读写能力也是 capability，
 * 但它**不认识任何东西**。所以这里加一层「零件能不能干这事」的检查。
 *
 * 这就是「一个类一个实现单元」真正要装的东西 ——
 * 通用逻辑表达不了的、只有这个类才有的条件。
 */

/** 名字里带这些词的才算「能识别」 */
const RECOGNIZER = /ocr|recognize|vision|read_?text|screenshot/i
const JPEG = /preview|text|hud|inspector/i

export const classId = 'body.ocr'
export const summary = 'OCR 体：识别 + 预处理 + 结果展示'

export const requires: BodyRequirement[] = [
  { role: 'ui', reason: '需要界面承载：结果要能看、能选中、能复制' },
  { role: 'capability', reason: '需要真实能力：最终必须落到某个识别/预处理操作上' },
  { role: 'intel', reason: '需要判断理解：低置信度时要决定重试、换模式还是放弃' }
]

export interface BodyOcrResult extends AssembleResult {
  /** OCR 体独有的问题（通用检查过不了的不会出现在这里） */
  findings: Array<{ code: string; message: string; hint?: string }>
}

export const run = defineClassImpl<BodyClassInput, BodyOcrResult>({
  classId,
  summary,
  run: (input) => {
    const base = assessComposition(input.profile, input.deps, input.requires ?? requires)
    const findings: BodyOcrResult['findings'] = []

    const parts = input.profile.composition ?? []
    const points = parts
      .filter((part) => (part.class?.layer ?? part.layer) === 'point')
      .map((part) => String(part.class?.name ?? part.ref ?? ''))

    // 1. 「有个 capability」不等于「能识别」
    if (!points.some((name) => RECOGNIZER.test(name))) {
      findings.push({
        code: 'no-recognizer',
        message: points.length
          ? `OCR 体的点零件是 ${points.join('、')}，没有一个能识别内容`
          : 'OCR 体里没有任何点能力',
        hint: '需要一个 ocr_read / screenshot 这类能拿到图像内容的点能力'
      })
    }

    // 2. 识别结果是多行文本，展示面得能承载
    const surfaces = parts
      .filter((part) => (part.class?.layer ?? part.layer) === 'surface')
      .map((part) => String(part.class?.name ?? part.ref ?? ''))
    if (surfaces.length && !surfaces.some((name) => JPEG.test(name))) {
      findings.push({
        code: 'ui-cannot-show-text',
        message: `OCR 体的展示面是 ${surfaces.join('、')}，看起来承载不了长文本结果`,
        hint: '识别结果是多行文本，用 file_preview / hud / inspector 这类面更合适'
      })
    }

    return { ...base, findings }
  }
}).run
