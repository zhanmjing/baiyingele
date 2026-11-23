#!/usr/bin/env node
/**
 * 从 build/data 的旧数据重新生成 src/shared/generatedFullCatalogs.json。
 *
 * 背景：README 声称目录是从 build/data 生成的，但生成器从来没进仓库，
 * 于是改数据只能手撕 4,974 行 JSON，且改完无法验证是否可再生成。
 * 这个脚本是逆向还原出来的等价实现：对当前数据输出与仓库文件逐字节一致。
 *
 * 用法：
 *   node scripts/gen-catalogs.mjs            # 只检查漂移（CI / check 用）
 *   node scripts/gen-catalogs.mjs --write    # 写回文件
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'src/shared/generatedFullCatalogs.json')

const DETAIL_PARAM = {
  key: 'detail',
  label: '配置摘要',
  type: 'text',
  required: false,
  description: '实例配置摘要',
  defaultValue: ''
}

/** detail 字段可能是 JSON（点层）也可能是纯文本（其他层） */
function parseDetail(detail) {
  try {
    const value = JSON.parse(detail)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** 嵌套对象在参数里以 JSON 字符串保存（例如 window.control 的 selector） */
function paramValue(value) {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function inferType(value) {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'bool'
  return 'text'
}

function normalizeStatus(status) {
  return status === 'stable' ? 'active' : status
}

/** 点层：参数从实例 detail 的 JSON 里推导（按首次出现顺序 + 首次出现处的类型） */
function transformPointLayer(source) {
  return source.classes.map((item) => {
    const instances = item.instances.map((instance) => {
      const detail = parseDetail(instance.detail)
      return {
        id: instance.id,
        name: instance.name,
        rev: instance.rev,
        status: normalizeStatus(instance.status),
        description: instance.detail,
        params: detail
          ? Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, paramValue(v)]))
          : {}
      }
    })

    const seen = new Map()
    const types = new Map()
    for (const raw of item.instances) {
      const detail = parseDetail(raw.detail)
      if (!detail) continue
      for (const [key, value] of Object.entries(detail)) {
        if (seen.has(key)) continue
        seen.set(key, paramValue(value))
        types.set(key, inferType(value))
      }
    }
    const params = [...seen].map(([key, value]) => ({
      key,
      label: key,
      type: types.get(key),
      required: false,
      description: key,
      defaultValue: value
    }))

    return {
      id: item.id,
      name: item.name,
      family: item.group,
      priority: item.priority,
      effect: item.effect,
      status: normalizeStatus(item.status),
      description: item.summary,
      params,
      instances
    }
  })
}

/** 线 / 面 / 体层：detail 是纯文本，统一塞进一个合成参数 */
function transformFlatLayer(source, { deriveInstanceId } = {}) {
  return source.classes.map((item) => ({
    id: item.id,
    name: item.name,
    family: item.group,
    priority: item.priority,
    effect: item.effect,
    status: normalizeStatus(item.status),
    description: item.summary,
    params: [{ ...DETAIL_PARAM }],
    instances: item.instances.map((instance) => ({
      id: deriveInstanceId ? instance.id ?? deriveInstanceId(item, instance) : instance.id,
      name: instance.name,
      rev: instance.rev,
      status: normalizeStatus(instance.status),
      description: instance.detail,
      params: { detail: instance.detail }
    }))
  }))
}

/**
 * 场层来自独立数据集，字段名不同（autonomy / output / landing）。
 * 另外：场层实例的 detail 如果是 JSON，就按点层的方式解析成 typed params；
 * 是纯文本时退回合成的 { detail } 参数（保证老数据输出不变）。
 */
function transformFieldLayer(source) {
  return source.classes.map((item) => {
    const instances = item.instances.map((instance) => {
      const detail = parseDetail(instance.detail)
      return {
        id: instance.id ?? `${item.id}.${instance.name}@r${instance.rev}`,
        name: instance.name,
        rev: instance.rev,
        status: normalizeStatus(instance.status),
        description: instance.detail,
        params: detail
          ? Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, paramValue(v)]))
          : { detail: instance.detail }
      }
    })

    const seen = new Map()
    const types = new Map()
    for (const raw of item.instances) {
      const detail = parseDetail(raw.detail)
      if (!detail) continue
      for (const [key, value] of Object.entries(detail)) {
        if (seen.has(key)) continue
        seen.set(key, paramValue(value))
        types.set(key, inferType(value))
      }
    }
    const params = seen.size
      ? [...seen].map(([key, value]) => ({
          key,
          label: key,
          type: types.get(key),
          required: false,
          description: key,
          defaultValue: value
        }))
      : [{ ...DETAIL_PARAM }]

    return {
      id: item.id,
      name: item.name ?? item.id.replace(/^field\./, ''),
      family: item.family,
      priority: item.priority,
      effect: item.autonomy,
      landing: item.landing,
      status: normalizeStatus(item.status),
      description: item.summary ?? `${item.output} → ${item.landing} · 自主度上限 ${item.autonomy}`,
      params,
      instances
    }
  })
}

