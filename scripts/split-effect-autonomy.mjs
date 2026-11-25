#!/usr/bin/env node
/**
 * 拆开 effect 与 autonomy 两个正交的轴。
 *
 * 现状（实测）：23 个场层类的 effect 字段里存的是 A0 / A1 / A2，
 * 而其他 4 层存的是 L0 / L1 / L2。同一个字段两套语义。
 *
 * 后果（真 bug）：main/index.ts 里
 *     decideLanding(context.pointClass.effect, outcome.landing)
 * 参数名要的是 autonomy，传的却是 effect。今天能跑，纯粹因为场层类的
 * effect 字段里恰好是 A 码。谁要是「统一一下 effect 用 L 编码」，场层
 * 落地决策会立刻全部 refuse: 未知自主度 L0。
 *
 * 拆法：
 *   autonomy  保留原来的 A0/A1/A2（自主度上限）
 *   effect    统一成 L 码（副作用等级）
 *
 * 场层类的 effect 一律 L0 —— 它们**计算**，不**行动**。真正的副作用发生在
 * fieldRuntime.applyLanding 里，等级由落点目标那一层决定。这是两个轴正交的
 * 直接体现：一个能力可以「无副作用（L0）」同时「允许自动应用（A2）」。
 *
 * 用法：node scripts/split-effect-autonomy.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/effect-autonomy-backup')
const DIR = join(ROOT, 'build/data/catalog/field')

const edits = []
const summary = {}
for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.json') || name === '_index.json') continue
  const path = join(DIR, name)
  const cls = JSON.parse(readFileSync(path, 'utf8'))
  const effect = String(cls.effect ?? '')
  // 判据是 effect 里存的是 A 码（说明这个轴被占用了）
  if (!/^A[0-2]$/.test(effect)) continue

  // 类文件里本来就有 autonomy 字段（实测 23/23 都有），只是 gen-catalogs 没传下去。
  // 所以这里不用新建，只要把被占用的 effect 让出来。
  if (!cls.autonomy) cls.autonomy = effect
  cls.effect = 'L0'
  edits.push({ path, data: cls })
  summary[effect] = (summary[effect] ?? 0) + 1
}

console.log('=== effect / autonomy 拆分 ===')
console.log(`场层 ${edits.length} 个类：autonomy 保留原值，effect 统一为 L0`)
for (const [a, n] of Object.entries(summary).sort()) console.log(`  ${a}: ${n} 个`)

if (!WRITE) { console.log('\n加 --write 落盘'); process.exit(0) }

rmSync(BACKUP, { recursive: true, force: true })
mkdirSync(BACKUP, { recursive: true })
for (const edit of edits) {
  copyFileSync(edit.path, join(BACKUP, edit.path.split(/[\\/]/).pop()))
  writeFileSync(edit.path, `${JSON.stringify(edit.data, null, 2)}\n`, 'utf8')
}
console.log(`\n已写盘 ${edits.length} 个文件，备份在 .tmp/effect-autonomy-backup/`)
