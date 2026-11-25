#!/usr/bin/env node
/**
 * 把面层类的 detail 自由文本转成结构化 slots。
 *
 * 现状：17 个面层类**只声明了 detail 一个参数**，所以 runSurface 只能报
 * 「没有 regions/slots 结构」，渲染不出任何东西。
 *
 * 但 detail 本身已经在编码槽位：
 *   form   "默认 VPN / 自动打开 / 自动连接 / 超时 · settings"   → 4 个字段
 *   dialog "打开 VPN / 我已手动打开 / 取消 · modal"             → 3 个按钮
 *   wizard "选模板 → 绑槽位 → 试运行 · modal"                   → 3 个步骤
 *
 * 所以这次迁移**不发明结构**，只是把已经在文本里的结构显式化。
 *
 * 用法：node scripts/structure-surface-slots.mjs [--write]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/surface-slots-backup')
const DIR = join(ROOT, 'build/data/catalog/surface')

/** 每种面层 kind 的段落到槽位角色的映射。 */
const ROLE_OF = {
  form: 'field',
  wizard: 'step',
  inspector: 'section',
  table: 'column',
  card_grid: 'card',
  tree: 'node',
  command_palette: 'result-group',
  canvas: 'layer',
  dashboard: 'metric',
  run_history: 'timeline',
  diff: 'diff-pane',
  dialog: 'action',
  notification: 'message',
  tray_menu: 'menu-item',
  hud: 'overlay-body',
  metric_card: 'metric',
  // 手势录制板：整块可以画的手势垫
  gesture_recorder: 'gesture-pad'
}

/**
 * 每种面层 kind 的槽位从哪取数（按生命周期分类，不按层分）。
 *
 * 决策树：
 *   会随运行变化？     → run（再定 layer）
 *   是目录声明？       → registry（整层 or 单类）
 *   是本次输入？       → params
 *   永不变化？         → static
 *
 * 这里的判定依据是这个面层类**语义上要展示什么**，不是凭空猜：
 *   run_history / dashboard / diff  展示运行结果 → run
 *   table / tree / inspector        展示目录结构 → registry
 *   form                            展示可编辑配置 → params
 *   wizard / dialog / canvas        展示固定文案或步骤 → static
 */
const SOURCE_OF_KIND = {
  form: { kind: 'params' },
  wizard: { kind: 'static' },
  inspector: { kind: 'registry', layer: 'point' },
  table: { kind: 'registry', layer: 'point' },
  card_grid: { kind: 'registry', layer: 'body' },
  tree: { kind: 'registry', layer: 'point' },
  command_palette: { kind: 'registry' },
  canvas: { kind: 'static' },
  dashboard: { kind: 'run', layer: 'line' },
  run_history: { kind: 'run', layer: 'line' },
  diff: { kind: 'run', layer: 'line' },
  dialog: { kind: 'static' },
  notification: { kind: 'run', layer: 'field' },
  tray_menu: { kind: 'registry', layer: 'line' },
  hud: { kind: 'run', layer: 'point' },
  metric_card: { kind: 'run', layer: 'point' },
  // 录制板：实时方向串来自 run；冲突检查要看 registry（已有绑定）
  gesture_recorder: { kind: 'run', layer: 'line' }
}

/** 给一个槽位算出它的 source */
function sourceOf(kind, slot) {
  const base = SOURCE_OF_KIND[kind] ?? { kind: 'static' }
  if (base.kind === 'params') {
    // 字段名就是配置项名；没有真实 key 时用扁平化后的标签，语义上仍是「配置项」
    return { kind: 'params', key: String(slot.label).trim().replace(/\s+/g, '_') }
  }
  if (base.kind === 'static') {
    // 步骤/按钮的文案本来就是字面量，不是取来的
    return { kind: 'static', value: String(slot.label) }
  }
  if (base.kind === 'registry' && base.layer) {
    return { kind: 'registry', layer: base.layer }
  }
  if (base.kind === 'registry') {
    return { kind: 'registry', layer: 'point' }
  }
  if (base.kind === 'run') {
    return { kind: 'run', layer: base.layer, limit: 20 }
  }
  return { kind: 'static', value: String(slot.label) }
}

