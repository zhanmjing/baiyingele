#!/usr/bin/env node
/**
 * 生成 src/renderer/src/generatedSurface.json。
 *
 * 这个文件以前是手写的（名字却叫 generated），而且 panelClasses 和
 * build/data/.panel-data.json 是两份重复数据。现在：
 *
 *   panelClasses  ← catalog 里 surface.panel 的 14 个实例（唯一真相）
 *   gestures      ← build/data/.gesture-data.json
 *   dockTabs/Tiles← build/data/.dock-data.json
 *
 * 用法：node scripts/gen-surface-view.mjs [--write]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const OUT = join(ROOT, 'src/renderer/src/generatedSurface.json')

const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
const panelClass = (catalogs.surface ?? []).find((c) => c.id === 'surface.panel')
if (!panelClass) {
  console.error('catalog 里没有 surface.panel，先跑 npm run data:gen')
  process.exit(1)
}

/** 面板实例 → 渲染层期望的 PanelClass 形状（content 保持旧字段名，值仍是结构化引用数组） */
const panelClasses = panelClass.instances.map((inst) => {
  const p = inst.params ?? {}
  return {
    id: inst.id,
    name: inst.name,
    icon: p.icon ?? '',
    group: p.group ?? '',
    desc: p.desc ?? inst.description ?? '',
    modes: p.modes ?? [],
    regions: p.regions ?? [],
    content: p.pages ?? [],
    states: p.states ?? [],
    behaviors: p.behaviors ?? [],
    a11y: p.a11y ?? [],
    version: inst.id.match(/@r\d+$/)?.[0].slice(2) ?? '1',
    status: inst.status,
    instances: (p.applications ?? []).map((a) => ({
      label: a.label,
      content: a.pages ?? [],
      mode: a.mode,
      width: a.width,
      state: a.state,
      data: a.data,
      actions: a.actions ?? [],
      rev: a.rev ?? 1,
      status: a.status ?? 'active'
    }))
  }
})

const gestures = existsSync(join(ROOT, 'build/data/.gesture-data.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'build/data/.gesture-data.json'), 'utf8'))
  : []
const dock = existsSync(join(ROOT, 'build/data/.dock-data.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'build/data/.dock-data.json'), 'utf8'))
  : { tabs: [], tiles: [] }

const out = {
  panelClasses,
  gestures: Array.isArray(gestures) ? gestures : [],
  dockTabs: dock.tabs ?? [],
  dockTiles: dock.tiles ?? []
}

console.log('=== 生成 generatedSurface.json ===')
console.log(`panelClasses ${panelClasses.length} · 应用记录 ${panelClasses.reduce((n, p) => n + p.instances.length, 0)} · 手势 ${out.gestures.length} · dockTab ${out.dockTabs.length} · dockTile ${out.dockTiles.length}`)
if (!WRITE) { console.log('\n加 --write 落盘'); process.exit(0) }
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
console.log(`已写出 ${OUT}`)
