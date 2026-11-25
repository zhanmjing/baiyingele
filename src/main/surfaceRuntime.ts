import type { InstanceRunner, RunOutcome } from './layerStore'

/**
 * 面层执行器：渲染。
 *
 * 面层**不执行、不产生副作用**。它做两件事：读数据渲染、把用户操作变成意图。
 * 所以 `runSurface` 的产物是 `kind: 'render'` —— 一份「本该渲染成什么」的描述，
 * 而不是执行结果。真正跑起来的是上层收到 intent 之后的事。
 *
 * 现状（2026-11 实测）：
 *   面层 17 个类**只声明了 `detail` 一个参数**，没有 regions / slots 结构。
 *   `detail` 是自由文本，尾部带挂载模式：`... · sidebar` / `· modal` / `· main`。
 *   唯一有结构的是 `surface.panel`：它的 params 里有 pages 和 applications。
 *
 * 所以 render 现在能诚实回答的是：
 *   - 这个面声明了哪些区域（多数是「一个都没声明」）
 *   - 它挂在哪（从 detail 尾部解析）
 *   - 面板类承载的页面里有几个真的存在
 *   - 缺什么
 */

export interface SurfacePageRef {
  layer?: string
  name?: string
  instance?: string
  rev?: number | null
  dangling?: boolean
}

export interface SurfaceSlot {
  id: string
  role: string
  label: string
  order?: number
}

export interface SurfaceParamsLike {
  detail?: unknown
  /** 结构化槽位（scripts/structure-surface-slots.mjs 从 detail 文本推导而来） */
  slots?: unknown
  slotCount?: unknown
  mount?: unknown
  modes?: unknown
  regions?: unknown
  pages?: unknown
  applications?: unknown
  states?: unknown
}

export interface SurfaceDeps {
  /** 某层的某个类是否存在 */
  hasClass: (layer: string, name: string) => boolean
  /** 面层类 id → 该类的 params 声明（用来判断有没有声明区域） */
  declaredRegionKeys?: (classId: string) => string[]
}

export interface RenderBlock {
  /** 这块是什么：page（承载的页面）/ placeholder（占位）/ empty（空） */
  kind: 'page' | 'placeholder'
  label: string
  /** 页面引用解析出来的 id，解析不出就是 null */
  ref: string | null
  exists: boolean
}

export interface RenderResult {
  classId: string
  instanceId: string
  /** pattern / page / panel —— 面层三种 kind */
  surfaceKind: 'pattern' | 'page' | 'panel'
  /** 挂载模式，从 detail 尾部解析；解析不出为 null */
  mount: string | null
  /** 这个面声明的区域（实测多数是空数组） */
  regions: string[]
  blocks: RenderBlock[]
  /** 这次渲染读了哪些数据源 */
  dataUsed: { kind: string; ref: string }[]
  /** 现在可用的意图 */
  intents: string[]
  /** 渲染不了的槽位 */
  gaps: { slot: string; reason: string }[]
}

const MOUNTS = ['sidebar', 'main', 'modal', 'overlay', 'toast', 'tray', 'right', 'bottom', 'floating', 'sheet']

/** 从 detail 尾部解析挂载模式：`... · sidebar` */
export function parseMount(detail: unknown): string | null {
  if (typeof detail !== 'string') return null
  const tail = detail.split('·').pop()?.trim().toLowerCase()
  if (!tail) return null
  return MOUNTS.includes(tail) ? tail : null
}

/** `{layer, name, instance}` → `layer.name[.instance]` */
export function pageRefId(ref: SurfacePageRef | null | undefined): string | null {
  if (!ref?.layer || !ref?.name) return null
  return ref.instance ? `${ref.layer}.${ref.name}.${ref.instance}` : `${ref.layer}.${ref.name}`
}

