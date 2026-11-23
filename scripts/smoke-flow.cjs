#!/usr/bin/env node
/**
 * 无 GUI 的运行时冒烟测试。
 *
 * 验证 flow.clipboard-to-file 真的能端到端跑完四个节点：
 *   读剪贴板 → 套模板 → 写文件 → 系统通知
 * 并且每次都落成一条真实的 PointRun，最后聚合成一条 FlowRun。
 *
 * 覆盖三块：
 *   1. 线层执行器：flow.clipboard-to-file 四节点端到端
 *   2. 真实能力：file.read / file.move 的成功与失败路径
 *   3. 存储：新增类时的增量补齐（不能清空已有实例）
 * 只替换掉 electron 相关副作用（剪贴板用固定文本、通知不弹窗），
 * 组合、映射、串流、记录、落盘全部走真实代码。
 *
 * 用法：npm run smoke（会先把 layerStore / flowRuntime 编译到 .tmp/smoke）
 */
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { LayerStore } = require('../.tmp/smoke/main/layerStore.js')
const { createLineRunner, orderNodes, parseFlowArgs } = require('../.tmp/smoke/main/flowRuntime.js')
const { CAPABILITIES } = require('../.tmp/smoke/main/capabilities/index.js')
const catalogs = require('../src/shared/generatedFullCatalogs.json')
const profiles = require('../src/shared/generatedLineProfiles.json')

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'baiying-smoke-'))
process.chdir(workdir)

const CLIP_TEXT = 'Hello from clipboard'

