#!/usr/bin/env node
/**
 * 跨层引用解析器。
 *
 * 把「悬空引用」这一个模糊概念拆成五种可处置的状态：
 *   ok              目标存在
 *   aliased         名字漂移，可通过 build/data/aliases.json 映射到已有类
 *   kind-mismatch   引用了实例，但这里需要的是类
 *   layer-mismatch  层放错了（例如点层里写了 surface.show）
 *   missing         真的没有这个能力 → 转成 Requirement，而不是当成错误
 *
 * 用法：
 *   node scripts/reconcile-refs.mjs            只读，打印分类报告
 *   node scripts/reconcile-refs.mjs --write    同时写出 requirements.generated.json
 *   node scripts/reconcile-refs.mjs --apply    按 aliases.json 改写引用（会改文件）
 */
import { classIdOf, instanceIdOf, isExprRef } from '../src/shared/atomId.ts'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CATALOG_PATH = resolve(ROOT, 'src/shared/generatedFullCatalogs.json')
const LINE_PROFILE_PATH = resolve(ROOT, 'src/shared/generatedLineProfiles.json')
const BODY_PROFILE_PATH = resolve(ROOT, 'src/shared/generatedBodyProfiles.json')
const SURFACE_PATH = resolve(ROOT, 'src/renderer/src/generatedSurface.json')
const ALIAS_PATH = resolve(ROOT, 'build/data/aliases.json')
const REQUIREMENTS_OUT = resolve(ROOT, 'src/shared/requirements.generated.json')
const CHANGES_OUT = resolve(ROOT, 'build/data/reconcile-changes.json')

/** 层独占的 id 前缀：出现这些前缀说明引用放错了层 */
const EXCLUSIVE_DOMAIN = { flow: 'line', surface: 'surface', body: 'body', field: 'field' }

const flags = new Set(process.argv.slice(2))

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8')
}

function buildIndex() {
  const catalogs = loadJson(CATALOG_PATH)
  const classIds = new Map()
  const instanceClass = new Map()
  for (const layer of Object.keys(catalogs)) {
    classIds.set(layer, new Set())
    for (const item of catalogs[layer]) {
      classIds.get(layer).add(item.id)
      for (const instance of item.instances ?? []) instanceClass.set(instance.id, item.id)
    }
  }
  return { catalogs, classIds, instanceClass }
}

/** 兼容新的结构化形态与旧的 {layer, ref} 形态 */
const classRefOf = (part) =>
  part?.class ?? (part?.layer && part?.ref ? { layer: part.layer, name: part.ref } : null)

/** 采集所有跨层引用，并记住它可以被改写的位置 */
function collectRefs(lineProfiles, bodyProfiles, surface) {
  const refs = []

  for (const [ownerId, profile] of Object.entries(bodyProfiles)) {
    ;(profile.composition ?? []).forEach((part, index) => {
      refs.push({
        where: 'body.composition',
        owner: ownerId,
        expectedLayer: classRefOf(part)?.layer,
        ref: classIdOf(classRefOf(part)),
        kind: 'class',
        required: part.required !== false,
        role: part.role,
        locator: { file: 'body', ownerId, index }
      })
    })
  }

  for (const [classId, profile] of Object.entries(lineProfiles)) {
    for (const node of profile.nodes ?? []) {
      if (node.kind !== 'point') continue
      if (node.pointClass) {
        refs.push({
          where: 'line.node.pointClass',
          owner: `${classId}/${node.id}`,
          expectedLayer: node.pointClass?.layer ?? 'point',
          ref: classIdOf(node.pointClass),
          kind: 'class',
          required: true,
          role: node.role,
          locator: { file: 'line', classId, nodeId: node.id, field: 'pointClass' }
        })
      }
      if (node.pointInstance) {
        refs.push({
          where: 'line.node.pointInstance',
          owner: `${classId}/${node.id}`,
          expectedLayer: node.pointInstance?.layer ?? 'point',
          ref: instanceIdOf(node.pointInstance),
          kind: 'instance',
          required: true,
          role: node.role,
          locator: { file: 'line', classId, nodeId: node.id, field: 'pointInstance' }
        })
      }
    }
  }

  for (const tile of surface.dockTiles ?? []) {
    if (!tile.target) continue
    refs.push({
      where: 'dock.tile.target',
      owner: tile.id,
      expectedLayer: 'any',
      ref: tile.target,
      kind: 'instance',
      required: true,
      role: tile.name,
      locator: { file: 'surface', collection: 'dockTiles', id: tile.id, field: 'target' }
    })
  }

  for (const gesture of surface.gestures ?? []) {
    if (!gesture.target) continue
    refs.push({
      where: 'gesture.target',
      owner: gesture.pattern,
      expectedLayer: 'any',
      ref: gesture.target,
      kind: 'instance',
      required: true,
      role: gesture.name,
      locator: { file: 'surface', collection: 'gestures', id: gesture.pattern, field: 'target' }
    })
  }

  return refs
}

