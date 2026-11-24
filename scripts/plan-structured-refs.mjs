/**
 * 把手写引用改写成「结构化字段」的预演 —— 只读，不写任何文件。
 *
 * 目标：源文件里不再出现 id 字符串，只存 { layer, name, instance, rev }。
 * id 一律由 src/shared/atomId.ts 的 makeClassId / makeInstanceId 在运行时拼。
 *
 * 用法：node scripts/plan-structured-refs.mjs          只读预演
 *       node scripts/plan-structured-refs.mjs --write  写回源文件（会先备份）
 * 产出：.tmp/refs-structured-plan.json（全量改后结构）+ 控制台报告
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { classSegment, instanceSegment, makeClassId, makeInstanceId, parseInstanceId } from '../src/shared/atomId.ts'

const ROOT = process.cwd()
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
const lineProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedLineProfiles.json'), 'utf8'))
const bodyProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedBodyProfiles.json'), 'utf8'))
const surfaceUi = JSON.parse(readFileSync(join(ROOT, 'src/renderer/src/generatedSurface.json'), 'utf8'))

/** 旧类 id → ClassRef（层靠前缀判断，点层的主题前缀靠 hint） */
function classRefOf(raw, hint) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  for (const layer of LAYERS) {
    if (text.startsWith(layer + '.')) return { layer, name: classSegment(layer, text) }
  }
  if (!hint) return null
  return { layer: hint, name: classSegment(hint, text) }
}

/** 在目录里按旧 id 找到实例，拿到 rev */
function instanceRev(layer, classId, instanceId) {
  for (const cls of catalogs[layer] ?? []) {
    if (cls.id !== classId) continue
    const base = String(instanceId).replace(/@r\d+$/, '')
    const hit = cls.instances.find((i) => i.id === instanceId)
      ?? cls.instances.find((i) => String(i.id).replace(/@r\d+$/, '') === base)
    if (hit) return Number(hit.rev ?? 1) || 1
  }
  return null
}

/** 悬空实例引用：目录里找不到，只能按位置拆。rev 记为 null，交给校验器报缺口。 */
function danglingInstanceRef(raw, hint) {
  const text = String(raw ?? '').trim()
  let layer = hint
  let rest = text
  for (const l of LAYERS) {
    if (text.startsWith(l + '.')) { layer = l; rest = text.slice(l.length + 1); break }
  }
  if (!layer || !rest) return null
  const parts = rest.split('.').filter(Boolean)
  if (!parts.length) return null
  const name = classSegment(layer, `${layer}.${parts[0]}`)
  const instance = parts.length > 1 ? instanceSegment(layer, `${layer}.${parts[0]}`, parts.slice(1).join('.')) : 'default'
  return { layer, name, instance, rev: null, dangling: true }
}

function instanceRefOf(raw, hint) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  // $args.x / $input 是运行时表达式，不是静态引用，原样保留
  if (text.startsWith('$')) return { expr: text }
  // 已经带层前缀的新格式直接解析
  const parsed = parseInstanceId(text)
  if (parsed) return parsed
  // 旧格式：先按「实例 id 精确匹配」找归属（line 层是 inst.xxx，不带类前缀）
  for (const layer of LAYERS) {
    for (const cls of catalogs[layer] ?? []) {
      const tb = text.replace(/@r\d+$/, '')
      if (cls.instances.some((i) => i.id === text || String(i.id).replace(/@r\d+$/, '') === tb)) {
        const rev = instanceRev(layer, cls.id, text)
        return { layer, name: classSegment(layer, cls.id), instance: instanceSegment(layer, cls.id, text), rev: rev ?? null }
      }
    }
  }
  // 再按「类前缀」找归属，找不到实例就记成悬空，不短路
  for (const layer of LAYERS) {
    for (const cls of catalogs[layer] ?? []) {
      if (text.startsWith(cls.id + '.')) {
        const rev = instanceRev(layer, cls.id, text)
        const ref = { layer, name: classSegment(layer, cls.id), instance: instanceSegment(layer, cls.id, text), rev: rev ?? null }
        if (rev === null) ref.dangling = true
        return ref
      }
    }
  }
  return danglingInstanceRef(text, hint)
}

const report = { line: [], body: [], panel: [] }
const unresolved = []

// ── 1. lineProfiles：节点上的 pointClass / pointInstance ──
const lineOut = {}
for (const [classId, profile] of Object.entries(lineProfiles)) {
  const nodes = (profile.nodes ?? []).map((node) => {
    const next = { ...node }
    const hint = node.kind === 'subflow' ? 'line' : 'point'
    if (node.pointClass) {
      const ref = classRefOf(node.pointClass, hint)
      if (ref) { report.line.push({ from: node.pointClass, to: ref, kind: 'class' }); delete next.pointClass; next.pointClass = ref }
      else unresolved.push({ where: 'line.pointClass', raw: node.pointClass })
    }
    if (node.pointInstance) {
      const ref = instanceRefOf(node.pointInstance, hint)
      if (ref) {
        const kind = 'expr' in ref ? 'expr' : ref.dangling ? 'dangling' : 'instance'
        report.line.push({ from: node.pointInstance, to: ref, kind })
        next.pointInstance = ref
      } else unresolved.push({ where: 'line.pointInstance', raw: node.pointInstance })
    }
    return next
  })
  lineOut[classId] = { ...profile, nodes }
}

