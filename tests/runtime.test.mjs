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

test('surfaceRuntime：pattern 缺 regions 必须报缺口；panel 页面存在与缺失混合', async () => {
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

  // runner 现在是 async：要取数就得 await
  const out = await surfRt.createSurfaceRunner(deps)(mockContext('surface.panel', { pages: [{ layer: 'surface', name: 'nope' }] }))
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

// ── 场层：故障诊断 ────────────────────────────────────────────
test('field.diagnose：按错误特征给出原因与修法，判断不了就说判断不了', () => {
  const { diagnoseText } = load('main/capabilities/field.diagnose.js')

  const enoent = diagnoseText("Error: ENOENT: no such file or directory, open 'a.txt'")
  assert.match(enoent.cause, /路径或目标不存在/)
  assert.ok(enoent.confidence >= 0.9)
  assert.ok(enoent.fix.length > 10, '必须给出具体修法，不能只说「检查一下」')

  assert.match(diagnoseText('connect ECONNREFUSED 127.0.0.1:7890').cause, /网络层不可达/)
  assert.match(diagnoseText('EACCES: permission denied').cause, /权限不足/)
  assert.match(diagnoseText('Unexpected token } in JSON').cause, /不是合法 JSON/)

  // 误诊比不诊断更糟：认不出就返回 null
  assert.strictEqual(diagnoseText('未知的错误 xyz'), null)
  assert.strictEqual(diagnoseText(''), null)

  // 多条同时命中时按置信度排序，并给出备选
  const multi = diagnoseText('UIA automation timeout for control')
  assert.ok(multi.confidence > 0)
  assert.ok(Array.isArray(multi.alternatives) && multi.alternatives.length > 0, '多特征命中要给备选原因')
})

// ── 场层：历史挖掘 ────────────────────────────────────────────
test('field.mine：结构相同的流程图能被分组（真实数据里 10/13 有同伴）', () => {
  const { groupByShape, flowShape, coOccurrence } = load('main/capabilities/field.mine.js')

  assert.strictEqual(flowShape({ nodes: [{ kind: 'point' }, { kind: 'gate' }], edges: [{}] }), 'point>gate|1')

  const groups = groupByShape(lineProfiles)
  assert.ok(groups.length > 0, '真实流程图里应该存在同骨架的组')
  const grouped = groups.reduce((n, g) => n + g.ids.length, 0)
  // 4 + 2 + 2 + 2 = 10（原本写成 9 是我自己算错，断言把它抓出来了）
  assert.strictEqual(grouped, 10, `当前实测应有 10 张图能配对，实际 ${grouped}`)

  // 共现：同一 5 分钟窗口里出现 2 次以上才算
  const mk = (classId, at) => ({ id: `${classId}@${at}`, classId, status: 'ok', elapsedMs: 10, createdAt: at })
  const pairs = coOccurrence([mk('point.a', 1), mk('point.b', 2), mk('point.a', 100000), mk('point.b', 100001)])
  // 两个不同会话各出现一次 = 偶发，不算「总一起出现」
  assert.strictEqual(pairs.length, 0, '跨会话的两次不该算共现')
  // 同一会话里两次 → 1 个会话，仍不够；两个会话都有 → 才算
  const twoSessions = [
    { ...mk('point.a', 1) }, { ...mk('point.b', 2) },
    { ...mk('point.a', 400000) }, { ...mk('point.b', 400001) }
  ]
  assert.strictEqual(coOccurrence(twoSessions)[0].pair.join('+'), 'point.a+point.b')
  assert.strictEqual(coOccurrence(twoSessions)[0].count, 2, '两个会话 → count 2')
})

// ── 场层：建议下一步 ──────────────────────────────────────────
test('field.recommend：先修失败，再固化重复，样本太少时明说不可靠', () => {
  const { suggestNext } = load('main/capabilities/field.recommend.js')
  const mk = (classId, status) => ({ id: `${classId}:${status}:${Math.random()}`, classId, status, elapsedMs: 10, createdAt: 0 })

  assert.strictEqual(suggestNext([]), null, '没有历史就没有建议')

  const withFailures = [mk('point.a', 'ok'), mk('point.b', 'warn'), mk('point.b', 'warn'), mk('point.b', 'warn')]
  const diag = suggestNext(withFailures)
  assert.strictEqual(diag.action, '诊断失败', '失败率高的优先修')
  assert.strictEqual(diag.target, 'point.b')

  const allOk = Array.from({ length: 6 }, () => mk('point.c', 'ok'))
  assert.strictEqual(suggestNext(allOk).action, '封装成流程', '没问题时建议固化高频动作')

  const tiny = [mk('point.d', 'ok')]
  const weak = suggestNext(tiny)
  assert.strictEqual(weak.action, '继续使用积累样本')
  assert.match(weak.why, /样本太少/)
  assert.ok(weak.confidence < 0.5, '样本不足时置信度必须低')
})

// ── 场层：解释 ────────────────────────────────────────────────
test('field.explain：把证据翻成人话，缺证据时明说缺什么', () => {
  const { explainPointRun, explainSuggestion, explainLineRun, explainPermission } = load('main/capabilities/field.explain.js')

  const run = explainPointRun({ classId: 'point.file_read', status: 'warn', output: '只读到 0 字节', elapsedMs: 42 })
  assert.match(run.headline, /只读到 0 字节/)
  assert.ok(run.points.some((p) => p.includes('42 毫秒')))
  assert.ok(run.points.some((p) => p.includes('warn 表示跑了但有缺口')), 'warn 必须解释清楚不是完全成功')

  const sug = explainSuggestion({ suggestion: { action: '诊断失败', target: 'point.b', why: '失败 3 次', confidence: 0.85 } })
  assert.match(sug.headline, /诊断失败/)
  assert.match(sug.headline, /point\.b/)
  assert.ok(sug.points.some((p) => p.includes('85%')))

  const lowConf = explainSuggestion({ suggestion: { action: 'x', target: 'y', confidence: 0.3 } })
  assert.ok(lowConf.points.some((p) => p.includes('置信度偏低')), '低置信度必须提醒')

  const flow = explainLineRun({ nodes: [{ id: 'a', status: 'ok' }, { id: 'b', status: 'warn', output: '超时' }], halted: 'b' })
  assert.match(flow.headline, /共 2 个节点/)
  assert.ok(flow.points.some((p) => p.includes('流程在 b 处停下')))

  // 没有证据 → 明说缺什么，不编
  assert.ok(explainSuggestion({}).missing.includes('suggestion'))
  assert.ok(explainPermission({}).missing.includes('permission'))
  assert.deepStrictEqual(explainLineRun({}).missing, ['nodes'])
  // 通配权限要直说不合适
  assert.ok(explainPermission({ permission: 'filesystem:*', usedBy: 'ocr' }).points.some((p) => p.includes('通配权限')))
})

// ── 场层：提问 ────────────────────────────────────────────────
test('field.ask：确认 / 澄清（维度与候选值不能错位）/ 多选', () => {
  const { askConfirm, askClarify, askChoose } = load('main/capabilities/field.ask.js')

  const confirm = askConfirm('归档 12 个文件', { target: 'D:\\archive', reversible: false })
  assert.match(confirm.question, /归档 12 个文件/)
  assert.ok(confirm.options.some((o) => o.consequence.includes('无法撤销')), '不可撤销必须写在选项上')
  assert.ok(confirm.options.some((o) => o.value === 'no'), '必须有取消选项')
  assert.strictEqual(askConfirm('x', { reversible: true }).options[0].consequence, '可以撤销')

  // 维度是「哪个文档」，候选取值是文档名 —— 第一版这里错位成「用什么打开」
  const clarify = askClarify('打开那个文档', '哪个文档', ['doc-a.md', 'doc-b.md'])
  assert.match(clarify.question, /哪个文档/)
  assert.deepStrictEqual(clarify.options.map((o) => o.value), ['doc-a.md', 'doc-b.md'], '选项必须是该维度的候选值')
  assert.strictEqual(clarify.allowFreeText, false)
  assert.strictEqual(askClarify('打开那个文档', '哪个文档', []).allowFreeText, true, '没有候选值时必须允许自由填')

  const choose = askChoose('文件', Array.from({ length: 8 }, (_, i) => ({ id: `f${i}` })))
  assert.match(choose.question, /匹配到 8 个/)
  assert.strictEqual(choose.options.length, 5, '超过 5 个只列前 5 个')
  assert.match(choose.why, /只列了前 5 个/)
})

// ── 场层：个性化 ──────────────────────────────────────────────
test('field.personalize：样本不足不给建议，够样本才按频率推', () => {
  const { suggestShortcut, suggestLayout, suggestDefaults } = load('main/capabilities/field.personalize.js')
  const mk = (classId, params) => ({ id: `${classId}:${Math.random()}`, classId, status: 'ok', elapsedMs: 10, createdAt: 0, params })

  assert.strictEqual(suggestShortcut([mk('point.a')]), null, '1 条记录就推快捷键是瞎猜')

  const many = Array.from({ length: 8 }, () => mk('point.hot'))
  const shortcut = suggestShortcut(many)
  assert.strictEqual(shortcut.target, 'point.hot')
  assert.match(shortcut.basis, /8 次/)
  assert.match(shortcut.suggestedValue, /待分配/, '不编具体组合键 —— 冲突检查不是这个能力的职责')

  const mixed = [...Array.from({ length: 6 }, () => mk('point.a')), ...Array.from({ length: 2 }, () => mk('line.b'))]
  const layout = suggestLayout(mixed)
  assert.match(layout.suggestedValue, /point 层放主区域/)
  assert.match(layout.basis, /75%/)

  // 参数要 >60% 一致才算默认值
  const withParams = [...Array.from({ length: 7 }, () => mk('point.c', { mode: 'fast' })), mk('point.c', { mode: 'slow' })]
  assert.match(suggestDefaults(withParams).suggestedValue, /mode=fast/)
  const split = Array.from({ length: 8 }, (_, i) => mk('point.c', { mode: i % 2 ? 'a' : 'b' }))
  assert.strictEqual(suggestDefaults(split), null, '参数五五开时不能当默认值')
})

// ── 面层：结构化槽位（从 detail 文本推导，不是凭空设计）────────────
test('surfaceRuntime：16 个面层类都有结构化槽位，不再报「没结构」', () => {
  const rt = load('main/surfaceRuntime.js')
  const deps = { hasClass: () => true, declaredRegionKeys: () => ['detail'] }
  const rows = catalogs.surface
    .filter((c) => c.id !== 'surface.panel')
    .map((c) => ({ id: c.id, plan: rt.planRender(c.id, c.instances[0].id, c.instances[0].params, deps) }))

  const noSlots = rows.filter((r) => r.plan.blocks.length === 0).map((r) => r.id)
  assert.deepStrictEqual(noSlots, [], `这些面层类还没推导出槽位: ${noSlots.join(',')}`)

  const withGap = rows.filter((r) => r.plan.gaps.some((g) => g.slot === 'regions')).map((r) => r.id)
  assert.deepStrictEqual(withGap, [], `有槽位就不该再报 regions 缺口: ${withGap.join(',')}`)

  // 角色必须和该类的语义对得上，不能全是 block 兜底
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.plan]))
  assert.deepStrictEqual(byId['surface.form'].regions, ['field'])
  assert.deepStrictEqual(byId['surface.dialog'].regions, ['action'])
  assert.deepStrictEqual(byId['surface.wizard'].regions, ['step'])
  assert.deepStrictEqual(byId['surface.command_palette'].regions, ['result-group'])

  // 段数 = 槽位数（form 的 detail 有 4 段）
  assert.strictEqual(byId['surface.form'].blocks.length, 4)
  assert.deepStrictEqual(byId['surface.form'].blocks.map((b) => b.label), ['默认 VPN', '自动打开', '自动连接', '超时'])

  // 箭头表示有序序列，要拆成多个槽位
  assert.strictEqual(byId['surface.wizard'].blocks.length, 3)
  assert.deepStrictEqual(byId['surface.wizard'].blocks.map((b) => b.label), ['选模板', '绑槽位', '试运行'])
})

