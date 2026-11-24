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
import { parseClassId, parseInstanceId, classSegment, makeInstanceId, isExprRef } from '../src/shared/atomId.ts'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditCatalogDir, diffAgainstRepo, generateFullCatalogs } from './gen-catalogs.mjs'
import { drift as implDrift } from './gen-impl-manifest.mjs'
import { ALIAS_PATH, collectRefs, groupRequirements, makeClassifier } from './reconcile-refs.mjs'

/** 合法段：小写字母数字下划线或中文，不许有点、空格、大写 */
const FLAT_SEGMENT = /^[a-z0-9_\u4e00-\u9fa5]+$/

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

const catalogs = require(resolve(ROOT, 'src/shared/generatedFullCatalogs.json'))
const lineProfiles = require(resolve(ROOT, 'src/shared/generatedLineProfiles.json'))
const bodyProfiles = require(resolve(ROOT, 'src/shared/generatedBodyProfiles.json'))
const surface = require(resolve(ROOT, 'src/renderer/src/generatedSurface.json'))
const settings = require(resolve(ROOT, 'src/renderer/src/generatedSettings.json'))
const requirementFile = require(resolve(ROOT, 'src/shared/requirements.generated.json'))

const LAYERS = ['point', 'line', 'surface', 'body', 'field']
const PRIORITIES = new Set(['P0', 'P1', 'P2'])
const STATUSES = new Set(['active', 'draft', 'archived'])
const EFFECTS = /^(L[0-3]|A[0-3])$/
const PARAM_TYPES = new Set(['text', 'number', 'bool', 'enum', 'file', 'folder', 'json', 'any'])
/** 设置项（generatedSettings.json）用的是另一套类型词汇 */
const SETTING_TYPES = new Set(['enum', 'number', 'bool', 'string', 'path', 'secret', 'text', 'json', 'any'])

const hard = []
const stats = {}
/**
 * 缺口棘轮：只允许下降。
 *
 * 历史上调过一次（140 → 141），原因是**测量纠错而不是新增债务**：
 * 手势 UD「检测 VPN 状态」的 target 指向不存在的 point.vpn.default_status，
 * 在引用还是字符串、expectedLayer='any' 时被分类器静默丢掉，从来没进过缺口统计。
 * 引用结构化之后它被如实报了出来。
 *
 * 真要再上调，必须在提交信息里写清「为什么这不是新债务」。能降就降。
 */
const maxGapsArg = process.argv.find((arg) => arg.startsWith('--max-gaps='))
const maxGaps = maxGapsArg ? Number(maxGapsArg.split('=')[1]) : Number.POSITIVE_INFINITY