// ── 2. bodyProfiles：composition 的 { layer, ref } ──
const bodyOut = {}
for (const [classId, profile] of Object.entries(bodyProfiles)) {
  const composition = (profile.composition ?? []).map((item) => {
    const ref = classRefOf(item.ref, item.layer)
    if (!ref) { unresolved.push({ where: 'body.composition', raw: item.ref, layer: item.layer }); return item }
    report.body.push({ from: item.ref, to: ref })
    const { ref: _drop, layer: _layer, ...rest } = item
    return { ...rest, class: ref }
  })
  bodyOut[classId] = { ...profile, composition }
}

// ── 3. generatedSurface：panel 的 content（类级 + 实例级，含 `+` 多页面） ──
const panelOut = (surfaceUi.panelClasses ?? []).map((panel) => {
  const split = (raw) => String(raw ?? '').split('+').map((s) => s.trim()).filter(Boolean)
  const classContent = split(panel.content).map((raw) => {
    const ref = classRefOf(raw, 'surface')
    if (ref) report.panel.push({ from: raw, to: ref, kind: 'class' })
    else unresolved.push({ where: 'panel.content', raw })
    return ref
  }).filter(Boolean)
  const instances = (panel.instances ?? []).map((inst) => {
    const content = split(inst.content).map((raw) => {
      const ref = instanceRefOf(raw, 'surface')
      if (ref) report.panel.push({ from: raw, to: ref, kind: 'instance' })
      else unresolved.push({ where: 'panel.instance.content', raw })
      return ref
    }).filter(Boolean)
    return { ...inst, content }
  })
  return { ...panel, content: classContent, instances }
})

if (!existsSync(join(ROOT, '.tmp'))) mkdirSync(join(ROOT, '.tmp'))
writeFileSync(
  join(ROOT, '.tmp/refs-structured-plan.json'),
  JSON.stringify({ lineProfiles: lineOut, bodyProfiles: bodyOut, surfacePanels: panelOut, unresolved }, null, 2)
)

console.log('=== 结构化引用转换预演（只读）===')
console.log(`lineProfiles  ${report.line.length} 处（class ${report.line.filter((r) => r.kind === 'class').length} · instance ${report.line.filter((r) => r.kind === 'instance').length}）`)
console.log(`bodyProfiles  ${report.body.length} 处`)
console.log(`panel.content ${report.panel.length} 处（class ${report.panel.filter((r) => r.kind === 'class').length} · instance ${report.panel.filter((r) => r.kind === 'instance').length}）`)
console.log(`未能转换      ${unresolved.length} 处`)
if (unresolved.length) for (const u of unresolved.slice(0, 6)) console.log('  ', JSON.stringify(u))
console.log()
console.log('=== 样例 ===')
for (const kind of ['line', 'body', 'panel']) {
  const seen = new Set()
  for (const r of report[kind]) {
    if (seen.has(r.kind ?? kind)) continue
    seen.add(r.kind ?? kind)
    console.log(`  ${kind.padEnd(6)} ${String(r.from).padEnd(34)} → ${JSON.stringify(r.to)}`)
  }
}
console.log()
console.log('完整结构已写入 .tmp/refs-structured-plan.json')

// ── 写盘 ──────────────────────────────────────────────────────
if (process.argv.includes('--write')) {
  const backupDir = join(ROOT, '.tmp/structured-backup')
  rmSync(backupDir, { recursive: true, force: true })
  mkdirSync(backupDir, { recursive: true })
  const targets = [
    ['src/shared/generatedLineProfiles.json', lineOut],
    ['src/shared/generatedBodyProfiles.json', bodyOut],
    ['src/renderer/src/generatedSurface.json', { ...surfaceUi, panelClasses: panelOut }],
    ['build/data/.panel-data.json', { ...JSON.parse(readFileSync(join(ROOT, 'build/data/.panel-data.json'), 'utf8')), classes: panelOut }]
  ]
  for (const [rel, data] of targets) {
    const src = join(ROOT, rel)
    if (existsSync(src)) {
      const dest = join(backupDir, rel)
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(src, dest)
    }
    mkdirSync(dirname(src), { recursive: true })
    writeFileSync(src, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    console.log(`  写出 ${rel}`)
  }
  console.log(`\n已写盘 ${targets.length} 个文件，备份在 .tmp/structured-backup/`)
}
