#!/usr/bin/env node
/**
 * 新建一个点能力的脚手架。
 *
 *   npm run new:point -- file.scan --name 扫描目录 --params root,pattern,depth,limit
 *   npm run new:point -- file.scan --impl     # 顺手生成能力模块骨架
 *
 * 会做四件事：
 *   1. 写 build/data/catalog/point/<id>.json（含一个默认实例）
 *   2. 把 id 插进同目录 _index.json
 *   3. 跑 data:gen 重新生成目录
 *   4. --impl 时再生成 src/main/capabilities/<id>.ts 并跑 impl:gen
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_DIR = resolve(ROOT, 'build/data/catalog/point')
const CAPABILITY_DIR = resolve(ROOT, 'src/main/capabilities')

const argv = process.argv.slice(2)
const id = argv.find((arg) => !arg.startsWith('--'))
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback
}
const has = (name) => argv.includes(`--${name}`)

if (!id) {
  console.error('用法: npm run new:point -- <id> [--name 名称] [--group file] [--effect L0] [--priority P1] [--summary "…"] [--params a,b,c] [--impl]')
  process.exit(1)
}
if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(id)) {
  console.error(`非法 id：${id}（要求 domain.verb，全小写，点分段，例如 file.scan）`)
  process.exit(1)
}

const classPath = join(CATALOG_DIR, `${id}.json`)
if (existsSync(classPath)) {
  console.error(`已存在：${classPath}`)
  process.exit(1)
}

const name = flag('name', id)
const group = flag('group', id.split('.')[0])
const effect = flag('effect', 'L0')
const priority = flag('priority', 'P1')
const summary = flag('summary', `${name}（待补充摘要）`)
const params = (flag('params', '') || '').split(',').map((p) => p.trim()).filter(Boolean)

const detail = Object.fromEntries(params.map((key) => [key, '']))
const instanceName = 'i-default'

const pointClass = {
  id,
  name,
  group,
  version: '1.0.0',
  status: 'stable',
  effect,
  priority,
  summary,
  instances: [
    {
      id: `${id}.${instanceName}@r1`,
      name: instanceName,
      rev: 1,
      status: 'stable',
      detail: JSON.stringify(detail)
    }
  ]
}

writeFileSync(classPath, `${JSON.stringify(pointClass, null, 2)}\n`, 'utf8')

const indexPath = join(CATALOG_DIR, '_index.json')
const index = JSON.parse(readFileSync(indexPath, 'utf8'))
if (!index.order.includes(id)) index.order.push(id)
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')

console.log(`✓ ${classPath}`)
console.log(`✓ _index.json（共 ${index.order.length} 个类）`)

if (has('impl')) {
  const capabilityPath = join(CAPABILITY_DIR, `${id}.ts`)
  if (existsSync(capabilityPath)) {
    console.error(`能力模块已存在：${capabilityPath}`)
  } else {
    const source = `import { elapsed, type Capability } from './_shared'

export const id = '${id}'
export const summary = '${summary.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'

/** TODO: 按 build/data/catalog/point/${id}.json 的契约实现。当前只会返回 warn，不会伪造成功。 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  return {
    status: 'warn',
    output: \`尚未实现：\${ctx.instance.classId}\`,
    elapsedMs: elapsed(startedAt)
  }
}
`
    writeFileSync(capabilityPath, source, 'utf8')
    console.log(`✓ ${capabilityPath}`)
    console.log('⚠ 该骨架会让这个类在界面上显示为「真实」，请在同一次改动里写完实现')
  }
}

execFileSync('node', [resolve(ROOT, 'scripts/gen-catalogs.mjs'), '--write'], { stdio: 'inherit', cwd: ROOT })
if (has('impl')) {
  execFileSync('node', [resolve(ROOT, 'scripts/gen-impl-manifest.mjs')], { stdio: 'inherit', cwd: ROOT })
}

console.log('\n下一步：')
console.log(`  1. 编辑 build/data/catalog/point/${id}.json 填参数与默认值`)
if (!has('impl')) console.log(`  2. 写实现：src/main/capabilities/${id}.ts（导出 id / summary / run），再跑 npm run impl:gen`)
console.log('  3. npm run refs && npm run validate')
