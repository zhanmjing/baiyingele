#!/usr/bin/env node
/**
 * WGestures 备份 → 我们的 trigger-bindings 格式。
 *
 * 输入：docs/wgestures-1.8.5.0.gestures.json（从 .wgb 解出的原始配置）
 * 输出：迁移报告 + 可落地的绑定
 *
 *   node scripts/migrate-wgestures.mjs            # 只看报告
 *   node scripts/migrate-wgestures.mjs --write    # 写 .tmp/wgestures-migrated.json
 *
 * ## 为什么不直接产出可用的 trigger-bindings.json
 *
 * WGestures 的绑定指向 AbstractCommand 对象（10 种，各有参数），
 * 我们的绑定指向点层/线层**实例**。有些命令有点层对应能力，有些连类都不存在。
 *
 * 所以产出两样东西：
 *   bindings   能落地的（指向现有实例）
 *   pending    落不了地的（写明缺哪个点层类）
 *
 * 报喜不报忧的迁移比不迁移更糟 —— 用户会以为 71 条都过来了。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'docs/wgestures-1.8.5.0.gestures.json')
const OUT = join(ROOT, '.tmp/wgestures-migrated.json')
const CATALOG = join(ROOT, 'src/shared/generatedFullCatalogs.json')

/**
 * 目录里真实存在的实例 id。
 *
 * 为什么必须核对：WGestures 把命令参数内联在命令对象里
 * （keys / filePath / url），我们的绑定指向**预先配置好的实例**。
 * 所以迁移不可能直接复用现有实例 —— 每个绑定通常都需要一个新实例。
 * 不核对就会产出一堆指向不存在实例的绑定，add() 全部被拒。
 */
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const realInstances = new Set(
  ['point', 'line'].flatMap((layer) => catalog[layer].flatMap((cls) => cls.instances.map((i) => i.id)))
)
const instanceClassOf = (id) => id.split('.').slice(0, 2).join('.')

/** 从三元组生成稳定的实例名段（只允许小写字母数字下划线） */
function slugOf(triple, scopeSlug) {
  const mod = triple.modifier ? `_${triple.modifier.replace(/-/g, '_')}` : ''
  const dirs = triple.dirs ? `_${triple.dirs}` : ''
  const base = `${triple.button}${dirs}${mod}`
  const ascii = base.replace(/↑/g, 'u').replace(/↗/g, 'ur').replace(/→/g, 'r')
    .replace(/↘/g, 'dr').replace(/↓/g, 'd').replace(/↙/g, 'dl')
    .replace(/←/g, 'l').replace(/↖/g, 'ul')
  const clean = ascii.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'g'
  // 同一三元组会在多个作用域重复出现（全局 + 各应用），必须带作用域区分
  return scopeSlug && scopeSlug !== 'global' ? `${scopeSlug}_${clean}` : clean
}

// 箭头记法，与 WGestures Gesture.dirs[] 索引一一对应（0=↑ … 7=↖）
const DIRS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
const BUTTONS = { 0: null, 1: 'right', 2: 'middle', 4: 'x1', 8: 'x2' }
const MODIFIERS = {
  1: 'wheel-forward', 2: 'wheel-backward', 4: 'middle-down',
  8: 'left-down', 16: 'right-down', 32: 'x1', 64: 'x2'
}
const WINDOW_OPS = ['MAXIMIZE_RESTORE', 'MINIMIZE', 'CLOSE', 'TOP_MOST', 'DOCK_LEFT', 'DOCK_RIGHT']

/**
 * 虚拟键码 → 组合键名。
 * WGestures 存原始 VK 数组（Keys:[67], Modifiers:[162]），
 * point.key_send 吃 'Ctrl+C' 字符串。不转换的话 String([67]) = '67'，会发出乱码键。
 */
