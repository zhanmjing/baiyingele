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
const http = require('node:http')

// 能力模块会 require('electron')，但本脚本跑在纯 node 下。
// 先把 electron 换成可控假桩，这样剪贴板这类能力也能被真实断言。
const fakeClipboard = {
  text: '',
  async readText() {
    return this.text
  },
  async writeText(value) {
    this.text = value
  },
  async read() {
    return []
  },
  clear() {
    this.text = ''
  }
}
const shellCalls = []
const electronPath = require.resolve('electron')
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: {
    clipboard: fakeClipboard,
    app: { getPath: () => os.tmpdir(), setAppUserModelId() {} },
    Notification: class {
      static isSupported() {
        return false
      }
      show() {}
    },
    shell: {
      async openPath(target) {
        shellCalls.push(['openPath', target])
        return ''
      },
      async openExternal(target) {
        shellCalls.push(['openExternal', target])
      }
    },
    desktopCapturer: {
      async getSources() {
        return [
          {
            id: 'screen:0:0',
            name: 'Screen 1',
            thumbnail: { toPNG: () => Buffer.from('fake-png-bytes') }
          }
        ]
      }
    },
    screen: { getPrimaryDisplay: () => ({ size: { width: 1280, height: 720 } }) }
  }
}

const { LayerStore } = require('../.tmp/smoke/main/layerStore.js')
const { createLineRunner, orderNodes, parseFlowArgs } = require('../.tmp/smoke/main/flowRuntime.js')
const { CAPABILITIES } = require('../.tmp/smoke/main/capabilities/index.js')
const { decideLanding } = require('../.tmp/smoke/shared/fieldLanding.js')
const { applyLanding } = require('../.tmp/smoke/main/fieldRuntime.js')
const { UndoJournal } = require('../.tmp/smoke/main/undoJournal.js')
const { selectWindows, parseSelector } = require('../.tmp/smoke/main/capabilities/win.window.query.js')
const { planThemeChange } = require('../.tmp/smoke/main/capabilities/win.theme.mode.js')
const { computeRect, resolveTarget } = require('../.tmp/smoke/main/capabilities/win.window.control.js')
const { parseCombo, matchesCombo, withHeldModifiers, registeredCombos, stopHook } = require('../.tmp/smoke/main/capabilities/win.key.trigger.js')
const { TriggerStore } = require('../.tmp/smoke/main/triggerStore.js')
const { TriggerService } = require('../.tmp/smoke/main/triggerService.js')
const gesture = require('../.tmp/smoke/shared/gestureRecognizer.js')
const keysend = require('../.tmp/smoke/main/capabilities/win.key.send.js')
const volmod = require('../.tmp/smoke/main/capabilities/win.audio.volume.js')
const comm = require('../.tmp/smoke/main/capabilities/_com.js')
const bright = require('../.tmp/smoke/main/capabilities/win.display.brightness.js')
const formSpec = require('../.tmp/smoke/shared/formSpec.js')
const formMod = require('../.tmp/smoke/main/capabilities/ui.form.js')
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
  assert.match(record.output, /4 节点 · 真实 4 模拟 0 跳过 0 失败 0/, `节点统计异常: ${record.output}`)
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


  // ── 5b. 线层引擎：分支路由 / 未实现 gate / 子流程 / 循环引用 ──────
  const { evaluateIfGate, firedEdges } = require('../.tmp/smoke/main/flowRuntime.js')
  const { hasRealImpl } = require('../.tmp/smoke/shared/implRegistry.js')

  // if gate 只认明确值，含糊值必须拒绝（不能替用户猜）
  for (const [input, expect] of [['true', true], ['1', true], ['yes', true], ['ok', true],
    ['false', false], ['0', false], ['no', false], ['', false]]) {
    const decided = evaluateIfGate(input)
    assert.strictEqual(decided.ok, true, `evaluateIfGate(${input}) 应能判断`)
    assert.strictEqual(decided.truthy, expect, `evaluateIfGate(${input}) 应为 ${expect}`)
  }
  assert.strictEqual(evaluateIfGate('maybe').ok, false, '含糊值必须拒绝')

  const flowDir = path.join(workdir, 'flow-engine')
  fs.mkdirSync(flowDir, { recursive: true })

  // 脚本化点 store：按 classId 返回预设状态，并记录跑过哪些实例
  const scripted = (statusByClass = {}) => {
    const ran = []
    const store = new LayerStore(
      path.join(flowDir, `pt-${Math.random().toString(36).slice(2)}.json`),
      { key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {} },
      async (runCtx) => {
        ran.push(runCtx.instance.id)
        const status = statusByClass[runCtx.instance.classId] ?? 'ok'
        return { status, output: `${runCtx.instance.classId}:${status}`, elapsedMs: 1 }
      }
    )
    return { store, ran }
  }
  const flowCtx = (classId, description = '', input = '') => ({
    def: { key: 'line', classLabel: 'FlowClass', classes: [], outputs: {} },
    instance: { id: `inst.${classId}`, classId, description, params: {} },
    input,
    args: {},
    params: {},
    findInstance: () => undefined
  })

  // A. probe 成功 → 只走 ok 分支，warn 分支绝不能执行
  {
    const { store } = scripted({})
    const runner = createLineRunner({ profiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('flow.ensure-vpn', 'url=https://example.com'))
    const trace = outcome.evidence.nodes
    assert.strictEqual(outcome.status, 'ok', `probe 正常时流程应 ok: ${outcome.output}`)
    assert.deepStrictEqual(trace.map((n) => n.id), ['probe', 'guard', 'ready'], `只应执行 ok 分支: ${trace.map((n) => n.id)}`)
    assert.strictEqual(trace.some((n) => n.id === 'manual'), false, 'warn 分支不应执行')
    assert.deepStrictEqual(trace[1].fired, ['ready'], 'guard 只应激活 ready')
  }

  // B. probe 失败 → 走 warn 分支；且流程状态必须降到 warn（不能吞掉警告）
  {
    const { store } = scripted({ 'win.http.request': 'warn' })
    const runner = createLineRunner({ profiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('flow.ensure-vpn', 'url=https://example.com'))
    const trace = outcome.evidence.nodes
    assert.deepStrictEqual(trace.map((n) => n.id), ['probe', 'guard', 'manual'], `只应执行 warn 分支: ${trace.map((n) => n.id)}`)
    assert.strictEqual(trace.some((n) => n.id === 'ready'), false, 'ok 分支不应执行')
    assert.strictEqual(outcome.status, 'warn', '中间节点 warn 时流程必须 warn，不能报 ok')
    assert.strictEqual(outcome.evidence.warned, 1, 'warn 计数应为 1')
  }

  // C. 除了 if / if-status / foreach 之外的 gate 必须让流程停下，而不是跳过继续
  {
    const { store } = scripted({})
    const customProfiles = {
      'test.unknown-gate': {
        classId: 'test.unknown-gate',
        nodes: [
          { id: 'loop', label: '未知门', kind: 'gate', gate: 'while', x: 0, y: 0, w: 1, h: 1 },
          { id: 'after', label: '后续', kind: 'point', pointClass: 'notify.toast', pointInstance: 'notify.toast.i-system@r1', x: 1, y: 0, w: 1, h: 1 }
        ],
        edges: [{ from: 'loop', to: 'after' }]
      }
    }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('test.unknown-gate'))
    assert.strictEqual(outcome.status, 'warn', '未实现 gate 必须 warn')
    assert.match(outcome.output, /尚未实现/, `应说明 gate 未实现: ${outcome.output}`)
    assert.deepStrictEqual(outcome.evidence.nodes.map((n) => n.id), ['loop'], 'gate 之后的下游绝不能执行')
    assert.notStrictEqual(outcome.evidence.halted, null, '必须给出 halted 原因')
  }

  // C2. foreach：按列表逐项跑循环体，跑完再跑 done 分支
  const foreachProfile = {
    classId: 'test.foreach',
    nodes: [
      { id: 'loop', label: '遍历', kind: 'gate', gate: 'foreach', x: 0, y: 0, w: 1, h: 1 },
      { id: 'body', label: '处理一项', kind: 'point', pointClass: 'clipboard.write', pointInstance: 'clipboard.write.i-text@r1', x: 1, y: 0, w: 1, h: 1 },
      { id: 'done', label: '收尾', kind: 'point', pointClass: 'notify.toast', pointInstance: 'notify.toast.i-system@r1', x: 2, y: 0, w: 1, h: 1 }
    ],
    edges: [
      { from: 'loop', to: 'body', label: 'each' },
      { from: 'body', to: 'loop' },
      { from: 'loop', to: 'done', label: 'done' }
    ]
  }
  {
    const { store, ran } = scripted({})
    const customProfiles = { ...profiles, 'test.foreach': foreachProfile }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('test.foreach', '', JSON.stringify(['a.txt', 'b.txt', 'c.txt'])))
    const bodyRuns = ran.filter((id) => id === 'clipboard.write.i-text@r1').length
    const doneRuns = ran.filter((id) => id === 'notify.toast.i-system@r1').length
    assert.strictEqual(outcome.status, 'ok', `foreach 正常时应 ok: ${outcome.output}`)
    assert.strictEqual(bodyRuns, 3, `循环体应跑 3 次，实际 ${bodyRuns}`)
    assert.strictEqual(doneRuns, 1, `done 分支应跑 1 次，实际 ${doneRuns}`)
    const loopNode = outcome.evidence.nodes.find((n) => n.id === 'loop')
    assert.strictEqual(loopNode.status, 'ok')
    assert.match(outcome.output, /遍历 3\/3 项/, `应报告遍历数量: ${outcome.output}`)
  }

  // C3. foreach 输入不是列表 → 停下，不猜
  {
    const { store } = scripted({})
    const customProfiles = { ...profiles, 'test.foreach': foreachProfile }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('test.foreach', '', '这不是列表'))
    assert.strictEqual(outcome.status, 'warn', '非列表输入必须 warn')
    assert.match(outcome.output, /既不是 JSON 数组也不是多行列表/, `应说明原因: ${outcome.output}`)
  }

  // C4. foreach 超过迭代上限 → 停下，不静默截断
  {
    const { store } = scripted({})
    const customProfiles = { ...profiles, 'test.foreach': foreachProfile }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const many = JSON.stringify(Array.from({ length: 101 }, (_, i) => `f${i}.txt`))
    const outcome = await runner(flowCtx('test.foreach', '', many))
    assert.strictEqual(outcome.status, 'warn')
    assert.match(outcome.output, /超过上限/, `应说明超限: ${outcome.output}`)
  }

  // C5. foreach 缺少 each 出边 → 结构性错误，停下说清楚
  {
    const { store } = scripted({})
    const broken = {
      ...foreachProfile,
      classId: 'test.foreach-broken',
      edges: [{ from: 'loop', to: 'done', label: 'done' }]
    }
    const customProfiles = { ...profiles, 'test.foreach-broken': broken }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('test.foreach-broken', '', JSON.stringify(['x'])))
    assert.strictEqual(outcome.status, 'warn')
    assert.match(outcome.output, /缺少 each 出边/, `应指出结构问题: ${outcome.output}`)
  }

  // C6. entryNodes：foreach 的回边不算入度，gate 仍是入口
  {
    const { entryNodes } = require('../.tmp/smoke/main/flowRuntime.js')
    const entries = entryNodes(foreachProfile).map((n) => n.id)
    assert.deepStrictEqual(entries, ['loop'], `foreach 图的入口应只有 loop，实际 ${entries}`)
  }

  // D. 子流程：父流程里真的把子流程跑完，再继续后续节点
  {
    const { store, ran } = scripted({})
    const customProfiles = {
      ...profiles,
      'test.parent': {
        classId: 'test.parent',
        nodes: [
          { id: 'sub', label: '子流程', kind: 'subflow', pointInstance: 'inst.ensure-vpn-ask@r2', x: 0, y: 0, w: 1, h: 1 },
          { id: 'after', label: '后续', kind: 'point', pointClass: 'notify.toast', pointInstance: 'notify.toast.i-system@r1', x: 1, y: 0, w: 1, h: 1 }
        ],
        edges: [{ from: 'sub', to: 'after' }]
      }
    }
    const runner = createLineRunner({ profiles: customProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('test.parent'))
    const trace = outcome.evidence.nodes
    assert.deepStrictEqual(trace.map((n) => n.id), ['sub', 'after'], `子流程应执行: ${trace.map((n) => n.id)}`)
    assert.strictEqual(trace[0].kind, 'subflow')
    assert.match(outcome.output, /flow\.ensure-vpn/, '子流程输出应标明跑了哪个类')
    assert.ok(ran.length >= 3, `子流程内部节点也要真跑，实际跑了 ${ran.length} 个`)
  }

  // E. 子流程自调用必须被循环引用挡住
  {
    const { store } = scripted({})
    const loopProfiles = {
      'flow.ensure-vpn': {
        classId: 'flow.ensure-vpn',
        nodes: [{ id: 'self', label: '自调用', kind: 'subflow', pointInstance: 'inst.ensure-vpn-ask@r2', x: 0, y: 0, w: 1, h: 1 }],
        edges: []
      }
    }
    const runner = createLineRunner({ profiles: loopProfiles, pointStore: () => store, lineStore: () => lineStore })
    const outcome = await runner(flowCtx('flow.ensure-vpn'))
    assert.strictEqual(outcome.status, 'warn', '循环引用必须 warn')
    assert.match(outcome.output, /循环引用/, `应报循环引用: ${outcome.output}`)
  }

  // F. 图谱完整性：13 个 FlowClass 都要有图，每个节点绑定都要真实有效
  const pointClassOfInstance = new Map(catalogs.point.flatMap((cls) => cls.instances.map((item) => [item.id, cls.id])))
  const lineInstanceIds = new Set(catalogs.line.flatMap((cls) => cls.instances.map((item) => item.id)))
  for (const cls of catalogs.line) {
    assert.ok(profiles[cls.id], `FlowClass ${cls.id} 缺少数据流图谱`)
  }
  for (const [classId, profile] of Object.entries(profiles)) {
    const nodeIds = new Set(profile.nodes.map((n) => n.id))
    for (const edgeItem of profile.edges) {
      assert.ok(nodeIds.has(edgeItem.from), `${classId} 的边起点不存在: ${edgeItem.from}`)
      assert.ok(nodeIds.has(edgeItem.to), `${classId} 的边终点不存在: ${edgeItem.to}`)
    }
    for (const item of profile.nodes) {
      if (item.kind === 'point') {
        const boundClass = pointClassOfInstance.get(item.pointInstance)
        assert.ok(boundClass, `${classId}/${item.id} 绑定了不存在的点实例 ${item.pointInstance}`)
        assert.strictEqual(item.pointClass, boundClass, `${classId}/${item.id} 的 pointClass 与实际不符`)
        assert.ok(hasRealImpl(boundClass), `${classId}/${item.id} 绑定的 ${boundClass} 没有真实实现`)
      }
      if (item.kind === 'subflow') {
        const target = item.pointInstance ?? ''
        if (target.startsWith('$args.')) {
          // 参数化目标：每个实例都必须真的提供这个参数，且解析出来是存在的线实例
          const argKey = target.slice('$args.'.length)
          const classInstances = catalogs.line.find((c) => c.id === classId)?.instances ?? []
          assert.ok(classInstances.length, `${classId} 没有实例，却用了参数化子流程目标`)
          for (const inst of classInstances) {
            const parsed = parseFlowArgs(inst.description ?? '')
            assert.ok(parsed[argKey], `${classId}/${inst.id} 缺少子流程参数 ${argKey}`)
            assert.ok(
              lineInstanceIds.has(parsed[argKey]),
              `${classId}/${inst.id} 的 ${argKey}=${parsed[argKey]} 不是存在的线实例`
            )
          }
        } else {
          assert.ok(lineInstanceIds.has(target), `${classId}/${item.id} 的子流程目标不存在 ${target}`)
        }
      }
    }
  }
  console.log(`✓ 线层引擎：分支路由 / 未实现 gate 停下 / 子流程 / 循环引用 / ${Object.keys(profiles).length} 张图谱完整性 都正确`)

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

  // toDir：搬进目录并保留原文件名（批量归档靠这个）
  const archiveDir = path.join(workdir, 'archive-target')
  const archiveSrc = path.join(workdir, 'to-archive.txt')
  fs.writeFileSync(archiveSrc, 'ARCH', 'utf8')
  const intoDir = await CAPABILITIES['file.move'](ctx('file.move', { from: archiveSrc, toDir: archiveDir, overwrite: 'false' }))
  assert.strictEqual(intoDir.status, 'ok', `toDir 应成功: ${intoDir.output}`)
  assert.strictEqual(fs.existsSync(path.join(archiveDir, 'to-archive.txt')), true, '文件名应保留在目标目录里')
  assert.strictEqual(fs.existsSync(archiveSrc), false, '源应已移走')
  assert.strictEqual(intoDir.evidence?.toDir, archiveDir)

  // to 和 toDir 互斥
  const bothTargets = await CAPABILITIES['file.move'](ctx('file.move', { from: moveDst, to: moveDst, toDir: archiveDir }))
  assert.strictEqual(bothTargets.status, 'warn', 'to 和 toDir 同时给必须拒绝')
  assert.match(bothTargets.output, /只能给一个/)

  // 两个都不给
  const noMoveTarget = await CAPABILITIES['file.move'](ctx('file.move', { from: moveDst }))
  assert.strictEqual(noMoveTarget.status, 'warn', '缺目标必须拒绝')

  // 源和目标相同 → 明确拒绝，不做无意义操作
  const sameFile = await CAPABILITIES['file.move'](ctx('file.move', { from: moveDst, toDir: path.dirname(moveDst) }))
  assert.strictEqual(sameFile.status, 'warn', '源目标相同必须拒绝')
  assert.match(sameFile.output, /源和目标相同/)

  console.log('✓ file.move：成功 / 拒绝覆盖 / 强制覆盖 / 源缺失 / toDir / 互斥 / 同源 七种路径都正确')

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

  // ── 7c. 真实能力：clipboard.write ↔ win.clipboard.get 往返 ──
  fakeClipboard.text = ''

  const emptyWrite = await CAPABILITIES['clipboard.write'](ctx('clipboard.write', { text: '' }))
  assert.strictEqual(emptyWrite.status, 'warn', '空文本必须 warn')
  assert.strictEqual(fakeClipboard.text, '', '空文本不能改动剪贴板')

  const CLIPBOARD_TEXT = '你好，剪贴板'
  const clipWritten = await CAPABILITIES['clipboard.write'](ctx('clipboard.write', { text: CLIPBOARD_TEXT }))
  assert.strictEqual(clipWritten.status, 'ok', `写剪贴板应成功: ${clipWritten.output}`)
  assert.strictEqual(fakeClipboard.text, CLIPBOARD_TEXT, '剪贴板内容应被写入')

  const clipReadBack = await CAPABILITIES['win.clipboard.get'](ctx('win.clipboard.get', { format: 'text' }))
  assert.strictEqual(clipReadBack.status, 'ok', `读剪贴板应成功: ${clipReadBack.output}`)
  assert.strictEqual(clipReadBack.value, CLIPBOARD_TEXT, '写进去的内容必须能原样读回')

  fakeClipboard.text = ''
  const emptyRead = await CAPABILITIES['win.clipboard.get'](ctx('win.clipboard.get', { format: 'text' }))
  assert.strictEqual(emptyRead.status, 'warn', '空剪贴板必须 warn')
  console.log('✓ clipboard.write ↔ win.clipboard.get：写入 / 回读 / 空值保护 都正确')

  // ── 7d. translate.text：provider 降级链 本地 → 网络 → API ──────
  const startChatServer = (initialReply) =>
    new Promise((resolve) => {
      let reply = initialReply
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        const body = typeof reply === 'function' ? reply() : reply
        res.end(JSON.stringify({ choices: [{ message: { content: body } }] }))
      })
      server.listen(0, '127.0.0.1', () =>
        resolve({
          server,
          url: `http://127.0.0.1:${server.address().port}/v1`,
          setReply: (next) => {
            reply = next
          }
        })
      )
    })

  const clearTranslateEnv = () => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('BAIYING_TRANSLATE_')) delete process.env[key]
    }
  }

  const TRANSLATED = '你好，世界'
  const live = await startChatServer(TRANSLATED)
  const deadUrl = 'http://127.0.0.1:9/v1'

  clearTranslateEnv()
  const noProvider = await CAPABILITIES['translate.text'](ctx('translate.text', { text: 'hello' }))
  assert.strictEqual(noProvider.status, 'warn', '没配 provider 必须 warn')
  assert.match(noProvider.output, /未配置翻译 provider/, `文案不对: ${noProvider.output}`)

  process.env.BAIYING_TRANSLATE_LOCAL_URL = live.url
  const viaLocal = await CAPABILITIES['translate.text'](ctx('translate.text', { text: 'hello', target: 'zh' }))
  assert.strictEqual(viaLocal.status, 'ok', `本地档应成功: ${viaLocal.output}`)
  assert.strictEqual(viaLocal.value, TRANSLATED, '译文应原样透传')
  assert.match(viaLocal.output, /local 档/, `应标注命中 local: ${viaLocal.output}`)

  process.env.BAIYING_TRANSLATE_LOCAL_URL = deadUrl
  process.env.BAIYING_TRANSLATE_NETWORK_URL = live.url
  const viaNetwork = await CAPABILITIES['translate.text'](ctx('translate.text', { text: 'hello' }))
  assert.strictEqual(viaNetwork.status, 'ok', `本地挂掉应降级到网络档: ${viaNetwork.output}`)
  assert.match(viaNetwork.output, /network 档/)
  assert.match(viaNetwork.output, /前面 1 档失败/, '应说明前面有档位失败')

  process.env.BAIYING_TRANSLATE_NETWORK_URL = deadUrl
  const allDead = await CAPABILITIES['translate.text'](ctx('translate.text', { text: 'hello' }))
  assert.strictEqual(allDead.status, 'warn', '全挂必须 warn')
  assert.match(allDead.output, /所有 provider 都失败/, `应带上每档原因: ${allDead.output}`)

  clearTranslateEnv()
  await new Promise((resolve) => live.server.close(resolve))
  console.log('✓ translate.text：未配置 / 命中本地 / 降级到网络 / 全挂 四种情形都正确')

  // ── 7e. 真实能力：win.open ───────────────────────────────────
  shellCalls.length = 0
  process.env.USERPROFILE = 'C:\\Users\\smoke'

  const openUrl = await CAPABILITIES['win.open'](ctx('win.open', { kind: 'url', target: 'https://github.com' }))
  assert.strictEqual(openUrl.status, 'ok', `打开 URL 应成功: ${openUrl.output}`)
  assert.deepStrictEqual(shellCalls.at(-1), ['openExternal', 'https://github.com'], '应走 openExternal')

  const badUrl = await CAPABILITIES['win.open'](ctx('win.open', { kind: 'url', target: 'file:///etc/passwd' }))
  assert.strictEqual(badUrl.status, 'warn', '非 http(s) 必须 warn')
  assert.strictEqual(shellCalls.length, 1, '非法 URL 不能触达 shell')

  const openFolder = await CAPABILITIES['win.open'](ctx('win.open', { kind: 'folder', target: '%USERPROFILE%\\Downloads' }))
  assert.strictEqual(openFolder.status, 'ok', `打开文件夹应成功: ${openFolder.output}`)
  assert.deepStrictEqual(shellCalls.at(-1), ['openPath', 'C:\\Users\\smoke\\Downloads'], '%VAR% 应被展开')

  const noTarget = await CAPABILITIES['win.open'](ctx('win.open', { kind: 'folder', target: '' }))
  assert.strictEqual(noTarget.status, 'warn', '缺 target 必须 warn')
  console.log('✓ win.open：URL / 非法协议拦截 / %VAR% 展开 / 缺参数 都正确')

  // ── 7f. 场层：field.classify（模型分类 + evidence）──────────────
  const classifyCtx = (description, input) => ({
    def: { key: 'field', classLabel: 'FieldClass', classes: [], outputs: {} },
    instance: { classId: 'field.classify', name: 'classify.intent', params: {}, description },
    pointClass: {},
    params: {},
    input,
    findInstance: () => undefined
  })

  let classReply = ''
  const classServer = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: classReply } }] }))
    })
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/v1` })
    )
  })
  const INTENT_DESC = 'command palette · action/flow/body/question'

  clearTranslateEnv()
  const noProviderClassify = await CAPABILITIES['field.classify'](classifyCtx(INTENT_DESC, '帮我做个按钮'))
  assert.strictEqual(noProviderClassify.status, 'warn', '没配 provider 必须 warn')
  assert.match(noProviderClassify.output, /未配置场层 provider/)

  process.env.BAIYING_TRANSLATE_LOCAL_URL = classServer.url

  classReply = JSON.stringify({ label: 'flow', confidence: 0.82, reason: '需要多步编排' })
  const okClassify = await CAPABILITIES['field.classify'](
    classifyCtx(INTENT_DESC, '帮我做一个打开 GitHub 前检查 VPN 的按钮')
  )
  assert.strictEqual(okClassify.status, 'ok', `分类应成功: ${okClassify.output}`)
  const classified = JSON.parse(okClassify.value)
  assert.strictEqual(classified.label, 'flow')
  assert.strictEqual(classified.confidence, 0.82)
  assert.deepStrictEqual(classified.labels, ['action', 'flow', 'body', 'question'], '候选集应从实例描述解析')
  assert.strictEqual(okClassify.evidence.confidence, 0.82, 'confidence 必须进 evidence')
  assert.strictEqual(okClassify.evidence.tier, 'local', 'evidence 要记命中的档位')

  classReply = JSON.stringify({ label: 'nonsense', confidence: 0.9 })
  const badLabel = await CAPABILITIES['field.classify'](classifyCtx('body.ocr · text/math/qr/table', '这张图是表格'))
  assert.strictEqual(badLabel.status, 'warn', '候选集外的标签必须 warn')
  assert.match(badLabel.output, /不在候选集里/)

  classReply = '我觉得是 flow 吧'
  const notJson = await CAPABILITIES['field.classify'](classifyCtx(INTENT_DESC, '随便'))
  assert.strictEqual(notJson.status, 'warn')
  assert.match(notJson.output, /没返回合法 JSON/)

  const noLabels = await CAPABILITIES['field.classify'](classifyCtx('没有分隔符的描述', '文本'))
  assert.strictEqual(noLabels.status, 'warn', '无候选集必须 warn')
  assert.match(noLabels.output, /没有声明候选标签/)

  clearTranslateEnv()
  await new Promise((resolve) => classServer.server.close(resolve))
  console.log('✓ field.classify：未配置 / 正常分类 / 非法标签 / 非 JSON / 无候选集 都正确')

  // ── 7g. 真实能力：win.ocr.read（视觉模型）────────────────────
  const ocrHolder = { text: '第一行\n第二行' }
  const ocrServer = await startChatServer(() => ocrHolder.text)
  const SMALL_PNG = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`

  clearTranslateEnv()
  const ocrNoProvider = await CAPABILITIES['win.ocr.read'](ctx('win.ocr.read', { image: SMALL_PNG }))
  assert.strictEqual(ocrNoProvider.status, 'warn', '没配 provider 必须 warn')
  assert.match(ocrNoProvider.output, /未配置 OCR provider/)

  process.env.BAIYING_TRANSLATE_LOCAL_URL = ocrServer.url

  const ocrDataUrl = await CAPABILITIES['win.ocr.read'](
    ctx('win.ocr.read', { image: SMALL_PNG, lang: 'zh', layout: 'true' })
  )
  assert.strictEqual(ocrDataUrl.status, 'ok', `data URL 应成功: ${ocrDataUrl.output}`)
  assert.strictEqual(ocrDataUrl.value, '第一行\n第二行', '识别文本应原样透传')
  assert.strictEqual(ocrDataUrl.evidence.imageSource, 'data-url')
  assert.strictEqual(ocrDataUrl.evidence.tier, 'local')
  assert.strictEqual(ocrDataUrl.evidence.layout, true)

  const imgPath = path.join(workdir, 'shot.png')
  fs.writeFileSync(imgPath, Buffer.from('fake-png-bytes'))
  const ocrFile = await CAPABILITIES['win.ocr.read'](ctx('win.ocr.read', { image: imgPath }))
  assert.strictEqual(ocrFile.status, 'ok', `本地图片应成功: ${ocrFile.output}`)
  assert.strictEqual(ocrFile.evidence.imageSource, imgPath)

  const ocrScreenshot = await CAPABILITIES['win.ocr.read'](ctx('win.ocr.read', { image: '$screenshot' }))
  assert.strictEqual(ocrScreenshot.status, 'ok', `截图 OCR 应成功: ${ocrScreenshot.output}`)
  assert.match(String(ocrScreenshot.evidence.imageSource), /^screenshot:/, '应走截图分支')

  const ocrMissing = await CAPABILITIES['win.ocr.read'](ctx('win.ocr.read', { image: '' }))
  assert.strictEqual(ocrMissing.status, 'warn', '缺图必须 warn')

  ocrHolder.text = ''
  const ocrEmpty = await CAPABILITIES['win.ocr.read'](ctx('win.ocr.read', { image: SMALL_PNG }))
  assert.strictEqual(ocrEmpty.status, 'warn', '空结果必须 warn')
  assert.match(ocrEmpty.output, /没有识别到文字/, `空结果文案不对: ${ocrEmpty.output}`)

  clearTranslateEnv()
  await new Promise((resolve) => ocrServer.server.close(resolve))
  console.log('✓ win.ocr.read：未配置 / data URL / 本地图片 / 截图 / 缺图 / 空结果 都正确')

  // ── 7h. 场层落点：自主度决策 / A2 落地 + 撤销 / prefill 端到端 ──
  const TARGET_INSTANCE = 'win.open.i-open-github@r1'
  const landing = { layer: 'point', target: 'param', instanceId: TARGET_INSTANCE, param: 'target', value: 'https://x.test' }

  assert.strictEqual(decideLanding('A0', landing).action, 'draft', 'A0 只能出草稿')
  assert.strictEqual(decideLanding('A1', landing).action, 'draft', 'A1 只能出草稿')
  assert.strictEqual(decideLanding('A2', landing).action, 'apply', 'A2 可自动应用')
  assert.strictEqual(decideLanding('A3', landing).action, 'refuse', 'A3 必须拒绝')
  assert.strictEqual(decideLanding('A2', undefined).action, 'none', '没有落点时不做任何事')

  const landingStore = new LayerStore(
    path.join(workdir, 'landing-state.json'),
    { key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {} },
    () => ({ status: 'ok', output: 'x', elapsedMs: 0 })
  )
  const journal = new UndoJournal(path.join(workdir, 'undo.json'))
  const originalTarget = landingStore.instance(TARGET_INSTANCE).params.target

  const draft = await applyLanding({
    decision: decideLanding('A1', landing),
    landing,
    pointStore: landingStore,
    journal
  })
  assert.strictEqual(draft.applied, false, 'A1 不能真写')
  assert.strictEqual(landingStore.instance(TARGET_INSTANCE).params.target, originalTarget, 'A1 下目标必须原样')

  const applied = await applyLanding({
    decision: decideLanding('A2', landing),
    landing,
    pointStore: landingStore,
    journal
  })
  assert.strictEqual(applied.applied, true, `A2 应落地: ${applied.note}`)
  assert.strictEqual(landingStore.instance(TARGET_INSTANCE).params.target, 'https://x.test', 'A2 应写入新值')
  assert.ok(applied.undoToken, 'A2 必须给撤销令牌')

  const entry = journal.take(applied.undoToken)
  assert.ok(entry, '令牌应能取到')
  landingStore.update(entry.instanceId, { params: { [entry.param]: entry.previous ?? '' } })
  assert.strictEqual(landingStore.instance(TARGET_INSTANCE).params.target, originalTarget, '撤销应恢复原值')
  assert.strictEqual(journal.take(applied.undoToken), undefined, '令牌必须一次性')

  // prefill 端到端：剪贴板 → 建议 → A2 落地
  fakeClipboard.text = 'https://example.com/from-clipboard'
  const prefill = await CAPABILITIES['field.prefill']({
    def: { key: 'field', classLabel: 'FieldClass', classes: [], outputs: {} },
    instance: { classId: 'field.prefill', name: 'prefill.landing-demo', params: {}, description: 'win.open · target' },
    pointClass: { effect: 'A2' },
    params: { target: TARGET_INSTANCE, param: 'target', source: 'clipboard', literal: '' },
    findInstance: () => undefined
  })
  assert.strictEqual(prefill.status, 'ok', `prefill 应成功: ${prefill.output}`)
  assert.strictEqual(prefill.landing.instanceId, TARGET_INSTANCE)
  assert.strictEqual(prefill.landing.value, 'https://example.com/from-clipboard')
  assert.strictEqual(prefill.evidence.sourceType, 'clipboard')

  const prefillLanded = await applyLanding({
    decision: decideLanding('A2', prefill.landing),
    landing: prefill.landing,
    pointStore: landingStore,
    journal
  })
  assert.strictEqual(prefillLanded.applied, true)
  assert.strictEqual(
    landingStore.instance(TARGET_INSTANCE).params.target,
    'https://example.com/from-clipboard',
    'prefill 的值应真的写进点实例'
  )

  const prefillNoTarget = await CAPABILITIES['field.prefill']({
    def: { key: 'field', classLabel: 'FieldClass', classes: [], outputs: {} },
    instance: { classId: 'field.prefill', name: 'x', params: {}, description: '' },
    pointClass: { effect: 'A2' },
    params: { target: '', param: '' },
    findInstance: () => undefined
  })
  assert.strictEqual(prefillNoTarget.status, 'warn', '缺 target/param 必须 warn')

  fakeClipboard.text = ''
  console.log('✓ 场层落点：A0/A1 只出草稿、A2 落地可撤销、A3 拒绝、prefill 端到端 都正确')

  // ── 7i. 系统级能力：窗口查询 / 主题切换（纯函数 + 一次实机调用）──
  const WINDOWS = [
    { id: 1, process: 'Code', title: 'smoke-flow.cjs - baiyingELE - Visual Studio Code' },
    { id: 2, process: 'notepad', title: '无标题 - 记事本' },
    { id: 3, process: 'chrome', title: 'GitHub · Where software is built' },
    { id: 4, process: 'chrome', title: 'Baiying Deck' }
  ]

  assert.deepStrictEqual(selectWindows(WINDOWS, {}, 10).map((w) => w.id).sort(), [1, 2, 3, 4], '无条件时全返回')
  assert.deepStrictEqual(selectWindows(WINDOWS, { process: 'chrome' }, 10).map((w) => w.id).sort(), [3, 4], '进程筛选')
  assert.deepStrictEqual(selectWindows(WINDOWS, { title: 'github', titleMatch: 'contains' }, 10).map((w) => w.id), [3], '标题包含（忽略大小写）')
  assert.deepStrictEqual(selectWindows(WINDOWS, { title: 'GitHub · Where software is built', titleMatch: 'exact' }, 10).map((w) => w.id), [3], '标题精确')
  assert.strictEqual(selectWindows(WINDOWS, {}, 2).length, 2, 'limit 生效')
  assert.deepStrictEqual(parseSelector('not json'), {}, '非法 selector 退化为空条件')
  assert.deepStrictEqual(parseSelector('{"process":"x"}'), { process: 'x' }, '合法 selector 正常解析')

  assert.deepStrictEqual(planThemeChange({ action: 'set', mode: 'dark', scope: 'apps', currentApps: 1, currentSystem: 1 }), { apps: 0 }, 'set dark + apps')
  assert.deepStrictEqual(planThemeChange({ action: 'set', mode: 'light', scope: 'both', currentApps: 0, currentSystem: 0 }), { apps: 1, system: 1 }, 'set light + both')
  assert.deepStrictEqual(planThemeChange({ action: 'toggle', mode: 'dark', scope: 'system', currentApps: 0, currentSystem: 0 }), { system: 1 }, 'toggle 按当前值翻转')
  assert.deepStrictEqual(planThemeChange({ action: 'set', mode: 'dark', scope: 'unknown', currentApps: 1, currentSystem: 1 }), { apps: 0 }, '未知 scope 退回 apps')
  console.log('✓ win.window.query / win.theme.mode：筛选、排序、限流、主题取值 纯函数均正确')

  // 实机调用窗口枚举（只读）。PowerShell 不可用时明确报告跳过，不伪装通过。
  const realQuery = await CAPABILITIES['win.window.query'](ctx('win.window.query', { limit: '5', selector: '' }))
  if (realQuery.status === 'ok') {
    const listed = JSON.parse(realQuery.value)
    assert.ok(Array.isArray(listed), '窗口列表应为数组')
    assert.ok(listed.length <= 5, 'limit 应生效')
    console.log(`✓ win.window.query 实机：命中 ${listed.length} 个窗口${listed[0] ? `（例如 ${listed[0].process}）` : ''}`)
  } else {
    console.log(`· win.window.query 实机调用跳过：${realQuery.output.slice(0, 60)}`)
  }

  // ── 7j. win.window.control：矩形解析 + 目标解析（不产生桌面副作用）──
  const AREA = { x: 0, y: 0, width: 1920, height: 1080 }

  assert.deepStrictEqual(computeRect('0,0,0.5,1', AREA), { x: 0, y: 0, width: 960, height: 1080 }, '比例写法')
  assert.deepStrictEqual(computeRect('0.5,0.5,0.5,0.5', AREA), { x: 960, y: 540, width: 960, height: 540 }, '带偏移的比例')
  assert.deepStrictEqual(computeRect('100,100,800,600', AREA), { x: 100, y: 100, width: 800, height: 600 }, '像素写法')
  assert.strictEqual(computeRect('1,2,3', AREA), null, '参数不足应为 null')
  assert.strictEqual(computeRect('a,b,c,d', AREA), null, '非数字应为 null')

  const bogusSelector = '{"title":"__绝不存在的窗口标题__"}'
  const ctlNoTarget = await CAPABILITIES['win.window.control'](
    ctx('win.window.control', { op: 'focus', selector: bogusSelector })
  )
  assert.strictEqual(ctlNoTarget.status, 'warn', '匹配不到窗口必须 warn')
  assert.match(ctlNoTarget.output, /没有匹配的窗口/)

  const unknownOp = await CAPABILITIES['win.window.control'](ctx('win.window.control', { op: 'explode' }))
  assert.strictEqual(unknownOp.status, 'warn')
  assert.match(unknownOp.output, /未知 op/)

  // 真实 Win32 读路径（枚举 + 主屏工作区），但 rect 非法 → 不会移动任何窗口
  const badRect = await CAPABILITIES['win.window.control'](
    ctx('win.window.control', { op: 'move', selector: '', rect: 'bogus', monitor: '1' })
  )
  if (badRect.output.includes('没有匹配的窗口')) {
    console.log('· win.window.control 实机跳过：当前没有可匹配的窗口')
  } else {
    assert.strictEqual(badRect.status, 'warn', '非法 rect 必须 warn')
    assert.match(badRect.output, /rect 格式不对/, `应走到 rect 校验: ${badRect.output}`)
    console.log('✓ win.window.control：矩形解析 / 无目标 / 未知 op / Win32 读路径 都正确（未移动任何窗口）')
  }

  // ── 7k. win.key.trigger：组合键解析 / 匹配 / 钩子起停 ──────────
  const KEYMAP = { Space: 57, A: 30, F5: 116, Escape: 1 }

  const combo1 = parseCombo('Ctrl+Alt+Space')
  assert.deepStrictEqual(
    { key: combo1.key, ctrl: combo1.ctrl, alt: combo1.alt, shift: combo1.shift, label: combo1.label },
    { key: 'Space', ctrl: true, alt: true, shift: false, label: 'Ctrl+Alt+Space' }
  )
  assert.strictEqual(parseCombo('F5').label, 'F5', '单功能键')
  assert.strictEqual(parseCombo('Ctrl+Shift+A').label, 'Ctrl+Shift+A', '多修饰键')
  assert.strictEqual(parseCombo('esc').key, 'Escape', '别名解析')
  assert.strictEqual(parseCombo(''), null, '空字符串应为 null')
  assert.strictEqual(parseCombo('Ctrl'), null, '只有修饰键应为 null')
  assert.strictEqual(parseCombo('Ctrl+A+B'), null, '两个主键应为 null')

  const spaceCombo = parseCombo('Ctrl+Alt+Space')
  const evt = (keycode, mods) => ({ keycode, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods })
  assert.strictEqual(matchesCombo(spaceCombo, evt(57, { ctrlKey: true, altKey: true }), KEYMAP), true, '完全匹配')
  assert.strictEqual(matchesCombo(spaceCombo, evt(57, { ctrlKey: true }), KEYMAP), false, '少一个修饰键不匹配')
  assert.strictEqual(matchesCombo(spaceCombo, evt(30, { ctrlKey: true, altKey: true }), KEYMAP), false, '主键不同不匹配')
  assert.strictEqual(matchesCombo(parseCombo('F13'), evt(116, {}), KEYMAP), false, 'keymap 里没有的键不匹配')

  // 实测 uiohook 在 Windows 上按 Ctrl 组合时主键事件 ctrlKey 为 false，必须靠自跟踪状态补齐
  const KEYMAP_M = { ...KEYMAP, Ctrl: 29, Alt: 56, Shift: 42, Meta: 3675 }
  const heldCtrlAlt = new Set([29, 56])
  const ctrlLostEvent = evt(57, { ctrlKey: false, altKey: true }) // 真实观测到的形状
  assert.strictEqual(matchesCombo(spaceCombo, ctrlLostEvent, KEYMAP_M), false, '不补齐时 Ctrl+Alt+Space 匹配不上（复现 bug）')
  assert.strictEqual(
    matchesCombo(spaceCombo, withHeldModifiers(ctrlLostEvent, heldCtrlAlt, KEYMAP_M), KEYMAP_M),
    true,
    '补齐后应能匹配'
  )
  const noHeld = withHeldModifiers(evt(57, { ctrlKey: true, altKey: true }), new Set(), KEYMAP_M)
  assert.strictEqual(noHeld.ctrlKey, true, '事件自带修饰位时保持原样')

  // 钩子起停（真启动全局钩子，随后立刻停掉）
  const trigStart = await CAPABILITIES['win.key.trigger'](ctx('win.key.trigger', { keys: 'Ctrl+Alt+Space', scope: 'global' }))
  if (trigStart.status === 'ok') {
    assert.match(trigStart.output, /已开始监听 Ctrl\+Alt\+Space/)
    assert.deepStrictEqual(registeredCombos(), ['Ctrl+Alt+Space'], '应注册 1 个组合')
    const trigStop = await CAPABILITIES['win.key.trigger'](ctx('win.key.trigger', { keys: '', scope: 'global' }))
    assert.strictEqual(trigStop.status, 'ok')
    assert.match(trigStop.output, /已停止全局钩子|钩子本来就没在运行/)
    assert.deepStrictEqual(registeredCombos(), [], '停止后应清空组合')
    console.log('✓ win.key.trigger：组合解析 / 事件匹配 / 钩子起停 都正确')
  } else {
    assert.match(trigStart.output, /启动全局钩子失败/, `非预期失败: ${trigStart.output}`)
    console.log(`· win.key.trigger 实机跳过：${trigStart.output.slice(0, 60)}`)
  }

  const badScope = await CAPABILITIES['win.key.trigger'](ctx('win.key.trigger', { keys: 'F5', scope: 'window' }))
  assert.strictEqual(badScope.status, 'warn', '非 global 作用域必须 warn')

  // ── 7l. 触发器服务：热键与手势共用一条 dispatch ──────────────
  const trigStore = new TriggerStore(path.join(workdir, 'triggers.json'))
  const ptForTrigger = new LayerStore(
    path.join(workdir, 'pt-trigger.json'),
    { key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {} },
    () => ({ status: 'ok', output: '点被触发了', elapsedMs: 1 })
  )
  const lnForTrigger = new LayerStore(
    path.join(workdir, 'ln-trigger.json'),
    { key: 'line', classLabel: 'FlowClass', classes: catalogs.line, outputs: {} },
    () => ({ status: 'ok', output: '线被触发了', elapsedMs: 1 })
  )
  const triggerService = new TriggerService({
    store: trigStore,
    pointStore: () => ptForTrigger,
    lineStore: () => lnForTrigger
  })

  const TRIGGER_TARGET = 'win.open.i-open-github@r1'
  const LINE_TARGET = catalogs.line[0].instances[0].id

  const hotBinding = triggerService.add({ source: 'hotkey', pattern: 'ctrl+alt+space', targetKind: 'point', targetId: TRIGGER_TARGET })
  assert.strictEqual(hotBinding.ok, true, `热键绑定应成功: ${hotBinding.ok ? '' : hotBinding.message}`)
  assert.strictEqual(hotBinding.binding.pattern, 'Ctrl+Alt+Space', '组合键应规范化')
  assert.strictEqual(hotBinding.binding.source, 'hotkey')

  const gestBinding = triggerService.add({
    source: 'gesture',
    pattern: 'ldr',
    targetKind: 'line',
    targetId: LINE_TARGET,
    note: 'LDR 触发流程',
    name: '打开 GitHub',
    effect: 'L2'
  })
  assert.strictEqual(gestBinding.ok, true, `手势绑定应成功: ${gestBinding.ok ? '' : gestBinding.message}`)
  assert.strictEqual(gestBinding.binding.pattern, 'LDR', '手势模式应大写')
  assert.strictEqual(gestBinding.binding.name, '打开 GitHub', '展示名应持久化')
  assert.strictEqual(gestBinding.binding.effect, 'L2', '副作用等级应持久化')

  assert.strictEqual(triggerService.add({ source: 'gesture', pattern: 'XYZ', targetKind: 'line', targetId: LINE_TARGET }).ok, false, '非法手势应拒绝')
  assert.strictEqual(triggerService.add({ source: 'hotkey', pattern: 'Ctrl', targetKind: 'point', targetId: TRIGGER_TARGET }).ok, false, '只有修饰键应拒绝')
  assert.strictEqual(triggerService.add({ source: 'hotkey', pattern: 'F5', targetKind: 'point', targetId: '不存在' }).ok, false, '目标不存在应拒绝')

  const ptRunsBefore = ptForTrigger.runs(100).length
  const hotFired = await triggerService.dispatchHotkey('Ctrl+Alt+Space')
  assert.strictEqual(hotFired[0].status, 'ok')
  assert.strictEqual(ptForTrigger.runs(100).length, ptRunsBefore + 1, '热键目标必须真的跑了')
  assert.strictEqual(hotFired[0].source, 'hotkey')

  const lnRunsBefore = lnForTrigger.runs(100).length
  const gestFired = await triggerService.dispatchGestureDirections('LDR')
  assert.strictEqual(gestFired[0].status, 'ok')
  assert.strictEqual(lnForTrigger.runs(100).length, lnRunsBefore + 1, '手势目标必须真的跑了')
  assert.strictEqual(gestFired[0].source, 'gesture')
  assert.ok(gestFired[0].score >= 0.75, '手势命中应带置信度')

  const fuzzy = await triggerService.dispatchGestureDirections('LDDR')
  assert.strictEqual(fuzzy[0].status, 'ok', `模糊匹配应命中: ${fuzzy[0].output}`)
  assert.ok(fuzzy[0].score < 1, '模糊命中置信度应小于 1')

  // 真实轨迹 → 识别 → 派发
  const ldrTrace = []
  for (let x = 320; x >= 70; x -= 4) ldrTrace.push({ x, y: 60 })
  for (let y = 60; y <= 160; y += 4) ldrTrace.push({ x: 70, y })
  for (let x = 70; x <= 320; x += 4) ldrTrace.push({ x, y: 160 })

  const viaTrace = await triggerService.dispatchGesturePoints(ldrTrace)
  assert.strictEqual(viaTrace.valid, true)
  assert.strictEqual(viaTrace.directions, 'LDR', `轨迹应识别为 LDR，得到 ${viaTrace.directions}`)
  assert.strictEqual(viaTrace.records[0].status, 'ok')

  const badTrace = await triggerService.dispatchGesturePoints([{ x: 0, y: 0 }])
  assert.strictEqual(badTrace.valid, false, '无效轨迹应拒绝')

  const noMatch = await triggerService.dispatchHotkey('F12')
  assert.strictEqual(noMatch[0].status, 'skipped')
  assert.match(noMatch[0].output, /没有匹配的绑定/)

  // 种子手势必须全部指向真实实例（否则首次启动迁移后是空的）
  const surfaceSeed = require('../src/renderer/src/generatedSurface.json')
  for (const seed of surfaceSeed.gestures) {
    const kind = seed.targetKind ?? (seed.kind === 'flow' ? 'line' : 'point')
    const targetStore = kind === 'line' ? lnForTrigger : ptForTrigger
    assert.ok(targetStore.instance(seed.target), `种子手势 ${seed.pattern} 的目标不存在: ${seed.target}`)
  }
  console.log(`  种子手势 ${surfaceSeed.gestures.length} 个，目标全部可解析`)

  // 手势去重：一个 pattern 只能有一个目标，改绑即覆盖
  assert.strictEqual(triggerService.add({ source: 'gesture', pattern: 'LDR', targetKind: 'point', targetId: TRIGGER_TARGET, name: '改绑' }).ok, true)
  const ldrList = triggerService.list().filter((item) => item.source === 'gesture' && item.pattern === 'LDR')
  assert.strictEqual(ldrList.length, 1, '同 pattern 只能有一条')
  assert.strictEqual(ldrList[0].targetId, TRIGGER_TARGET, '应覆盖成新目标')
  assert.strictEqual(ldrList[0].name, '改绑')
  assert.strictEqual(ldrList[0].id, 'gesture:LDR')

  assert.strictEqual(triggerService.remove(hotBinding.binding.id), true)
  assert.strictEqual(triggerService.remove(gestBinding.binding.id), true)
  assert.strictEqual(triggerService.list().length, 0)

  stopHook()
  console.log('✓ 触发器服务：热键/手势绑定校验 + 两条派发路径 + 目标真跑 + 模糊命中 + 解绑 都正确')

  // ── 7m. 手势识别：用真实轨迹样例验证 ─────────────────────────
  const densify = (control, step = 4) => {
    const out = []
    for (let i = 1; i < control.length; i++) {
      const [x0, y0] = control[i - 1]
      const [x1, y1] = control[i]
      const segments = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step))
      for (let k = 0; k < segments; k++) {
        out.push({ x: x0 + ((x1 - x0) * k) / segments, y: y0 + ((y1 - y0) * k) / segments })
      }
    }
    const last = control[control.length - 1]
    out.push({ x: last[0], y: last[1] })
    return out
  }

  // 与 surfaceData.gesturePaths 一致
  const PATHS = {
    LDR: [[320, 60], [70, 60], [70, 160], [320, 160]],
    UD: [[190, 220], [190, 55], [215, 220]],
    RL: [[65, 150], [330, 150], [65, 150]],
    DR: [[65, 65], [65, 225], [330, 225]],
    DLU: [[330, 60], [330, 225], [70, 225], [70, 60]]
  }

  for (const [name, control] of Object.entries(PATHS)) {
    const result = gesture.recognize(densify(control))
    assert.strictEqual(result.directions, name, `${name} 识别错误，得到 ${result.directions || '(空)'}`)
  }

  // 抖动 ±2px 仍然识别正确（靠噪声段过滤）
  const jitter = (points, amp = 2) =>
    points.map((p, i) => ({ x: p.x + Math.sin(i * 1.7) * amp, y: p.y + Math.cos(i * 2.3) * amp }))
  for (const [name, control] of Object.entries(PATHS)) {
    const result = gesture.recognize(jitter(densify(control)))
    assert.strictEqual(result.directions, name, `${name} 加抖动后识别错误: ${result.directions}`)
  }

  // 缩放 0.5x / 2x 仍然识别（相对阈值，DPI 无关）
  for (const scale of [0.5, 2]) {
    for (const [name, control] of Object.entries(PATHS)) {
      const scaled = densify(control).map((p) => ({ x: p.x * scale, y: p.y * scale }))
      const result = gesture.recognize(scaled)
      assert.strictEqual(result.directions, name, `${name} 缩放 ${scale}x 后识别错误: ${result.directions}`)
    }
  }

  // 无效输入
  assert.strictEqual(gesture.recognize([{ x: 0, y: 0 }]).reason, 'too-few-points')
  assert.strictEqual(gesture.recognize([{ x: 0, y: 0 }, { x: 5, y: 0 }]).reason, 'too-short', '太短应拒绝')
  const fast = densify(PATHS.LDR).map((p, i) => ({ ...p, t: 1000 + Math.floor(i / 10) }))
  assert.strictEqual(gesture.recognize(fast).reason, 'too-fast', '太快应拒绝')
  const slow = densify(PATHS.LDR).map((p, i) => ({ ...p, t: 1000 + i * 100 }))
  assert.strictEqual(gesture.recognize(slow).reason, 'too-slow', '太慢应拒绝')

  // 模糊匹配：多画一段仍能匹配上，并给出置信度
  assert.ok(gesture.scorePattern('LDDR', 'LDR') >= 0.75, '多一段应仍在阈值内')
  const bestMatch = gesture.matchPattern('LDDR', ['UD', 'LDR', 'RL'])
  assert.strictEqual(bestMatch.pattern, 'LDR', '应挑最像的')
  assert.ok(bestMatch.score > 0.7 && bestMatch.score < 1, '置信度应为中间值')
  assert.strictEqual(gesture.matchPattern('RLRL', ['UD', 'LDR'], 0.9), null, '全不匹配应返回 null')
  console.log('✓ 手势识别：5 个轨迹样例 / 抖动 / 0.5x-2x 缩放 / 4 种无效输入 / 模糊匹配 都正确')

  // ── 7n. win.key.send：组合解析 / 事件构造 / 真实发送 ──────────
  const KEY_CASES = [
    ['Ctrl+C', 'Ctrl+C'],
    ['ctrl+shift+alt+a', 'Ctrl+Alt+Shift+A'],
    ['alt+tab', 'Alt+Tab'],
    ['F5', 'F5'],
    ['Ctrl+F24', 'Ctrl+F24'],
    ['win+e', 'Meta+E'],
    ['pgdn', 'PageDown'],
    ['esc', 'Escape']
  ]
  for (const [input, expect] of KEY_CASES) {
    const parsed = keysend.parseKeys(input)
    assert.strictEqual(parsed?.label, expect, `parseKeys(${input}) 应为 ${expect}，得到 ${parsed?.label}`)
  }

  assert.strictEqual(keysend.parseKeys('Ctrl'), null, '只有修饰键应拒绝')
  assert.strictEqual(keysend.parseKeys('Ctrl+A+B'), null, '两个主键应拒绝')
  assert.strictEqual(keysend.parseKeys('Ctrl+NoSuchKey'), null, '未知键应拒绝')
  assert.strictEqual(keysend.parseKeys(''), null, '空串应拒绝')

  assert.strictEqual(keysend.virtualKeyOf('C'), 0x43, 'C 的 VK')
  assert.strictEqual(keysend.virtualKeyOf('F24'), 0x87, 'F24 的 VK')
  assert.strictEqual(keysend.virtualKeyOf('ArrowLeft'), 0x25, '方向键别名')
  assert.strictEqual(keysend.isExtendedKey(0x25), true, '方向键是扩展键')
  assert.strictEqual(keysend.isExtendedKey(0x43), false, '字母不是扩展键')

  // press：Ctrl+Shift+A = 2 修饰下 + 主下 + 主上 + 2 修饰上 = 6
  const csa = keysend.parseKeys('Ctrl+Shift+A')
  const pressEvents = keysend.buildKeyEvents(csa, 'press', new Set())
  assert.strictEqual(pressEvents.length, 6, 'press 应为 6 个事件')
  assert.deepStrictEqual(pressEvents[0], { vk: 0xa2, extended: false, up: false }, '第一个应是 Ctrl 按下')
  assert.deepStrictEqual(pressEvents[pressEvents.length - 1], { vk: 0xa2, extended: false, up: true }, '最后一个应是 Ctrl 抬起')

  // 用户已经按着 Shift 时，不能再按/松 Shift
  const withHeld = keysend.buildKeyEvents(csa, 'press', new Set([0xa0]))
  assert.strictEqual(withHeld.length, 4, '已按住 Shift 时应只有 4 个事件')
  assert.strictEqual(withHeld.some((e) => e.vk === 0xa0), false, '不能碰用户已按住的 Shift')

  assert.strictEqual(keysend.buildKeyEvents(keysend.parseKeys('Ctrl+C'), 'press', new Set(), 3).length, 12, 'repeat=3 应为 12')
  assert.strictEqual(keysend.buildKeyEvents(csa, 'down', new Set()).length, 3, 'down 无 keyup')
  assert.strictEqual(keysend.buildKeyEvents(keysend.parseKeys('Left'), 'press', new Set())[0].extended, true, '方向键应带扩展标记')

  const unknownMode = await CAPABILITIES['win.key.send'](ctx('win.key.send', { keys: 'F24', mode: 'teleport' }))
  assert.strictEqual(unknownMode.status, 'warn')
  assert.match(unknownMode.output, /未知 mode/)

  const sendNoTarget = await CAPABILITIES['win.key.send'](
    ctx('win.key.send', { keys: 'F24', target: '{"title":"__绝不存在的窗口标题__"}' })
  )
  assert.strictEqual(sendNoTarget.status, 'warn', '目标不存在必须 warn')
  assert.match(sendNoTarget.output, /没有匹配的目标窗口/)

  // 真实发送 F24：所有正常应用都没有绑定这个键，绝对安全
  const realSend = await CAPABILITIES['win.key.send'](ctx('win.key.send', { keys: 'F24', mode: 'press', repeat: '1' }))
  if (realSend.status === 'ok') {
    assert.strictEqual(realSend.evidence.backend, 'sendinput')
    assert.strictEqual(realSend.evidence.events, 2, 'F24 单击应为 2 个事件')
    assert.strictEqual(realSend.evidence.sent, 2, 'SendInput 应全部接受')
    console.log('✓ win.key.send：解析 / 事件构造 / 修饰键保护 / 真实发送（F24）都正确')
  } else {
    assert.match(realSend.output, /koffi|发送失败/, `非预期失败: ${realSend.output}`)
    console.log(`· win.key.send 实机跳过：${realSend.output.slice(0, 60)}`)
  }

  // ── 7o. win.audio.volume：计划纯函数 / GUID / 只读读音量 ────────
  const VOL_STATE = { level: 0.5, mute: false }
  assert.deepStrictEqual(volmod.planVolumeChange('get', VOL_STATE, 5, 50), { level: null, mute: null }, 'get 不应改任何东西')
  assert.deepStrictEqual(volmod.planVolumeChange('up', VOL_STATE, 5, 50), { level: 0.55, mute: null })
  assert.deepStrictEqual(volmod.planVolumeChange('down', VOL_STATE, 5, 50), { level: 0.45, mute: null })
  assert.deepStrictEqual(volmod.planVolumeChange('set', VOL_STATE, 5, 30), { level: 0.3, mute: null })
  assert.deepStrictEqual(volmod.planVolumeChange('mute', VOL_STATE, 5, 50), { level: null, mute: true })
  assert.deepStrictEqual(volmod.planVolumeChange('unmute', { level: 0.5, mute: true }, 5, 50), { level: null, mute: false })
  assert.deepStrictEqual(volmod.planVolumeChange('toggle', VOL_STATE, 5, 50), { level: null, mute: true })
  assert.deepStrictEqual(volmod.planVolumeChange('toggle', { level: 0.5, mute: true }, 5, 50), { level: null, mute: false })

  // 边界钳制：到顶就是 1，到底就是 0
  assert.strictEqual(volmod.planVolumeChange('up', { level: 0.98, mute: false }, 5, 50).level, 1)
  assert.strictEqual(volmod.planVolumeChange('down', { level: 0.02, mute: false }, 5, 50).level, 0)
  assert.strictEqual(volmod.planVolumeChange('set', VOL_STATE, 5, 150).level, 1, '超过 100% 应钳到 1')
  assert.strictEqual(volmod.planVolumeChange('set', VOL_STATE, 5, -20).level, 0, '负数应钳到 0')
  assert.strictEqual(volmod.planVolumeChange('explode', VOL_STATE, 5, 50), null, '未知动作应返回 null')

  // GUID 解析：字节序是 COM 的老坑（前 3 段小端，后 8 字节原样）
  const g = comm.guid('BCDE0395-E52F-467C-8E3D-C4579291692E')
  assert.strictEqual(g.length, 16)
  assert.strictEqual(g.readUInt32LE(0), 0xbcde0395, 'Data1 小端')
  assert.strictEqual(g.readUInt16LE(4), 0xe52f, 'Data2 小端')
  assert.strictEqual(g.readUInt16LE(6), 0x467c, 'Data3 小端')
  assert.strictEqual(g[8], 0x8e, 'Data4 原样')
  assert.deepStrictEqual(
    comm.guid('{bcde0395-e52f-467c-8e3d-c4579291692e}'),
    g,
    '大小写和花括号不影响结果'
  )
  let guidThrew = false
  try { comm.guid('不是GUID') } catch { guidThrew = true }
  assert.strictEqual(guidThrew, true, '非法 GUID 应抛错')

  const volumeRead = await CAPABILITIES['win.audio.volume'](ctx('win.audio.volume', { action: 'get' }))
  if (volumeRead.status === 'ok') {
    assert.strictEqual(volumeRead.evidence.backend, 'coreaudio')
    const level = volumeRead.evidence.after.level
    assert.ok(level >= 0 && level <= 1, `音量应在 0..1，得到 ${level}`)

    // 写路径：设成「当前值」，能验证 SetMasterVolumeLevelScalar 通，且不产生净变化
    const roundTrip = await CAPABILITIES['win.audio.volume'](
      ctx('win.audio.volume', { action: 'set', level: String(Math.round(level * 100)) })
    )
    assert.strictEqual(roundTrip.status, 'ok', `回写当前值应成功: ${roundTrip.output}`)
    assert.ok(Math.abs(roundTrip.evidence.after.level - level) < 0.011, '回写后音量应基本不变')
    console.log('✓ win.audio.volume：计划纯函数 / GUID 解析 / CoreAudio 读写（零净变化）都正确')
  } else {
    assert.match(volumeRead.output, /koffi|音频端点/, `非预期失败: ${volumeRead.output}`)
    console.log(`· win.audio.volume 实机跳过：${volumeRead.output.slice(0, 60)}`)
  }

  const badApp = await CAPABILITIES['win.audio.volume'](ctx('win.audio.volume', { action: 'up', app: 'chrome.exe' }))
  assert.strictEqual(badApp.status, 'warn', '应用级音量应明确拒绝')

  // ── 7p. win.display.brightness：计划纯函数 + WMI 读写 ───────────
  assert.strictEqual(bright.planBrightnessChange('get', 76, 10, 60), null, 'get 不改')
  assert.strictEqual(bright.planBrightnessChange('set', 76, 10, 60), 60)
  assert.strictEqual(bright.planBrightnessChange('up', 76, 10, 60), 86)
  assert.strictEqual(bright.planBrightnessChange('down', 76, 10, 60), 66)
  assert.strictEqual(bright.planBrightnessChange('set', 76, 10, 150), 100, '超上限钳到 100')
  assert.strictEqual(bright.planBrightnessChange('set', 76, 10, -5), 0, '负数钳到 0')
  assert.strictEqual(bright.planBrightnessChange('up', 96, 10, 60), 100, '到顶不越界')
  assert.strictEqual(bright.planBrightnessChange('down', 4, 10, 60), 0, '到底不越界')
  assert.strictEqual(bright.planBrightnessChange('explode', 76, 10, 60), null, '未知动作返回 null')

  const brightRead = await CAPABILITIES['win.display.brightness'](ctx('win.display.brightness', { action: 'get' }))
  if (brightRead.status === 'ok') {
    assert.strictEqual(brightRead.evidence.backend, 'wmi')
    const level = brightRead.evidence.level
    assert.ok(level >= 0 && level <= 100, `亮度应在 0..100，得到 ${level}`)

    // 写路径：设成当前值，验证 WmiSetBrightness 通，且屏幕亮度不变
    const brightRound = await CAPABILITIES['win.display.brightness'](
      ctx('win.display.brightness', { action: 'set', value: String(level) })
    )
    assert.strictEqual(brightRound.status, 'ok', `回写当前亮度应成功: ${brightRound.output}`)
    assert.strictEqual(brightRound.evidence.after, level, '回写后亮度应不变')
    console.log('✓ win.display.brightness：计划纯函数 / WMI 读写（零净变化）都正确')
  } else {
    assert.match(brightRead.output, /没有支持 WMI 亮度控制|无法解析|失败/, `非预期失败: ${brightRead.output}`)
    console.log(`· win.display.brightness 实机跳过：${brightRead.output.slice(0, 60)}`)
  }

  const ext = await CAPABILITIES['win.display.brightness'](ctx('win.display.brightness', { action: 'set', value: '50', monitor: 'external' }))
  assert.strictEqual(ext.status, 'warn', '外接屏应明确 warn')
  assert.match(ext.output, /DDC\/CI|外接屏/)

  // ── 7q. ui.form：规格解析 / 校验 / 请求-答复全流程 ──────────────
  const parsedList = formSpec.parseFormSpec('确认发布', '备注, 版本号')
  assert.strictEqual(parsedList.title, '确认发布')
  assert.deepStrictEqual(parsedList.fields.map((f) => f.name), ['备注', '版本号'])
  assert.strictEqual(parsedList.fields[0].type, 'text')
  assert.strictEqual(parsedList.fields[0].required, false)

  const typedList = formSpec.parseFormSpec('带类型', '备注; 数量:number，开关:boolean')
  assert.deepStrictEqual(typedList.fields.map((f) => f.type), ['text', 'number', 'boolean'], '中英文分隔符 + 类型标注')

  const fromSchema = formSpec.parseFormSpec('', '', JSON.stringify({
    title: '发布确认',
    description: '确认后才会推送到生产',
    required: ['version'],
    properties: {
      version: { type: 'string', title: '版本号' },
      note: { type: 'string', title: '备注' },
      channel: { type: 'string', enum: ['stable', 'beta'] }
    }
  }))
  assert.strictEqual(fromSchema.title, '发布确认')
  assert.deepStrictEqual(fromSchema.fields.map((f) => f.name), ['version', 'note', 'channel'])
  assert.strictEqual(fromSchema.fields[0].required, true, 'required 只标记列出的字段')
  assert.strictEqual(fromSchema.fields[2].type, 'select', 'enum 应变成 select')
  assert.deepStrictEqual(fromSchema.fields[2].options, ['stable', 'beta'])

  assert.strictEqual(formSpec.parseFormSpec('t', ''), null, '没字段应拒绝')
  assert.strictEqual(formSpec.parseFormSpec('t', '', '不是JSON'), null, 'schema 解析失败应拒绝')

  const specForCheck = {
    title: 't',
    fields: [
      { name: '版本号', label: '版本号', type: 'text', required: true },
      { name: '数量', label: '数量', type: 'number', required: false }
    ]
  }
  assert.deepStrictEqual(formSpec.validateFormValues(specForCheck, { 版本号: '1.0' }), [], '填了必填项应通过')
  assert.strictEqual(formSpec.validateFormValues(specForCheck, {}).length, 1, '缺必填项应报错')
  assert.match(formSpec.validateFormValues(specForCheck, { 版本号: '1.0', 数量: 'abc' })[0], /需要是数字/)
  assert.strictEqual(formSpec.summarizeFormValues(specForCheck, { 版本号: '1.0', 数量: '' }), '版本号=1.0', '摘要跳过空值')

  // 全流程：请求 → 校验 → 答复
  const captured = []
  formMod.setFormSink((request) => captured.push(request))

  // 用带 required 的 schema，才能同时验到「主进程二次校验」的拒绝路径
  const requiredSchema = JSON.stringify({
    title: '确认发布',
    required: ['版本号'],
    properties: { 备注: { type: 'string' }, 版本号: { type: 'string' } }
  })
  const submitPromise = CAPABILITIES['ui.form'](ctx('ui.form', { title: '确认发布', schema: requiredSchema, timeoutMs: '60000' }))
  assert.strictEqual(captured.length, 1, 'sink 应收到 1 个请求')
  assert.strictEqual(captured[0].spec.title, '确认发布')
  const submitId = formMod.pendingFormId()
  assert.ok(submitId, '应有挂起请求')
  const badResolve = formMod.resolveForm(submitId, { kind: 'submitted', values: {} })
  assert.strictEqual(badResolve.ok, false, '缺必填/空值应被主进程拒绝')
  assert.strictEqual(formMod.pendingFormId(), submitId, '校验失败时请求应仍然挂起')
  const goodResolve = formMod.resolveForm(submitId, { kind: 'submitted', values: { 备注: '紧急', 版本号: '1.2.0' } })
  assert.strictEqual(goodResolve.ok, true, '提交应成功')
  const submitResult = await submitPromise
  assert.strictEqual(submitResult.status, 'ok')
  assert.match(submitResult.output, /已提交/)
  assert.match(submitResult.output, /备注=紧急/)
  assert.strictEqual(JSON.parse(submitResult.value).版本号, '1.2.0')

  // 取消 → 必须是 warn，不能假装成功
  const cancelPromise = CAPABILITIES['ui.form'](ctx('ui.form', { title: '取消测试', fields: '备注' }))
  formMod.resolveForm(formMod.pendingFormId(), { kind: 'cancelled' })
  const cancelResult = await cancelPromise
  assert.strictEqual(cancelResult.status, 'warn', '取消必须是 warn')
  assert.match(cancelResult.output, /已取消/)

  // 超时 → 也是 warn
  const timeoutPromise = CAPABILITIES['ui.form'](ctx('ui.form', { title: '超时测试', fields: '备注' }))
  formMod.resolveForm(formMod.pendingFormId(), { kind: 'timeout', reason: '测试模拟' })
  const timeoutResult = await timeoutPromise
  assert.strictEqual(timeoutResult.status, 'warn', '超时必须是 warn')
  assert.match(timeoutResult.output, /超时/)

  // 新请求顶替旧请求
  const firstPromise = CAPABILITIES['ui.form'](ctx('ui.form', { title: '第一个', fields: 'A' }))
  const secondPromise = CAPABILITIES['ui.form'](ctx('ui.form', { title: '第二个', fields: 'B' }))
  const firstResult = await firstPromise
  assert.strictEqual(firstResult.status, 'warn', '被顶替的请求也是 warn')
  formMod.resolveForm(formMod.pendingFormId(), { kind: 'cancelled' })
  await secondPromise

  // 没有界面时的行为
  formMod.setFormSink(null)
  const noSink = await CAPABILITIES['ui.form'](ctx('ui.form', { title: '无界面', fields: 'A' }))
  assert.strictEqual(noSink.status, 'warn')
  assert.match(noSink.output, /无法显示/)

  const emptyForm = await CAPABILITIES['ui.form'](ctx('ui.form', { title: '空', fields: '' }))
  assert.strictEqual(emptyForm.status, 'warn', '空表单应拒绝')
  assert.match(emptyForm.output, /没有字段/)
  console.log('✓ ui.form：规格解析 / 校验 / 提交·取消·超时·顶替·无界面 都正确')


  // ── 7r. field.guard：确定性闸门 ────────────────────────────────
  const guard = require('../.tmp/smoke/main/capabilities/field.guard.js')
  const makeDraft = (over) => ({ effect: 'L1', autonomy: 'A1', confidence: null, approved: false, text: '', action: '', ...over })

  // A3 是设计上禁止的，不看其他条件
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L0', autonomy: 'A3' })).decision, 'deny', 'A3 必须拒绝')
  assert.match(guard.assessRisk(makeDraft({ autonomy: 'A3' })).reasons[0], /禁止/)
  // 副作用等级
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L0' })).decision, 'allow')
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L1' })).decision, 'allow')
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L2' })).decision, 'ask', 'L2 必须人工确认，不能自动放行')
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L3' })).decision, 'deny', 'L3 未批准必须拒绝')
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'L3', approved: true })).decision, 'ask', 'L3 已批准仍要二次确认')
  assert.strictEqual(guard.assessRisk(makeDraft({ effect: 'LX' })).decision, 'deny', '未知等级按最保守处理')

  // 权限闸门
  assert.strictEqual(guard.assessPermission(makeDraft({ effect: 'L1' }), 'L1').decision, 'allow')
  assert.strictEqual(guard.assessPermission(makeDraft({ effect: 'L2' }), 'L1').decision, 'ask')
  assert.strictEqual(guard.assessPermission(makeDraft({ effect: 'L3' }), 'L3').decision, 'deny', 'L3 不在任何自动许可内')

  // 置信度闸门
  assert.strictEqual(guard.assessConfidence(0.9).decision, 'pass')
  assert.strictEqual(guard.assessConfidence(0.6).decision, 'ask')
  assert.strictEqual(guard.assessConfidence(0.3).decision, 'reject')
  assert.strictEqual(guard.assessConfidence(null).decision, 'ask', '没有置信度按询问处理')

  // 隐私脱敏
  const leaked = '联系 zhang@example.com 或 13812345678，卡号 6222021234567890123，token Bearer abcdefghijklmnop'
  const redacted = guard.redactText(leaked)
  assert.ok(redacted.ok)
  assert.ok(!redacted.text.includes('zhang@example.com'), '邮箱应被脱敏')
  assert.ok(!redacted.text.includes('13812345678'), '手机号应被脱敏')
  assert.ok(redacted.hits.includes('私钥块') === false)
  const privateKey = guard.redactText('-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----')
  assert.ok(privateKey.hits.includes('私钥块'), '私钥必须被识别')
  assert.strictEqual(guard.redactText('').ok, false, '空文本应拒绝')

  // 描述 → 策略
  assert.strictEqual(guard.policyOf('all drafts · L0–L3'), 'risk')
  assert.strictEqual(guard.policyOf('all drafts · allow/deny/ask'), 'permission')
  assert.strictEqual(guard.policyOf('all suggestions · pass/ask/reject'), 'confidence')
  assert.strictEqual(guard.policyOf('context · redact/block'), 'privacy')

  // 草稿解析
  assert.strictEqual(guard.parseDraft('{"effect":"L2","autonomy":"A2"}').ok, true)
  assert.strictEqual(guard.parseDraft('不是json').ok, false)
  assert.strictEqual(guard.parseDraft('[1,2]').ok, false, 'JSON 数组不是草稿')

  // 能力入口：拒绝是正常判断结果，不能记成执行失败
  const guardRun = await CAPABILITIES['field.guard'](
    ctx('field.guard', { policy: 'risk' })
  )
  assert.strictEqual(guardRun.status, 'warn', '没有草稿时应 warn')

  const guardDeny = await CAPABILITIES['field.guard'](
    { ...ctx('field.guard', { policy: 'risk' }), input: JSON.stringify({ effect: 'L3', autonomy: 'A2' }) }
  )
  assert.strictEqual(guardDeny.status, 'ok', '闸门给出拒绝是正常判断，不是执行失败')
  assert.strictEqual(guardDeny.value, 'deny')
  assert.match(guardDeny.output, /拒绝/)
  console.log('✓ field.guard：A3 禁止 / L2 询问 / L3 批准 / 置信度三档 / 隐私脱敏 6 类 / 描述→策略 都正确')

  // ── 7s. field.observe：切面解析与历史统计 ──────────────────────
  const observe = require('../.tmp/smoke/main/capabilities/field.observe.js')
  assert.deepStrictEqual(observe.facetsOf('global · 前台进程/窗口/时间/空闲'), ['前台进程', '窗口', '时间', '空闲'])
  assert.deepStrictEqual(observe.facetsOf('run history · 最近运行/失败/耗时'), ['最近运行', '失败', '耗时'])
  assert.deepStrictEqual(observe.facetsOf('没有分隔符'), [], '没有「·」就无法区分作用域和切面')

  const historyRuns = [
    { id: '1', classId: 'a', status: 'ok', elapsedMs: 100, createdAt: 1 },
    { id: '2', classId: 'b', status: 'warn', elapsedMs: 200, createdAt: 2 },
    { id: '3', classId: 'c', status: 'ok', elapsedMs: 900, createdAt: 3 }
  ]
  const stats = observe.summarizeHistory(historyRuns)
  assert.strictEqual(stats.total, 3)
  assert.strictEqual(stats.notOk, 1, 'warn 也算没成功')
  assert.strictEqual(stats.p95Ms, 900)
  assert.strictEqual(stats.slowest.classId, 'c')
  assert.deepStrictEqual(observe.summarizeHistory([]), { total: 0, notOk: 0, p50Ms: 0, p95Ms: 0, slowest: null })

  // 能力入口：没有切面声明要拒绝；历史源没注入时不能假装采到
  observe.setRunHistorySource(null)
  const noFacets = await CAPABILITIES['field.observe']({ ...ctx('field.observe', {}), instance: { classId: 'field.observe', name: 'o', description: '没有分隔符', params: {} } })
  assert.strictEqual(noFacets.status, 'warn', '没有切面声明必须 warn')
  assert.match(noFacets.output, /没有声明要观察的切面/)

  const desktopSnapshot = await CAPABILITIES['field.observe']({
    ...ctx('field.observe', {}),
    instance: { classId: 'field.observe', name: 'o', description: 'global · 前台进程/窗口/时间/空闲', params: {} }
  })
  const parsedSnapshot = JSON.parse(desktopSnapshot.value)
  assert.ok(parsedSnapshot.takenAt, '快照必须带时间戳')
  if (desktopSnapshot.status === 'ok') {
    assert.ok(parsedSnapshot.desktop?.process, '应采到前台进程')
    console.log('✓ field.observe：切面解析 / 历史统计 / 实机快照（' + parsedSnapshot.desktop.process + '）都正确')
  } else {
    assert.match(desktopSnapshot.output, /取不到/, '取不到必须明说')
    console.log('✓ field.observe：切面解析 / 历史统计 / 取不到就如实说 都正确')
  }

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
