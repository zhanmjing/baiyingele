#!/usr/bin/env node
/**
 * 把 WGestures 迁移产物导入真实存储。
 *
 *   node scripts/wg-import.mjs                 # 预演（默认不写盘）
 *   node scripts/wg-import.mjs --write         # 落盘，写前自动备份
 *   node scripts/wg-import.mjs --write --replace   # 绑定整段替换（丢掉旧的手工绑定）
 *
 * ## 为什么必须一次写两个文件
 *
 * 绑定指向实例。只写 trigger-bindings.json 不写 point-state.json，就会
 * 出现「绑定指向不存在的实例」—— 点下去报「目标不存在」。
 * 所以两边要么一起写，要么都不写。
 *
 * ## 覆盖语义
 *
 * 默认按 id **upsert**：迁移产物里有的 id 覆盖旧记录，其余旧记录保留。
 * 传 --replace 才整段替换（那会丢掉不在迁移产物里的实例/绑定）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')
const REPLACE = process.argv.includes('--replace')
const MIGRATED = join(ROOT, '.tmp/wgestures-migrated.json')

/** 与主进程一致的数据目录：%APPDATA%/baiying-electron */
function dataDir() {
  const base = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(base, 'baiying-electron')
}

const POINT_STATE = () => join(dataDir(), 'point-state.json')
const TRIGGER_STATE = () => join(dataDir(), 'trigger-bindings.json')

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`✗ 读不了 ${path}：${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temp, path)
}

/** 按 id upsert；replace=true 时直接用新数组 */
function upsertById(existing, incoming, replace) {
  if (replace) return { list: incoming, added: incoming.length, updated: 0, kept: 0 }
  const byId = new Map(existing.map((item) => [item.id, item]))
  let added = 0
  let updated = 0
  for (const item of incoming) {
    if (byId.has(item.id)) updated++
    else added++
    byId.set(item.id, item)
  }
  const list = [...byId.values()]
  return { list, added, updated, kept: list.length - incoming.length }
}

console.log('=== WGestures 迁移落库 ===\n')
console.log(`模式：${WRITE ? '**落盘**' : '预演（加 --write 才写）'}${REPLACE ? ' · 整段替换' : ' · 按 id 覆盖'}`)
console.log(`数据目录：${dataDir()}\n`)

if (!existsSync(MIGRATED)) {
  console.error(`✗ 找不到迁移产物 ${MIGRATED}\n  先跑：node scripts/migrate-wgestures.mjs`)
  process.exit(1)
}

const migrated = readJson(MIGRATED, null)

/**
 * 迁移产物用的是 { classId, instanceId, name, params }，
 * 而 point-state.json 里的实例是 PointInstanceRecord：
 *   { id, name, rev, status, description, params, classId, createdAt, updatedAt }
 * 必须显式映射 —— 直接塞进去的话实例没有 id，绑定全部变成「指向不存在的实例」。
 */
const now = Date.now()
const incomingInstances = (migrated?.instances ?? []).map((item) => ({
  id: item.instanceId,
  name: item.name ?? item.instanceId,
  rev: 1,
  status: 'active',
  description: JSON.stringify(item.params ?? {}),
  params: item.params ?? {},
  classId: item.classId,
  createdAt: now,
  updatedAt: now
}))
const incomingBindings = migrated?.bindings ?? []
console.log(`迁移产物：实例 ${incomingInstances.length} · 绑定 ${incomingBindings.length}`)

// ── 写前校验：每个绑定目标都要能落地 ────────────────────
const oldPoint = readJson(POINT_STATE(), { version: 1, instances: [], runs: [] })
const oldTrigger = readJson(TRIGGER_STATE(), { version: 3, bindings: [] })

const knownIds = new Set([
  ...(Array.isArray(oldPoint.instances) ? oldPoint.instances.map((i) => i.id) : []),
  ...incomingInstances.map((i) => i.id)
])

// 实例 id 形态：层名.类名.实例名@rN
const badInstances = incomingInstances.filter((i) => !/^[a-z]+\.[a-z0-9_]+\.[a-z0-9_]+@r\d+$/.test(String(i.id ?? '')))
if (badInstances.length) {
  console.error(`\n✗ ${badInstances.length} 个实例 id 不合法，拒绝写入：`)
  for (const i of badInstances.slice(0, 5)) console.error(`   ${String(i.id)}`)
  process.exit(1)
}

// 绑定必须是手势来源：缺 source 会被 TriggerStore 归一化成 hotkey，
// 表现就是「手势数 0、热键多 70、全部注册失败」。写前必须拦住。
const wrongSource = incomingBindings.filter((b) => b.source !== 'gesture')
if (wrongSource.length) {
  console.error(`\n✗ ${wrongSource.length} 个绑定 source 不是 gesture，拒绝写入：`)
  for (const b of wrongSource.slice(0, 5)) console.error(`   ${b.id} source=${String(b.source)}`)
  process.exit(1)
}
// 允许空 pattern：有 8 条手势本来就是「右键 + 滚轮」没有方向串，
// 身份完全由 gesture.modifier 决定。空 pattern 只在也没有 modifier 时才是错。
const noPattern = incomingBindings.filter((b) => !b.pattern && !b.gesture?.modifier)
if (noPattern.length) {
  console.error(`\n✗ ${noPattern.length} 个手势绑定缺 pattern，拒绝写入`)
  process.exit(1)
}

const dangling = incomingBindings.filter((b) => !knownIds.has(b.targetId))
if (dangling.length) {
  console.error(`\n✗ ${dangling.length} 个绑定指向不存在的实例，拒绝写入：`)
  for (const b of dangling.slice(0, 5)) console.error(`   ${b.id} → ${b.targetId}`)
  process.exit(1)
}

// 实例表永远 upsert：里面还有大量非手势的点层实例，整段替换会误删
const inst = upsertById(Array.isArray(oldPoint.instances) ? oldPoint.instances : [], incomingInstances, false)
// --replace 只作用于绑定：实例表里还有大量非手势的点层实例，整段替换会误删
const bind = upsertById(Array.isArray(oldTrigger.bindings) ? oldTrigger.bindings : [], incomingBindings, REPLACE)

console.log('\n写入计划：')
console.log(`  实例  旧 ${oldPoint.instances?.length ?? 0} → 新增 ${inst.added} · 覆盖 ${inst.updated} · 保留 ${inst.kept} → 共 ${inst.list.length}`)
console.log(`  绑定  旧 ${oldTrigger.bindings?.length ?? 0} → 新增 ${bind.added} · 覆盖 ${bind.updated} · 保留 ${bind.kept} → 共 ${bind.list.length}`)

// 迁移里被阻塞的那 1 条不进存储，明确报出来
const blocked = migrated?.pending ?? []
if (blocked.length) {
  console.log(`\n⚠ 有 ${blocked.length} 条没迁进来（参数翻不出来，不是我漏了）：`)
  for (const b of blocked) console.log(`   ${b.name ?? b.id}：${b.reason ?? '未知'}`)
}

if (!WRITE) {
  console.log('\n（预演结束，什么都没写。加 --write 落盘。）')
  process.exit(0)
}

// ── 备份 ──────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = join(ROOT, '.tmp/wg-import-backup', stamp)
mkdirSync(backupDir, { recursive: true })
for (const [label, path] of [['point-state', POINT_STATE()], ['trigger-bindings', TRIGGER_STATE()]]) {
  if (existsSync(path)) {
    copyFileSync(path, join(backupDir, `${label}.json`))
  }
}
console.log(`\n已备份到 .tmp/wg-import-backup/${stamp}/`)

// ── 写两个文件 ────────────────────────────────────────
writeJsonAtomic(POINT_STATE(), { ...oldPoint, version: 1, instances: inst.list, runs: oldPoint.runs ?? [] })
writeJsonAtomic(TRIGGER_STATE(), { ...oldTrigger, version: 3, bindings: bind.list })

console.log(`✓ 已写入 ${POINT_STATE()}`)
console.log(`✓ 已写入 ${TRIGGER_STATE()}`)
console.log('\n重启应用后生效。')
