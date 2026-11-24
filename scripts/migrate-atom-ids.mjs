#!/usr/bin/env node
/**
 * 统一 id 迁移：把 `层.类.实例@rN` 三段格式应用到所有源数据。
 *
 * 默认只读预演；加 --write 才落盘，落盘前自动备份到 .tmp/migration-backup/。
 *
 * 真源头（不是 generatedFullCatalogs.json，那个是产物）：
 *   build/data/catalog/<layer>/<class-id>.json   102 个类文件
 *   build/data/catalog/<layer>/_index.json        5 个顺序索引
 *   src/shared/generatedLineProfiles.json        线层图谱（含 pointClass/pointInstance）
 *   src/shared/generatedBodyProfiles.json        体层 composition
 *   build/data/.panel-data.json                  面板 content
 *   src/renderer/src/generatedSurface.json       面板 content + dock target（与上面同步）
 *   build/data/.dock-data.json                   dock tile target
 *
 * 引用只做「字符串等价映射」：原来带 @rN 的仍带，原来不带的仍不带。
 * 结构化改造是下一步的事，本脚本不改引用形态。
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { classSegment, instanceSegment } from '../src/shared/atomId.ts'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/migration-backup')
const LAYERS = ['point', 'line', 'surface', 'body', 'field']
const CATALOG = join(ROOT, 'build/data/catalog')

const cn = { point: '点层', line: '线层', surface: '面层', body: '体层', field: '场层' }
const stats = { files: 0, classIds: 0, instanceIds: 0, refs: 0, refsUnmapped: 0 }
const unmapped = new Set()

function flat(n) {
  return String(n).normalize('NFKC').trim()
    .replace(/[.\-\s]+/g, '_').replace(/[^\w\u4e00-\u9fa5]+/g, '_')
    .replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}
const OWN = { point: null, line: 'flow', surface: 'surface', body: 'body', field: 'field' }

/** 类 id → 新类名段（去自指命名空间；点层额外去 win） */
function clsSeg(layer, cid) {
  let p = cid.split('.')
  if (p.length > 1 && (p[0] === layer || p[0] === OWN[layer])) p = p.slice(1)
  if (layer === 'point' && p.length > 1 && p[0] === 'win') p = p.slice(1)
  return flat(p.join('_'))
}

/** 实例 id → 新实例名段（去类型标记；去掉与类名重复的前导词，含缩写） */
function instSeg(layer, cid, iid) {
  let b = String(iid).replace(/@r\d+$/, '')
  if (b.startsWith(cid + '.')) b = b.slice(cid.length + 1)
  else if (b.startsWith(layer + '.')) b = b.slice(layer.length + 1)
  for (const m of ['inst.', 'i-']) if (b.startsWith(m)) { b = b.slice(m.length); break }
  b = flat(b)
  const cs = clsSeg(layer, cid)
  const ctoks = cs.split('_')
  let ttoks = b.split('_')
  const common = (a, c) => { let n = 0; for (let i = 0; i < Math.min(a.length, c.length); i++) { if (a[i] !== c[i]) break; n++ } return n }
  while (ttoks.length) {
    const t = ttoks[0]
    if (!ctoks.some((c) => t === c || (t.length >= 5 && common(t, c) >= 5))) break
    ttoks = ttoks.slice(1)
  }
  const joined = ttoks.join('_')
  if (joined.length < 3 || /^\d+$/.test(joined)) return b || 'default'
  return joined
}

// ── 1. 建映射表 ────────────────────────────────────────────────
const classMap = new Map()      // 旧类 id -> 新类 id
const instMap = new Map()       // 旧实例 id（含 @rN） -> 新实例 id
const instBaseMap = new Map()   // 旧实例 base（去 @rN） -> 新 base
const instRev = new Map()       // 旧实例 id（含 @rN） -> rev