// ── 两个正交的轴：effect（副作用）vs autonomy（自主度）────────────
test('目录：effect 是 L 码、autonomy 是 A 码，两个轴不许混', () => {
  const all = ['point', 'line', 'surface', 'body', 'field'].flatMap((layer) => catalogs[layer] ?? [])
  const badEffect = all.filter((c) => !/^L[0-3]$/.test(String(c.effect ?? ''))).map((c) => `${c.id}=${c.effect}`)
  assert.deepStrictEqual(badEffect, [], `effect 必须是 L0-L3：${badEffect.join(',')}`)

  const fieldMissingAutonomy = (catalogs.field ?? []).filter((c) => !c.autonomy).map((c) => c.id)
  assert.deepStrictEqual(fieldMissingAutonomy, [], `场层类必须有 autonomy：${fieldMissingAutonomy.join(',')}`)

  const nonFieldWithAutonomy = ['point', 'line', 'surface', 'body']
    .flatMap((layer) => (catalogs[layer] ?? []).filter((c) => c.autonomy).map((c) => c.id))
  assert.deepStrictEqual(nonFieldWithAutonomy, [], `非场层不该有 autonomy：${nonFieldWithAutonomy.join(',')}`)

  const badAutonomy = (catalogs.field ?? []).filter((c) => !/^A[0-2]$/.test(String(c.autonomy))).map((c) => `${c.id}=${c.autonomy}`)
  assert.deepStrictEqual(badAutonomy, [], `autonomy 必须是 A0-A2：${badAutonomy.join(',')}`)

  // 关键性质：两个轴确实在独立变化 —— 全部 effect=L0 但 autonomy 三种都有
  const distinctAutonomy = new Set((catalogs.field ?? []).map((c) => c.autonomy))
  assert.deepStrictEqual([...distinctAutonomy].sort(), ['A0', 'A1', 'A2'], 'litmus：场层 autonomy 应该三种都有')
  const distinctEffect = new Set((catalogs.field ?? []).map((c) => c.effect))
  assert.deepStrictEqual([...distinctEffect], ['L0'], '场层能力只计算不行动，effect 全为 L0')
})

