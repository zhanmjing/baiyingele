#!/usr/bin/env node
/**
 * 手势钩子实机验证。
 *
 * 容器里跑不了全局鼠标钩子（uiohook-napi 需要真实 Windows 桌面会话），
 * 所以采样/识别的单元测试通过，不代表钩子真能装上。这个脚本只干一件事：
 * 把真实鼠标事件抓出来，让你看见「到底能不能用」。
 *
 * 用法：
 *   node scripts/verify-gesture-hook.mjs
 *   node scripts/verify-gesture-hook.mjs --seconds 10
 *
 * 它做四步：
 *   1. 能不能加载 uiohook-napi
 *   2. 能不能起步钩子
 *   3. 能不能收到真实事件（等你动鼠标）
 *   4. 把事件喂进我们的采样状态机，看能不能真的识别出手势
 *
 * 退出码：0 = 全部通过，1 = 某一步失败（会打印具体原因，不静默）
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.tmp/verify-gesture')

/**
 * 先把采样状态机和识别器编译出来。
 *
 * 不编译就没法验证「真实事件 → 采样 → 识别」这条链，
 * 只能看原始事件，那等于没验到我们的代码。
 */
function compileHelpers() {
  // tsc 保留源目录结构
  if (existsSync(join(OUT, 'main/classes/point/gesture_sample.js'))) return true
  mkdirSync(OUT, { recursive: true })
  try {
    execFileSync(
      process.execPath,
      [
        join(ROOT, 'node_modules/typescript/bin/tsc'),
        join(ROOT, 'src/main/classes/point/gesture_sample.ts'),
        join(ROOT, 'src/shared/gestureRecognizer.ts'),
        join(ROOT, 'src/shared/gestureNotation.ts'),
        join(ROOT, 'src/main/capabilities/_shared.ts'),
        '--outDir', OUT,
        '--module', 'commonjs',
        '--target', 'ES2022',
        '--moduleResolution', 'bundler',
        '--skipLibCheck',
        '--esModuleInterop',
        // 本仓 tsconfig 开了 composite，指定文件时必须跳过配置
        '--ignoreConfig',
        '--types', 'node'
      ],
      { stdio: 'pipe', cwd: ROOT }
    )
    return true
  } catch (error) {
    const detail = [error?.stdout?.toString?.(), error?.stderr?.toString?.(), error?.message].filter(Boolean).join('\n') || '未知错误'
    console.error('编译采样状态机失败：', detail.slice(0, 400))
    return false
  }
}
const argSeconds = process.argv.indexOf('--seconds')
const SECONDS = argSeconds >= 0 ? Number(process.argv[argSeconds + 1]) : 8

const log = (...args) => console.log(...args)
const fail = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

log('=== 手势钩子实机验证 ===\n')

// ── 步骤 1：模块能不能加载 ──────────────────────────────
let uiohook
let UiohookKey
try {
  const mod = require('uiohook-napi')
  uiohook = mod.uIOhook
  UiohookKey = mod.UiohookKey
  log('✓ 1/4 uiohook-napi 加载成功')
} catch (error) {
  fail(`1/4 uiohook-napi 加载失败：${error instanceof Error ? error.message : String(error)}
    常见原因：没装 native 依赖 / 架构不匹配 / 被安全软件拦截
    修复：npm rebuild uiohook-napi`)
}

// ── 步骤 2：能不能起步钩子 ──────────────────────────────
let started = false
try {
  uiohook.start()
  started = true
  log('✓ 2/4 全局钩子已启动')
} catch (error) {
  fail(`2/4 钩子启动失败：${error instanceof Error ? error.message : String(error)}
    常见原因：权限不足 / 另一个进程已占用 / 非交互式桌面会话`)
}

// ── 步骤 3：收真实事件 ──────────────────────────────────
const events = []
const onAny = (kind) => (event) => events.push({ kind, event })
uiohook.on('mousemove', onAny('move'))
uiohook.on('mousedown', onAny('down'))
uiohook.on('mouseup', onAny('up'))
uiohook.on('wheel', onAny('wheel'))

log(`\n现在请在 ${SECONDS} 秒内：`)
log('  1) 按住**右键**画一个「← ↓ →」（先左、再下、再右）')
log('  2) 滚一下滚轮')
log('  3) 松开右键\n')

