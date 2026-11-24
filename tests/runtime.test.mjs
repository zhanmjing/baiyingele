/**
 * 运行时能力测试（body / surface / rank / detect / critique）。
 *
 * 这些用例从 smoke-flow.cjs 的 7u–7x 搬过来，搬的理由很直接：
 * 那 4 节在 1692 行单文件里已经撞了 4 次变量名，批量改名还改坏过字符串常量。
 * 搬到独立文件后各自有独立作用域，且能单独跑：
 *
 *   node --test tests/runtime.test.mjs
 *   node --test --test-name-pattern 'critique' tests/
 */
import test from 'node:test'
import assert from 'node:assert'
import { load, catalogs, bodyProfiles, lineProfiles, allClassIds, mockContext } from './_harness.mjs'

// ── 体层装配检查 ──────────────────────────────────────────────
test('bodyRuntime：装配检查（齐备 / 缺实现 / 缺类 / 无 profile）', () => {
  const bodyRt = load('main/bodyRuntime.js')
  const deps = {
    profiles: {},
    hasClass: (l, n) => ['surface.form', 'line.ensure_vpn', 'point.key_send', 'point.ocr_read'].includes(`${l}.${n}`),
    implementedClassIds: new Set(['point.key_send', 'point.ocr_read', 'line.ensure_vpn', 'surface.form'])
  }

  const full = bodyRt.assessComposition(
    { composition: [
        { class: { layer: 'surface', name: 'form' } },
        { class: { layer: 'line', name: 'ensure_vpn' } },
        { class: { layer: 'point', name: 'key_send' } }
      ] },
    deps
  )
  assert.strictEqual(full.readiness.total, 3)
  assert.strictEqual(full.readiness.satisfied, 3)
  assert.deepStrictEqual(full.assembly.surfaces, ['surface.form'])
  assert.deepStrictEqual(full.assembly.points, ['point.key_send'])

  const noImpl = bodyRt.assessComposition({ composition: [{ class: { layer: 'point', name: 'ocr_read' } }] }, { ...deps, implementedClassIds: new Set() })
  assert.strictEqual(noImpl.readiness.missing[0].reason, 'no-impl')
  assert.strictEqual(noImpl.assembly, undefined, '缺零件时不能给装配方案')
  assert.deepStrictEqual(noImpl.blockedBy, ['req.point.ocr_read'])

  const noClass = bodyRt.assessComposition({ composition: [{ class: { layer: 'line', name: 'preview_file' } }] }, deps)
  assert.strictEqual(noClass.readiness.missing[0].reason, 'no-class')

  const okRunner = bodyRt.createBodyRunner({ ...deps, profiles: { 'body.x': { composition: [{ class: { layer: 'point', name: 'key_send' } }] } } })
  const okOut = okRunner(mockContext('body.x'))
  assert.strictEqual(okOut.status, 'ok')
  assert.match(okOut.output, /装配完成/)

  const warnRunner = bodyRt.createBodyRunner({ ...deps, profiles: { 'body.y': { composition: [{ class: { layer: 'line', name: 'preview_file' } }] } } })
  const warnOut = warnRunner(mockContext('body.y'))
  assert.strictEqual(warnOut.status, 'warn', '零件不齐必须 warn')
  assert.match(warnOut.output, /装配未完成/)

  assert.strictEqual(bodyRt.createBodyRunner({ ...deps, profiles: {} })(mockContext('body.z')).status, 'warn')
})

test('bodyRuntime：真实 29 个体齐备 0 个（见证当前真实现状）', () => {
  const bodyRt = load('main/bodyRuntime.js')
  const impl = new Set(load('shared/implemented.generated.js').IMPLEMENTED_CLASS_IDS)
  const deps = { profiles: bodyProfiles, hasClass: (l, n) => allClassIds.has(`${l}.${n}`), implementedClassIds: impl }
  const readies = Object.entries(bodyProfiles).map(([id, p]) => ({ id, r: bodyRt.assessComposition(p, deps).readiness }))
  const complete = readies.filter((x) => x.r.missing.length === 0)
  assert.strictEqual(complete.length, 0, `当前不应该有任何体齐备，实际齐备 ${complete.map((x) => x.id).join(',')}`)
})

