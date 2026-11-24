/**
 * Atom 统一 id —— 唯一真相
 *
 * 格式：`层名.类名.实例名@rN`（3 段定长，全小写）
 *
 *   point.win_key_send.copy@r1
 *   line.ensure_vpn.ensure_vpn_ask@r2
 *   surface.form.settings_vpn@r3
 *   body.file_preview.text@r1
 *   field.observe.desktop@r1
 *
 * 设计原则（按维护者要求「简化命名，只要不重名」）：
 *
 * 1. **id 里不承载语义**。想知道 `field.observe.desktop` 是干什么的，
 *    看实例的 `name` / `description` 字段，不要指望从 id 读出来。
 *    id 只保证三件事：唯一、可自动生成、引用稳定。
 * 2. **全小写**。避免 Windows 大小写不敏感、URL、排序带来的隐性差异。
 * 3. **段内不许有点**。多词用 `_` 连接，这样 `split('.')` 永远只切出 3 段，
 *    解析不需要任何启发式。
 * 4. **id 由本文件的函数生成，不接受手写**。
 *    现有 287 个实例里有 46 个 id 的版本号和 `rev` 字段对不上（全在 surface），
 *    就是因为手写的 id 会和数据漂移。
 */

export type AtomLayer = 'point' | 'line' | 'surface' | 'body' | 'field'

export const ATOM_LAYERS: readonly AtomLayer[] = ['point', 'line', 'surface', 'body', 'field']

/**
 * 每层「自指」的命名空间前缀，拼 id 时剥掉 —— 它已经体现在第 1 段了。
 *
 * 点层是 null：`win.` / `file.` / `ui.` 是真实主题（跨类），不是自指，要保留，
 * 否则 `point.window_control` 和 `window.control` 无从区分。
 */
const OWN_NAMESPACE: Record<AtomLayer, string | null> = {
  point: null,
  line: 'flow',
  surface: 'surface',
  body: 'body',
  field: 'field'
}

/** 实例 id 里纯类型标记的前缀 —— 3 段定长之后「第 3 段就是实例」，它们是噪音 */
const INSTANCE_TYPE_MARKERS = ['inst.', 'i-'] as const

const REV_SUFFIX = /@r(\d+)$/

/** 把一个词压成合法段：只留小写字母数字下划线，多词用单下划线连接 */
export function flattenSegment(raw: string): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[.\-\s]+/g, '_')
    .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

/** 类 id → 类名段。剥掉本层自指命名空间后扁平化。 */
export function classSegment(layer: AtomLayer, classId: string): string {
  const parts = String(classId ?? '').split('.').filter(Boolean)
  if (parts.length > 1) {
    const own = OWN_NAMESPACE[layer]
    if (parts[0] === layer || (own !== null && parts[0] === own)) parts.shift()
  }
  return flattenSegment(parts.join('_'))
}

/** 实例 id → 实例名段。剥掉类 id 前缀 / 层前缀 / 类型标记后扁平化。 */
export function instanceSegment(layer: AtomLayer, classId: string, instanceId: string): string {
  let body = String(instanceId ?? '').trim().replace(REV_SUFFIX, '')
  if (body.startsWith(`${classId}.`)) body = body.slice(classId.length + 1)
  else if (body.startsWith(`${layer}.`)) body = body.slice(layer.length + 1)
  for (const marker of INSTANCE_TYPE_MARKERS) {
    if (body.startsWith(marker)) {
      body = body.slice(marker.length)
      break
    }
  }
  return flattenSegment(body) || 'default'
}

/** 从原始数据推出完整 id —— 这是唯一的生成入口 */
export function deriveAtomId(
  layer: AtomLayer,
  classId: string,
  instanceId: string,
  rev: number
): string {
  return makeAtomId({
    layer,
    className: classSegment(layer, classId),
    instance: instanceSegment(layer, classId, instanceId),
    rev
  })
}

export interface AtomParts {
  layer: AtomLayer
  className: string
  instance: string
  rev: number
}

/** 拼 id。段里若混进点会直接抛错，防止漂移被写进数据。 */
export function makeAtomId(parts: AtomParts): string {
  const { layer, className, instance, rev } = parts
  if (!ATOM_LAYERS.includes(layer)) throw new Error(`未知层名：${layer}`)
  for (const [label, value] of [
    ['类名', className],
    ['实例名', instance]
  ] as const) {
    if (!value) throw new Error(`${label}不能为空`)
    if (value.includes('.')) throw new Error(`${label}不能含点（会破坏 3 段定长）：${value}`)
  }
  if (!Number.isInteger(rev) || rev < 1) throw new Error(`版本号必须是 ≥1 的整数：${rev}`)
  return `${layer}.${className}.${instance}@r${rev}`
}

/** 解析 id。格式不对返回 null，不抛错（调用方通常在做校验）。 */
export function parseAtomId(id: string): AtomParts | null {
  const parts = String(id ?? '').split('.')
  if (parts.length !== 3) return null
  const [layer, className, tail] = parts
  if (!ATOM_LAYERS.includes(layer as AtomLayer)) return null
  const matched = REV_SUFFIX.exec(tail)
  if (!matched) return null
  const instance = tail.slice(0, matched.index)
  if (!className || !instance) return null
  const rev = Number(matched[1])
  if (!Number.isInteger(rev) || rev < 1) return null
  return { layer: layer as AtomLayer, className, instance, rev }
}

export function isAtomId(id: string): boolean {
  return parseAtomId(id) !== null
}

/** 只取层名，拿不到返回 null */
export function layerOf(id: string): AtomLayer | null {
  return parseAtomId(id)?.layer ?? null
}