function makeClassifier({ classIds, instanceClass }, aliases) {
  const classAliases = aliases?.classes ?? {}
  const instanceAliases = aliases?.instances ?? {}

  return (ref) => {
    if (ref.kind === 'instance') {
      if (instanceClass.has(ref.ref)) return { status: 'ok' }
      const alias = instanceAliases[ref.ref]
      if (alias && instanceClass.has(alias)) return { status: 'aliased', target: alias }
      return { status: 'missing', requirement: { type: 'instance', capability: `point:${ref.ref}` } }
    }

    if (classIds.get(ref.expectedLayer)?.has(ref.ref)) return { status: 'ok' }

    const alias = classAliases[ref.expectedLayer]?.[ref.ref]
    if (alias && classIds.get(ref.expectedLayer)?.has(alias)) {
      return { status: 'aliased', target: alias }
    }
    if (alias) {
      return { status: 'missing', requirement: { type: 'class', capability: `${ref.expectedLayer}:${alias}`, badAlias: alias } }
    }

    if (instanceClass.has(ref.ref)) {
      return { status: 'kind-mismatch', target: instanceClass.get(ref.ref) }
    }

    const domainLayer = EXCLUSIVE_DOMAIN[String(ref.ref).split('.')[0]]
    if (domainLayer && domainLayer !== ref.expectedLayer) {
      return { status: 'layer-mismatch', actualLayer: domainLayer }
    }

    return { status: 'missing', requirement: { type: 'class', capability: `${ref.expectedLayer}:${ref.ref}` } }
  }
}

