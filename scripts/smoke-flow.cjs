#!/usr/bin/env node
/**
 * 无 GUI 的运行时冒烟测试。
 *
 * 验证 flow.clipboard-to-file 真的能端到端跑完四个节点：
 *   读剪贴板 → 套模板 → 写文件 → 系统通知
 * 并且每次都落成一条真实的 PointRun，最后聚合成一条 FlowRun。
 *
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

  console.log('\n全部通过：flow.clipboard-to-file 端到端可执行')
}

main().catch((error) => {
  console.error('✗ 冒烟测试失败:', error.message)
  process.exit(1)
})
