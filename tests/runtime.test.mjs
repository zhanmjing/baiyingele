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
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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
  const { rankItems } = load('main/classes/field/rank.js')
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
  const { detectRepetition, detectAnomaly } = load('main/classes/field/detect.js')
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
  const { findCycles } = load('main/classes/field/critique.js')
  const mkNode = (id, kind, extra) => ({ id, kind, label: id, ...extra })
  assert.strictEqual(findCycles([mkNode('a'), mkNode('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]).length, 1)
  assert.strictEqual(findCycles([mkNode('a')], [{ from: 'a', to: 'a' }]).length, 1)
  assert.strictEqual(findCycles([mkNode('a'), mkNode('b')], [{ from: 'a', to: 'b' }]).length, 0)
})

test('field.critique：悬空边 / 未绑定 / 缺实现 / 合法 foreach 不误报 / 未知 gate 报错', () => {
  const { critiqueFlow } = load('main/classes/field/critique.js')
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
  const route = load('main/classes/field/route.js')
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
  const route = load('main/classes/field/route.js')
  const lookup = { hasClass: (l, n) => `${l}.${n}` === 'body.ocr' || `${l}.${n}` === 'body.media_converter' || `${l}.${n}` === 'body.file_preview' || `${l}.${n}` === 'body.file_organizer' }

  assert.strictEqual(route.routeBody('把 photo.png 里的文字提出来', lookup).target, 'body.ocr')
  assert.strictEqual(route.routeBody('转一下 clip.mp4', lookup).target, 'body.media_converter')
  assert.strictEqual(route.routeBody('看看 note.md', lookup).target, 'body.file_preview')
  assert.strictEqual(route.routeBody('帮我整理一下这些文件', lookup).target, 'body.file_organizer')
  assert.strictEqual(route.routeBody('随便说点什么', lookup), null, '匹配不上就返回 null，不硬塞默认值')
})

test('field.route：判断不了必须 warn，不能返回一个默认目标', async () => {
  const route = load('main/classes/field/route.js')
  const out = await route.run(mockContext('field.route', { mode: 'body' }))
  assert.strictEqual(out.status, 'warn')
  assert.match(out.output, /无法路由/)
  assert.strictEqual(out.evidence.decided, false)
})

test('field.route：evidence.kind 恒为 route，不被目标类型覆盖', async () => {
  const route = load('main/classes/field/route.js')
  const out = await route.run({ ...mockContext('field.route', { mode: 'model' }), input: '总结', params: { mode: 'model', localEndpoint: 'http://local' } })
  assert.strictEqual(out.evidence.kind, 'route', 'evidence.kind 必须是语义标记')
  assert.strictEqual(out.evidence.targetKind, 'local', '目标类型放在 targetKind')
})

// ── 场层：故障诊断 ────────────────────────────────────────────
test('field.diagnose：按错误特征给出原因与修法，判断不了就说判断不了', () => {
  const { diagnoseText } = load('main/classes/field/diagnose.js')

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
  const { groupByShape, flowShape, coOccurrence } = load('main/classes/field/mine.js')

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
  const { suggestNext } = load('main/classes/field/recommend.js')
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
  const { explainPointRun, explainSuggestion, explainLineRun, explainPermission } = load('main/classes/field/explain.js')

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
  const { askConfirm, askClarify, askChoose } = load('main/classes/field/ask.js')

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
  const { suggestShortcut, suggestLayout, suggestDefaults } = load('main/classes/field/personalize.js')
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

// ── 一类一实现单元（新轨）──────────────────────────────────────
test('新轨：每个实现单元的 classId 与注册表键一致，且 summary 有实质内容', () => {
  const impls = load('main/classes/index.js').CLASS_IMPLS
  const keys = Object.keys(impls)
  assert.ok(keys.length >= 18, `新轨至少该有 18 个，实际 ${keys.length}`)

  for (const [key, impl] of Object.entries(impls)) {
    assert.strictEqual(impl.classId, key, `注册表键 ${key} 与 impl.classId ${impl.classId} 不一致`)
    assert.strictEqual(typeof impl.run, 'function', `${key} 缺 run`)
    assert.ok(impl.summary.length >= 12, `${key} 的 summary 太短：${impl.summary}`)
    assert.ok(!impl.summary.includes('TODO'), `${key} 的 summary 还是 TODO`)
  }

  const surfaceIds = catalogs.surface.map((c) => c.id).sort()
  const covered = surfaceIds.filter((id) => impls[id])
  assert.deepStrictEqual(covered, surfaceIds, `面层有类没有实现单元：${surfaceIds.filter((id) => !impls[id]).join(',')}`)
})

test('新轨：清单与注册表一致，面层 17 个必须全部进清单', () => {
  const impls = load('main/classes/index.js').CLASS_IMPLS
  const manifest = new Set(load('shared/implemented.generated.js').IMPLEMENTED_CLASS_IDS)
  for (const key of Object.keys(impls)) {
    assert.ok(manifest.has(key), `注册表里的 ${key} 没进清单`)
  }
  const surfaceInManifest = catalogs.surface.filter((c) => manifest.has(c.id))
  assert.strictEqual(surfaceInManifest.length, catalogs.surface.length, '面层 17 个类必须全部进清单')
})

// ── 体层：每个体声明自己的必需角色 ──────────────────────────────
test('body：29 个体都有实现单元，且各自声明了必需角色', () => {
  const impls = load('main/classes/index.js').CLASS_IMPLS
  const bodyIds = catalogs.body.map((c) => c.id).sort()
  const missing = bodyIds.filter((id) => !impls[id])
  assert.deepStrictEqual(missing, [], `这些体没有实现单元：${missing.join(',')}`)

  for (const id of bodyIds) {
    const mod = load(`main/classes/body/${id.split('.')[1]}.js`)
    assert.ok(Array.isArray(mod.requires) && mod.requires.length > 0, `${id} 没声明 requires`)
    for (const req of mod.requires) {
      assert.ok(['ui', 'flow', 'capability', 'intel'].includes(req.role), `${id} 的角色非法：${req.role}`)
      assert.ok(req.reason.length >= 8, `${id} 的 ${req.role} 没写清为什么需要`)
    }
  }

  assert.strictEqual(load('main/classes/body/screenshot_translate.js').requires.length, 4, '截图翻译要四种角色')
  assert.strictEqual(load('main/classes/body/file_preview.js').requires.length, 2)
})

test('body：零件齐但角色缺，仍然必须报不齐备', () => {
  const { assessComposition } = load('main/bodyRuntime.js')
  const deps = { profiles: {}, hasClass: () => true, implementedClassIds: new Set(['point.ocr_read', 'surface.form']) }
  const result = assessComposition(
    { composition: [{ class: { layer: 'point', name: 'ocr_read' } }, { class: { layer: 'surface', name: 'form' } }] },
    deps,
    [
      { role: 'ui', reason: '需要界面承载' },
      { role: 'capability', reason: '需要真实能力' },
      { role: 'intel', reason: '需要判断理解' }
    ]
  )
  assert.strictEqual(result.readiness.total, 5, '2 个零件 + 3 个角色 = 5 项检查')
  assert.strictEqual(result.readiness.satisfied, 4)
  const missingRole = result.readiness.missing.find((m) => m.reason === 'missing-role')
  assert.ok(missingRole, '缺角色必须报 missing-role')
  assert.strictEqual(missingRole.id, 'role:intel')
  assert.strictEqual(result.assembly, undefined, '角色缺了就不能给装配方案')
})

// ── 面层特化：surface.table 从「列块」变成「列 + 行」────────────
test('surface.table：槽位当列、registry 当行，截断要如实报总数', async () => {
  const table = load('main/classes/surface/table.js')
  const instance = catalogs.surface.find((c) => c.id === 'surface.table').instances[0]
  const deps = {
    hasClass: () => true,
    declaredRegionKeys: () => ['detail'],
    read: async (source) => {
      if (source.kind !== 'registry') return { status: 'missing', reason: '不该走这里' }
      return { status: 'ready', value: Array.from({ length: 450 }, (_, i) => ({ id: `p${i}`, name: `n${i}` })) }
    }
  }

  const out = await table.run({ instanceId: instance.id, params: instance.params, deps })
  assert.ok(out.table, '必须产出 table')
  assert.strictEqual(out.table.columns.length, 2, 'surface.table 的 detail 有 2 段 → 2 列')
  assert.strictEqual(out.table.total, 450, '总数要如实报 450')
  assert.strictEqual(out.table.rows.length, 200, '最多渲染 200 行')
  assert.strictEqual(out.table.truncated, true, '被截断必须标记')
  assert.ok(out.intents.some((i) => i.startsWith('page:')), '截断时要有翻页意图')
  assert.deepStrictEqual(out.blocks, [], '列 + 行模式下不该再留占位块')

  const emptyDeps = { ...deps, read: async () => ({ status: 'empty', reason: '没有记录' }) }
  const empty = await table.run({ instanceId: instance.id, params: instance.params, deps: emptyDeps })
  assert.strictEqual(empty.table.total, 0)
  assert.strictEqual(empty.gaps.length, 0, '空表不该算缺口')

  const failDeps = { ...deps, read: async () => ({ status: 'error', reason: '磁盘读失败' }) }
  const failed = await table.run({ instanceId: instance.id, params: instance.params, deps: failDeps })
  assert.strictEqual(failed.table, undefined, '取数失败不该给出 table')
  assert.ok(failed.gaps.some((g) => g.slot === 'rows'), '取数失败必须报 rows 缺口')
})

test('surface.form：字段取值 / 必填校验 / 不能提交时给出人话原因', async () => {
  const form = load('main/classes/surface/form.js')
  const instance = catalogs.surface.find((c) => c.id === 'surface.form').instances[0]
  const deps = { hasClass: () => true, declaredRegionKeys: () => ['detail'] }

  const blank = await form.run({
    instanceId: instance.id,
    params: { ...instance.params, required: '默认_VPN,自动打开' },
    deps
  })
  assert.ok(blank.form, '必须产出 form')
  assert.strictEqual(blank.form.fields.length, 4, 'surface.form 的 detail 有 4 段 → 4 个字段')
  assert.strictEqual(blank.form.canSubmit, false)
  assert.ok(blank.form.blockers.length >= 2, '两个必填项都应该报')
  assert.ok(blank.form.blockers.some((b) => b.includes('必填')))
  assert.deepStrictEqual(blank.blocks, [], '字段模式下不该留占位块')

  const filled = await form.run({
    instanceId: instance.id,
    params: { ...instance.params, required: '默认_VPN', 默认_VPN: '开' },
    deps
  })
  assert.strictEqual(filled.form.canSubmit, true, `该能提交，阻塞项：${filled.form.blockers.join('；')}`)
  assert.ok(filled.intents.includes('submit'))
  assert.ok(filled.intents.includes('reset'))

  const noRequired = await form.run({ instanceId: instance.id, params: instance.params, deps })
  assert.strictEqual(noRequired.form.canSubmit, false)
  assert.ok(noRequired.form.blockers.some((b) => b.includes('没有声明 required')))
  assert.ok(!noRequired.intents.includes('reset'), '不能提交时不该给 reset 意图')
})

test('body.ocr：零件「有」不等于「能识别」—— 这是该类独有的检查', () => {
  const ocr = load('main/classes/body/ocr.js')
  const deps = { profiles: {}, hasClass: () => true, implementedClassIds: new Set(['point.clipboard_get', 'point.ocr_read', 'surface.form', 'surface.file_preview', 'field.classify']) }

  const wrongCap = ocr.run({
    profile: { composition: [
      { class: { layer: 'point', name: 'clipboard_get' } },
      { class: { layer: 'surface', name: 'form' } },
      { class: { layer: 'field', name: 'classify' } }
    ] },
    deps
  })
  assert.ok(wrongCap.findings.some((f) => f.code === 'no-recognizer'), '剪贴板能力不该被当成识别能力')

  const good = ocr.run({
    profile: { composition: [
      { class: { layer: 'point', name: 'ocr_read' } },
      { class: { layer: 'surface', name: 'file_preview' } },
      { class: { layer: 'field', name: 'classify' } }
    ] },
    deps
  })
  assert.deepStrictEqual(good.findings, [], `不该有问题，实际：${JSON.stringify(good.findings)}`)
  assert.strictEqual(good.readiness.missing.length, 0, '零件和角色都齐')

  const noIntl = ocr.run({
    profile: { composition: [
      { class: { layer: 'point', name: 'ocr_read' } },
      { class: { layer: 'surface', name: 'file_preview' } }
    ] },
    deps
  })
  assert.ok(noIntl.readiness.missing.some((m) => m.id === 'role:intel'), '通用角色检查不能被特化检查绕过')
})

test('没有实现单元的类：runCapability 必须返回 null，不能编一个 ok', async () => {
  const { runCapability, CAPABILITIES } = load('main/capabilities/index.js')
  const ctx = (cid) => ({
    instance: { id: `${cid}.x@r1`, classId: cid, name: 'x', rev: 1, status: 'active', description: '', params: {}, createdAt: 0, updatedAt: 0 },
    def: { key: cid.split('.')[0], classLabel: 'X', classes: [], outputs: {} },
    pointClass: {},
    params: {},
    findInstance: () => undefined
  })

  const allIds = ['point', 'line', 'surface', 'body', 'field'].flatMap((layer) => catalogs[layer].map((c) => c.id))
  const missing = allIds.filter((id) => !CAPABILITIES[id])
  assert.ok(missing.length > 0, '当前应该还有没实现的类')

  for (const cid of missing) {
    assert.strictEqual(await runCapability(ctx(cid)), null, `${cid} 没实现就必须返回 null`)
  }

  for (const cid of ['point.clipboard_get', 'field.rank', 'surface.table', 'body.ocr']) {
    assert.strictEqual(typeof CAPABILITIES[cid], 'function', `${cid} 应该有实现单元`)
  }
})

test('主进程不再用 mockRunner 兜底（它会返回 ok + 随机耗时）', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  const calls = source
    .split('\n')
    .filter((line) => /mockRunner\s*\(/.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'))
  assert.deepStrictEqual(calls, [], `index.ts 里不该再调用 mockRunner：${calls.join(' | ')}`)
  assert.ok(/notImplemented/.test(source), '必须有一个统一的「未实现」回答')
})

test('LayerStore 默认 runner 必须如实报未注入，不能伪装成功', async () => {
  const { LayerStore } = load('main/layerStore.js')
  const store = new LayerStore(join(mkdtempSync(join(tmpdir(), 'norunner-')), 's.json'), {
    key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {}
  })
  const run = await store.run(catalogs.point[0].instances[0].id)
  assert.strictEqual(run.status, 'warn', '默认 runner 不该返回 ok')
  assert.match(run.output, /没有注入 runner/)
})

test('实现清单分两级：有单元 ≠ 有自己逻辑，三态覆盖全部类', () => {
  const reg = load('shared/implRegistry.js')
  const allIds = ['point', 'line', 'surface', 'body', 'field'].flatMap((layer) => catalogs[layer].map((c) => c.id))

  const real = allIds.filter((id) => reg.implStateOf(id) === 'real')
  const skeleton = allIds.filter((id) => reg.implStateOf(id) === 'skeleton')
  const missing = allIds.filter((id) => reg.implStateOf(id) === 'missing')

  assert.strictEqual(real.length + skeleton.length + missing.length, allIds.length, '三态必须覆盖全部类')
  assert.strictEqual(missing.length, 8, `应该有 8 个完全没有实现单元，实际 ${missing.length}`)
  assert.ok(skeleton.length > 0 && real.length > 0)

  for (const cid of ['surface.table', 'surface.form', 'body.ocr', 'point.clipboard_get', 'field.rank']) {
    assert.strictEqual(reg.implStateOf(cid), 'real', `${cid} 应该是真实实现`)
  }
  for (const cid of ['surface.dashboard', 'body.window_layout', 'line.ensure_vpn']) {
    assert.strictEqual(reg.implStateOf(cid), 'skeleton', `${cid} 是骨架，不该算真实实现`)
    assert.strictEqual(reg.hasImplUnit(cid), true)
    assert.strictEqual(reg.hasSpecialized(cid), false)
  }
  assert.strictEqual(reg.implStateOf('field.generate'), 'missing')
  assert.strictEqual(reg.implStateLabel('surface.table'), '真实实现')
  assert.match(reg.implStateLabel('surface.dashboard'), /骨架/)
  assert.strictEqual(reg.implStateLabel('field.generate'), '未实现')
})

test('手势识别：长距离单向移动必须判为拖拽，不能触发手势', () => {
  const g = load('shared/gestureRecognizer.js')
  const line = (n, step) => Array.from({ length: n }, (_, i) => ({ x: i * step, y: 0, t: i * 16 }))

  const drag = g.recognize(line(40, 13))
  assert.strictEqual(drag.valid, false, '长距离单向必须无效')
  assert.strictEqual(drag.reason, 'suppressed-as-drag')
  assert.strictEqual(drag.directions, 'R', '方向仍要算出来，只是不算有效手势')

  const short = g.recognize(line(6, 8))
  assert.strictEqual(short.valid, true, '短距离单向仍是合法手势')
  assert.strictEqual(short.directions, 'R')

  const off = g.recognize(line(40, 13), { dragSuppressPx: 0 })
  assert.strictEqual(off.valid, true, 'dragSuppressPx=0 时应放行')
})

test('手势识别：minSegments 能要求多段，避免单笔误触', () => {
  const g = load('shared/gestureRecognizer.js')
  const pts = (segs) => {
    const out = [{ x: 0, y: 0, t: 0 }]
    const d = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
    let x = 0, y = 0, t = 0
    for (const s of segs) for (let i = 0; i < 6; i++) { const [dx, dy] = d[s]; x += dx * 10; y += dy * 10; t += 20; out.push({ x, y, t }) }
    return out
  }
  assert.strictEqual(g.recognize(pts(['R'])).valid, true, '默认单段可以')
  assert.strictEqual(g.recognize(pts(['R']), { minSegments: 2 }).reason, 'too-few-segments')
  assert.strictEqual(g.recognize(pts(['L', 'D']), { minSegments: 2 }).valid, true, '两段满足要求')
})

test('body.gesture：三个必需零件都不存在时必须逐个报出来', () => {
  const gesture = load('main/classes/body/gesture.js')
  assert.strictEqual(gesture.classId, 'body.gesture')
  assert.strictEqual(gesture.requires.length, 3, '手势只要求 ui/flow/capability 三种角色')

  const deps = { profiles: {}, hasClass: () => false, implementedClassIds: new Set() }
  const out = gesture.run({ profile: load('shared/bodyCatalog.js').bodyProfiles['body.gesture'], deps })

  const codes = out.findings.map((f) => f.code)
  // 声明里**有**识别器和派发器（名字对得上），所以不该报 no-recognizer / no-dispatcher；
  // 该报的是「这个名字的零件在目录里不存在」。
  assert.ok(codes.includes('missing-part:point.gesture.sample'), '必须报采样零件不存在')
  assert.ok(codes.includes('missing-part:point.gesture.recognize'), '必须报识别零件不存在')
  assert.ok(codes.includes('missing-part:line.gesture.dispatch'), '必须报派发零件不存在')
  assert.ok(codes.includes('missing-part:surface.gesture.recorder'), '必须报录制面不存在')
  assert.ok(!codes.includes('no-recognizer'), '声明了识别器就不该报「没有识别器」')
  assert.strictEqual(out.parts.length, 6, '组成里有 6 个零件')
  assert.strictEqual(out.parts.filter((p) => p.required).length, 4, '4 个必需 + 2 个浮层可选')
  assert.ok(out.readiness.missing.length >= 3, '角色缺失也要报')

  const okDeps = { profiles: {}, hasClass: () => true, implementedClassIds: new Set() }
  const ok = gesture.run({ profile: load('shared/bodyCatalog.js').bodyProfiles['body.gesture'], deps: okDeps })
  // 零件齐了，但组合里没有场层零件 → 只剩一条消歧提示（这是加分项提示，不是缺陷）
  assert.deepStrictEqual(ok.findings.map((f) => f.code), ['no-disambiguation'], '零件齐时只该剩消歧提示')

  // 补上场层零件后完全干净
  const withIntel = gesture.run({
    profile: { composition: [
      { layer: 'point', ref: 'gesture.recognize', role: '识别', required: true },
      { layer: 'line', ref: 'gesture.dispatch', role: '派发', required: true },
      { layer: 'surface', ref: 'gesture.recorder', role: '录制板', required: true },
      { layer: 'field', ref: 'field.rank', role: '同分排序', required: false }
    ] },
    deps: okDeps
  })
  assert.deepStrictEqual(withIntel.findings, [], '四层零件齐全时不该有任何问题')

  // 换成一个不认识轨迹的点零件 → 这次才该报 no-recognizer
  const wrong = gesture.run({
    profile: { composition: [
      { layer: 'point', ref: 'clipboard.read', role: '读剪贴板', required: true },
      { layer: 'line', ref: 'gesture.dispatch', role: '派发', required: true },
      { layer: 'surface', ref: 'gesture.recorder', role: '录制板', required: true }
    ] },
    deps: okDeps
  })
  assert.ok(wrong.findings.some((f) => f.code === 'no-recognizer'), '点零件不能识别轨迹时必须报出来')
})

// ── 命令会话：手势后继续接管滚轮 ──────────────────────────────
test('会话：只有被观察的事件才送达，且同一时刻只允许一个会话', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const host = createSessionHost()
  const got = []
  let clock = 1000

  const started = host.start({
    bindingId: 'gesture:DR→音量',
    observes: ['wheel-forward', 'wheel-backward'],
    onEvent: (e) => { got.push(e); return true },
    now: () => clock
  })
  assert.strictEqual(started.ok, true)

  // 滚轮送达
  assert.strictEqual(host.dispatch('wheel-forward'), 'delivered')
  assert.strictEqual(host.dispatch('wheel-backward'), 'delivered')
  // 没观察的事件不送达
  assert.strictEqual(host.dispatch('x1'), 'not-observed')
  assert.deepStrictEqual(got, ['wheel-forward', 'wheel-backward'])

  // 会话进行中，新手势必须被拒绝（不抢占不排队）
  const second = host.start({ bindingId: 'gesture:U→复制', observes: [], onEvent: () => true })
  assert.strictEqual(second.ok, false)
  assert.strictEqual(second.reason, 'busy')
  assert.strictEqual(second.activeBindingId, 'gesture:DR→音量', '要告诉调用方是谁占着')

  host.end('path-ended')
  assert.strictEqual(host.active(), null)
  // 结束后可以开新的
  assert.strictEqual(host.start({ bindingId: 'gesture:U→复制', observes: [], onEvent: () => true }).ok, true)
})

test('会话：onEvent 返回 false 自己结束，超时会兜底结束', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const host = createSessionHost()
  let clock = 0

  // 自己结束
  host.start({
    bindingId: 'b1',
    observes: ['wheel-forward'],
    onEvent: () => false,
    now: () => clock
  })
  assert.strictEqual(host.dispatch('wheel-forward'), 'ended')
  assert.strictEqual(host.active(), null, '自己结束后不该还占着')

  // 超时兜底
  clock = 10_000
  host.start({ bindingId: 'b2', observes: ['wheel-forward'], onEvent: () => true, idleTimeoutMs: 500, now: () => clock })
  clock = 10_400
  assert.strictEqual(host.tick(), false, '未超时不该关')
  clock = 10_600
  assert.strictEqual(host.tick(), true, '超时必须关掉，否则滚轮被永久劫持')
  assert.strictEqual(host.active(), null)

  const records = host.history()
  assert.deepStrictEqual(records.map((r) => r.endReason), ['timeout', 'self-closed'], '历史要记清结束原因')
  assert.deepStrictEqual(records[1].seen, ['wheel-forward'], '要记收到过哪些事件')
})

test('会话：没有会话时 dispatch 返回 no-session，不能静默吞掉', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const host = createSessionHost()
  assert.strictEqual(host.dispatch('wheel-forward'), 'no-session')
  assert.strictEqual(host.active(), null)
  host.end('cancelled')  // 幂等，不该抛
  assert.strictEqual(host.active(), null)
})

// ── 全局鼠标采样：初始有效位移 / 起始停留 ──────────────────────
test('gesture_sample：右键单击不能被当成手势（初始有效位移）', () => {
  const s = load('main/classes/point/gesture_sample.js')

  // 按下就抬手，一点没动 → no-move
  let st = s.onDown({ x: 100, y: 100, t: 0, button: 'right' })
  assert.ok(st, '右键应该开始采样')
  assert.strictEqual(st.activated, false)
  assert.strictEqual(s.onUp(st, { t: 80 }).reason, 'no-move', '右键单击必须判 no-move')

  // 只移动 10px（小于 30 阈值）→ 仍是 no-move
  st = s.onDown({ x: 100, y: 100, t: 0, button: 'right' })
  st = s.onMove(st, { x: 108, y: 106, t: 50 })
  assert.strictEqual(st.activated, false, '没超阈值不该激活')
  assert.strictEqual(s.onUp(st, { t: 90 }).reason, 'no-move')

  // 超过 30px → 激活，并把起点补进去
  st = s.onDown({ x: 100, y: 100, t: 0, button: 'right' })
  st = s.onMove(st, { x: 140, y: 100, t: 50 })
  assert.strictEqual(st.activated, true)
  assert.strictEqual(st.points.length, 2, '起点要补进去，否则轨迹少开头一段')
  assert.deepStrictEqual(st.points[0], { x: 100, y: 100, t: 0 })

  const result = s.onUp(st, { t: 200 })
  assert.strictEqual(result.reason, undefined, '越过阈值就是合法采样')
  assert.strictEqual(result.durationMs, 200)
})

test('gesture_sample：只响应配置里的按钮；长按不动判 stay-timeout', () => {
  const s = load('main/classes/point/gesture_sample.js')

  // 默认只认右键
  assert.strictEqual(s.onDown({ x: 0, y: 0, t: 0, button: 'left' }), null, '左键默认不采样')
  assert.ok(s.onDown({ x: 0, y: 0, t: 0, button: 'right' }))
  // 配了就能认
  assert.ok(s.onDown({ x: 0, y: 0, t: 0, button: 'left' }, { ...s.DEFAULT_SAMPLE_CONFIG, triggerButtons: ['left'] }))

  // 长按不动 500ms → 超时
  const st = s.onDown({ x: 0, y: 0, t: 1000, button: 'right' })
  assert.strictEqual(s.isStayTimedOut(st, 1300), false, '300ms 还没到')
  assert.strictEqual(s.isStayTimedOut(st, 1500), true, '500ms 到了必须放弃')

  // 已经开始画了就不该再判超时
  const moved = s.onMove(st, { x: 100, y: 0, t: 1100 })
  assert.strictEqual(moved.activated, true)
  assert.strictEqual(s.isStayTimedOut(moved, 9999), false, '已经开始画了不该判超时')
})

test('gesture_sample：按钮名与滚轮方向映射正确', () => {
  const s = load('main/classes/point/gesture_sample.js')
  assert.strictEqual(s.buttonName(1), 'left')
  assert.strictEqual(s.buttonName(2), 'right')
  assert.strictEqual(s.buttonName(3), 'middle')
  assert.strictEqual(s.buttonName(4), 'x1')
  assert.strictEqual(s.buttonName(5), 'x2')
  assert.strictEqual(s.buttonName(99), null, '未知按钮要返回 null，不能瞎猜')

  assert.strictEqual(s.onWheel({ rotation: 1 }), 'wheel-forward')
  assert.strictEqual(s.onWheel({ rotation: -1 }), 'wheel-backward')
  assert.strictEqual(s.onWheel({ rotation: 0 }), null)
})

test('gesture_sample：采样结果能直接喂给识别器（端到端）', () => {
  const s = load('main/classes/point/gesture_sample.js')
  const g = load('shared/gestureRecognizer.js')

  // 用采样状态机造一条 L→D→R
  let st = s.onDown({ x: 0, y: 0, t: 0, button: 'right' })
  const path = []
  const dirs = { L: [-1, 0], D: [0, 1], R: [1, 0] }
  let x = 0, y = 0, t = 0
  for (const d of ['L', 'D', 'R']) {
    for (let i = 0; i < 8; i++) {
      const [dx, dy] = dirs[d]
      x += dx * 12; y += dy * 12; t += 20
      path.push({ x, y, t })
    }
  }
  for (const p of path) st = s.onMove(st, p)
  const sample = s.onUp(st, { t: t + 20 })

  assert.ok(sample.points.length > 20, '采样点要够识别器用')
  const recognized = g.recognize(sample.points)
  assert.strictEqual(recognized.valid, true, `采样结果应能识别，实际 ${recognized.reason}`)
  assert.strictEqual(recognized.directions, 'LDR', `识别出 ${recognized.directions}`)
})

test('三元组：右键+U 和 右键+滚轮前+U 必须是两个不同手势', () => {
  const s = load('main/triggerStore.js')
  const plain = s.parseGestureKey('right:U')
  const wheel = s.parseGestureKey('right:U:wheel-forward')
  assert.deepStrictEqual(plain, { button: 'right', dirs: 'U', modifier: undefined })
  assert.deepStrictEqual(wheel, { button: 'right', dirs: 'U', modifier: 'wheel-forward' })
  assert.strictEqual(plain.dirs, wheel.dirs, '方向串相同')
  assert.notStrictEqual(s.gestureKeyOf(plain), s.gestureKeyOf(wheel), '三元组身份必须区分开')

  const chord = s.parseGestureKey('right::left-down')
  assert.deepStrictEqual(chord, { button: 'right', dirs: '', modifier: 'left-down' })
  assert.deepStrictEqual(s.parseGestureKey('LDR'), { button: 'right', dirs: 'LDR' })
})

test('三元组：非法输入必须拒绝，不能瞎猜', () => {
  const s = load('main/triggerStore.js')
  assert.strictEqual(s.parseGestureKey(''), null)
  assert.strictEqual(s.parseGestureKey('XYZ'), null)
  assert.strictEqual(s.parseGestureKey('nope:U'), null)
  assert.strictEqual(s.parseGestureKey('right:U:wheel-sideways'), null)
  assert.strictEqual(s.parseGestureKey('right::'), null, '没方向又没 modifier 不是手势')
})

test('三元组：备份里 71 条能全部转出互不相同的三元组', () => {
  const s = load('main/triggerStore.js')
  const data = JSON.parse(readFileSync(join(process.cwd(), 'docs/wgestures-1.8.5.0.gestures.json'), 'utf8'))
  const DIRS = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL']
  const BUTTONS = { 1: 'right', 2: 'middle', 4: 'x1', 8: 'x2' }
  const MODIFIERS = { 1: 'wheel-forward', 2: 'wheel-backward', 4: 'middle-down', 8: 'left-down', 16: 'right-down', 32: 'x1', 64: 'x2' }

  const all = [...data.Global.GestureIntents, ...Object.values(data.Apps).flatMap((a) => a.GestureIntents)]
  assert.strictEqual(all.length, 71)

  const tripleOf = (intent) => {
    const g = intent.Gesture
    return {
      button: BUTTONS[g.GestureButton],
      dirs: g.Dirs.map((d) => DIRS[d]).join(''),
      modifier: MODIFIERS[g.Modifier]
    }
  }

  const scopes = [['Global', data.Global.GestureIntents], ...Object.values(data.Apps).map((a) => [a.Name, a.GestureIntents])]
  let withModifier = 0
  const collisions = []
  const uniqueAcrossScopes = new Set()

  for (const [name, intents] of scopes) {
    const seen = new Map()
    for (const intent of intents) {
      const triple = tripleOf(intent)
      assert.ok(triple.button, `按钮 ${intent.Gesture.GestureButton} 无法映射`)
      assert.ok(triple.dirs || triple.modifier)
      if (triple.modifier) withModifier += 1
      const key = s.gestureKeyOf(triple)
      uniqueAcrossScopes.add(key)
      if (seen.has(key)) collisions.push({ scope: name, key, a: seen.get(key), b: intent.Name, dirs: intent.Gesture.Dirs })
      else seen.set(key, intent.Name)
    }
  }
  assert.strictEqual(withModifier, 36, `带 modifier 应有 36 条，实际 ${withModifier}`)

  // ── 已知缺陷：方向记法有歧义 ──────────────────────────────
  // Dirs:[7]（斜向左上，一段）和 Dirs:[0,6]（先上后左，两段）都渲染成 "UL"。
  // 这是 WGestures 记法本身的坑（它的 Rust 版文档就警告过：
  //  「对角线用 NE/NW/SE/SW，不用 LD/RU 这类会与单字母序列歧义的写法」）。
  // 我们的 parseGestureKey / DIRS_PATTERN 继承了这个歧义 —— 必须改成段间带分隔符。
  assert.strictEqual(collisions.length, 4, `应有 4 组歧义撞车：${JSON.stringify(collisions.map((c) => c.key))}`)
  const keys = collisions.map((c) => c.key)
  assert.ok(keys.includes('right:UL:'), 'UL 撞车：开始(斜) vs edge(上+左)')
  assert.ok(keys.includes('right:UR:'), 'UR 撞车：最大化(斜) vs google(上+右)')
  assert.ok(keys.includes('right:DL:'), 'DL 撞车：最小化(斜) vs AI(下+左)')
  // 段结构不同 = 真不同手势：按 Dirs 数组去重应得 58 个；
  // 但按我们现在的**字符串键**只剩 53 个 —— 差的 5 个就是被记法歧义吃掉的手势。
  // 这就是必须改成「段间带分隔符」的硬证据，不是风格问题。
  const structural = new Set()
  for (const [scope, intents] of scopes) {
    for (const intent of intents) {
      const g = intent.Gesture
      structural.add(`${g.GestureButton}|${g.Dirs.join(',')}|${g.Modifier}${scope ? '' : ''}`)
    }
  }
  assert.strictEqual(structural.size, 58, `按段结构应有 58 个不同手势，实际 ${structural.size}`)
  assert.strictEqual(uniqueAcrossScopes.size, 53, `按字符串键只剩 53 个，实际 ${uniqueAcrossScopes.size}`)
  assert.strictEqual(structural.size - uniqueAcrossScopes.size, 5, '5 个手势被记法歧义吃掉')

  // 证明撞车：去掉 modifier 后唯一键会大幅减少
  const flat = new Set(all.map((i) => i.Gesture.Dirs.map((d) => DIRS[d]).join('')))
  assert.ok(flat.size < 30, `扁平方向串只剩 ${flat.size} 个不同值`)
})

test('记法：箭头是单码位，斜线与两段直角不再撞车', () => {
  const n = load('shared/gestureNotation.js')
  const diagonal = n.parseGesture('◑↖')
  const twoSegments = n.parseGesture('◑↑←')
  assert.deepStrictEqual(diagonal, { button: 'right', dirs: '↖' })
  assert.deepStrictEqual(twoSegments, { button: 'right', dirs: '↑←' })
  assert.notStrictEqual(diagonal.dirs, twoSegments.dirs, '箭头串必须不同')

  assert.strictEqual(n.arrowsToDirections('↖').join(''), 'UL')
  assert.strictEqual(n.arrowsToDirections('↑←').join(''), 'UL', '方向名层面仍相同')
  assert.strictEqual(n.directionsToArrows(['UL']), '↖')
  assert.strictEqual(n.directionsToArrows(['U', 'L']), '↑←')
})

test('记法：助记符与 WGestures 完全一致', () => {
  const n = load('shared/gestureNotation.js')
  assert.strictEqual(n.BUTTON_MNEMONIC.right, '◑')
  assert.strictEqual(n.BUTTON_MNEMONIC.middle, '●')
  assert.strictEqual(n.BUTTON_MNEMONIC.x1, 'X1')
  assert.strictEqual(n.MODIFIER_MNEMONIC['wheel-forward'], '▲')
  assert.strictEqual(n.MODIFIER_MNEMONIC['wheel-backward'], '▼')
  assert.strictEqual(n.MODIFIER_MNEMONIC['left-down'], '◐')
  assert.strictEqual(n.MODIFIER_MNEMONIC['right-down'], '◑')

  assert.strictEqual(n.formatGesture({ button: 'right', dirs: '←↓→' }), '◑←↓→')
  assert.strictEqual(n.formatGesture({ button: 'right', dirs: '↑↓', modifier: 'wheel-forward' }), '◑↑↓▲')
  assert.strictEqual(n.formatGesture({ button: 'right', dirs: '', modifier: 'left-down' }), '◑◐')

  for (const text of ['◑←↓→', '◑↑↓▲', '◑◐', '◑↖', '◑↑←']) {
    const parsed = n.parseGesture(text)
    assert.ok(parsed, `应能解析 ${text}`)
    assert.strictEqual(n.formatGesture(parsed), text, `${text} 往返应一致`)
  }
})

test('算法：首段 8 向、后续 4 向（照 WGestures）', () => {
  const g = load('shared/gestureRecognizer.js')
  // 判定函数吃**数学坐标**（y 向上），和 WGestures 一致。
  // 屏幕坐标（y 向下）要先 negate dy —— 见 GestureParser.cs:165。
  assert.strictEqual(g.wgDir4(10, 3), 'R', '右')
  assert.strictEqual(g.wgDir4(3, -10), 'D', '屏幕向下 = 数学 dy 为负')
  assert.strictEqual(g.wgDir4(-10, 3), 'L', '左')
  assert.strictEqual(g.wgDir4(-3, 10), 'U', '屏幕上 = 数学 dy 为正')

  assert.strictEqual(g.wgDir8(10, 10), 'UR', '右上（数学）')
  assert.strictEqual(g.wgDir8(-10, 10), 'UL', '左上（数学）')
  assert.strictEqual(g.wgDir8(0, 10), 'U')
  assert.strictEqual(g.wgDir8(10, 0), 'R')
  assert.strictEqual(g.wgDir8(-10, -10), 'DL', '左下（数学）')

  const diag = [{ x: 0, y: 0, t: 0 }, { x: 20, y: -20, t: 40 }, { x: 40, y: -40, t: 80 }]
  const with8 = g.recognize(diag, { switchVotes: 1, dragSuppressPx: 0 })
  assert.strictEqual(with8.valid, true)
  assert.ok(with8.directions.includes('UR') || with8.directions.includes('U') || with8.directions.includes('R'))
})
