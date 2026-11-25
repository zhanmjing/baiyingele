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

const DIRS = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL']
const BUTTONS = { 0: null, 1: 'right', 2: 'middle', 4: 'x1', 8: 'x2' }
const MODIFIERS = {
  1: 'wheel-forward', 2: 'wheel-backward', 4: 'middle-down',
  8: 'left-down', 16: 'right-down', 32: 'x1', 64: 'x2'
}
const WINDOW_OPS = ['MAXIMIZE_RESTORE', 'MINIMIZE', 'CLOSE', 'TOP_MOST', 'DOCK_LEFT', 'DOCK_RIGHT']

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
      return { type, capable: false, needs: '缺 point.copy_selection（先复制选区再搜）', detail: { url: command.SearchEngineUrl } }
    case 'SendTextCommand':
      return { type, capable: false, needs: '缺 SendKeys 方言翻译器（^v{enter}）', detail: { text: command.Text } }
    case 'CmdCommand':
      return { type, capable: false, needs: '缺 point.shell_exec（含 %WG_PROCID% 替换）', detail: { code: command.Code } }
    case 'TaskSwitcherCommand':
      return { type, capable: false, needs: '缺 point.task_switch', detail: {}, needsSession: true }
    case 'PauseWGesturesCommand':
      return { type, capable: false, needs: '缺 point.gesture_pause', detail: {} }
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
const pending = []
const byCommand = {}
let total = 0

const scopes = [{ name: '(Global)', exePath: null, intents: data.Global.GestureIntents }]
for (const app of Object.values(data.Apps)) {
  scopes.push({ name: app.Name, exePath: app.ExecutablePath, intents: app.GestureIntents })
}

const scopeRows = []
for (const scope of scopes) {
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
      bindings.push({
        ...base,
        id: `gesture:${triple.button}:${triple.dirs}:${triple.modifier ?? ''}`,
        targetKind: mapped.kind,
        targetId: mapped.instance,
        detail: mapped.detail,
        needsSession: mapped.needsSession === true
      })
      row.migratable += 1
    } else {
      pending.push({ ...base, reason: !triple ? '三元组无法解析' : mapped.needs })
      row.blocked += 1
    }
  }
  scopeRows.push(row)
}

console.log('=== WGestures 备份迁移报告 ===\n')
console.log(`总手势 ${total} 条 · 能落地 ${bindings.length} · 被阻塞 ${pending.length}\n`)
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
  writeFileSync(OUT, JSON.stringify({ report: { total, migratable: bindings.length, blocked: pending.length, byCommand, scopes: scopeRows }, bindings, pending }, null, 2), 'utf8')
  console.log(`\n已写入 ${OUT}`)
}