// ── 面层渲染 ──────────────────────────────────────────────────
test('surfaceRuntime：挂载位解析（settings 不是挂载位）', () => {
  const surfRt = load('main/surfaceRuntime.js')
  assert.strictEqual(surfRt.parseMount('默认 VPN / 自动打开 · settings'), null, 'settings 是设置分区不是挂载位')
  assert.strictEqual(surfRt.parseMount('使用率 / 温度 · main'), 'main')
  assert.strictEqual(surfRt.parseMount('选模板 → 绑槽位 · modal'), 'modal')
  assert.strictEqual(surfRt.parseMount('没有分隔符'), null)
  assert.strictEqual(surfRt.parseMount(null), null)
})

test('surfaceRuntime：pattern 缺 regions 必须报缺口；panel 页面存在与缺失混合', () => {
  const surfRt = load('main/surfaceRuntime.js')
  const deps = {
    hasClass: (l, n) => ['surface.inspector', 'surface.form'].includes(`${l}.${n}`),
    declaredRegionKeys: () => ['detail']
  }

  const pat = surfRt.planRender('surface.form', 'surface.form.settings_vpn@r3', { detail: 'VPN 设置 · sidebar' }, deps)
  assert.strictEqual(pat.surfaceKind, 'pattern')
  assert.strictEqual(pat.mount, 'sidebar')
  assert.ok(pat.gaps.some((g) => g.slot === 'regions'), '只声明 detail 时必须报缺口')

  const pan = surfRt.planRender('surface.panel', 'surface.panel.inspector@r1', {
    detail: '属性检查器',
    modes: ['right', 'floating'],
    pages: [{ layer: 'surface', name: 'inspector' }, { layer: 'surface', name: 'nope' }],
    applications: [{ label: 'point' }, { label: 'flow-slot' }]
  }, deps)
  assert.strictEqual(pan.blocks.length, 2)
  assert.strictEqual(pan.blocks[0].exists, true)
  assert.strictEqual(pan.blocks[1].exists, false)
  assert.strictEqual(pan.gaps.length, 1)
  assert.ok(pan.intents.includes('open:2 个应用'))

  const out = surfRt.createSurfaceRunner(deps)(mockContext('surface.panel', { pages: [{ layer: 'surface', name: 'nope' }] }))
  assert.strictEqual(out.status, 'warn')
  assert.strictEqual(out.evidence.kind, 'render', 'runSurface 的 kind 必须是 render')
})

// ── 场层：确定性排序 ──────────────────────────────────────────
test('field.rank：P0 优先 / 同优先度按使用次数 / 字典序兜底 / 结果可复现', () => {
  const { rankItems } = load('main/capabilities/field.rank.js')
  const ranked = rankItems([
    { id: 'c', name: 'C', priority: 'P2', usage: 9 },
    { id: 'a', name: 'A', priority: 'P0' },
    { id: 'b', name: 'B', priority: 'P0', usage: 2 }
  ])
  assert.deepStrictEqual(ranked.map((x) => x.id), ['b', 'a', 'c'])
  assert.strictEqual(ranked[0].rank, 1)
  assert.match(ranked[0].reason, /P0/)

  const twice = [rankItems([{ id: 'x', name: '同' }, { id: 'y', name: '同' }]), rankItems([{ id: 'x', name: '同' }, { id: 'y', name: '同' }])]
  assert.deepStrictEqual(twice[0], twice[1], '同样输入必须同样输出')
})