test('decideLanding：必须吃 autonomy，不吃 effect', () => {
  const { decideLanding } = load('shared/fieldLanding.js')
  // A2 可自动应用
  assert.strictEqual(decideLanding('A2', { layer: 'point', target: 'params', ref: 'x' }).action, 'apply')
  // A0/A1 只出草稿
  assert.strictEqual(decideLanding('A0', { layer: 'point', target: 'params', ref: 'x' }).action, 'draft')
  assert.strictEqual(decideLanding('A1', { layer: 'point', target: 'params', ref: 'x' }).action, 'draft')
  // A3 禁止
  assert.strictEqual(decideLanding('A3', { layer: 'point', target: 'params', ref: 'x' }).action, 'refuse')
  // 传 L 码必须被拒绝，而不是悄悄当成 A3 —— 这就是当年能跑的那个 bug 的护栏
  assert.strictEqual(decideLanding('L0', { layer: 'point', target: 'params', ref: 'x' }).action, 'refuse', 'L 码必须按未知自主度拒绝')
  assert.match(decideLanding('L0', { layer: 'point', target: 'params', ref: 'x' }).reason, /未知自主度/)
})

// ── 面层数据契约：槽位来源与四态 ────────────────────────────────
test('slotSource：四种 kind 的校验规则', () => {
  const { validateSlotSource, describeSlotSource } = load('shared/slotSource.js')

  assert.strictEqual(validateSlotSource({ kind: 'run', layer: 'line', limit: 20 }), null)
  assert.match(validateSlotSource({ kind: 'run', layer: 'nope' }), /五层之一/)
  assert.match(validateSlotSource({ kind: 'run', layer: 'line', limit: -1 }), /正数/)

  assert.strictEqual(validateSlotSource({ kind: 'registry', layer: 'point' }), null)
  assert.strictEqual(validateSlotSource({ kind: 'registry', classId: 'point.ocr' }), null)
  assert.match(validateSlotSource({ kind: 'registry' }), /至少要给/)
  assert.match(validateSlotSource({ kind: 'registry', layer: 'point', classId: 'line.x' }), /不一致/)

  assert.strictEqual(validateSlotSource({ kind: 'params', key: 'vpn.default' }), null)
  assert.match(validateSlotSource({ kind: 'params', key: '  ' }), /非空/)

  assert.strictEqual(validateSlotSource({ kind: 'static', value: '标题' }), null)
  assert.match(validateSlotSource({ kind: 'static', value: 1 }), /字符串/)

  assert.match(validateSlotSource({ kind: 'weird' }), /未知/)
  assert.match(validateSlotSource(null), /对象/)

  assert.strictEqual(describeSlotSource({ kind: 'run', layer: 'line', limit: 20 }), 'run:line×20')
  assert.strictEqual(describeSlotSource({ kind: 'registry', layer: 'point' }), 'registry:point.*')
})

