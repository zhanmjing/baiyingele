#!/usr/bin/env node
/**
 * 归档「孤儿实例」：classId 不在当前目录里的实例。
 *
 *   node scripts/archive-orphans.mjs            # 预演
 *   node scripts/archive-orphans.mjs --write    # 落盘（写前备份）
 *
 * ## 为什么会有孤儿
 *
 * 项目从旧轨（win.*）迁到新轨（point.*）时只改了目录和实现单元，
 * 存储里的历史实例没跟着迁。结果：
 *   · 点层页面按目录渲染 → 这些实例永远看不见
 *   · 但存储里还在，运行时会命中「未知类」
 *   · 以前直接 throw，UI 点一下就是未捕获异常弹窗
 *
 * 归档而不是删除：数据保留、可恢复，界面上不再出现，运行也不会再命中。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
const dataDir = join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'baiying-electron')

console.log('=== 归档孤儿实例 ===\n')
console.log(`模式：${WRITE ? '**落盘**' : '预演（加 --write 才写）'}`)
console.log(`数据目录：${dataDir}\n`)

let totalOrphans = 0
const plan = []

for (const layer of LAYERS) {
  const file = join(dataDir, `${layer}-state.json`)
  if (!existsSync(file)) continue
  const state = JSON.parse(readFileSync(file, 'utf8'))
  const known = new Set((catalogs[layer] ?? []).map((c) => c.id))
  const orphans = (state.instances ?? []).filter((i) => !known.has(i.classId) && i.status !== 'archived')
  if (!orphans.length) continue

  totalOrphans += orphans.length
  const byClass = {}
  for (const i of orphans) byClass[i.classId] = (byClass[i.classId] ?? 0) + 1
  plan.push({ layer, file, state, orphans })
  console.log(`${layer}: ${orphans.length} 个孤儿（目录里有 ${known.size} 个类）`)
  for (const [classId, count] of Object.entries(byClass).slice(0, 6)) console.log(`   ${classId} × ${count}`)
  if (Object.keys(byClass).length > 6) console.log(`   … 还有 ${Object.keys(byClass).length - 6} 个类`)
}

if (!totalOrphans) {
  console.log('没有孤儿实例，无需处理。')
  process.exit(0)
}

console.log(`\n合计 ${totalOrphans} 个待归档实例。`)

if (!WRITE) {
  console.log('\n（预演结束，什么都没写。加 --write 落盘。）')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = join(ROOT, '.tmp/archive-backup', stamp)
mkdirSync(backupDir, { recursive: true })

for (const { layer, file, state, orphans } of plan) {
  copyFileSync(file, join(backupDir, `${layer}-state.json`))
  const ids = new Set(orphans.map((i) => i.id))
  const now = Date.now()
  state.instances = state.instances.map((i) =>
    ids.has(i.id) ? { ...i, status: 'archived', updatedAt: now } : i
  )
  const temp = `${file}.tmp`
  writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8')
  renameSync(temp, file)
  console.log(`✓ ${layer}: 归档 ${orphans.length} 个`)
}

console.log(`\n已备份到 .tmp/archive-backup/${stamp}/`)
console.log('重启应用后生效。')