export function readLayer(layer) {
  const dir = resolve(ROOT, 'build/data/catalog', layer)
  const indexPath = join(dir, '_index.json')
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    return {
      classes: index.order.map((id) =>
        JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))
      )
    }
  }
  const legacyDir = resolve(ROOT, 'build/data/legacy')
  if (layer === 'field') {
    const fields = JSON.parse(readFileSync(join(legacyDir, 'field-data.json'), 'utf8'))
    return { classes: fields.classes }
  }
  const layers = JSON.parse(readFileSync(join(legacyDir, 'layer-catalogs.json'), 'utf8'))
  return layers[layer]
}

/** 校验 catalog 目录：_index 与实际文件必须一一对应 */
export function auditCatalogDir() {
  const problems = []
  for (const layer of ['point', 'line', 'surface', 'body', 'field']) {
    const dir = resolve(ROOT, 'build/data/catalog', layer)
    const indexPath = join(dir, '_index.json')
    if (!existsSync(indexPath)) {
      problems.push(`${layer}: 缺少 _index.json`)
      continue
    }
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    const onDisk = new Set(readdirSync(dir).filter((name) => name.endsWith('.json') && name !== '_index.json').map((name) => name.replace(/\.json$/, '')))
    const listed = new Set(index.order)
    for (const id of listed) if (!onDisk.has(id)) problems.push(`${layer}: _index 列了 ${id} 但文件不存在`)
    for (const id of onDisk) if (!listed.has(id)) problems.push(`${layer}: ${id}.json 没被 _index 收录`)
    if (listed.size !== index.order.length) problems.push(`${layer}: _index 里有重复 id`)
  }
  return problems
}

export function generateFullCatalogs() {
  return {
    point: transformPointLayer(readLayer('point')),
    line: transformFlatLayer(readLayer('line')),
    surface: transformFlatLayer(readLayer('surface')),
    body: transformFlatLayer(readLayer('body'), {
      deriveInstanceId: (item, instance) => `${item.id}.${instance.name}@r${instance.rev}`
    }),
    field: transformFieldLayer(readLayer('field'))
  }
}

/** 与仓库现有文件比对，返回漂移清单（空数组 = 完全一致） */
export function diffAgainstRepo(generated) {
  const current = JSON.parse(readFileSync(OUT_FILE, 'utf8'))
  const drift = []
  for (const layer of Object.keys(generated)) {
    const a = generated[layer] ?? []
    const b = current[layer] ?? []
    if (a.length !== b.length) drift.push(`${layer}: 类数量 ${a.length} ≠ ${b.length}`)
    const byId = new Map(b.map((item) => [item.id, item]))
    for (const item of a) {
      const existing = byId.get(item.id)
      if (!existing) {
        drift.push(`${layer}: 新增类 ${item.id}`)
        byId.delete(item.id)
        continue
      }
      if (JSON.stringify(item) !== JSON.stringify(existing)) drift.push(`${layer}: 内容变化 ${item.id}`)
      byId.delete(item.id)
    }
    for (const id of byId.keys()) drift.push(`${layer}: 多余类 ${id}`)
  }
  return drift
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const generated = generateFullCatalogs()
  const drift = diffAgainstRepo(generated)
  if (process.argv.includes('--write')) {
    writeFileSync(OUT_FILE, `${JSON.stringify(generated, null, 2)}\n`, 'utf8')
    console.log(`已写入 ${OUT_FILE}`)
    console.log(drift.length ? `覆盖掉 ${drift.length} 处漂移：\n  ${drift.slice(0, 20).join('\n  ')}` : '内容与生成结果一致')
  } else if (drift.length) {
    console.error(`目录与 build/data 不一致（${drift.length} 处）：`)
    for (const line of drift.slice(0, 40)) console.error(`  ${line}`)
    console.error('\n改数据请改 build/data 后运行：npm run data:gen')
    process.exit(1)
  } else {
    console.log('目录与 build/data 一致（5 层全部可复原）')
  }
}
