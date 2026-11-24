#!/usr/bin/env node
/**
 * 统一 id 迁移（第二步：代码与脚本）。
 *
 * 数据迁移跑完之后，源码里还有硬编码的旧 id：
 *   export const id = 'win.key.send'     能力注册 id
 *   outputs: { 'body.file-preview': … }  输出映射键
 *   断言里的 /flow\.ensure-vpn/           正则字面量
 *
 * 本脚本从「备份 vs 当前 catalog」重建别名表，然后在 src/ 与 scripts/ 里做
 * 引号包裹 token 与正则字面量的替换。必须紧跟在 migrate-atom-ids.mjs --write 之后跑。
 *
 * 用法：node scripts/migrate-atom-ids-code.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const WRITE = process.argv.includes('--write')
const BACKUP = join(ROOT, '.tmp/migration-backup/build/data/catalog')
const CURRENT = join(ROOT, 'build/data/catalog')

/** 用「同名类」把备份和当前的 id 对上，避免依赖旧文件名 */
function buildAlias() {
  const alias = new Map()
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const layer of readdirSync(BACKUP)) {
    const bdir = join(BACKUP, layer)
    const cdir = join(CURRENT, layer)
    if (!existsSync(cdir)) continue
    const currents = readdirSync(cdir).filter((n) => n.endsWith('.json') && n !== '_index.json')
      .map((n) => JSON.parse(readFileSync(join(cdir, n), 'utf8')))
    for (const name of readdirSync(bdir)) {
      if (!name.endsWith('.json') || name === '_index.json') continue
      const old = JSON.parse(readFileSync(join(bdir, name), 'utf8'))
      const cur = currents.find((c) => c.name === old.name)
      if (!cur) continue
      alias.set(old.id, cur.id)
      alias.set(esc(old.id), esc(cur.id))          // 类 id 的正则形态
      for (let i = 0; i < (old.instances ?? []).length; i++) {
        const oi = old.instances[i]
        const ni = cur.instances?.[i]
        if (!ni) continue
        const oldId = oi.id ?? `${old.id}.${oi.name}@r${oi.rev ?? 1}`
        alias.set(oldId, ni.id)
        const ob = oldId.replace(/@r\d+$/, '')
        const nb = String(ni.id).replace(/@r\d+$/, '')
        if (!alias.has(ob)) alias.set(ob, nb)
        // 正则字面量形态：点必须转义；连字符在字符类外不用转义，两种都登记
        alias.set(esc(ob), esc(nb))
        alias.set(esc(ob).replace(/-/g, '\\-'), esc(nb).replace(/-/g, '\\-'))
      }
    }
  }
  return alias
}

const alias = buildAlias()
const keys = [...alias.keys()].filter((k) => alias.get(k) !== k).sort((a, b) => b.length - a.length)
console.log(`别名表 ${alias.size} 条，需替换 ${keys.length} 条`)

const SKIP = new Set(['implemented.generated.ts', 'generatedFullCatalogs.json', 'requirements.generated.json'])
const targets = []
for (const dir of ['src', 'scripts']) collect(join(ROOT, dir))
function collect(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) { collect(full); continue }
    if (!/\.(ts|tsx|cjs|mjs)$/.test(name.name)) continue
    if (SKIP.has(name.name)) continue
    if (/migrate-atom-ids/.test(name.name)) continue
    targets.push(full)
  }
}

let files = 0
let total = 0
for (const file of targets) {
  const before = readFileSync(file, 'utf8')
  let after = before
  let n = 0
  for (const key of keys) {
    for (const q of ["'", '"', '`']) {
      const token = `${q}${key}${q}`
      if (!after.includes(token)) continue
      n += after.split(token).length - 1
      after = after.split(token).join(`${q}${alias.get(key)}${q}`)
    }
  }
  // 第二趟：正则字面量里的形态（含 \\. 转义）没有引号包裹，只能裸替换。
  // 因为带反斜杠的写法在正文里几乎不可能误伤，所以这一趟是安全的。
  for (const key of keys) {
    if (!key.includes('\\.')) continue
    if (!after.includes(key)) continue
    const next = alias.get(key)
    if (key === next) continue
    n += after.split(key).length - 1
    after = after.split(key).join(next)
  }
  if (after === before) continue
  files += 1
  total += n
  if (WRITE) writeFileSync(file, after, 'utf8')
}

console.log(`改写 ${files} 个文件、${total} 处${WRITE ? '（已写盘）' : '（预演，加 --write 落盘）'}`)