function groupRequirements(classified) {
  const groups = new Map()
  for (const item of classified) {
    if (item.status !== 'missing') continue
    const key = `${item.requirement.capability}#${item.requirement.type}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: `req:${item.requirement.capability.replace(':', '.')}${item.requirement.type === 'instance' ? '.instance' : ''}`,
        layer: item.requirement.capability.split(':')[0],
        capability: item.requirement.capability,
        type: item.requirement.type,
        requiredBy: []
      })
    }
    groups.get(key).requiredBy.push({ where: item.where, owner: item.owner, role: item.role, required: item.required })
  }
  return [...groups.values()].sort((a, b) => b.requiredBy.length - a.requiredBy.length || a.capability.localeCompare(b.capability))
}

function applyFixes(items, lineProfiles, bodyProfiles, surface) {
  const changes = []
  for (const item of items) {
    if (item.status !== 'aliased' && item.status !== 'kind-mismatch') continue
    const { locator } = item
    const target = item.target

    if (locator.file === 'body') {
      const part = bodyProfiles[locator.ownerId].composition[locator.index]
      changes.push({ where: item.where, owner: item.owner, from: part.ref, to: target, reason: item.status })
      part.ref = target
      part.rewrittenFrom = item.ref
    } else if (locator.file === 'line') {
      const node = lineProfiles[locator.classId].nodes.find((n) => n.id === locator.nodeId)
      changes.push({ where: item.where, owner: item.owner, from: node[locator.field], to: target, reason: item.status })
      node.rewrittenFrom = item.ref
      node[locator.field] = target
    } else if (locator.file === 'surface') {
      const list = surface[locator.collection]
      const entry = list.find((e) => (locator.collection === 'dockTiles' ? e.id : e.pattern) === locator.id)
      changes.push({ where: item.where, owner: item.owner, from: entry[locator.field], to: target, reason: item.status })
      entry.rewrittenFrom = item.ref
      entry[locator.field] = target
    }
  }
  return changes
}

function main() {
  const { catalogs, classIds, instanceClass } = buildIndex()
  const lineProfiles = loadJson(LINE_PROFILE_PATH)
  const bodyProfiles = loadJson(BODY_PROFILE_PATH)
  const surface = loadJson(SURFACE_PATH)
  const aliases = existsSync(ALIAS_PATH) ? loadJson(ALIAS_PATH) : null

  const refs = collectRefs(lineProfiles, bodyProfiles, surface)
  const classify = makeClassifier({ classIds, instanceClass }, aliases)
  const classified = refs.map((ref) => ({ ...ref, ...classify(ref) }))

  const counts = { ok: 0, aliased: 0, 'kind-mismatch': 0, 'layer-mismatch': 0, missing: 0 }
  for (const item of classified) counts[item.status] += 1

  const requirements = groupRequirements(classified)
  const classTotal = Object.values(catalogs).reduce((sum, list) => sum + list.length, 0)
  const instanceTotal = Object.values(catalogs).reduce(
    (sum, list) => sum + list.reduce((n, item) => n + item.instances.length, 0),
    0
  )

  console.log(`目录：${classTotal} 类 / ${instanceTotal} 实例`)
  console.log(`采集跨层引用：${refs.length} 条`)
  console.log(`  别名表：${aliases ? `${Object.keys(aliases.classes ?? {}).length} 层 / ${Object.values(aliases.classes ?? {}).reduce((n, m) => n + Object.keys(m).length, 0)} 条映射` : '未建立'}`)
  console.log('')
  console.log('解析结果：')
  console.log(`  ok              ${String(counts.ok).padStart(4)}`)
  console.log(`  aliased         ${String(counts.aliased).padStart(4)}   可自动改写`)
  console.log(`  kind-mismatch   ${String(counts['kind-mismatch']).padStart(4)}   引用的是实例，应改为类`)
  console.log(`  layer-mismatch  ${String(counts['layer-mismatch']).padStart(4)}   层放错，需人工决定`)
  console.log(`  missing         ${String(counts.missing).padStart(4)}   → ${requirements.length} 个已声明需求`)

  const layerMismatch = classified.filter((item) => item.status === 'layer-mismatch')
  if (layerMismatch.length) {
    console.log('\n层错位明细（需人工）：')
    for (const item of layerMismatch) {
      console.log(`  ${item.owner}  ${item.expectedLayer}:${item.ref}  → 实际属于 ${item.actualLayer} 层`)
    }
  }

  const kindMismatch = classified.filter((item) => item.status === 'kind-mismatch')
  if (kindMismatch.length) {
    console.log('\n类型错位明细（可自动改为类）：')
    for (const item of kindMismatch) console.log(`  ${item.owner}  ${item.ref} → ${item.target}`)
  }

  console.log('\n缺口 Top 12（按被引用次数）：')
  for (const req of requirements.slice(0, 12)) {
    const owners = [...new Set(req.requiredBy.map((r) => r.owner))].slice(0, 3).join(', ')
    console.log(`  ${String(req.requiredBy.length).padStart(2)} 处  ${req.capability.padEnd(28)} ${owners}`)
  }
  console.log(`  合计 ${requirements.length} 个需求，覆盖 ${requirements.filter((r) => r.type === 'class').length} 个类 + ${requirements.filter((r) => r.type === 'instance').length} 个实例`)

  if (flags.has('--write')) {
    writeJson(REQUIREMENTS_OUT, {
      version: 1,
      generatedBy: 'scripts/reconcile-refs.mjs',
      counts,
      requirements
    })
    console.log(`\n已写出 ${REQUIREMENTS_OUT}（${requirements.length} 条需求）`)
  }

  if (flags.has('--apply')) {
    const changes = applyFixes(classified, lineProfiles, bodyProfiles, surface)
    writeJson(LINE_PROFILE_PATH, lineProfiles)
    writeJson(BODY_PROFILE_PATH, bodyProfiles)
    writeJson(SURFACE_PATH, surface)
    writeJson(CHANGES_OUT, { version: 1, appliedAt: new Date().toISOString(), changes })
    console.log(`\n已改写 ${changes.length} 处引用：`)
    for (const change of changes) console.log(`  ${change.owner}  ${change.from} → ${change.to}  (${change.reason})`)
    console.log(`改写清单已写入 ${CHANGES_OUT}`)
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) main()

export {
  ALIAS_PATH,
  buildIndex,
  collectRefs,
  groupRequirements,
  loadJson,
  makeClassifier
}