/** 从 `... · mount` 里取出挂载位并去掉它 */
function splitMount(detail) {
  const parts = String(detail ?? '').split('·')
  const tail = (parts.pop() ?? '').trim()
  return { body: parts.join('·').trim(), mount: /^[a-z]+$/i.test(tail) ? tail.toLowerCase() : null }
}

/** 段落 → 槽位数组。`a → b → c` 会拆成按顺序的三个槽位。 */
function slotsOf(kind, body) {
  const role = ROLE_OF[kind] ?? 'block'
  const segments = body.split('/').map((s) => s.trim()).filter(Boolean)
  const out = []
  segments.forEach((segment, index) => {
    // 箭头表示「有序序列」，每一环都是一个独立槽位
    const chain = segment.split('→').map((s) => s.trim()).filter(Boolean)
    if (chain.length > 1) {
      chain.forEach((label, stepIndex) => {
        out.push({ id: `${role}-${index + 1}-${stepIndex + 1}`, role, label, order: out.length + 1, source: sourceOf(kind, { label }) })
      })
      return
    }
    out.push({ id: `${role}-${index + 1}`, role, label: segment, order: out.length + 1 })
  })
  // 每个槽位都要有数据来源 —— 没有 source 的槽位等于渲染层自己猜
  return out.map((slot) => ({ ...slot, source: sourceOf(kind, slot) }))
}

const edits = []
const report = []
for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.json') || name === '_index.json') continue
  const path = join(DIR, name)
  const cls = JSON.parse(readFileSync(path, 'utf8'))
  if (!String(cls.id).startsWith('surface.')) continue
  if (cls.id === 'surface.panel') continue // 面板已经是结构化的

  const kind = cls.id.split('.')[1]
  let changed = 0
  for (const instance of cls.instances ?? []) {
    const detail = instance.detail
    if (typeof detail !== 'string') continue

    // 幂等：已经结构化的只补 source，不重算槽位
    if (detail.startsWith('{')) {
      try {
        const existing = JSON.parse(detail)
        if (!Array.isArray(existing.slots)) continue
        let touched = false
        for (const slot of existing.slots) {
          if (slot.source) continue
          slot.source = sourceOf(kind, slot)
          touched = true
        }
        if (touched) {
          instance.detail = JSON.stringify(existing)
          changed += 1
        }
        continue
      } catch {
        continue
      }
    }

    const { body, mount } = splitMount(detail)
    const slots = slotsOf(kind, body)
    instance.detail = JSON.stringify({
      // 原文一律保留：结构化是加信息，不是替换
      detail: String(detail).trim(),
      mount,
      slots,
      slotCount: slots.length
    })
    changed += 1
  }
  if (changed) {
    edits.push({ path, data: cls })
    report.push({ id: cls.id, kind, instances: changed, role: ROLE_OF[kind] ?? 'block' })
  }
}

console.log('=== detail 文本 → 结构化 slots ===')
for (const row of report) console.log(`  ${row.id.padEnd(26)} ${row.kind.padEnd(16)} ${row.instances} 个实例 → 角色 ${row.role}`)
console.log(`\n共 ${report.length} 个类 / ${report.reduce((n, r) => n + r.instances, 0)} 个实例`)

if (!WRITE) { console.log('\n加 --write 落盘'); process.exit(0) }

rmSync(BACKUP, { recursive: true, force: true })
mkdirSync(BACKUP, { recursive: true })
for (const edit of edits) {
  copyFileSync(edit.path, join(BACKUP, edit.path.split(/[\\/]/).pop()))
  writeFileSync(edit.path, `${JSON.stringify(edit.data, null, 2)}\n`, 'utf8')
}
console.log(`\n已写盘 ${edits.length} 个文件，备份在 .tmp/surface-slots-backup/`)
