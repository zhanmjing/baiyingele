import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'

/**
 * surface.form —— 表单
 *
 * 这个面的渲染特化点：每个槽位是一个可编辑字段，值来自 params；改完要能提交并校验
 *
 * 现在 run 走通用的 planRender。特化逻辑以后写在这里，
 * 不再塞进 surfaceRuntime 的通用分支 —— 那样 17 个面层类会共用一条路径，
 * 表单和仪表盘在代码上就没有区别了。
 */

export const classId = 'surface.form'
export const summary = '表单：每个槽位是一个可编辑字段，值来自 params；改完要能提交并校验'

export const run = defineClassImpl<SurfaceClassInput, RenderResult>({
  classId,
  summary,
  run: (input) => planRender(classId, input.instanceId, input.params, input.deps)
}).run
