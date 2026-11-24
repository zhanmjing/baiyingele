/**
 * 表单规格：`ui.form` 用它在界面上渲染一个「问用户要输入」的弹窗。
 *
 * 放 shared 是因为两边都要用：
 *   - 主进程：解析实例参数（fields / schema），组装请求
 *   - 渲染层：渲染输入框，提交前做同一套校验
 * 校验逻辑只写一份，避免「前端放过了、后端又拒绝」这种不一致。
 */

export type FormFieldType = 'text' | 'number' | 'boolean' | 'select'

export interface FormField {
  /** 结果里的键名 */
  name: string
  /** 显示名 */
  label: string
  type: FormFieldType
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface FormSpec {
  title: string
  description?: string
  fields: FormField[]
}

export type FormAnswerKind = 'submitted' | 'cancelled' | 'timeout' | 'unavailable'

export interface FormAnswer {
  kind: FormAnswerKind
  values?: Record<string, string>
  reason?: string
}

function parseSchema(raw: string): FormSpec | null {
  let schema: unknown
  try {
    schema = JSON.parse(raw)
  } catch {
    return null
  }
  if (!schema || typeof schema !== 'object') return null

  const record = schema as Record<string, unknown>
  const properties = record.properties
  if (!properties || typeof properties !== 'object') return null

  const required = Array.isArray(record.required) ? record.required.map(String) : []
  const fields: FormField[] = Object.entries(properties as Record<string, unknown>).map(([name, definition]) => {
    const def = (definition && typeof definition === 'object' ? definition : {}) as Record<string, unknown>
    const enumValues = Array.isArray(def.enum) ? def.enum.map(String) : undefined
    const type: FormFieldType =
      def.type === 'number' || def.type === 'integer'
        ? 'number'
        : def.type === 'boolean'
          ? 'boolean'
          : enumValues
            ? 'select'
            : 'text'
    const field: FormField = {
      name,
      label: String(def.title ?? name),
      type,
      required: required.includes(name)
    }
    if (enumValues) field.options = enumValues
    if (typeof def.description === 'string') field.placeholder = def.description
    return field
  })

  if (!fields.length) return null
  const spec: FormSpec = { title: String(record.title ?? ''), fields }
  if (typeof record.description === 'string') spec.description = record.description
  return spec
}

/** `"备注, 版本号"` → 两个文本字段。中英文逗号、分号都当分隔符 */
function parseFieldList(raw: string): FormField[] {
  return String(raw ?? '')
    .split(/[,，;；]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      // 支持 "版本号:number" 这种简单类型标注
      const [rawLabel, rawType] = token.split(':').map((part) => part.trim())
      const type: FormFieldType =
        rawType === 'number' || rawType === 'boolean' || rawType === 'select' ? rawType : 'text'
      return { name: rawLabel, label: rawLabel, type, required: false }
    })
}

/**
 * 纯函数：把实例参数解析成表单规格。
 * 优先用 JSON Schema（`schema`），否则退回逗号分隔的字段列表（`fields`）。
 * 两者都没有就返回 null —— 没有字段的表单没有意义。
 */
export function parseFormSpec(title: string, fieldsRaw: string, schemaRaw = ''): FormSpec | null {
  const trimmedSchema = String(schemaRaw ?? '').trim()
  if (trimmedSchema) {
    const fromSchema = parseSchema(trimmedSchema)
    if (fromSchema) {
      if (!fromSchema.title) fromSchema.title = String(title ?? '').trim() || '请填写'
      return fromSchema
    }
    // 给了 schema 但解析不了：明确失败，不要偷偷退回 fields
    return null
  }

  const fields = parseFieldList(fieldsRaw)
  if (!fields.length) return null
  return { title: String(title ?? '').trim() || '请填写', fields }
}

/** 纯函数：校验用户提交的值，返回错误列表（空数组 = 通过） */
export function validateFormValues(spec: FormSpec, values: Record<string, string>): string[] {
  const errors: string[] = []
  for (const field of spec.fields) {
    const raw = values[field.name]
    const value = raw === undefined || raw === null ? '' : String(raw).trim()

    if (!value) {
      if (field.required) errors.push(`「${field.label}」是必填项`)
      continue
    }
    if (field.type === 'number' && !Number.isFinite(Number(value))) {
      errors.push(`「${field.label}」需要是数字`)
    }
    if (field.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
      errors.push(`「${field.label}」需要是 true 或 false`)
    }
    if (field.type === 'select' && field.options && !field.options.includes(value)) {
      errors.push(`「${field.label}」只能是 ${field.options.join(' / ')}`)
    }
  }
  return errors
}

/** 纯函数：提交结果的一行摘要（给运行记录用） */
export function summarizeFormValues(spec: FormSpec, values: Record<string, string>): string {
  return spec.fields
    .map((field) => {
      const value = values[field.name]
      return value === undefined || value === null || String(value).trim() === ''
        ? null
        : `${field.label}=${String(value).trim()}`
    })
    .filter(Boolean)
    .join(' · ')
}
