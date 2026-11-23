#!/usr/bin/env node
/**
 * 五层目录 / 图谱 / 设置的一致性校验。
 *
 * 分两类问题：
 *   硬错误 —— 结构坏了，必须修（重复 ID、非法枚举、生成器漂移、边指向不存在的节点）
 *   软问题  —— 跨层引用悬空（体层组合、线层绑定、启动坞/手势目标）
 *
 * 用法：
 *   node scripts/validate-catalog.mjs            # 软问题只报告，不阻塞
 *   node scripts/validate-catalog.mjs --strict   # 软问题也让退出码为 1
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diffAgainstRepo, generateFullCatalogs } from './gen-catalogs.mjs'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

const catalogs = require(resolve(ROOT, 'src/shared/generatedFullCatalogs.json'))
const lineProfiles = require(resolve(ROOT, 'src/shared/generatedLineProfiles.json'))
const bodyProfiles = require(resolve(ROOT, 'src/shared/generatedBodyProfiles.json'))
const surface = require(resolve(ROOT, 'src/renderer/src/generatedSurface.json'))
const settings = require(resolve(ROOT, 'src/renderer/src/generatedSettings.json'))

const LAYERS = ['point', 'line', 'surface', 'body', 'field']
const PRIORITIES = new Set(['P0', 'P1', 'P2'])
const STATUSES = new Set(['active', 'draft', 'archived'])
const EFFECTS = /^(L[0-3]|A[0-3])$/
const PARAM_TYPES = new Set(['text', 'number', 'bool', 'enum', 'file', 'folder', 'json', 'any'])
/** 设置项（generatedSettings.json）用的是另一套类型词汇 */
const SETTING_TYPES = new Set(['enum', 'number', 'bool', 'string', 'path', 'secret', 'text', 'json', 'any'])

const hard = []
const soft = new Map()
const stats = {}

let consumedErrors = 0
/** 打印本步状态：只统计本步新增的硬错误 */
function mark() {
  const delta = hard.length - consumedErrors
  consumedErrors = hard.length
  return delta ? `✗ ${delta}` : '✓'
}

function softAdd(kind, message) {
  if (!soft.has(kind)) soft.set(kind, [])
  soft.get(kind).push(message)
}

// ── 1. 目录生成一致性 ────────────────────────────────────────────
const drift = diffAgainstRepo(generateFullCatalogs())
if (drift.length) {
  for (const line of drift.slice(0, 20)) hard.push(`目录漂移: ${line}`)
  hard.push(`目录与 build/data 不一致，共 ${drift.length} 处；请运行 npm run data:gen`)
}
console.log(`[1/7] 目录生成一致性 …… ${drift.length ? `✗ ${drift.length} 处漂移` : '✓'}`)

// ── 2. 结构：层 / 类 / 实例 ──────────────────────────────────────
const classIds = new Map()
const instanceIds = new Map()
let classTotal = 0
let instanceTotal = 0
let paramTotal = 0