const pointRunner = ({ instance, params, input }) => {
  switch (instance.classId) {
    case 'win.clipboard.get':
      return { status: 'ok', output: `剪贴板文本 · ${CLIP_TEXT.length} 字符`, value: CLIP_TEXT, elapsedMs: 1 }
    case 'text.template': {
      const rendered = String(params.template).split('{{input}}').join(input ?? '')
      return { status: 'ok', output: `模板已套用 · ${rendered.length} 字符`, value: rendered, elapsedMs: 1 }
    }
    case 'file.write': {
      const target = String(params.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      if (String(params.append) === 'true') fs.appendFileSync(target, String(params.text ?? input ?? ''))
      else fs.writeFileSync(target, String(params.text ?? input ?? ''))
      return { status: 'ok', output: `已写入 ${target}`, value: target, elapsedMs: 1 }
    }
    case 'notify.toast':
      return { status: 'ok', output: `已发送系统通知 · ${String(input ?? '').length} 字符`, value: String(input ?? ''), elapsedMs: 1 }
    default:
      return null
  }
}

const pointStore = new LayerStore(
  path.join(workdir, 'point-state.json'),
  { key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {} },
  pointRunner
)
const lineStore = new LayerStore(
  path.join(workdir, 'line-state.json'),
  { key: 'line', classLabel: 'FlowClass', classes: catalogs.line, outputs: {} },
  createLineRunner({ profiles, pointStore: () => pointStore })
)

async function main() {
  // 1. 纯函数层
  assert.deepStrictEqual(parseFlowArgs('path=inbox.md；append=true'), { path: 'inbox.md', append: 'true' })
  const order = orderNodes(profiles['flow.clipboard-to-file']).map((node) => node.id)
  assert.deepStrictEqual(order, ['clip', 'template', 'write', 'notify'], `节点顺序错误: ${order.join('>')}`)
  console.log('✓ parseFlowArgs / orderNodes')

  // 2. 端到端：跑一条真实流程
  const record = await lineStore.run('inst.clipboard-inbox@r3')
  assert.strictEqual(record.status, 'ok', `FlowRun 失败: ${record.output}`)
  assert.match(record.output, /4 节点 · 成功 4 跳过 0 失败 0/, `节点统计异常: ${record.output}`)
  console.log('✓ FlowRun ok:', record.output.slice(0, 120), '…')

  // 3. 每个节点都产生了真实 PointRun
  const pointRuns = pointStore.runs(10)
  assert.strictEqual(pointRuns.length, 4, `PointRun 数量应为 4，实际 ${pointRuns.length}`)
  assert.deepStrictEqual(
    pointRuns.map((run) => run.classId).reverse(),
    ['win.clipboard.get', 'text.template', 'file.write', 'notify.toast']
  )
  console.log('✓ 4 条 PointRun:', pointRuns.map((run) => run.classId).reverse().join(' → '))

  // 4. 文件真的写出来了，内容是上游输出套模板后的结果
  const written = fs.readFileSync(path.join(workdir, 'inbox.md'), 'utf8')
  assert.ok(written.includes(CLIP_TEXT), `写文件内容不符: ${JSON.stringify(written)}`)
  assert.ok(written.startsWith('```'), '模板没有被套用')
  console.log('✓ 文件已落盘:', path.join(workdir, 'inbox.md'), `(${written.length} 字符)`)

  // 5. 运行记录持久化后能被重新读回
  const reloaded = new LayerStore(
    path.join(workdir, 'line-state.json'),
    { key: 'line', classLabel: 'FlowClass', classes: catalogs.line, outputs: {} },
    createLineRunner({ profiles, pointStore: () => pointStore })
  )
  assert.strictEqual(reloaded.runs(5)[0].id, record.id, '运行记录没有持久化')
  console.log('✓ 运行记录已持久化并可重读')

  // ── 6. 真实能力：file.read ───────────────────────────────────
  const ctx = (classId, params) => ({
    def: { key: 'point', classLabel: 'PointClass', classes: [], outputs: {} },
    instance: { classId, name: classId, params },
    pointClass: {},
    params,
    findInstance: () => undefined
  })

  const readTarget = path.join(workdir, 'read-me.txt')
  fs.writeFileSync(readTarget, '第一行内容\n第二行内容\n', 'utf8')

  const readOk = await CAPABILITIES['file.read'](ctx('file.read', { path: readTarget, encoding: 'utf-8', maxBytes: '4096' }))
  assert.strictEqual(readOk.status, 'ok', `file.read 应成功: ${readOk.output}`)
  assert.match(readOk.value, /第一行内容/, 'file.read 应返回原始文本')

  const readCut = await CAPABILITIES['file.read'](ctx('file.read', { path: readTarget, maxBytes: '3' }))
  assert.match(readCut.output, /已截断/, `maxBytes 应生效: ${readCut.output}`)

  const readMissing = await CAPABILITIES['file.read'](ctx('file.read', { path: path.join(workdir, 'nope.txt') }))
  assert.strictEqual(readMissing.status, 'warn', '不存在的路径必须返回 warn')

  const readDir = await CAPABILITIES['file.read'](ctx('file.read', { path: workdir }))
  assert.strictEqual(readDir.status, 'warn', '目录必须返回 warn')
  console.log('✓ file.read：成功 / 截断 / 缺失 / 目录 四种路径都正确')

  // ── 7. 真实能力：file.move ───────────────────────────────────
  const moveSrc = path.join(workdir, 'move-src.txt')
  const moveDst = path.join(workdir, 'nested', 'move-dst.txt')
  fs.writeFileSync(moveSrc, 'A', 'utf8')

  const moved = await CAPABILITIES['file.move'](ctx('file.move', { from: moveSrc, to: moveDst, overwrite: 'false' }))
  assert.strictEqual(moved.status, 'ok', `file.move 应成功: ${moved.output}`)
  assert.strictEqual(fs.existsSync(moveSrc), false, '源文件应已移走')
  assert.strictEqual(fs.readFileSync(moveDst, 'utf8'), 'A', '目标文件内容应正确')

  fs.writeFileSync(moveSrc, 'A2', 'utf8')
  fs.writeFileSync(moveDst, 'KEEP', 'utf8')
  const blocked = await CAPABILITIES['file.move'](ctx('file.move', { from: moveSrc, to: moveDst, overwrite: 'false' }))
  assert.strictEqual(blocked.status, 'warn', 'overwrite=false 且目标存在必须 warn')
  assert.strictEqual(fs.readFileSync(moveDst, 'utf8'), 'KEEP', '目标文件不能被改动')
  assert.strictEqual(fs.existsSync(moveSrc), true, '源文件必须还在')

  const forced = await CAPABILITIES['file.move'](ctx('file.move', { from: moveSrc, to: moveDst, overwrite: 'true' }))
  assert.strictEqual(forced.status, 'ok', `overwrite=true 应成功: ${forced.output}`)
  assert.strictEqual(fs.readFileSync(moveDst, 'utf8'), 'A2', '覆盖后内容应为源内容')

  const noSource = await CAPABILITIES['file.move'](ctx('file.move', { from: path.join(workdir, 'ghost.txt'), to: moveDst }))
  assert.strictEqual(noSource.status, 'warn', '源不存在必须 warn')
  console.log('✓ file.move：成功 / 拒绝覆盖 / 强制覆盖 / 源缺失 四种路径都正确')

  // ── 7b. 真实能力：file.scan ──────────────────────────────────
  const scanRoot = path.join(workdir, 'scan')
  fs.mkdirSync(path.join(scanRoot, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(scanRoot, 'a.txt'), 'a', 'utf8')
  fs.writeFileSync(path.join(scanRoot, 'b.md'), 'b', 'utf8')
  fs.writeFileSync(path.join(scanRoot, 'sub', 'c.txt'), 'c', 'utf8')

  const scanned = await CAPABILITIES['file.scan'](ctx('file.scan', { root: scanRoot, pattern: '*.txt', depth: '2', limit: '200' }))
  assert.strictEqual(scanned.status, 'ok', `file.scan 应成功: ${scanned.output}`)
  const scannedFiles = JSON.parse(scanned.value).map((item) => path.basename(item)).sort()
  assert.deepStrictEqual(scannedFiles, ['a.txt', 'c.txt'], `pattern/depth 过滤不对: ${scannedFiles.join(',')}`)

  const limitedScan = await CAPABILITIES['file.scan'](ctx('file.scan', { root: scanRoot, pattern: '*', depth: '2', limit: '1' }))
  assert.match(limitedScan.output, /已截断到 limit=1/, `limit 应生效: ${limitedScan.output}`)
  assert.strictEqual(JSON.parse(limitedScan.value).length, 1, 'limit 必须限制结果数')

  const scanMissing = await CAPABILITIES['file.scan'](ctx('file.scan', { root: path.join(workdir, 'ghost-dir') }))
  assert.strictEqual(scanMissing.status, 'warn', '目录不存在必须 warn')
  console.log('✓ file.scan：模式过滤 / limit 截断 / 目录缺失 都正确')

  // ── 8. 存储：新增类必须增量补齐，不能清空已有实例 ────────────
  const seedFile = path.join(workdir, 'seed-state.json')
  const fakeRunner = () => ({ status: 'ok', output: 'x', elapsedMs: 0 })
  const twoClasses = { key: 'point', classLabel: 'PointClass', classes: catalogs.point.slice(0, 2), outputs: {} }
  const storeA = new LayerStore(seedFile, twoClasses, fakeRunner)
  const firstInstanceId = storeA.catalog().instances[0].id
  storeA.update(firstInstanceId, { params: { probe: 'edited' } })
  const beforeCount = storeA.catalog().instances.length

  const thirdClass = catalogs.point[2]
  const threeClasses = { key: 'point', classLabel: 'PointClass', classes: catalogs.point.slice(0, 3), outputs: {} }
  const storeB = new LayerStore(seedFile, threeClasses, fakeRunner)
  const after = storeB.catalog().instances

  const survivor = after.find((instance) => instance.id === firstInstanceId)
  assert.ok(survivor, '已有实例不能被清空')
  assert.strictEqual(survivor.params.probe, 'edited', '已有实例的本地修改必须保留')
  assert.strictEqual(after.length, beforeCount + thirdClass.instances.length, '应只补新类的实例')
  assert.ok(after.some((instance) => instance.classId === thirdClass.id), '新类应被补齐')
  console.log(`✓ seed 增量补齐：${beforeCount} → ${after.length} 条，旧实例修改保留`)

  console.log('\n全部通过：flow.clipboard-to-file 端到端可执行')
}

main().catch((error) => {
  console.error('✗ 冒烟测试失败:', error.message)
  process.exit(1)
})
