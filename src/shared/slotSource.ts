import { ATOM_LAYERS, type AtomLayer } from './atomId'

/**
 * 槽位数据契约。
 *
 * 面层的 46 个槽位现在能说出「该显示什么」，但说不出「从哪取数」。
 * 这个文件定义「从哪取」—— 面层渲染的唯一数据入口。
 *
 * ## 分类依据是**生命周期**，不是数据长相
 *
 * 按「数据来自哪层」分会得到 pointRun / lineRun / surfaceRun / bodyRun / fieldRun
 * 五个副本，而它们的**失效条件完全一样**。那说明它们不是一个类别的五个成员，
 * 而是一个类别的一个参数。
 *
 *   kind       什么时候变      能不能缓存
 *   run        每次运行        不能
 *   registry   换目录版本      可以长期
 *   params     每次调用        不能
 *   static     永不            可以永久
 *
 * 这四个的失效条件互斥，所以是四个类别而不是一个。
 *
 * ## 取不到数必须分三态
 *
 * 「没有」和「坏了」是两件事。混在一起用户就分不清「还没数据」和「系统坏了」。
 */

export type SlotSource =
  /** 别人跑出来的结果。跨层是一等公民：layer 是参数，不是前缀。 */
  | { kind: 'run'; layer: AtomLayer; instanceId?: string; limit?: number }
  /**
   * 目录里声明的东西。
   *   { layer }             → 整层目录（例如「38 个点类」）
   *   { classId }           → 单个类的声明
   *   两者都给时 classId 必须以 layer 开头
   */
  | { kind: 'registry'; layer?: AtomLayer; classId?: string }
  /** 本次调用的输入参数 */
  | { kind: 'params'; key: string }
  /** 不走任何来源的字面值 */
  | { kind: 'static'; value: string }

/** 槽位的四种状态。ready 之外都必须有 reason。 */
export type SlotStatus = 'ready' | 'empty' | 'missing' | 'error'

export interface RenderedSlot {
  slotId: string
  role: string
  label: string
  status: SlotStatus
  /** 只有 ready 才有值 —— 编译器会强制调用方处理其他三种 */
  value?: unknown
  /** status 不是 ready 时必须说明为什么 */
  reason?: string
  /** 这次读的来源，用于对账「声明 vs 实际」 */
  source?: SlotSource
}

/** 校验一个 source 是否合法。返回 null 表示合法，否则返回原因。 */
export function validateSlotSource(source: unknown): string | null {
  if (!source || typeof source !== 'object') return 'source 必须是对象'
  const value = source as Record<string, unknown>
  switch (value.kind) {
    case 'run': {
      if (!ATOM_LAYERS.includes(value.layer as AtomLayer)) return `run.layer 必须是五层之一，实际是 ${JSON.stringify(value.layer)}`
      if (value.instanceId !== undefined && typeof value.instanceId !== 'string') return 'run.instanceId 必须是字符串'
      if (value.limit !== undefined && !(typeof value.limit === 'number' && value.limit > 0)) return 'run.limit 必须是正数'
      return null
    }
    case 'registry': {
      if (value.layer === undefined && value.classId === undefined) return 'registry 至少要给 layer 或 classId'
      if (value.layer !== undefined && !ATOM_LAYERS.includes(value.layer as AtomLayer)) {
        return `registry.layer 必须是五层之一，实际是 ${JSON.stringify(value.layer)}`
      }
      if (value.classId !== undefined) {
        if (typeof value.classId !== 'string' || !value.classId.includes('.')) return 'registry.classId 必须是 <layer>.<class>'
        if (value.layer !== undefined && !String(value.classId).startsWith(`${value.layer}.`)) {
          return `registry.classId ${String(value.classId)} 与 layer ${String(value.layer)} 不一致`
        }
      }
      return null
    }
    case 'params': {
      if (typeof value.key !== 'string' || !value.key.trim()) return 'params.key 必须是非空字符串'
      return null
    }
    case 'static': {
      if (typeof value.value !== 'string') return 'static.value 必须是字符串'
      return null
    }
    default:
      return `未知的 source.kind: ${JSON.stringify(value.kind)}`
  }
}

/** 两个 source 是否等价（对账「声明 vs 实际读过」时用） */
export function sameSlotSource(a: SlotSource, b: SlotSource): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 人读的来源描述，用于日志和 evidence */
export function describeSlotSource(source: SlotSource): string {
  switch (source.kind) {
    case 'run':
      return `run:${source.layer}${source.instanceId ? `.${source.instanceId}` : ''}${source.limit ? `×${source.limit}` : ''}`
    case 'registry':
      return source.classId ? `registry:${source.classId}` : `registry:${source.layer}.*`
    case 'params':
      return `params:${source.key}`
    case 'static':
      return 'static'
  }
}