let consumedErrors = 0
/** 打印本步状态：只统计本步新增的硬错误 */
function mark() {
  const delta = hard.length - consumedErrors
  consumedErrors = hard.length
  return delta ? `✗ ${delta}` : '✓'
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

    // ── 统一 id 闸门：类 id 必须是 <layer>.<name>，且与所属层一致 ──
    if (typeof item.id === 'string') {
      const parsedClass = parseClassId(item.id)
      if (!parsedClass) {
        hard.push(`${where} 类 id 不是 <layer>.<name> 两段格式: ${item.id}`)
      } else {
        if (parsedClass.layer !== layer) hard.push(`${where} 类 id 的层名 ${parsedClass.layer} 与所在层 ${layer} 不符`)
        if (!FLAT_SEGMENT.test(parsedClass.name)) hard.push(`${where} 类名段不合法（只能小写字母数字下划线）: ${parsedClass.name}`)
        if (parsedClass.name !== classSegment(layer, `${layer}.${parsedClass.name}`)) {
          hard.push(`${where} 类名段不是规范化形态: ${parsedClass.name}`)
        }
      }
    }

    for (const field of ['name', 'family', 'description']) {
      if (!item[field]) hard.push(`${where} 缺少 ${field}`)
    }
    if (!PRIORITIES.has(item.priority)) hard.push(`${where} 非法 priority: ${item.priority}`)
    if (!STATUSES.has(item.status)) hard.push(`${where} 非法 status: ${item.status}`)
    if (!EFFECTS.test(item.effect ?? '')) hard.push(`${where} 非法 effect: ${item.effect}`)
    if (layer === 'field' && !item.landing) {
      hard.push(`${where} 没有 landing —— 设计规定没有落点的 FieldClass 不允许发布`)
    }
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

      // ── 统一 id 闸门：实例 id 必须是 <layer>.<class>.<instance>@r<rev> ──
      if (typeof instance.id === 'string' && typeof item.id === 'string') {
        const parsedInstance = parseInstanceId(instance.id)
        if (!parsedInstance) {
          hard.push(`${where} 实例 id 不是三段 @rN 格式: ${instance.id}`)
        } else {
          if (parsedInstance.layer !== layer) hard.push(`${where} 实例 ${instance.id} 的层名与所在层不符`)
          if (`${parsedInstance.layer}.${parsedInstance.name}` !== item.id) {
            hard.push(`${where} 实例 ${instance.id} 不属于所属类 ${item.id}`)
          }
          if (!FLAT_SEGMENT.test(parsedInstance.instance)) {
            hard.push(`${where} 实例名段不合法: ${parsedInstance.instance}`)
          }
          if (typeof instance.rev === 'number' && parsedInstance.rev !== instance.rev) {
            hard.push(`${where} 实例 ${instance.id} 的 @r${parsedInstance.rev} 与 rev 字段 ${instance.rev} 不一致`)
          }
          // 反算：结构化身份拼回来的 id 必须等于存储值
          const rebuilt = makeInstanceId({
            layer: parsedInstance.layer,
            name: parsedInstance.name,
            instance: parsedInstance.instance,
            rev: instance.rev ?? parsedInstance.rev
          })
          if (rebuilt !== instance.id) hard.push(`${where} 实例 id 无法由结构化身份反算复现: ${instance.id} ≠ ${rebuilt}`)
        }
      }
    }
  }
}
// ── 结构化引用闸门：所有跨层引用的 layer / name / instance 段都必须合法 ──
let refTotal = 0
let refBad = 0
function checkRef(ref, where) {
  if (!ref || typeof ref !== 'object') return
  if (isExprRef(ref)) return
  refTotal += 1
  if (!LAYERS.includes(ref.layer)) { hard.push(`${where} 引用层非法: ${ref.layer}`); refBad += 1; return }
  if (!FLAT_SEGMENT.test(ref.name ?? '')) { hard.push(`${where} 引用类名段非法: ${ref.name}`); refBad += 1 }
  if (ref.instance !== undefined && !FLAT_SEGMENT.test(ref.instance)) {
    hard.push(`${where} 引用实例名段非法: ${ref.instance}`); refBad += 1
  }
  if (ref.dangling === true) {
    // 悬空引用是合法状态：目标还不存在（属于需求），版本必须是 null
    if (ref.rev !== null) { hard.push(`${where} 悬空引用必须 rev=null`); refBad += 1 }
  } else if (ref.rev !== undefined && (!Number.isInteger(ref.rev) || ref.rev < 1)) {
    hard.push(`${where} 引用版本号非法: ${ref.rev}`); refBad += 1
  }
}
for (const [classId, profile] of Object.entries(lineProfiles)) {
  for (const node of profile.nodes ?? []) {
    checkRef(node.pointClass, `${classId}/${node.id}.pointClass`)
    checkRef(node.pointInstance, `${classId}/${node.id}.pointInstance`)
  }
}
for (const [classId, profile] of Object.entries(bodyProfiles)) {
  for (const part of profile.composition ?? []) checkRef(part.class, `${classId}.composition`)
}
for (const panel of surface.panelClasses ?? []) {
  for (const ref of panel.content ?? []) checkRef(ref, `${panel.id}.content`)
  for (const inst of panel.instances ?? []) for (const ref of inst.content ?? []) checkRef(ref, `${panel.id}.${inst.label}.content`)
}