for (const layer of LAYERS) {
  const classes = catalogs[layer]
  if (!Array.isArray(classes) || classes.length === 0) {
    hard.push(`层 ${layer} 缺失或为空`)
    continue
  }
  classIds.set(layer, new Set())
  for (const item of classes) {
    classTotal += 1
    const where = `${layer}:${item.id ?? '?'}`

    if (!item.id || typeof item.id !== 'string') hard.push(`${where} 缺少 id`)
    else if (classIds.get(layer).has(item.id)) hard.push(`${where} id 重复`)
    else classIds.get(layer).add(item.id)

    for (const field of ['name', 'family', 'description']) {
      if (!item[field]) hard.push(`${where} 缺少 ${field}`)
    }
    if (!PRIORITIES.has(item.priority)) hard.push(`${where} 非法 priority: ${item.priority}`)
    if (!STATUSES.has(item.status)) hard.push(`${where} 非法 status: ${item.status}`)
    if (!EFFECTS.test(item.effect ?? '')) hard.push(`${where} 非法 effect: ${item.effect}`)
    if (!Array.isArray(item.params)) hard.push(`${where} params 不是数组`)
    if (!Array.isArray(item.instances)) hard.push(`${where} instances 不是数组`)

    const paramKeys = new Set()
    for (const param of item.params ?? []) {
      paramTotal += 1
      if (!param.key) hard.push(`${where} 存在无 key 的参数`)
      else if (paramKeys.has(param.key)) hard.push(`${where} 参数 key 重复: ${param.key}`)
      else paramKeys.add(param.key)
      if (!PARAM_TYPES.has(param.type)) hard.push(`${where}.${param.key} 非法参数类型: ${param.type}`)
      if (typeof param.required !== 'boolean') hard.push(`${where}.${param.key} required 必须是布尔值`)
    }

    for (const instance of item.instances ?? []) {
      instanceTotal += 1
      if (!instance.id) hard.push(`${where} 存在无 id 的实例`)
      else if (instanceIds.has(instance.id)) {
        hard.push(`实例 id 全局重复: ${instance.id}（${instanceIds.get(instance.id)} 与 ${where}）`)
      } else instanceIds.set(instance.id, where)
      if (!STATUSES.has(instance.status)) hard.push(`${where}.${instance.id} 非法 status: ${instance.status}`)
      if (typeof instance.rev !== 'number') hard.push(`${where}.${instance.id} rev 必须是数字`)
    }
  }
}
stats.classes = classTotal
stats.instances = instanceTotal
stats.params = paramTotal
console.log(`[2/7] 结构（类 / 实例 / 参数）…… ${mark()} ${classTotal} / ${instanceTotal} / ${paramTotal}`)

// ── 3. 线层图谱 ─────────────────────────────────────────────────
const flowIds = classIds.get('line') ?? new Set()
const pointClassIds = classIds.get('point') ?? new Set()
let profileCount = 0
const executableFlows = []
for (const [classId, profile] of Object.entries(lineProfiles)) {
  profileCount += 1
  if (!flowIds.has(classId)) softAdd('图谱 → 无对应 FlowClass', classId)
  const nodeIds = new Set()
  for (const node of profile.nodes ?? []) {
    if (nodeIds.has(node.id)) hard.push(`${classId} 节点 id 重复: ${node.id}`)
    nodeIds.add(node.id)
    if (node.kind === 'point') {
      if (!node.pointClass) hard.push(`${classId}.${node.id} 是 point 节点但没有 pointClass`)
      else if (!(classIds.get('point') ?? new Set()).has(node.pointClass)) {
        softAdd('线层节点 → PointClass', `${classId}.${node.id} → ${node.pointClass}`)
      }
      if (node.pointInstance && !instanceIds.has(node.pointInstance)) {
        softAdd('线层节点 → PointInstance', `${classId}.${node.id} → ${node.pointInstance}`)
      }
    }
  }
  const pointNodes = (profile.nodes ?? []).filter((node) => node.kind === 'point')
  const resolvable = pointNodes.filter(
    (node) => pointClassIds.has(node.pointClass) && instanceIds.has(node.pointInstance)
  ).length
  if (pointNodes.length && resolvable === pointNodes.length) executableFlows.push(classId)
  for (const edge of profile.edges ?? []) {
    if (!nodeIds.has(edge.from)) hard.push(`${classId} 边引用了不存在的节点: ${edge.from}`)
    if (!nodeIds.has(edge.to)) hard.push(`${classId} 边引用了不存在的节点: ${edge.to}`)
  }
}
const missingProfiles = [...flowIds].filter((id) => !lineProfiles[id])
console.log(`[3/7] 线层图谱 …… ${mark()} ${profileCount}/${flowIds.size} 个 FlowClass 有图谱`)
console.log(`      可端到端执行：${executableFlows.length ? executableFlows.join(', ') : '（无——所有图谱都还有悬空绑定）'}`)