for (const layer of LAYERS) {
  const dir = join(CATALOG, layer)
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || name === '_index.json') continue
    const cls = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    const newClassId = `${layer}.${clsSeg(layer, cls.id)}`
    classMap.set(cls.id, newClassId)
    for (const inst of cls.instances ?? []) {
      const rev = Number(inst.rev ?? 1) || 1
      // 体层 82 个实例在源文件里没有 id，gen-catalogs 是按 ${classId}.${name}@${rev} 现拼的。
      // 这里用同样的规则还原旧 id，再用 name 算新实例名段。
      const oldId = inst.id ?? `${cls.id}.${inst.name}@r${rev}`
      const segSource = inst.id ?? inst.name
      const base = `${newClassId}.${instSeg(layer, cls.id, segSource)}`
      instMap.set(oldId, `${base}@r${rev}`)
      instBaseMap.set(oldId.replace(/@r\d+$/, ''), base)
      instRev.set(oldId, rev)
    }
  }
}

/**
 * 自由文本里的 id 替换。
 *
 * 有些实例的 `detail` / `description` 是混杂文本，里面嵌了 id，例如
 *   "action=publish；target=inst.site-github@r1"
 * 这类字段不是引用字段，只能按 token 最长优先替换，不能整段解析。
 */
const textAliases = new Map()
for (const [oldId, newId] of classMap) textAliases.set(oldId, newId)
for (const [oldId, newId] of instMap) textAliases.set(oldId, newId)
for (const [oldBase, newBase] of instBaseMap) if (!textAliases.has(oldBase)) textAliases.set(oldBase, newBase)
const textKeys = [...textAliases.keys()].sort((a, b) => b.length - a.length)

let textRewriteCount = 0
function replaceIdsInText(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (const key of textKeys) {
    if (!out.includes(key)) continue
    const next = textAliases.get(key)
    if (key === next) continue
    out = out.split(key).join(next)
    textRewriteCount++
  }
  return out
}

/**
 * 引用映射。kind 决定「目标本来就不存在」时怎么按位置规范化：
 *   class    -> 整段当一个类名（剥自指命名空间后扁平化）
 *   instance -> 第一段当类名，其余当实例名
 * 已有映射的引用两种 kind 行为一致，都是查表。
 */
function mapRef(raw, layerHint, kind = 'auto') {
  const text = String(raw ?? '').trim()
  if (!text) return raw
  if (text.startsWith('$')) return raw                     // 表达式不动
  const m = /^(.*)@r(\d+)$/.exec(text)
  if (m) {
    const base = m[1]
    if (instMap.has(text)) return instMap.get(text)
    if (instBaseMap.has(base)) return `${instBaseMap.get(base)}@r${m[2]}`
  } else {
    if (classMap.has(text)) return classMap.get(text)
    if (instBaseMap.has(text)) return instBaseMap.get(text)
  }
  // 悬空引用：按位置规范化
  const body = text.replace(/@r\d+$/, '')
  let layer = layerHint
  let rest = body.split('.').filter(Boolean)
  if (LAYERS.includes(rest[0])) { layer = rest[0]; rest = rest.slice(1) }
  if (rest.length > 1 && rest[0] === OWN[layer]) rest = rest.slice(1)   // 剥自指命名空间
  if (!layer || !rest.length) { unmapped.add(text); stats.refsUnmapped++; return raw }
  let norm
  if (kind === 'class') {
    norm = `${layer}.${flat(rest.join('_'))}`
  } else {
    const cls = flat(rest[0])
    const inst = rest.length > 1 ? flat(rest.slice(1).join('.')) : 'default'
    norm = `${layer}.${cls}.${inst}`
  }
  if (m) norm += `@r${m[2]}`
  if (norm !== text) unmapped.add(`${text} → ${norm}（按位置规范化）`)
  return norm
}

// ── 2. 迁移类文件 ──────────────────────────────────────────────
const fileEdits = []   // { path, data }
const renames = []     // { from, to }