const VK_MODIFIER = { 160: 'Shift', 161: 'Shift', 162: 'Ctrl', 163: 'Ctrl', 164: 'Alt', 165: 'Alt', 91: 'Meta', 92: 'Meta' }
const VK_KEY = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space',
  33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
  37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down',
  45: 'Insert', 46: 'Delete',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
  65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I',
  74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R',
  83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
  186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
  219: '[', 220: '\\', 221: ']', 222: "'"
}

function comboOf(detail) {
  const mods = [...new Set((detail.modifiers ?? []).map((m) => VK_MODIFIER[m]).filter(Boolean))]
  const keys = (detail.keys ?? []).map((k) => VK_KEY[k]).filter(Boolean)
  if (!keys.length) return null
  return [...mods, keys[0]].join('+')
}

function paramsFor(classId, detail) {
  if (classId === 'point.key_send') {
    const combo = comboOf(detail)
    return combo ? { keys: combo, mode: 'press', repeat: '1' } : null
  }
  return detail
}

function mapCommand(command) {
  const type = String(command.$type ?? '').split(',')[0].split('.').pop()
  switch (type) {
    case 'HotKeyCommand':
      return { type, capable: true, kind: 'point', instance: 'point.key_send.tap@r1', detail: { keys: command.Keys ?? [], modifiers: command.Modifiers ?? [] } }
    case 'OpenFileCommand':
      return { type, capable: true, kind: 'point', instance: 'point.open.file@r1', detail: { path: command.FilePath } }
    case 'GotoUrlCommand':
      return { type, capable: true, kind: 'point', instance: 'point.open.url@r1', detail: { url: command.Url } }
    case 'WindowControlCommand':
      return { type, capable: true, kind: 'point', instance: 'point.window_control.maximize@r1', detail: { op: WINDOW_OPS[command.ChangeWindowStateTo] ?? '?' } }
    case 'ChangeAudioVolumeCommand':
      return { type, capable: true, kind: 'point', instance: 'point.audio_volume.up@r1', detail: { delta: command.Delta }, needsSession: true }
    case 'WebSearchCommand':
      return { type, capable: true, kind: 'point', instance: 'point.copy_selection.default@r1', detail: { url: command.SearchEngineUrl } }
    case 'SendTextCommand':
      return { type, capable: true, kind: 'point', instance: 'point.send_keys.custom@r1', detail: { text: command.Text } }
    case 'CmdCommand':
      return { type, capable: true, kind: 'point', instance: 'point.shell_exec.custom@r1', detail: { code: command.Code } }
    case 'TaskSwitcherCommand':
      return { type, capable: true, kind: 'point', instance: 'point.task_switch.next@r1', detail: {}, needsSession: true }
    case 'PauseWGesturesCommand':
      return { type, capable: true, kind: 'point', instance: 'point.gesture_pause.toggle@r1', detail: { action: 'toggle' } }
    default:
      return { type, capable: false, needs: `未知命令类型 ${type}`, detail: {} }
  }
}

function tripleOf(gesture) {
  const button = BUTTONS[gesture.GestureButton] ?? null
  const dirs = (gesture.Dirs ?? []).map((d) => DIRS[d] ?? '?').join('')
  const modifier = MODIFIERS[gesture.Modifier] ?? undefined
  if (!button) return null
  if (!dirs && !modifier) return null
  return { button, dirs, modifier }
}

const data = JSON.parse(readFileSync(SRC, 'utf8'))
const bindings = []
const instances = []
const pending = []
const byCommand = {}
let total = 0
let missingTargets = 0

const scopes = [{ name: '(Global)', exePath: null, intents: data.Global.GestureIntents }]
for (const app of Object.values(data.Apps)) {
  scopes.push({ name: app.Name, exePath: app.ExecutablePath, intents: app.GestureIntents })
}