// ── 4. 体层组合 / Manifest ──────────────────────────────────────
const bodyIds = classIds.get('body') ?? new Set()
let compositionParts = 0
for (const [classId, profile] of Object.entries(bodyProfiles)) {
  if (!bodyIds.has(classId)) hard.push(`体层 profile ${classId} 没有对应的 BodyClass`)
  if (!profile.manifest) hard.push(`${classId} 缺少 manifest`)
  else {
    for (const field of ['id', 'version', 'channel', 'signature', 'digest']) {
      if (!profile.manifest[field]) hard.push(`${classId}.manifest 缺少 ${field}`)
    }
  }
  for (const part of profile.composition ?? []) {
    compositionParts += 1
    if (!LAYERS.includes(part.layer)) hard.push(`${classId} 组合引用了非法层: ${part.layer}`)
    else if (!(classIds.get(part.layer) ?? new Set()).has(part.ref)) {
      softAdd('体层组合 → 目标类', `${classId} → ${part.layer}:${part.ref}`)
    }
  }
}
console.log(`[4/7] 体层组合 / Manifest …… ${mark()} ${compositionParts} 个组合引用`)

// ── 5. 面层资源（面板 / 手势 / 启动坞）──────────────────────────
const tabIds = new Set((surface.dockTabs ?? []).map((tab) => tab.id))
for (const tile of surface.dockTiles ?? []) {
  if (tile.tab && !tabIds.has(tile.tab)) hard.push(`启动坞磁贴 ${tile.id} 指向不存在的 tab: ${tile.tab}`)
  if (tile.target && !instanceIds.has(tile.target)) {
    softAdd('启动坞 / 手势 → 实例', `${tile.id} → ${tile.target}`)
  }
}
const gesturePatterns = new Set()
for (const gesture of surface.gestures ?? []) {
  if (gesturePatterns.has(gesture.pattern)) hard.push(`手势模式重复: ${gesture.pattern}`)
  gesturePatterns.add(gesture.pattern)
  if (gesture.target && !instanceIds.has(gesture.target)) {
    softAdd('启动坞 / 手势 → 实例', `手势 ${gesture.pattern} → ${gesture.target}`)
  }
}
console.log(`[5/7] 面层资源 …… ${mark()} ${(surface.panelClasses ?? []).length} PanelClass / ${(surface.dockTiles ?? []).length} Tile / ${(surface.gestures ?? []).length} 手势`)

// ── 6. 设置 ────────────────────────────────────────────────────
const settingKeys = new Set()
let settingCount = 0
for (const section of settings.sections ?? []) {
  for (const group of section.groups ?? []) {
    for (const setting of group.settings ?? []) {
      settingCount += 1
      if (settingKeys.has(setting.key)) hard.push(`设置 key 重复: ${setting.key}`)
      settingKeys.add(setting.key)
      if (setting.type && !SETTING_TYPES.has(setting.type)) {
        hard.push(`设置 ${setting.key} 非法类型: ${setting.type}`)
      }
    }
  }
}
stats.settings = settingCount
console.log(`[6/7] 设置 …… ${mark()} ${(settings.sections ?? []).length} section / ${settingCount} 项`)

// ── 7. 跨层引用（软）────────────────────────────────────────────
const softTotal = [...soft.values()].reduce((sum, list) => sum + list.length, 0)
console.log(`[7/7] 跨层引用 …… ${softTotal ? `⚠ ${softTotal} 处未解析` : '✓'}`)
for (const [kind, list] of [...soft.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`      ${kind.padEnd(24)} ${String(list.length).padStart(3)}`)
  for (const sample of list.slice(0, 3)) console.log(`        · ${sample}`)
  if (list.length > 3) console.log(`        … 其余 ${list.length - 3} 条`)
}
if (missingProfiles.length) {
  console.log(`      另外 ${missingProfiles.length} 个 FlowClass 没有数据流图谱：${missingProfiles.join(', ')}`)
}

// ── 汇总 ───────────────────────────────────────────────────────
console.log('')
if (hard.length) {
  console.error(`✗ 硬错误 ${hard.length} 条：`)
  for (const line of hard.slice(0, 40)) console.error(`  · ${line}`)
  if (hard.length > 40) console.error(`  … 其余 ${hard.length - 40} 条`)
  process.exit(1)
}
console.log('✓ 无硬错误')
if (softTotal && strict) {
  console.error(`✗ --strict：跨层引用有 ${softTotal} 处未解析`)
  process.exit(1)
}
if (softTotal) {
  console.log(`⚠ 跨层引用有 ${softTotal} 处未解析（加 --strict 可让此项阻塞构建）`)
}