for (const layer of LAYERS) {
  const dir = join(CATALOG, layer)
  if (!existsSync(dir)) continue
  const indexDoc = JSON.parse(readFileSync(join(dir, '_index.json'), 'utf8'))
  const order = indexDoc.order ?? []
  const newOrder = order.map((id) => {
    const next = classMap.get(id)
    if (!next) return id
    stats.classIds++
    return next
  })
  fileEdits.push({ path: join(dir, '_index.json'), data: { ...indexDoc, order: newOrder } })

  for (const oldId of order) {
    const file = join(dir, `${oldId}.json`)
    if (!existsSync(file)) continue
    const cls = JSON.parse(readFileSync(file, 'utf8'))
    const newId = classMap.get(cls.id)
    const out = { ...cls, id: newId }
    out.instances = (cls.instances ?? []).map((inst) => {
      const rev = Number(inst.rev ?? 1) || 1
      const oldId = inst.id ?? `${cls.id}.${inst.name}@r${rev}`
      const mapped = instMap.get(oldId)
      if (!mapped) return inst
      stats.instanceIds++
      // 显式写 id：源数据里不该再有「靠生成器现拼」的隐式身份
      const next = { ...inst, id: mapped }
      if (typeof inst.detail === 'string') next.detail = replaceIdsInText(inst.detail)
      if (typeof inst.description === 'string') next.description = replaceIdsInText(inst.description)
      return next
    })
    fileEdits.push({ path: file, data: out, isClassFile: true, newName: `${newId}.json` })
    renames.push({ from: file, to: join(dir, `${newId}.json`) })
  }
}

// ── 3. 迁移跨层引用 ────────────────────────────────────────────
function loadJson(rel) { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) }

// 3a. 线层图谱
const linePath = join(ROOT, 'src/shared/generatedLineProfiles.json')
const lineProfiles = loadJson('src/shared/generatedLineProfiles.json')
const newLine = {}
for (const [classId, profile] of Object.entries(lineProfiles)) {
  const nodes = (profile.nodes ?? []).map((node) => {
    const hint = node.kind === 'subflow' ? 'line' : 'point'
    const next = { ...node }
    if (node.pointClass) { next.pointClass = mapRef(node.pointClass, hint, 'class'); if (next.pointClass !== node.pointClass) stats.refs++ }
    if (node.pointInstance) { next.pointInstance = mapRef(node.pointInstance, hint, 'instance'); if (next.pointInstance !== node.pointInstance) stats.refs++ }
    return next
  })
  newLine[classMap.get(classId) ?? classId] = { ...profile, classId: classMap.get(profile.classId) ?? profile.classId, nodes }
}
stats.files++
fileEdits.push({ path: linePath, data: newLine })

// 3b. 体层 composition
const bodyPath = join(ROOT, 'src/shared/generatedBodyProfiles.json')
const bodyProfiles = loadJson('src/shared/generatedBodyProfiles.json')
const newBody = {}
for (const [classId, profile] of Object.entries(bodyProfiles)) {
  const composition = (profile.composition ?? []).map((item) => {
    const mapped = mapRef(item.ref, item.layer, 'class')
    if (mapped !== item.ref) stats.refs++
    return { ...item, ref: mapped }
  })
  const newId = classMap.get(classId) ?? classId
  newBody[newId] = { ...profile, classId: classMap.get(profile.classId) ?? profile.classId, composition }
}
stats.files++
fileEdits.push({ path: bodyPath, data: newBody })

// 3c. 面板 content（类级 + 实例级，含 `+` 多页面）
function migratePanel(panel) {
  const split = (raw) => String(raw ?? '').split('+').map((s) => s.trim()).filter(Boolean)
  const join_ = (arr) => arr.join(' + ')
  const out = { ...panel }
  if (panel.content) {
    const mapped = split(panel.content).map((r) => mapRef(r, 'surface', 'class'))
    if (join_(mapped) !== panel.content) stats.refs++
    out.content = join_(mapped)
  }
  out.instances = (panel.instances ?? []).map((inst) => {
    if (!inst.content) return inst
    const mapped = split(inst.content).map((r) => mapRef(r, 'surface', 'instance'))
    if (join_(mapped) !== inst.content) stats.refs++
    return { ...inst, content: join_(mapped) }
  })
  return out
}