// ── 结构化引用 ────────────────────────────────────────────────
//
// 跨层引用**不存 id 字符串，存结构化字段**。理由：
//   - id 格式改一次（我们已经改了一次），所有存字符串的地方都要全文重写
//   - 结构化字段里 `layer` / `name` / `rev` 各自独立，改名只动一个字段
//   - 拼装和校验都走本文件的函数，不会出现「两份数据对不上」的漂移
//
// 现有 287 个实例里有 46 个 id 的版本号和 `rev` 字段对不上（全在 surface），
// 就是「同一个事实存了两份」的后果。

/** 类引用：稳定，指向一个类。`name` 是类名段，不含层、不含点。 */
export interface ClassRef {
  layer: AtomLayer
  /** 类名段，如 `win_key_send`（不是 `point.win_key_send`） */
  name: string
}

/** 实例引用：钉住版本。 */
export interface InstanceRef extends ClassRef {
  /** 实例名段，如 `copy` */
  instance: string
  rev: number
}

/** 拼类 id：`{layer:'point', name:'win_key_send'}` → `point.win_key_send` */
export function makeClassId(ref: ClassRef): string {
  if (!ATOM_LAYERS.includes(ref.layer)) throw new Error(`未知层名：${ref.layer}`)
  if (!ref.name) throw new Error('类名不能为空')
  if (ref.name.includes('.')) throw new Error(`类名不能含点：${ref.name}`)
  return `${ref.layer}.${ref.name}`
}

/** 拆类 id。层名必须是 5 个之一，否则返回 null。 */
export function parseClassId(id: string): ClassRef | null {
  const parts = String(id ?? '').split('.')
  if (parts.length !== 2) return null
  const [layer, name] = parts
  if (!ATOM_LAYERS.includes(layer as AtomLayer) || !name) return null
  return { layer: layer as AtomLayer, name }
}

/** 拼实例 id：`{layer, name, instance, rev}` → `point.win_key_send.copy@r1` */
export function makeInstanceId(ref: InstanceRef): string {
  return makeAtomId({ layer: ref.layer, className: ref.name, instance: ref.instance, rev: ref.rev })
}

/** 拆实例 id → InstanceRef（`AtomParts` 的结构与它一致，这里只做改名） */
export function parseInstanceId(id: string): InstanceRef | null {
  const parts = parseAtomId(id)
  if (!parts) return null
  return { layer: parts.layer, name: parts.className, instance: parts.instance, rev: parts.rev }
}

/** 两个引用是否指向同一版本 */
export function sameInstanceRef(a: InstanceRef, b: InstanceRef): boolean {
  return a.layer === b.layer && a.name === b.name && a.instance === b.instance && a.rev === b.rev
}

/** 两个引用是否同一个类（忽略版本） */
export function sameClassRef(a: ClassRef, b: ClassRef): boolean {
  return a.layer === b.layer && a.name === b.name
}

// ── 兼容层：同时接受字符串与结构化 ────────────────────────────
//
// 迁移是分步的：数据先改结构化，代码逐个跟上。这层让两步之间不出现「改了一半读不到」。
// **新代码一律写结构化，读的时候用这两个函数归一化。**

/** 运行时表达式，不是静态引用 */
export interface ExprRef {
  expr: string
}

export type AnyClassRef = string | ClassRef
export type AnyInstanceRef = string | InstanceRef | ExprRef

export function isExprRef(value: unknown): value is ExprRef {
  return !!value && typeof value === 'object' && typeof (value as ExprRef).expr === 'string'
}

export function isClassRef(value: unknown): value is ClassRef {
  return !!value && typeof value === 'object' && typeof (value as ClassRef).layer === 'string' && typeof (value as ClassRef).name === 'string'
}

export function isInstanceRef(value: unknown): value is InstanceRef {
  return isClassRef(value) && typeof (value as InstanceRef).instance === 'string' && typeof (value as InstanceRef).rev === 'number'
}

/** 归一化成类 id 字符串。结构化就拼，字符串就原样返回。 */
export function classIdOf(ref: AnyClassRef | null | undefined): string | null {
  if (!ref) return null
  if (typeof ref === 'string') return ref || null
  if (isClassRef(ref)) return makeClassId(ref)
  return null
}

/** 归一化成实例 id 字符串。表达式返回 null（调用方自己按 expr 解析）。 */
export function instanceIdOf(ref: AnyInstanceRef | null | undefined): string | null {
  if (!ref) return null
  if (typeof ref === 'string') return ref || null
  if (isExprRef(ref)) return null
  if (isInstanceRef(ref)) return makeInstanceId(ref)
  return null
}

/**
 * 悬空引用的「基 id」：`<layer>.<name>.<instance>`（不带 @rN）。
 *
 * 悬空引用是 `{ ..., rev: null, dangling: true }` —— 目标还不存在，
 * 但它必须能被需求生成器看见，否则缺口会静默消失。
 * `instanceIdOf` 对这种引用返回 null（它不是合法 InstanceRef），
 * 所以单独给一个函数，调用方按需使用。
 */
export function danglingBaseId(ref: Partial<InstanceRef> & { layer?: string; name?: string; instance?: string } | null | undefined): string | null {
  if (!ref || !ref.layer || !ref.name || !ref.instance) return null
  return `${ref.layer}.${ref.name}.${ref.instance}`
}

/** 任意引用 → 用于「查存在性」的基 id（带不带版本都能给出） */
export function refBaseId(ref: AnyInstanceRef | null | undefined): string | null {
  if (!ref) return null
  if (typeof ref === 'string') return ref.replace(/@r\d+$/, '')
  if (isExprRef(ref)) return null
  return danglingBaseId(ref as InstanceRef)
}