const scopeRows = []
let scopeIndex = 0
for (const scope of scopes) {
  scopeIndex += 1
  const row = { name: scope.name, total: scope.intents.length, migratable: 0, blocked: 0 }
  for (const intent of scope.intents) {
    total += 1
    const triple = tripleOf(intent.Gesture)
    const mapped = mapCommand(intent.Command)
    byCommand[mapped.type] = (byCommand[mapped.type] ?? 0) + 1

    const base = {
      name: intent.Name,
      gesture: triple,
      commandType: mapped.type,
      executeOnModifier: intent.ExecuteOnModifier === true,
      scope: scope.exePath ? { exePath: scope.exePath, inheritGlobal: true } : undefined
    }

    if (triple && mapped.capable) {
      // 一条手势建一个实例：参数属于绑定，不属于可复用原子能力
      // 作用域序号而不是名字：中文应用名会被压成下划线，仍然撞车
      const scopeSlug = scope.exePath ? `s${scopeIndex}` : 'global'
      const slug = slugOf(triple, scopeSlug)
      const classId = instanceClassOf(mapped.instance)
      const instanceId = `${classId}.${slug}@r1`
      const params = paramsFor(classId, mapped.detail)
      if (params === null) {
        // 参数翻不出来这条就落不了地 —— 实例也别建
        pending.push({ ...base, reason: `${classId} 的参数翻不出来` })
        row.blocked += 1
        continue
      }
      instances.push({
        classId,
        instanceId,
        name: String(intent.Name ?? slug).trim() || slug,
        params,
        paramsOk: params !== null,
        from: 'wgestures'
      })
      const targetExists = realInstances.has(instanceId)
      bindings.push({
        ...base,
        // 绑定 id 必须带作用域：不同应用的同一手势是两条不同的绑定，
        // 不带作用域会撞成一条，70 条里丢 5 条。
        id: `gesture:${triple.button}:${triple.dirs}:${triple.modifier ?? ''}@${scopeSlug}`,
        targetKind: mapped.kind,
        targetId: instanceId,
        targetClass: classId,
        targetExists,
        detail: mapped.detail,
        needsSession: mapped.needsSession === true
      })
      row.migratable += 1
      if (!targetExists) missingTargets += 1
    } else {
      pending.push({ ...base, reason: !triple ? '三元组无法解析' : mapped.needs })
      row.blocked += 1
    }
  }
  scopeRows.push(row)
}

console.log('=== WGestures 备份迁移报告 ===\n')
console.log(`总手势 ${total} 条 · 能落地 ${bindings.length} · 被阻塞 ${pending.length}`)
if (missingTargets) {
  console.log(`\n⚠ 能落地的 ${bindings.length} 条里，${missingTargets} 条的目标实例还不存在`)
  console.log('  WGestures 把命令参数内联在命令对象里，我们的绑定指向预配置实例，')
  console.log(`  要新建 ${instances.length} 个点层实例（见 instances[]，参数已带上）。`)
}
console.log('')
console.log('按作用域：')
for (const s of scopeRows) {
  console.log(`  ${s.name.padEnd(10)} ${String(s.total).padStart(2)} 条  能落地 ${String(s.migratable).padStart(2)}  阻塞 ${s.blocked}`)
}
console.log('\n按命令类型：')
for (const [type, count] of Object.entries(byCommand).sort((a, b) => b[1] - a[1])) {
  const sample = pending.find((p) => p.commandType === type)
  console.log(`  ${type.padEnd(24)} ${String(count).padStart(2)}  ${sample ? '← ' + sample.reason : 'OK'}`)
}
if (pending.length) {
  console.log('\n被阻塞的手势（前 8 条）：')
  for (const p of pending.slice(0, 8)) {
    const g = p.gesture ? `${p.gesture.button}:${p.gesture.dirs || '∅'}${p.gesture.modifier ? ':' + p.gesture.modifier : ''}` : '?'
    console.log(`  ${g.padEnd(20)} ${String(p.name ?? '').slice(0, 12).padEnd(14)} ${p.reason}`)
  }
}
if (process.argv.includes('--write')) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify({ report: { total, migratable: bindings.length, blocked: pending.length, newInstances: instances.length, byCommand, scopes: scopeRows }, instances, bindings, pending }, null, 2), 'utf8')
  console.log(`\n已写入 ${OUT}`)
}