for (const rel of ['build/data/.panel-data.json', 'src/renderer/src/generatedSurface.json']) {
  const data = loadJson(rel)
  if (Array.isArray(data.classes)) data.classes = data.classes.map(migratePanel)
  if (Array.isArray(data.panelClasses)) data.panelClasses = data.panelClasses.map(migratePanel)
  const tileHint = (t) => (t.kind === 'flow' ? 'line' : t.kind === 'point' ? 'point' : undefined)
  if (Array.isArray(data.tiles)) data.tiles = data.tiles.map((t) => ({ ...t, target: mapRef(t.target, tileHint(t), 'instance') }))
  if (Array.isArray(data.gestures)) data.gestures = data.gestures.map((g) => ({ ...g, target: mapRef(g.target, tileHint(g), 'instance') }))
  if (Array.isArray(data.dockTiles)) data.dockTiles = data.dockTiles.map((t) => ({ ...t, target: mapRef(t.target, tileHint(t), 'instance') }))
  stats.files++
  fileEdits.push({ path: join(ROOT, rel), data })
}

// 3d-2. 手势种子
const gesturePath = join(ROOT, 'build/data/.gesture-data.json')
const gestures = loadJson('build/data/.gesture-data.json')
if (Array.isArray(gestures)) {
  const out = gestures.map((g) => ({ ...g, target: mapRef(g.target, g.kind === 'flow' ? 'line' : g.kind === 'point' ? 'point' : undefined, 'instance') }))
  stats.files++
  fileEdits.push({ path: gesturePath, data: out })
}

// 3d. dock tiles
const dockPath = join(ROOT, 'build/data/.dock-data.json')
const dock = loadJson('build/data/.dock-data.json')
const dockHint = (t) => (t.kind === 'flow' ? 'line' : t.kind === 'point' ? 'point' : undefined)
if (Array.isArray(dock.tiles)) dock.tiles = dock.tiles.map((t) => ({ ...t, target: mapRef(t.target, dockHint(t), 'instance') }))
stats.files++
fileEdits.push({ path: dockPath, data: dock })

// ── 4. 落盘 ────────────────────────────────────────────────────
console.log(`=== 统一 id 迁移${WRITE ? '（写盘）' : '（预演，未写盘）'} ===`)
console.log(`类 id 变更 ${stats.classIds} · 实例 id 变更 ${stats.instanceIds} · 引用变更 ${stats.refs} · 引用未映射 ${stats.refsUnmapped}`)
console.log(`涉及文件 ${fileEdits.length} 个 · 类文件改名 ${renames.filter((r) => r.from !== r.to).length} 个 · detail 文本替换 ${textRewriteCount} 处`)
if (unmapped.size) {
  console.log(`\n按位置规范化的引用 ${unmapped.size} 条（目标本来就不存在）：`)
  for (const u of [...unmapped].slice(0, 6)) console.log('  ', u)
}

if (!WRITE) {
  console.log('\n加 --write 才会落盘（落盘前自动备份到 .tmp/migration-backup/）')
  process.exit(0)
}

if (existsSync(BACKUP)) rmSync(BACKUP, { recursive: true, force: true })
mkdirSync(BACKUP, { recursive: true })
for (const edit of fileEdits) {
  const rel = edit.path.slice(ROOT.length + 1).replace(/\\/g, '/')
  const dest = join(BACKUP, rel)
  mkdirSync(dirname(dest), { recursive: true })
  if (existsSync(edit.path)) copyFileSync(edit.path, dest)
}
// 类文件写到新路径再删旧的；其余文件原地写
const renameByOld = new Map(renames.map((r) => [r.from, r.to]))
for (const edit of fileEdits) {
  const target = renameByOld.get(edit.path) ?? edit.path
  writeFileSync(target, `${JSON.stringify(edit.data, null, 2)}\n`, 'utf8')
}
for (const r of renames) if (r.from !== r.to && existsSync(r.from)) rmSync(r.from, { force: true })
console.log(`\n已落盘 ${fileEdits.length} 个文件（其中 ${renames.filter((r) => r.from !== r.to).length} 个改名），备份在 .tmp/migration-backup/`)