test('surfaceRuntime：46 个槽位都有 source，且全部合法', () => {
  const { validateSlotSource } = load('shared/slotSource.js')
  const rows = []
  for (const cls of catalogs.surface) {
    if (cls.id === 'surface.panel') continue
    for (const inst of cls.instances) {
      for (const slot of inst.params?.slots ?? []) rows.push({ cls: cls.id, slot })
    }
  }
  assert.ok(rows.length >= 40, `槽位数应该有几十个，实际 ${rows.length}`)

  const noSource = rows.filter((r) => !r.slot.source).map((r) => `${r.cls}:${r.slot.id}`)
  assert.deepStrictEqual(noSource, [], `这些槽位没有声明 source: ${noSource.slice(0, 5).join(',')}`)

  const invalid = rows.map((r) => ({ id: `${r.cls}:${r.slot.id}`, err: validateSlotSource(r.slot.source) })).filter((r) => r.err)
  assert.deepStrictEqual(invalid, [], `source 非法: ${JSON.stringify(invalid.slice(0, 3))}`)

  // 四种 kind 都应该被真实用到（否则说明分类是空谈）
  const kinds = new Set(rows.map((r) => r.slot.source.kind))
  assert.deepStrictEqual([...kinds].sort(), ['params', 'registry', 'run', 'static'], `四种 kind 都该用到，实际: ${[...kinds]}`)
})

