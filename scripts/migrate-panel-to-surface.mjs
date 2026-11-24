#!/usr/bin/env node
/**
 * 把 panel 收编成 surface 层的一个功能类。
 *
 * 之前 panel 是和 surface 并列的另一套模型（14 个「类」，各有自己的 instances），
 * 但从数据上看它们的字段集完全一致 —— 那是「同一个类被写了 14 遍」。
 *
 * 收编后：
 *   surface.panel                 类（1 个）
 *     └ surface.panel.<name>@rN   实例（14 个，原 panel.* ）
 *          └ detail 里存 applications（原 37 个 sub-entry）
 *
 * 只读预演；--write 落盘。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/panel-backup')
const SURFACE_DIR = join(ROOT, 'build/data/catalog/surface')

const flat = (n) => String(n).normalize('NFKC').trim()
  .replace(/[.\-\s]+/g, '_').replace(/[^\w\u4e00-\u9fa5]+/g, '_')
  .replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()

const src = JSON.parse(readFileSync(join(ROOT, 'src/renderer/src/generatedSurface.json'), 'utf8'))
const panels = src.panelClasses ?? []
if (!panels.length) { console.log('没有 panelClasses，可能已经迁移过'); process.exit(0) }

const cls = {
  id: 'surface.panel',
  name: '面板',
  group: 'layout',
  version: '1.0.0',
  status: 'active',
  effect: 'L0',
  priority: 'P0',
  summary: '可挂载的容器：把页面承载到工作区的某个区域（右栏 / 浮窗 / 模态 / 底部 / 抽屉）。'
}

const instances = panels.map((p) => {
  const name = String(p.id).replace(/^panel\./, '')
  const detail = {
    icon: p.icon,
    group: p.group,
    desc: p.desc,
    modes: p.modes ?? [],
    regions: p.regions ?? [],
    pages: p.content ?? [],
    states: p.states ?? [],
    behaviors: p.behaviors ?? [],
    a11y: p.a11y ?? [],
    // 原来 37 条 sub-entry → 应用记录；content 改名为 pages，语义更直白
    applications: (p.instances ?? []).map((a) => ({
      label: a.label,
      pages: a.content ?? [],
      mode: a.mode,
      width: a.width,
      state: a.state,
      data: a.data,
      actions: a.actions ?? [],
      rev: a.rev ?? 1,
      status: a.status ?? 'active'
    }))
  }
  return {
    id: `surface.panel.${flat(name)}@r1`,
    name: p.name,
    rev: 1,
    status: 'active',
    detail: JSON.stringify(detail)
  }
})

const out = { ...cls, instances }
console.log('=== panel → surface.panel ===')
console.log(`类 ${cls.id} · 实例 ${instances.length} 个 · 应用记录 ${instances.reduce((n, i) => n + JSON.parse(i.detail).applications.length, 0)} 条`)
for (const i of instances.slice(0, 3)) {
  const d = JSON.parse(i.detail)
  console.log(`  ${i.id.padEnd(34)} ${String(i.name).padEnd(18)} 模式 ${d.modes.join('/')} · 应用 ${d.applications.length}`)
}

if (!WRITE) { console.log('\n加 --write 落盘'); process.exit(0) }

rmSync(BACKUP, { recursive: true, force: true })
mkdirSync(BACKUP, { recursive: true })
const classPath = join(SURFACE_DIR, 'surface.panel.json')
if (existsSync(classPath)) copyFileSync(classPath, join(BACKUP, 'surface.panel.json'))
writeFileSync(classPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')

// _index.json 追加 surface.panel
const indexPath = join(SURFACE_DIR, '_index.json')
copyFileSync(indexPath, join(BACKUP, '_index.json'))
const index = JSON.parse(readFileSync(indexPath, 'utf8'))
if (!index.order.includes('surface.panel')) {
  index.order.push('surface.panel')
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
}

// 旧的手写 panel 数据不再需要（真相源已经搬进 catalog）
const panelDataPath = join(ROOT, 'build/data/.panel-data.json')
if (existsSync(panelDataPath)) {
  copyFileSync(panelDataPath, join(BACKUP, '.panel-data.json'))
  rmSync(panelDataPath)
}

console.log(`\n已写出 ${classPath}，_index 已追加，旧 .panel-data.json 已移除（备份在 .tmp/panel-backup/）`)