// ── 命名空间隔离：非 Atom 的 id 必须用保留前缀，不许和五层命名空间混用 ──
// Atom   <layer>.<class>[.<instance>@rN]   layer ∈ 五层
// Panel  panel.<name>
// Req    req.<layer>.<class>[.<instance>]
// Group  group.<name>            （尚未实装，先占位）
const ATOM_LAYERS = new Set(LAYERS)
// panel 已收编成 surface 层的一个功能类：surface.panel
// 渲染层看到的 panelClasses 是它的 14 个实例，id 必须是合法的 Atom 实例 id
const panelClass = (catalogs.surface ?? []).find((c) => c.id === 'surface.panel')
if (!panelClass) hard.push('catalog 缺少 surface.panel 类（panel 收编后必须存在）')
else {
  const panelInstanceIds = new Set(panelClass.instances.map((i) => i.id))
  for (const panel of surface.panelClasses ?? []) {
    if (!panelInstanceIds.has(panel.id)) {
      hard.push(`panelClasses 里的 ${panel.id} 不是 surface.panel 的实例`)
    }
  }
  if ((surface.panelClasses ?? []).length !== panelClass.instances.length) {
    hard.push(`panelClasses 数量 ${(surface.panelClasses ?? []).length} 与 surface.panel 实例数 ${panelClass.instances.length} 不符，请跑 npm run data:gen`)
  }
}
for (const req of requirementFile.requirements ?? []) {
  if (!String(req.id ?? '').startsWith('req.')) hard.push(`需求 id 必须用 req. 前缀: ${req.id}`)
  if (!ATOM_LAYERS.has(req.layer)) hard.push(`需求 ${req.id} 的层名非法: ${req.layer}`)
  if (!req.ref || req.ref.layer !== req.layer) hard.push(`需求 ${req.id} 的 ref.layer 与 layer 字段不一致`)
}
for (const section of settings.sections ?? []) {
  if (String(section.id ?? '').includes('.')) hard.push(`设置 section id 不该含点（它是裸 slug）: ${section.id}`)
  if (ATOM_LAYERS.has(section.id)) {
    // 允许，但记一笔：设置 section 和层同名，读代码时容易混
    stats.sectionLayerCollision = (stats.sectionLayerCollision ?? 0) + 1
  }
}

stats.classes = classTotal
stats.instances = instanceTotal
stats.params = paramTotal
console.log(`[2/7] 结构（类 / 实例 / 参数 / 引用）…… ${mark()} ${classTotal} / ${instanceTotal} / ${paramTotal} / ${refTotal}${refBad ? `（坏 ${refBad}）` : ''}`)

