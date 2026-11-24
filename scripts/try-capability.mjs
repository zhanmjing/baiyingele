#!/usr/bin/env node
/**
 * 能力试跑台：不进 Electron 就能跑一个能力。
 *
 *   npm run try -- field.rank --items '[{"id":"a","priority":"P0"}]'
 *   npm run try -- field.detect --mode anomaly
 *   npm run try -- point.clipboard_get              # 会真的读剪贴板
 *   npm run try -- field.rank --json               # 只出 JSON，不要摘要行
 *
 * 编译结果缓存在 .tmp/try/，源码没变就跳过编译（首次约 3 秒，之后约 0.3 秒）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const OUT = join(ROOT, '.tmp/try')
const STAMP = join(OUT, '.stamp')

/** 编译清单：能力 + 它们的直接依赖。全编一次也就 3 秒，别为了省时间做增量。 */
const ENTRIES = [
  'src/main/layerStore.ts',
  'src/main/layerRegistry.ts',
  'src/main/lineRuntime.ts',
  'src/main/bodyRuntime.ts',
  'src/main/surfaceRuntime.ts',
  'src/main/fieldRuntime.ts',
  'src/main/capabilities/index.ts',
  'src/main/capabilities/_win32.ts',
  'src/main/capabilities/_com.ts',
  'src/shared/fieldLanding.ts',
  'src/shared/gestureRecognizer.ts',
  'src/shared/formSpec.ts'
]

function newestMtime(dir, exts = ['.ts', '.tsx', '.json']) {
  let newest = 0
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (exts.some((e) => name.endsWith(e))) newest = Math.max(newest, st.mtimeMs)
    }
  }
  walk(dir)
  return newest
}

function ensureCompiled() {
  const srcNewest = Math.max(newestMtime(join(ROOT, 'src/main')), newestMtime(join(ROOT, 'src/shared')))
  const built = existsSync(STAMP) ? Number(readFileSync(STAMP, 'utf8')) : 0
  if (built >= srcNewest && existsSync(join(OUT, 'main/capabilities/index.js'))) return { compiled: false }

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const args = [
    ...ENTRIES,
    '--ignoreConfig', '--rootDir', 'src', '--outDir', OUT,
    '--module', 'node16', '--moduleResolution', 'node16',
    '--target', 'es2022', '--skipLibCheck', '--types', 'node', '--resolveJsonModule'
  ]
  // 不用 npx：直接跑本地 tsc 的入口，避免 Windows 上 .cmd 的 spawn 问题
  const tsc = join(ROOT, 'node_modules/typescript/bin/tsc')
  execFileSync(process.execPath, [tsc, ...args], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit']
  })
  writeFileSync(STAMP, String(Date.now()), 'utf8')
  return { compiled: true, at: Date.now() }
}

/** --key value 收集成对象；单独一个位置参数当 input */
function parseArgs(argv) {
  const out = { params: {}, input: undefined, json: false, list: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') { out.json = true; continue }
    if (arg === '--list') { out.list = true; continue }
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) { out.params[key] = 'true'; continue }
      // @path：从文件读值，绕开 Windows 命令行的引号问题
      if (next.startsWith('@')) {
        const file = next.slice(1)
        out.params[key] = readFileSync(file.startsWith('/') || /^[A-Za-z]:/.test(file) ? file : join(ROOT, file), 'utf8').trim()
      } else {
        out.params[key] = next
      }
      i += 1
      continue
    }
    out.input = out.input === undefined ? arg : `${out.input} ${arg}`
  }
  return out
}

