/**
 * 统一 id 迁移预演 —— 只读，不写任何业务数据。
 *
 * 产出 .tmp/atom-id-plan.json，内容是全量「旧 id → 新 id」对照，
 * 供人工审核之后再决定是否写盘。
 *
 * 规则见 src/shared/atomId.ts。版本号一律取实例的 `rev` 字段，
 * 不取 id 里可能已经过期的 @rN —— 现有 46 个 surface 实例的版本号就是错的。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { deriveAtomId, parseAtomId, classSegment, makeAtomId } from '../src/shared/atomId.ts'

const ROOT = process.cwd()
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
const lineProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedLineProfiles.json'), 'utf8'))
const bodyProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedBodyProfiles.json'), 'utf8'))
const requirements = JSON.parse(readFileSync(join(ROOT, 'src/shared/requirements.generated.json'), 'utf8')).requirements
const surfaceUi = JSON.parse(readFileSync(join(ROOT, 'src/renderer/src/generatedSurface.json'), 'utf8'))

const classPlan = []
const instancePlan = []
const problems = []
const newIds = new Map() // newId -> 原 id，用于查重

for (const layer of LAYERS) {
  for (const cls of catalogs[layer] ?? []) {
    const newClassId = makeAtomId({
      layer,
      className: classSegment(layer, cls.id),
      instance: 'x', // 只为复用拼装函数，下面会丢弃
      rev: 1
    })
    const className = classSegment(layer, cls.id)
    const derivedClassId = `${layer}.${className}`
    classPlan.push({
      layer,
      oldId: cls.id,
      newId: derivedClassId,
      name: cls.name,
      family: cls.family ?? '',
      instanceCount: cls.instances.length,
      changed: derivedClassId !== cls.id
    })

    for (const inst of cls.instances) {
      // 版本号以 rev 字段为准
      const rev = Number(inst.rev ?? 1) || 1
      const newId = deriveAtomId(layer, cls.id, inst.id, rev)
      const parsed = parseAtomId(newId)
      if (!parsed) {
        problems.push({ 原因: '生成结果不是合法 id', layer, classId: cls.id, oldId: inst.id, newId })
        continue
      }
      if (newIds.has(newId)) {
        problems.push({ 原因: '新 id 冲突', newId, a: newIds.get(newId), b: inst.id })
      } else {
        newIds.set(newId, inst.id)
      }
      const idRevMatch = /@r(\d+)$/.exec(inst.id)
      const oldRev = idRevMatch ? Number(idRevMatch[1]) : null
      instancePlan.push({
        layer,
        classOldId: cls.id,
        classNewId: derivedClassId,
        instanceName: inst.name,
        oldId: inst.id,
        newId,
        rev,
        oldRev,
        revDrift: oldRev !== rev,
        changed: newId !== inst.id
      })
    }
  }
}

// 引用面：这些是手写源，必须跟着改
const refChecks = {
  lineProfiles: { pointClass: 0, pointInstance: 0 },
  bodyProfiles: { composition: 0 },
  panelContent: { classLevel: 0, instanceLevel: 0 },
  requirements: 0
}
for (const profile of Object.values(lineProfiles)) {
  for (const node of profile.nodes ?? []) {
    if (node.pointClass) refChecks.lineProfiles.pointClass += 1
    if (node.pointInstance) refChecks.lineProfiles.pointInstance += 1
  }
}
for (const profile of Object.values(bodyProfiles)) {
  refChecks.bodyProfiles.composition += (profile.composition ?? []).length
}
for (const panel of surfaceUi.panelClasses ?? []) {
  if (panel.content) refChecks.panelContent.classLevel += 1
  refChecks.panelContent.instanceLevel += (panel.instances ?? []).filter((i) => i.content).length
}
refChecks.requirements = requirements.length

const changedCount = instancePlan.filter((x) => x.changed).length
const driftCount = instancePlan.filter((x) => x.revDrift).length
const changedClasses = classPlan.filter((x) => x.changed).length

const plan = {
  生成时间: new Date().toISOString(),
  规则: '层名.类名.实例名@rN（3 段定长，全小写，语义看 name/description 字段）',
  统计: {
    类: { 总数: classPlan.length, 要改: changedClasses },
    实例: { 总数: instancePlan.length, 要改: changedCount, 版本漂移: driftCount },
    新id冲突: problems.filter((p) => p.原因 === '新 id 冲突').length,
    其他问题: problems.filter((p) => p.原因 !== '新 id 冲突').length
  },
  引用面: refChecks,
  problems,
  classes: classPlan,
  instances: instancePlan
}

if (!existsSync(join(ROOT, '.tmp'))) mkdirSync(join(ROOT, '.tmp'))
writeFileSync(join(ROOT, '.tmp/atom-id-plan.json'), JSON.stringify(plan, null, 2))

console.log('=== 统一 id 迁移预演（只读，未写盘）===')
console.log(`类：${classPlan.length} 个，要改 ${changedClasses} 个`)
console.log(`实例：${instancePlan.length} 个，要改 ${changedCount} 个，版本漂移 ${driftCount} 个`)
console.log(`新 id 冲突：${plan.统计.新id冲突}　其他问题：${plan.统计.其他问题}`)
console.log()
console.log('=== 按层 ===')
for (const layer of LAYERS) {
  const insts = instancePlan.filter((x) => x.layer === layer)
  const cls = classPlan.filter((x) => x.layer === layer)
  console.log(
    `  ${layer.padEnd(8)} 类 ${cls.filter((c) => c.changed).length}/${cls.length} 要改 · ` +
      `实例 ${insts.filter((i) => i.changed).length}/${insts.length} 要改 · ` +
      `漂移 ${insts.filter((i) => i.revDrift).length}`
  )
}
console.log()
console.log('=== 引用面（手写源必须同步）===')
console.log(`  lineProfiles   pointClass ${refChecks.lineProfiles.pointClass} · pointInstance ${refChecks.lineProfiles.pointInstance}`)
console.log(`  bodyProfiles   composition ${refChecks.bodyProfiles.composition}`)
console.log(`  panel.content  类级 ${refChecks.panelContent.classLevel} · 实例级 ${refChecks.panelContent.instanceLevel}`)
console.log(`  requirements   ${refChecks.requirements}`)
console.log()
console.log('=== 样例（每层 3 条）===')
for (const layer of LAYERS) {
  for (const item of instancePlan.filter((x) => x.layer === layer).slice(0, 3)) {
    const mark = item.revDrift ? ' ⚠版本漂移' : ''
    console.log(`  ${item.oldId.padEnd(34)} → ${item.newId}${mark}`)
  }
}
console.log()
console.log('完整对照已写入 .tmp/atom-id-plan.json')
if (problems.length) {
  console.log(`\n⚠ 有 ${problems.length} 个问题需要先解决：`)
  for (const p of problems.slice(0, 5)) console.log('  ', JSON.stringify(p))
  process.exitCode = 1
}
