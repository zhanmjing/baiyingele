/**
 * 测试共用底座。
 *
 * 每个测试文件是**独立进程**（node --test 的默认行为），所以这里按需编译、
 * 按需加载，不做跨文件的共享可变状态 —— 这正是为了消灭
 * smoke-flow.cjs 里那种「全局变量名撞车」。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const ROOT = process.cwd()
export const OUT = join(ROOT, '.tmp/test')
const STAMP = join(OUT, '.stamp')

const ENTRIES = [
  'src/main/layerStore.ts',
  'src/main/layerRegistry.ts',
  'src/main/lineRuntime.ts',
  'src/main/bodyRuntime.ts',
  'src/main/surfaceRuntime.ts',
  'src/main/fieldRuntime.ts',
  'src/main/classes/index.ts',
  'src/main/triggerStore.ts',
  'src/main/capabilities/index.ts',
  'src/main/classes/index.ts',
  'src/main/triggerStore.ts',
  'src/main/capabilities/_win32.ts',
  'src/main/capabilities/_com.ts',
  'src/shared/fieldLanding.ts',
  'src/shared/gestureRecognizer.ts',
  'src/shared/gestureNotation.ts',
  'src/shared/commandSession.ts',
  'src/shared/formSpec.ts'
]

function newestMtime(dir) {
  let newest = 0
  const walk = (p) => {
    for (const name of readdirSync(p)) {
      const full = join(p, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (/\.(ts|tsx|json)$/.test(name)) newest = Math.max(newest, st.mtimeMs)
    }
  }
  walk(dir)
  return newest
}

/** 编译一次；源码没变就跳过。多个测试文件并发调用时第二个会看到 stamp 直接返回。 */
export function ensureCompiled() {
  if (existsSync(STAMP) && existsSync(join(OUT, 'main/capabilities/index.js'))) {
    const built = Number(readFileSync(STAMP, 'utf8'))
    const src = Math.max(newestMtime(join(ROOT, 'src/main')), newestMtime(join(ROOT, 'src/shared')))
    if (built >= src) return
  }
  mkdirSync(OUT, { recursive: true })
  const tsc = join(ROOT, 'node_modules/typescript/bin/tsc')
  execFileSync(process.execPath, [
    tsc, ...ENTRIES,
    '--ignoreConfig', '--rootDir', 'src', '--outDir', OUT,
    '--module', 'node16', '--moduleResolution', 'node16',
    '--target', 'es2022', '--skipLibCheck', '--types', 'node', '--resolveJsonModule'
  ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
  writeFileSync(STAMP, String(Date.now()), 'utf8')
}

const requireFromRoot = createRequire(pathToFileURL(join(ROOT, 'package.json')))

/** 加载编译产物里的模块 */
export function load(rel) {
  ensureCompiled()
  return requireFromRoot(join(OUT, rel))
}

export const catalogs = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedFullCatalogs.json'), 'utf8'))
export const lineProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedLineProfiles.json'), 'utf8'))
export const bodyProfiles = JSON.parse(readFileSync(join(ROOT, 'src/shared/generatedBodyProfiles.json'), 'utf8'))

/** 全部类 id */
export const allClassIds = new Set(
  ['point', 'line', 'surface', 'body', 'field'].flatMap((layer) => (catalogs[layer] ?? []).map((c) => c.id))
)

/** 造一个最小 RunContext（能力 runner 用） */
export function mockContext(classId, params = {}) {
  return {
    instance: {
      id: `${classId}.test@r1`,
      classId,
      name: 'test',
      rev: 1,
      status: 'active',
      description: '',
      params,
      createdAt: 0,
      updatedAt: 0
    },
    def: { key: classId.split('.')[0], classLabel: 'X', classes: [], outputs: {} },
    pointClass: { id: classId, name: classId.split('.')[1], params: [], instances: [] },
    params,
    findInstance: () => undefined
  }
}
