#!/usr/bin/env node
/**
 * 把剩余几处「还在存 id 字符串」的地方改成结构化引用。
 *
 * 覆盖：
 *   1. dock tile 的 target         → InstanceRef
 *   2. 手势种子的 target            → InstanceRef
 *   3. aliases.json 的映射值        → ClassRef / InstanceRef
 *   4. line 层类文件的 name 字段     → 旧 id 改为新类名段（线层没有显示名，先与 id 对齐）
 *
 * 用法：node scripts/structure-remaining-ids.mjs [--write]
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseInstanceId, parseClassId, makeInstanceId } from '../src/shared/atomId.ts'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/remaining-backup')
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
/** 现存实例 id 集合，用来判定结构化后的引用是否悬空 */
const liveInstances = new Set()
const liveClasses = new Set()
for (const layer of LAYERS) {
  for (const cls of catalogs[layer] ?? []) {
    liveClasses.add(cls.id)
    for (const inst of cls.instances ?? []) liveInstances.add(inst.id)
  }
}

/**
 * 字符串 id → InstanceRef。
 * 目标不存在时记 rev=null + dangling=true，而不是丢掉引用。
 */
function toInstanceRef(raw, hint) {
  if (raw && typeof raw === 'object') return raw
  let text = String(raw ?? '').trim()
  if (!text) return null
  if (oldToNew.has(text)) text = oldToNew.get(text)
  const parsed = parseInstanceId(text)
  if (parsed) {
    const id = makeInstanceId(parsed)
    return liveInstances.has(id) ? parsed : { ...parsed, rev: null, dangling: true }
  }
  // 三段但版本号对不上，或层名缺失 → 按位置拆
  const parts = text.replace(/@r\d+$/, '').split('.').filter(Boolean)
  const layer = LAYERS.includes(parts[0]) ? parts[0] : hint
  const rest = LAYERS.includes(parts[0]) ? parts.slice(1) : parts
  if (!layer || rest.length < 2) return null
  return { layer, name: rest[0], instance: rest.slice(1).join('_'), rev: null, dangling: true }
}

/** 字符串类 id → ClassRef */
function toClassRef(raw, hint) {
  if (raw && typeof raw === 'object') return raw
  let text = String(raw ?? '').trim()
  if (!text) return null
  if (oldToNew.has(text)) text = oldToNew.get(text)
  const parsed = parseClassId(text)
  if (parsed) return parsed
  const parts = text.split('.').filter(Boolean)
  const layer = LAYERS.includes(parts[0]) ? parts[0] : hint
  const rest = LAYERS.includes(parts[0]) ? parts.slice(1) : parts
  if (!layer || !rest.length) return null
  return { layer, name: rest.join('_') }
}

/** 旧 id → 新 id（从 id 迁移前的备份重建，用于 aliases 里还存着旧 id 的映射） */
const oldToNew = new Map()
const BACKUP_CATALOG = join(ROOT, '.tmp/migration-backup/build/data/catalog')
if (existsSync(BACKUP_CATALOG)) {
  for (const layer of LAYERS) {
    const bdir = join(BACKUP_CATALOG, layer)
    const cdir = join(ROOT, 'build/data/catalog', layer)
    if (!existsSync(bdir) || !existsSync(cdir)) continue
    const currents = readdirSync(cdir).filter((n) => n.endsWith('.json') && n !== '_index.json')
      .map((n) => JSON.parse(readFileSync(join(cdir, n), 'utf8')))
    for (const name of readdirSync(bdir)) {
      if (!name.endsWith('.json') || name === '_index.json') continue
      const old = JSON.parse(readFileSync(join(bdir, name), 'utf8'))
      const cur = currents.find((c) => c.name === old.name)
      if (!cur) continue
      oldToNew.set(old.id, cur.id)
      const oldInsts = old.instances ?? []
      const curInsts = cur.instances ?? []
      for (let i = 0; i < oldInsts.length; i++) {
        if (!curInsts[i]) continue
        oldToNew.set(oldInsts[i].id ?? `${old.id}.${oldInsts[i].name}@r${oldInsts[i].rev ?? 1}`, curInsts[i].id)
      }
    }
  }
}

const edits = []
const report = { dock: 0, gesture: 0, aliasClass: 0, aliasInstance: 0, lineName: 0 }

