import { defineClassImpl } from '../../../shared/classImpl'
import { assessComposition, type BodyClassInput, type BodyRequirement } from '../../bodyRuntime'

/**
 * body.meeting_notes —— 会议纪要
 *
 * 录音 → 转录 → 摘要 → 待办
 *
 * 齐备条件不只是「零件存在」，还包括这些**角色**必须被填上。
 * 这就是这个体区别于其他体的地方 —— 以前全埋在通用装配检查里。
 */

export const classId = 'body.meeting_notes'
export const summary = '会议纪要：录音 → 转录 → 摘要 → 待办'

/** 必需角色。缺任何一个都算不齐备，哪怕零件都在。 */
export const requires: BodyRequirement[] = [
    { role: 'ui', reason: '需要界面承载：这类工具必须让人看见选项和结果' },
    { role: 'flow', reason: '需要编排：多个步骤有先后依赖，单次调用表达不了' },
    { role: 'capability', reason: '需要真实能力：这个体最终要落到某个原子操作上' },
    { role: 'intel', reason: '需要判断/理解：这一步不是确定性的机械操作' }
]

export const run = defineClassImpl<BodyClassInput, ReturnType<typeof assessComposition>>({
  classId,
  summary,
  run: (input) => assessComposition(input.profile, input.deps, input.requires ?? requires)
}).run
