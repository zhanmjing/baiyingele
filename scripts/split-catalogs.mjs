#!/usr/bin/env node
/**
 * 一次性迁移：把 build/data 里的整包目录拆成一类一文件。
 *
 *   build/data/legacy/layer-catalogs.json  ─┐
 *   build/data/legacy/field-data.json      ─┴→ build/data/catalog/<layer>/<class-id>.json
 *                                             build/data/catalog/<layer>/_index.json（顺序）
 *
 * 为什么要拆：4,974 行单文件里改一条记录要碰整份文件，diff 噪音大、冲突多，
 * 而补能力（118 个类）恰恰是最需要并行和 review 的活。
 *
 * 用法：node scripts/split-catalogs.mjs [--force]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'build/data')
const LEGACY_DIR = join(DATA_DIR, 'legacy')
const CATALOG_DIR = join(DATA_DIR, 'catalog')
const LAYERS = ['point', 'line', 'surface', 'body', 'field']

const force = process.argv.includes('--force')

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function main() {
  if (existsSync(CATALOG_DIR) && readdirSync(CATALOG_DIR).length && !force) {
    console.error('build/data/catalog 已存在；如需重建请加 --force')
    process.exit(1)
  }

  // 1. 归档旧文件（保留可追溯来源）
  mkdirSync(LEGACY_DIR, { recursive: true })
  for (const [from, to] of [
    [join(DATA_DIR, '.layer-catalogs.json'), join(LEGACY_DIR, 'layer-catalogs.json')],
    [join(DATA_DIR, '.field-data.json'), join(LEGACY_DIR, 'field-data.json')]
  ]) {
    if (existsSync(from) && !existsSync(to)) renameSync(from, to)
  }

  const layers = JSON.parse(readFileSync(join(LEGACY_DIR, 'layer-catalogs.json'), 'utf8'))
  const fields = JSON.parse(readFileSync(join(LEGACY_DIR, 'field-data.json'), 'utf8'))

  const sourceOf = (layer) => (layer === 'field' ? fields.classes : layers[layer].classes)

  let total = 0
  for (const layer of LAYERS) {
    const classes = sourceOf(layer)
    if (!Array.isArray(classes)) throw new Error(`层 ${layer} 的源数据不是数组`)
    const dir = join(CATALOG_DIR, layer)
    mkdirSync(dir, { recursive: true })
    const order = []
    for (const item of classes) {
      if (!item.id) throw new Error(`${layer} 存在没有 id 的条目`)
      writeJson(join(dir, `${item.id}.json`), item)
      order.push(item.id)
      total += 1
    }
    writeJson(join(dir, '_index.json'), { layer, order })
    console.log(`${layer.padEnd(8)} ${String(classes.length).padStart(2)} 个类 → build/data/catalog/${layer}/`)
  }
  console.log(`\n共写出 ${total} 个类文件；旧数据归档到 build/data/legacy/`)
}

main()