/** 纯函数：算一次渲染结果 */
export function planRender(
  classId: string,
  instanceId: string,
  params: SurfaceParamsLike,
  deps: SurfaceDeps
): RenderResult {
  const isPanel = classId === 'surface.panel'
  const surfaceKind: RenderResult['surfaceKind'] = isPanel ? 'panel' : 'pattern'
  const declared = deps.declaredRegionKeys?.(classId) ?? ['detail']
  const slots = Array.isArray(params.slots) ? (params.slots as SurfaceSlot[]) : []
  // 有结构化槽位时，区域就是槽位角色的集合
  const regions = slots.length
    ? [...new Set(slots.map((slot) => slot.role))]
    : Array.isArray(params.regions) ? (params.regions as string[]) : []
  const gaps: RenderResult['gaps'] = []
  const blocks: RenderBlock[] = []
  const dataUsed: RenderResult['dataUsed'] = []
  const intents: string[] = []

  // 一个槽位都没有才是真缺口；有槽位就别再报「没结构」
  if (!isPanel && !slots.length && declared.length <= 1 && declared[0] === 'detail') {
    gaps.push({ slot: 'regions', reason: '该类只声明了 detail 一个参数，没有 regions / slots 结构' })
  }

  // 结构化槽位 → 渲染块。这是真实可渲染的内容，不再是占位。
  for (const slot of slots) {
    blocks.push({ kind: 'page', label: slot.label, ref: slot.id, exists: true })
  }

  if (isPanel) {
    const pages = Array.isArray(params.pages) ? (params.pages as SurfacePageRef[]) : []
    if (!pages.length) gaps.push({ slot: 'pages', reason: '面板没有声明承载任何页面' })
    for (const page of pages) {
      const id = pageRefId(page)
      if (!id) {
        gaps.push({ slot: 'pages', reason: `无法解析的页面引用: ${JSON.stringify(page)}` })
        continue
      }
      const layer = page.layer ?? id.split('.')[0]
      const name = page.name ?? id.slice(layer.length + 1).split('.')[0]
      const exists = deps.hasClass(layer, name)
      blocks.push({ kind: 'page', label: id, ref: id, exists })
      dataUsed.push({ kind: 'registry', ref: id })
      if (!exists) gaps.push({ slot: `page:${id}`, reason: '页面类不存在' })
    }

    const apps = Array.isArray(params.applications) ? (params.applications as unknown[]) : []
    if (apps.length) intents.push(`open:${apps.length} 个应用`)
    const modes = Array.isArray(params.modes) ? (params.modes as string[]) : []
    if (modes.length) intents.push(`mount:${modes.join('|')}`)
  } else if (!slots.length) {
    // 非面板且没有槽位：只能给占位，不假装渲染成功
    const detail = typeof params.detail === 'string' ? params.detail : ''
    const described = detail.split('·')[0]?.trim()
    if (described) blocks.push({ kind: 'placeholder', label: described, ref: null, exists: false })
  }

  return {
    classId,
    instanceId,
    surfaceKind,
    mount:
      (typeof params.mount === 'string' && params.mount) ||
      parseMount(params.detail) ||
      (Array.isArray(params.modes) ? String((params.modes as string[])[0] ?? '') || null : null),
    regions,
    blocks,
    dataUsed,
    intents,
    gaps
  }
}

export function createSurfaceRunner(deps: SurfaceDeps): InstanceRunner {
  return (ctx): RunOutcome => {
    const startedAt = Date.now()
    const classId = ctx.instance.classId
    const result = planRender(classId, ctx.instance.id, ctx.instance.params as SurfaceParamsLike, deps)
    const elapsedMs = Date.now() - startedAt
    const renderable = result.blocks.filter((b) => b.exists).length

    const head =
      result.surfaceKind === 'panel'
        ? `面板 ${result.mount ?? '(未声明挂载)'} · ${result.blocks.length} 个页面（存在 ${renderable}）`
        : result.regions.length
          ? `模式 ${result.mount ?? '(未声明挂载)'} · ${result.blocks.length} 个槽位（${result.regions.join('/')}）`
          : `模式 ${result.mount ?? '(未声明挂载)'} · ${result.blocks.length} 个占位块`

    const gapText = result.gaps.length ? ` · 缺口 ${result.gaps.length} 个：${result.gaps.slice(0, 3).map((g) => g.slot).join('、')}` : ''

    return {
      // 有缺口就不能报成功 —— 渲染不完整这件事必须让上层知道
      status: result.gaps.length ? 'warn' : 'ok',
      output: `渲染 ${classId}：${head}${gapText}`,
      value: JSON.stringify(result),
      elapsedMs,
      evidence: { kind: 'render', ...result }
    }
  }
}
