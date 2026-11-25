/**
 * 五层共用的目录类型。
 *
 * 这套形状**不属于点层**——五层的类/实例/运行记录结构本就一致（都由
 * scripts/gen-catalogs.mjs 产出）。之前把它定义在 pointCatalog.ts 里，
 * 导致五层 IPC 契约全都引用 Point* 类型，想给某一层加专属字段时无处可加。
 *
 * 现在这里拥有形状，pointCatalog.ts 退成别名，保持既有导入不变。
 */

export type LayerPriority = 'P0' | 'P1' | 'P2'
export type LayerStatus = 'active' | 'draft' | 'archived'

export interface LayerParam {
  key: string
  label: string
  type: string
  required: boolean
  description: string
  defaultValue?: string
}

export interface LayerInstanceSeed {
  id: string
  name: string
  rev: number
  status: LayerStatus
  description: string
  /** detail 解析后的参数；纯文本 detail 会退成 { detail: 文本 } */
  params?: Record<string, unknown>
  classId?: string
  createdAt?: number
  updatedAt?: number
}

export interface LayerClassSeed {
  id: string
  name: string
  family: string
  priority: LayerPriority
  effect: string
  status: 'active' | 'draft'
  description: string
  /** 场层专用：这个 FieldClass 的落点。设计上不允许为空 */
  landing?: string
  /**
   * 场层专用：自主度上限 A0/A1/A2。
   *
   * 和 `effect` 是**两个正交的轴**：
   *   effect    副作用等级 L0/L1/L2 —— 这个能力会不会改变世界
   *   autonomy  自主度上限 A0/A1/A2 —— 允许它自己决定到哪一步
   * 一个能力可以同时「无副作用（L0）」和「允许自动应用（A2）」。
   */
  autonomy?: string
  params: LayerParam[]
  instances: LayerInstanceSeed[]
}

export interface LayerInstanceRecord extends LayerInstanceSeed {
  classId: string
  params: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface LayerRunRecord {
  id: string
  classId: string
  instanceId: string
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
  createdAt: number
  evidence?: Record<string, unknown>
}

/**
 * params 的字符串视图。
 *
 * `params` 的真相是 `Record<string, unknown>` —— 面板类的配置是嵌套结构，
 * 不能假装它全是字符串。但点层/线层的能力只吃字符串参数，所以真正把它们
 * 交给能力之前，用这个函数取一份字符串视图（对象/数组一律 JSON 序列化）。
 */
export function stringParams(params: Record<string, unknown> | undefined | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue
    out[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return out
}
