#!/usr/bin/env node
/**
 * 修两类 id 迁移残留（都是真实缺陷，不是设计）：
 *
 * 1. bodyProfiles 的 manifest.id —— 25/29 还是旧类 id（body.file-preview）
 *    迁移只改了 profile.classId 和对象的键，漏了 manifest 内部那一份。
 *
 * 2. dock tile 里 8 个外网站点的 target 被解析成「类名 = inst」
 *    原值是 inst.site-openai@r1，按位置拆分时把类型标记 inst 当成了类名。
 *    它们其实是 line.open_external_site 的新实例（站点名），还原成
 *    { layer:'line', name:'open_external_site', instance:'openai', rev:null, dangling:true }
 *
 * 用法：node scripts/fix-residual-ids.mjs [--write]
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/residual-backup')
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const oldToNew = new Map()
const BC = join(ROOT, '.tmp/migration-backup/build/data/catalog')
if (existsSync(BC)) {
  for (const layer of LAYERS) {
    const bdir = join(BC, layer)
    const cdir = join(ROOT, 'build/data/catalog', layer)
    if (!existsSync(bdir) || !existsSync(cdir)) continue
    const currents = readdirSync(cdir).filter((n) => n.endsWith('.json') && n !== '_index.json')
      .map((n) => JSON.parse(readFileSync(join(cdir, n), 'utf8')))
    for (const n of readdirSync(bdir)) {
      if (!n.endsWith('.json') || n === '_index.json') continue
      const old = JSON.parse(readFileSync(join(bdir, n), 'utf8'))
      const cur = currents.find((c) => c.name === old.name)
      if (cur) oldToNew.set(old.id, cur.id)
    }
  }
}

const edits = []
const report = { manifestId: 0, dockInst: 0 }

const bodyPath = join(ROOT, 'src/shared/generatedBodyProfiles.json')
const body = JSON.parse(readFileSync(bodyPath, 'utf8'))
for (const [key, profile] of Object.entries(body)) {
  const m = profile.manifest
  if (!m?.id) continue
  const mapped = oldToNew.get(m.id) ?? (LAYERS.some((l) => key.startsWith(l + '.')) ? key : null)
  if (mapped && mapped !== m.id) {
    profile.manifest = { ...m, id: mapped }
    report.manifestId += 1
  }
}
edits.push({ path: bodyPath, data: body })

function fixDockTiles(data) {
  const out = { ...data }
  const fix = (t) => {
    const tg = t.target
    if (!tg || typeof tg !== 'object' || tg.name !== 'inst') return t
    const site = String(tg.instance ?? '').replace(/^site_/, '')
    if (!site) return t
    report.dockInst += 1
    return { ...t, target: { layer: 'line', name: 'open_external_site', instance: site, rev: null, dangling: true } }
  }
  if (Array.isArray(out.dockTiles)) out.dockTiles = out.dockTiles.map(fix)
  if (Array.isArray(out.tiles)) out.tiles = out.tiles.map(fix)
  return out
}
for (const rel of ['src/renderer/src/generatedSurface.json', 'build/data/.dock-data.json']) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) continue
  const data = JSON.parse(readFileSync(p, 'utf8'))
  edits.push({ path: p, data: Array.isArray(data) ? data.map(fixDockTiles) : fixDockTiles(data) })
}

console.log('=== 修残留 id ===')
console.log(`manifest.id ${report.manifestId} · dock inst 误判 ${report.dockInst} · 文件 ${edits.length} 个`)
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
console.log(`\n已写盘 ${edits.length} 个文件，备份在 .tmp/residual-backup/`)