test('surfaceRuntime.resolveSlots：ready/empty/missing/error 四态必须分开', async () => {
  const { resolveSlots } = load('main/surfaceRuntime.js')
  const slots = [
    { id: 'a', role: 'field', label: '有值', source: { kind: 'static', value: 'x' } },
    { id: 'b', role: 'field', label: '空', source: { kind: 'run', layer: 'line' } },
    { id: 'c', role: 'field', label: '缺', source: { kind: 'registry', layer: 'point' } },
    // 用 registry 触发异常：params 现在本地解析，走不到 reader
    { id: 'd', role: 'field', label: '错', source: { kind: 'registry', classId: 'point.boom' } },
    { id: 'e', role: 'field', label: '没声明' }
  ]
  const read = async (source) => {
    if (source.kind === 'run') return { status: 'empty', reason: '还没跑过' }
    if (source.kind === 'registry') {
      if (source.classId === 'point.boom') throw new Error('磁盘读失败')
      return { status: 'missing', reason: '目录里没有' }
    }
    throw new Error('不该走到这里：static / params 应该本地解析')
  }
  const out = await resolveSlots(slots, { read })
  assert.deepStrictEqual(out.map((s) => s.status), ['ready', 'empty', 'missing', 'error', 'missing'])
  assert.strictEqual(out[0].value, 'x')
  assert.match(out[1].reason, /还没跑过/)
  assert.match(out[3].reason, /磁盘读失败/)
  assert.match(out[4].reason, /没有声明 source/)

  // 没注入 reader 时，需要外部数据的 source 必须是 missing 且说明原因，不能默默当空
  const noReader = await resolveSlots([{ id: 'r', role: 'x', label: 'r', source: { kind: 'run', layer: 'line' } }], {})
  assert.strictEqual(noReader[0].status, 'missing')
  assert.match(noReader[0].reason, /没有注入取数器/)
})

test('surfaceRuntime.resolveSlots：static / params 本地解析，不依赖注入', async () => {
  const { resolveSlots } = load('main/surfaceRuntime.js')
  const slots = [
    { id: 's1', role: 'field', label: '字面量', source: { kind: 'static', value: '标题' } },
    { id: 's2', role: 'field', label: '空字面量', source: { kind: 'static', value: '' } },
    { id: 's3', role: 'field', label: '参数有值', source: { kind: 'params', key: 'vpn' } },
    { id: 's4', role: 'field', label: '参数缺失', source: { kind: 'params', key: 'nope' } },
    { id: 's5', role: 'field', label: '参数为空', source: { kind: 'params', key: 'blank' } }
  ]
  const out = await resolveSlots(slots, { params: { vpn: 'on', blank: '' } })
  assert.deepStrictEqual(out.map((s) => s.status), ['ready', 'empty', 'ready', 'missing', 'empty'])
  assert.strictEqual(out[2].value, 'on')
  assert.match(out[3].reason, /参数 nope 不存在/)

  const external = await resolveSlots([{ id: 'r', role: 'x', label: 'r', source: { kind: 'run', layer: 'line' } }], {})
  assert.strictEqual(external[0].status, 'missing')
  assert.match(external[0].reason, /没有注入取数器/)
})