// ── 场层：信号发现 ────────────────────────────────────────────
test('field.detect：重复序列识别 / 只出现一次不报 / 失败集中被报出', () => {
  const { detectRepetition, detectAnomaly } = load('main/capabilities/field.detect.js')
  const mkRun = (classId, status, ms, at) => ({ id: `${classId}@${at}`, classId, status, elapsedMs: ms, createdAt: at })
  const seq = []
  let t = 1
  for (let round = 0; round < 3; round += 1) for (const c of ['point.a', 'point.b', 'point.c']) seq.push(mkRun(c, 'ok', 100, t++))

  const reps = detectRepetition(seq)
  assert.ok(reps.length > 0, '重复 3 次的序列必须被发现')
  assert.ok(reps.some((s) => s.title.includes('point.a → point.b')))
  assert.strictEqual(detectRepetition(seq.slice(0, 4)).length, 0, '只出现 1 次的序列不该报')

  const anomalies = detectAnomaly([...seq, mkRun('point.a', 'warn', 100, 99), mkRun('point.a', 'warn', 100, 100)])
  assert.ok(anomalies.some((s) => s.kind === 'anomaly' && s.evidence.classId === 'point.a'))
})

// ── 场层：结构审查 ────────────────────────────────────────────
test('field.critique：环检测（两节点 / 自环 / DAG 无环）', () => {
  const { findCycles } = load('main/capabilities/field.critique.js')
  const mkNode = (id, kind, extra) => ({ id, kind, label: id, ...extra })
  assert.strictEqual(findCycles([mkNode('a'), mkNode('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]).length, 1)
  assert.strictEqual(findCycles([mkNode('a')], [{ from: 'a', to: 'a' }]).length, 1)
  assert.strictEqual(findCycles([mkNode('a'), mkNode('b')], [{ from: 'a', to: 'b' }]).length, 0)
})

test('field.critique：悬空边 / 未绑定 / 缺实现 / 合法 foreach 不误报 / 未知 gate 报错', () => {
  const { critiqueFlow } = load('main/capabilities/field.critique.js')
  const deps = {
    profiles: {},
    bodyProfiles: {},
    implementedClassIds: new Set(['point.key_send']),
    hasClass: (l, n) => ['point.key_send', 'point.clipboard_get'].includes(`${l}.${n}`)
  }
  const mkNode = (id, kind, extra) => ({ id, kind, label: id, ...extra })

  const dangling = critiqueFlow({ classId: 'x', nodes: [mkNode('a', 'point', { pointClass: 'key_send' })], edges: [{ from: 'a', to: 'ghost' }] }, deps)
  assert.ok(dangling.some((f) => f.code === 'dangling-edge' && f.severity === 'error'))

  assert.ok(critiqueFlow({ classId: 'x', nodes: [mkNode('a', 'point')], edges: [] }, deps).some((f) => f.code === 'unbound-node'))
  assert.ok(critiqueFlow({ classId: 'x', nodes: [mkNode('a', 'point', { pointClass: 'clipboard_get' })], edges: [] }, deps).some((f) => f.code === 'missing-impl' && f.severity === 'warn'))

  // 合法 foreach：gate 有出口 → 不报
  const foreachOk = critiqueFlow({
    classId: 'batch',
    nodes: [mkNode('scan', 'point', { pointClass: 'key_send' }), mkNode('loop', 'gate', { gate: 'foreach' }), mkNode('move', 'point', { pointClass: 'key_send' }), mkNode('done', 'point', { pointClass: 'key_send' })],
    edges: [{ from: 'scan', to: 'loop' }, { from: 'loop', to: 'move' }, { from: 'move', to: 'loop' }, { from: 'loop', to: 'done' }]
  }, deps)
  assert.strictEqual(foreachOk.filter((f) => f.code.startsWith('cycle') || f.code.includes('gate')).length, 0, '合法 foreach 不该被报成缺陷')

  // 未知 gate + 回边 → error
  const unknownGate = critiqueFlow({
    classId: 'x',
    nodes: [mkNode('g', 'gate', { gate: 'weird' }), mkNode('b', 'point', { pointClass: 'key_send' }), mkNode('end', 'point', { pointClass: 'key_send' })],
    edges: [{ from: 'g', to: 'b' }, { from: 'b', to: 'g' }, { from: 'g', to: 'end' }]
  }, deps)
  assert.ok(unknownGate.some((f) => f.code === 'unknown-gate-cycle' && f.severity === 'error'))

  // 真实 13 张图：全部干净
  const impl = new Set(load('shared/implemented.generated.js').IMPLEMENTED_CLASS_IDS)
  const realDeps = { profiles: lineProfiles, bodyProfiles: {}, implementedClassIds: impl, hasClass: (l, n) => allClassIds.has(`${l}.${n}`) }
  const flagged = Object.entries(lineProfiles).filter(([, p]) => critiqueFlow(p, realDeps).length > 0).map(([k]) => k)
  assert.deepStrictEqual(flagged, [], `真实 13 张图不该有缺陷，实际: ${flagged.join(',')}`)
})

// ── 场层：路由决策 ────────────────────────────────────────────
test('field.route：本地/云端/回退（按长度与推理迹象）', () => {
  const route = load('main/capabilities/field.route.js')
  const endpoints = { localEndpoint: 'http://local', cloudEndpoint: 'https://cloud' }

  const short = route.routeModel('总结一下这段文字', endpoints)
  assert.strictEqual(short.target, 'http://local')
  assert.strictEqual(short.kind, 'local')

  const reasoning = route.routeModel('帮我分析这个架构的权衡', endpoints)
  assert.strictEqual(reasoning.target, 'https://cloud')
  assert.match(reasoning.reason, /推理/)

  const tooLong = route.routeModel('x'.repeat(3000), endpoints)
  assert.strictEqual(tooLong.kind, 'cloud', '超长输入必须走云端')
  assert.strictEqual(tooLong.fallback, 'http://local', '云端失败要能退回本地')

  const offline = route.routeModel('随便', { ...endpoints, offline: 'true', fallbackEndpoint: 'http://fb' })
  assert.strictEqual(offline.kind, 'fallback')

  assert.strictEqual(route.routeModel('随便', {}), null, '没有任何端点时必须返回 null，不能瞎选')
})

test('field.route：body 按扩展名 / 网址 / 整理意图', () => {
  const route = load('main/capabilities/field.route.js')
  const lookup = { hasClass: (l, n) => `${l}.${n}` === 'body.ocr' || `${l}.${n}` === 'body.media_converter' || `${l}.${n}` === 'body.file_preview' || `${l}.${n}` === 'body.file_organizer' }

  assert.strictEqual(route.routeBody('把 photo.png 里的文字提出来', lookup).target, 'body.ocr')
  assert.strictEqual(route.routeBody('转一下 clip.mp4', lookup).target, 'body.media_converter')
  assert.strictEqual(route.routeBody('看看 note.md', lookup).target, 'body.file_preview')
  assert.strictEqual(route.routeBody('帮我整理一下这些文件', lookup).target, 'body.file_organizer')
  assert.strictEqual(route.routeBody('随便说点什么', lookup), null, '匹配不上就返回 null，不硬塞默认值')
})

test('field.route：判断不了必须 warn，不能返回一个默认目标', async () => {
  const route = load('main/capabilities/field.route.js')
  const out = await route.run(mockContext('field.route', { mode: 'body' }))
  assert.strictEqual(out.status, 'warn')
  assert.match(out.output, /无法路由/)
  assert.strictEqual(out.evidence.decided, false)
})

test('field.route：evidence.kind 恒为 route，不被目标类型覆盖', async () => {
  const route = load('main/capabilities/field.route.js')
  const out = await route.run({ ...mockContext('field.route', { mode: 'model' }), input: '总结', params: { mode: 'model', localEndpoint: 'http://local' } })
  assert.strictEqual(out.evidence.kind, 'route', 'evidence.kind 必须是语义标记')
  assert.strictEqual(out.evidence.targetKind, 'local', '目标类型放在 targetKind')
})
