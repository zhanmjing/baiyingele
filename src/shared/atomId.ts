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
 * 否则 `win.window.control` 和 `window.control` 无从区分。
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