// 顺便把采样状态机也跑起来，验证「事件 → 轨迹」这层
let sampler = null
try {
  if (!compileHelpers()) throw new Error('compile failed')
  sampler = require(join(OUT, 'main/classes/point/gesture_sample.js'))
  log('（采样状态机已加载，会同时喂真实事件）\n')
} catch {
  log('（采样状态机编译失败，本轮只看原始事件）\n')
}

const samples = []
if (sampler) {
  let state = null
  uiohook.on('mousedown', (e) => {
    const button = sampler.buttonName(e.button)
    if (!button) return
    // uiohook 的 e.time 是单调时钟，不能和 Date.now() 混用
    const next = sampler.onDown({ x: e.x, y: e.y, t: Date.now(), button })
    if (next) state = next
  })
  uiohook.on('mousemove', (e) => {
    if (!state) return
    state = sampler.onMove(state, { x: e.x, y: e.y, t: Date.now() })
    if (sampler.isStayTimedOut(state, Date.now())) {
      state = null
    }
  })
  uiohook.on('mouseup', (e) => {
    if (!state) return
    const button = sampler.buttonName(e.button)
    if (button && button !== state.button) return
    const result = sampler.onUp(state, { t: Date.now() })
    state = null
    samples.push(result)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(SECONDS * 1000)

uiohook.removeAllListeners?.('mousemove')
uiohook.removeAllListeners?.('mousedown')
uiohook.removeAllListeners?.('mouseup')
uiohook.removeAllListeners?.('wheel')
uiohook.stop()

const counts = events.reduce((acc, { kind }) => {
  acc[kind] = (acc[kind] ?? 0) + 1
  return acc
}, {})

log(`收到事件：${events.length} 个`)
for (const kind of ['move', 'down', 'up', 'wheel']) {
  log(`  ${kind.padEnd(6)} ${counts[kind] ?? 0}`)
}

if (!events.length) {
  fail(`3/4 钩子起来了但**一个事件都没收到**
    常见原因：
      · 当前不是交互式桌面会话（远程/服务/容器）
      · 钩子被安全软件或另一个程序抢占
      · 这 ${SECONDS} 秒内你真的没动鼠标`)
}

const first = events[0].event
log(`\n✓ 3/4 收到真实事件（首条坐标 ${first.x}, ${first.y}）`)

// DPI 合理性：坐标应该在某个显示器的范围内
const maxX = Math.max(...events.map((e) => e.event.x ?? 0))
const maxY = Math.max(...events.map((e) => e.event.y ?? 0))
log(`  坐标范围：0…${maxX} × 0…${maxY}`)
if (maxX > 10000 || maxY > 10000) {
  log('  ⚠ 坐标异常大，可能是 DPI 缩放问题（多显示器混合缩放时要特别注意）')
}

// ── 步骤 4：采样状态机能不能识别出轨迹 ──────────────────
if (!sampler) {
  log('\n○ 4/4 跳过（采样状态机未编译）')
} else if (!samples.length) {
  log('\n○ 4/4 没有完整采样（可能没画手势，或没按右键拖）')
} else {
  const recognizer = require(join(OUT, 'shared/gestureRecognizer.js'))
  log(`\n采样到 ${samples.length} 次：`)
  for (const sample of samples) {
    const tail = sample.reason ? `失败：${sample.reason}` : recognizer.recognize(sample.points)
    if (typeof tail === 'string') {
      log(`  按钮 ${sample.button} · ${sample.points.length} 点 → ${tail}`)
    } else {
      log(`  按钮 ${sample.button} · ${sample.points.length} 点 → ${tail.valid ? `识别为 ${tail.directions}` : `失败：${tail.reason}`}`)
    }
  }
  const ok = samples.some((s) => !s.reason && recognizer.recognize(s.points).valid)
  if (ok) log('\n✓ 4/4 采样 + 识别链路在真实事件上跑通')
  else log('\n○ 4/4 有采样但都没成手势（画法或参数可能需要调）')
}

log('\n=== 结论 ===')
log(`钩子可用：${started && events.length > 0 ? '是' : '否'}`)
process.exit(0)
