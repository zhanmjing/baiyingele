import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'

/**
 * surface.form —— 表单
 *
 * 特化点：槽位是**可编辑字段**，值来自 params；改完要能提交并校验。
 *
 * 通用 planRender 只把槽位列成块 —— 对表单来说是错的：
 * 表单的每个槽位都有「当前值」「是否必填」「校验错误」三件事，
 * 整张表还要能回答「现在能不能提交」。
 *
 * 这三件事缺任何一件，渲染层就只能自己拼表单逻辑 —— 回到手写页面的老路。
 */

export interface FormField {
  id: string
  label: string
  key: string
  value: unknown
  blank: boolean
  errors: string[]
}

export interface FormRender extends RenderResult {
  form?: {
    fields: FormField[]
    canSubmit: boolean
    blockers: string[]
  }
}

export const classId = 'surface.form'
export const summary = '表单：槽位是可编辑字段，值来自 params；改完要能提交并校验'

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

const requiredOf = (params: Record<string, unknown>): string[] =>
  String(params.required ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

export const run = defineClassImpl<SurfaceClassInput, FormRender>({
  classId,
  summary,
  run: async (input) => {
    const base = planRender(classId, input.instanceId, input.params, input.deps)
    const params = (input.params ?? {}) as Record<string, unknown>
    const requiredKeys = requiredOf(params)

    const fields: FormField[] = base.slots.map((slot) => {
      const key = slot.source?.kind === 'params' ? slot.source.key : String(slot.label ?? slot.id)
      const value = params[key]
      const blank = isBlank(value)
      const errors: string[] = []
      if (requiredKeys.includes(key) && blank) errors.push('必填')
      return { id: slot.id, label: slot.label, key, value, blank, errors }
    })

    const blockers: string[] = []
    if (!requiredKeys.length) {
      // 没声明必填时不能假装「都能提交」—— 那是在替调用方做决定
      blockers.push('没有声明 required，无法判断必填项')
    }
    for (const field of fields) {
      if (field.errors.length) blockers.push(`${field.label}：${field.errors.join('、')}`)
    }

    return {
      ...base,
      blocks: [],
      form: { fields, canSubmit: blockers.length === 0, blockers },
      intents: ['submit', ...(blockers.length ? [] : ['reset'])]
    }
  }
}).run
