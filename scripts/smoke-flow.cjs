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