// ── 1 + 2. dock / 手势 target ────────────────────────────────
function migrateTargets(data, kindKey) {
  const out = { ...data }
  if (Array.isArray(out.tiles)) {
    out.tiles = out.tiles.map((t) => {
      const hint = t.kind === 'flow' ? 'line' : t.kind === 'point' ? 'point' : undefined
      const ref = toInstanceRef(t.target, hint)
      if (ref) report.dock += 1
      return ref ? { ...t, target: ref } : t
    })
  }
  if (Array.isArray(out.dockTiles)) {
    out.dockTiles = out.dockTiles.map((t) => {
      const hint = t.kind === 'flow' ? 'line' : t.kind === 'point' ? 'point' : undefined
      const ref = toInstanceRef(t.target, hint)
      if (ref) report.dock += 1
      return ref ? { ...t, target: ref } : t
    })
  }
  if (Array.isArray(out.gestures)) {
    out.gestures = out.gestures.map((g) => {
      const hint = g.kind === 'flow' ? 'line' : g.kind === 'point' ? 'point' : undefined
      const ref = toInstanceRef(g.target, hint)
      if (ref) report.gesture += 1
      return ref ? { ...g, target: ref } : g
    })
  }
  return out
}

for (const rel of ['build/data/.dock-data.json', 'build/data/.gesture-data.json', 'src/renderer/src/generatedSurface.json', 'build/data/.panel-data.json']) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) continue
  const data = JSON.parse(readFileSync(p, 'utf8'))
  if (Array.isArray(data)) {
    // .gesture-data.json 是顶层数组
    const out = data.map((g) => {
      const hint = g.kind === 'flow' ? 'line' : g.kind === 'point' ? 'point' : undefined
      const ref = toInstanceRef(g.target, hint)
      if (ref) report.gesture += 1
      return ref ? { ...g, target: ref } : g
    })
    edits.push({ path: p, data: out })
  } else {
    edits.push({ path: p, data: migrateTargets(data) })
  }
}

// ── 3. aliases.json → 结构化映射值 ──────────────────────────
const aliasPath = join(ROOT, 'build/data/aliases.json')
if (existsSync(aliasPath)) {
  const al = JSON.parse(readFileSync(aliasPath, 'utf8'))
  const classes = {}
  for (const [layer, map] of Object.entries(al.classes ?? {})) {
    classes[layer] = {}
    for (const [aliasName, target] of Object.entries(map)) {
      const ref = toClassRef(target, layer)
      classes[layer][aliasName] = ref ?? target
      if (ref) report.aliasClass += 1
    }
  }
  const instances = {}
  for (const [aliasName, target] of Object.entries(al.instances ?? {})) {
    const ref = toInstanceRef(target)
    instances[aliasName] = ref ?? target
    if (ref) report.aliasInstance += 1
  }
  const review = (al.review ?? []).map((item) => {
    if (!item.to) return item
    const ref = toClassRef(item.to) ?? toInstanceRef(item.to)
    if (!ref) return item
    report.aliasReview = (report.aliasReview ?? 0) + 1
    return { ...item, to: ref }
  })
  edits.push({ path: aliasPath, data: { ...al, classes, instances, review } })
}

// ── 4. line 层 name 字段：旧 id → 新类名段 ──────────────────
const lineDir = join(ROOT, 'build/data/catalog/line')
if (existsSync(lineDir)) {
  for (const name of readdirSync(lineDir)) {
    if (!name.endsWith('.json') || name === '_index.json') continue
    const p = join(lineDir, name)
    const cls = JSON.parse(readFileSync(p, 'utf8'))
    if (typeof cls.name === 'string' && /^(flow|line)\./.test(cls.name)) {
      const seg = String(cls.id).split('.').slice(1).join('_')
      edits.push({ path: p, data: { ...cls, name: seg } })
      report.lineName += 1
    }
  }
}

console.log('=== 剩余 id 结构化 ===')
console.log(`dock 目标 ${report.dock} · 手势目标 ${report.gesture} · 类别名 ${report.aliasClass} · 实例别名 ${report.aliasInstance} · 待审 to ${report.aliasReview ?? 0} · 线层 name ${report.lineName}`)
console.log(`涉及文件 ${edits.length} 个`)

if (!WRITE) { console.log('\n加 --write 落盘'); process.exit(0) }

rmSync(BACKUP, { recursive: true, force: true })
mkdirSync(BACKUP, { recursive: true })
for (const e of edits) {
  const rel = e.path.slice(ROOT.length + 1)
  const dest = join(BACKUP, rel)
  mkdirSync(dirname(dest), { recursive: true })
  if (existsSync(e.path)) copyFileSync(e.path, dest)
  writeFileSync(e.path, `${JSON.stringify(e.data, null, 2)}\n`, 'utf8')
}
console.log(`\n已写盘 ${edits.length} 个文件，备份在 .tmp/remaining-backup/`)