// ── 3. 线层图谱 ─────────────────────────────────────────────────
const flowIds = classIds.get('line') ?? new Set()
const pointClassIds = classIds.get('point') ?? new Set()
let profileCount = 0
const executableFlows = []
const orphanProfiles = []
for (const [classId, profile] of Object.entries(lineProfiles)) {
  profileCount += 1
  if (!flowIds.has(classId)) orphanProfiles.push(classId)
  const nodeIds = new Set()
  for (const node of profile.nodes ?? []) {
    if (nodeIds.has(node.id)) hard.push(`${classId} 节点 id 重复: ${node.id}`)
    nodeIds.add(node.id)
    if (node.kind === 'point') {
      if (!node.pointClass) hard.push(`${classId}.${node.id} 是 point 节点但没有 pointClass`)
      else if (!(classIds.get('point') ?? new Set()).has(node.pointClass)) {
        // 跨层引用统一交给第 7 步的五态解析
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
    // 新形态 { class: { layer, name } }；兼容旧的 { layer, ref }
    const ref = part.class ?? (part.layer && part.ref ? { layer: part.layer, name: part.ref } : null)
    if (!ref) { hard.push(`${classId} 的组合项既没有 class 也没有 {layer, ref}`); continue }
    if (!LAYERS.includes(ref.layer)) hard.push(`${classId} 组合引用了非法层: ${ref.layer}`)
    if (!ref.name) hard.push(`${classId} 组合引用的类名为空`)
    else if (!FLAT_SEGMENT.test(ref.name)) hard.push(`${classId} 组合引用的类名段不合法: ${ref.name}`)
  }
}
console.log(`[4/7] 体层组合 / Manifest …… ${mark()} ${compositionParts} 个组合引用`)

// ── 5. 面层资源（面板 / 手势 / 启动坞）──────────────────────────
const tabIds = new Set((surface.dockTabs ?? []).map((tab) => tab.id))
for (const tile of surface.dockTiles ?? []) {
  if (tile.tab && !tabIds.has(tile.tab)) hard.push(`启动坞磁贴 ${tile.id} 指向不存在的 tab: ${tile.tab}`)

}
const gesturePatterns = new Set()
for (const gesture of surface.gestures ?? []) {
  if (gesturePatterns.has(gesture.pattern)) hard.push(`手势模式重复: ${gesture.pattern}`)
  gesturePatterns.add(gesture.pattern)

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

// ── 7. 跨层引用（五态解析）────────────────────────────────────
const instanceClass = new Map()
for (const layer of LAYERS) {
  for (const item of catalogs[layer] ?? []) {
    for (const instance of item.instances ?? []) instanceClass.set(instance.id, item.id)
  }
}
const aliases = existsSync(ALIAS_PATH) ? JSON.parse(readFileSync(ALIAS_PATH, 'utf8')) : null
const refs = collectRefs(lineProfiles, bodyProfiles, surface)
const classify = makeClassifier({ classIds, instanceClass }, aliases)
const classified = refs.map((ref) => ({ ...ref, ...classify(ref) }))

const byStatus = { ok: 0, aliased: 0, 'kind-mismatch': 0, 'layer-mismatch': 0, missing: 0 }
for (const item of classified) byStatus[item.status] += 1

for (const item of classified) {
  if (item.status === 'kind-mismatch') {
    hard.push(`${item.owner}: ${item.ref} 是实例，这里需要类（建议改成 ${item.target}）`)
  } else if (item.status === 'layer-mismatch') {
    hard.push(`${item.owner}: ${item.ref} 属于 ${item.actualLayer} 层，不应出现在 ${item.expectedLayer} 层`)
  } else if (item.status === 'aliased') {
    hard.push(`${item.owner}: ${item.ref} 命中了别名但还没改写，请运行 npm run refs:apply`)
  }
}

const requirements = groupRequirements(classified)
const unmetClasses = requirements.filter((item) => item.type === 'class')
const unmetInstances = requirements.filter((item) => item.type === 'instance')

console.log(`[7/7] 跨层引用 …… ${mark()} ${refs.length} 条`)
console.log(`      已满足 ${byStatus.ok} 条 ｜ 未满足需求 ${requirements.length} 条（${unmetClasses.length} 个类 + ${unmetInstances.length} 个实例）`)
for (const requirement of unmetClasses.slice(0, 5)) {
  console.log(`        · ${String(requirement.requiredBy.length).padStart(2)} 处 ${requirement.capability}`)
}
if (orphanProfiles.length) {
  console.log(`      孤立图谱 ${orphanProfiles.length} 个：${orphanProfiles.join(', ')}`)
}
if (missingProfiles.length) {
  console.log(`      未建图谱的 FlowClass ${missingProfiles.length} 个`)
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
if (requirements.length > maxGaps) {
  console.error(`✗ 未满足需求 ${requirements.length} 条，超过上限 ${maxGaps}`)
  process.exit(1)
}
console.log(`ℹ 未满足需求 ${requirements.length} 条属合法状态（蓝图依赖未实现），加 --max-gaps=N 可做数量棘轮`)