/** 给定能力 id，猜它属于哪一层（点层 / 场层），并造一个最小 RunContext */
function buildContext(capabilityId, parsed, catalogs) {
  const [layerGuess, ...rest] = capabilityId.split('.')
  const layer = ['point', 'line', 'surface', 'body', 'field'].includes(layerGuess) ? layerGuess : 'point'
  const classes = catalogs[layer] ?? []
  const cls = classes.find((c) => c.id === capabilityId) ?? classes[0]
  if (!cls) throw new Error(`目录里找不到 ${capabilityId}（也没有同层兜底类）`)

  const instanceSeed = cls.instances[0]
  const baseParams = {}
  for (const [k, v] of Object.entries(instanceSeed?.params ?? {})) {
    baseParams[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  const params = { ...baseParams, ...parsed.params }
  const instance = {
    id: instanceSeed?.id ?? `${capabilityId}.try@r1`,
    classId: capabilityId,
    name: instanceSeed?.name ?? 'try',
    rev: instanceSeed?.rev ?? 1,
    status: 'active',
    description: instanceSeed?.description ?? '',
    params,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const def = {
    key: layer,
    classLabel: `${layer}Class`,
    classes,
    outputs: {}
  }
  return {
    def,
    instance,
    pointClass: cls,
    params,
    input: parsed.input,
    args: parsed.params,
    findInstance: (id) => {
      for (const c of classes) {
        const found = c.instances.find((i) => i.id === id)
        if (found) return { ...found, classId: c.id, params: {}, createdAt: 0, updatedAt: 0 }
      }
      return undefined
    }
  }
}

const require_ = createRequire(pathToFileURL(join(ROOT, 'package.json')))
const argv = process.argv.slice(2)
if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
  console.log(`用法：npm run try -- <能力 id> [--key 值 ...] [位置参数=input] [--json] [--list]

例：
  npm run try -- --list
  npm run try -- field.rank --items '[{"id":"a","priority":"P0"}]'
  npm run try -- field.rank --from classes
  npm run try -- field.detect --mode repetition
  npm run try -- point.clipboard_get
`)
  process.exit(0)
}

const step = ensureCompiled()
const index = require_(join(OUT, 'main/capabilities/index.js'))
const capMap = index.CAPABILITIES ?? {}
/** 注册表的值是 run 函数本身；id / summary 在模块自己的导出里 */
function loadModule(id) {
  try {
    return require_(join(OUT, 'main/capabilities', `${id}.js`))
  } catch {
    return null
  }
}
const all = Object.keys(capMap).map((id) => ({ id, summary: loadModule(id)?.summary ?? '', run: capMap[id] }))

const rawId = argv[0]
if (rawId === '--list') {
  console.log(`已编译能力 ${all.length} 个：`)
  for (const cap of all) console.log(`  ${String(cap.id).padEnd(26)} ${cap.summary ?? ''}`)
  process.exit(0)
}

const capability = all.find((c) => c.id === rawId)
if (!capability) {
  console.error(`没有这个能力：${rawId}\n用 npm run try -- --list 看全部`)
  const near = all.filter((c) => String(c.id).includes(rawId.split('.').pop())).slice(0, 5)
  if (near.length) console.error(`你是不是想要：${near.map((c) => c.id).join('、')}`)
  process.exit(1)
}

const parsed = parseArgs(argv.slice(1))
const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
const ctx = buildContext(rawId, parsed, catalogs)

const startedAt = Date.now()
let outcome
try {
  outcome = await capability.run(ctx)
} catch (error) {
  console.error(`✗ ${rawId} 抛异常：${error?.message ?? error}`)
  if (process.env.TRY_STACK) console.error(error?.stack)
  process.exit(1)
}

const wall = Date.now() - startedAt
if (parsed.json) {
  console.log(JSON.stringify({ capability: rawId, compiled: step.compiled, wallMs: wall, outcome }, null, 2))
  process.exit(outcome.status === 'ok' ? 0 : 2)
}

const icon = outcome.status === 'ok' ? '✓' : outcome.status === 'warn' ? '!' : '✗'
console.log(`${icon} ${rawId}  ${outcome.status}  ${outcome.elapsedMs ?? wall}ms${step.compiled ? '  (已重新编译)' : ''}`)
console.log(`  ${outcome.output}`)
if (outcome.evidence) {
  console.log(`  evidence: ${JSON.stringify(outcome.evidence).slice(0, 600)}`)
}
if (outcome.value) {
  console.log(`  value: ${String(outcome.value).slice(0, 400)}`)
}
process.exit(outcome.status === 'ok' ? 0 : 2)
