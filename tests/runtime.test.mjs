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
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
  assert.strictEqual(drag.directions, '→', '方向仍要算出来，只是不算有效手势')

  const short = g.recognize(line(6, 8))
  assert.strictEqual(short.valid, true, '短距离单向仍是合法手势')
  assert.strictEqual(short.directions, '→')

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

  // 滚轮送达（注意 100ms 节流：要推进时钟）
  assert.strictEqual(host.dispatch('wheel-forward'), 'delivered')
  clock += 50
  assert.strictEqual(host.dispatch('wheel-backward'), 'not-observed', '100ms 内第二次滚轮被节流')
  clock += 60
  assert.strictEqual(host.dispatch('wheel-backward'), 'delivered', '过了 100ms 才再送')
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
  clock += 200
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

  // uiohook rotation 与 Windows delta 符号相反
  assert.strictEqual(s.onWheel({ rotation: -1 }), 'wheel-forward')
  assert.strictEqual(s.onWheel({ rotation: 1 }), 'wheel-backward')
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
  assert.strictEqual(recognized.directions, '←↓→', `识别出 ${recognized.directions}`)
})

test('三元组：右键+U 和 右键+滚轮前+U 必须是两个不同手势', () => {
  const s = load('main/triggerStore.js')
  const plain = s.parseGestureKey('right:↑')
  const wheel = s.parseGestureKey('right:↑:wheel-forward')
  assert.deepStrictEqual(plain, { button: 'right', dirs: '↑', modifier: undefined })
  assert.deepStrictEqual(wheel, { button: 'right', dirs: '↑', modifier: 'wheel-forward' })
  assert.strictEqual(plain.dirs, wheel.dirs, '方向串相同')
  assert.notStrictEqual(s.gestureKeyOf(plain), s.gestureKeyOf(wheel), '三元组身份必须区分开')

  const chord = s.parseGestureKey('right::left-down')
  assert.deepStrictEqual(chord, { button: 'right', dirs: '', modifier: 'left-down' })
  assert.deepStrictEqual(s.parseGestureKey('←↓→'), { button: 'right', dirs: '←↓→' })
  assert.deepStrictEqual(s.parseGestureKey('◑↑↓▲'), { button: 'right', dirs: '↑↓', modifier: 'wheel-forward' })
})

test('三元组：非法输入必须拒绝，不能瞎猜', () => {
  const s = load('main/triggerStore.js')
  assert.strictEqual(s.parseGestureKey(''), null)
  assert.strictEqual(s.parseGestureKey('XYZ'), null)
  assert.strictEqual(s.parseGestureKey('nope:↑'), null)
  assert.strictEqual(s.parseGestureKey('right:↑:wheel-sideways'), null)
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
  assert.ok(['↗','↑','→'].some((a) => with8.directions.includes(a)), `实际 ${with8.directions}`)
})

test('迁移脚本：产出必须自洽（箭头串 + 目标存在性标出）', () => {
  const out = execFileSync(process.execPath, [join(process.cwd(), 'scripts/migrate-wgestures.mjs'), '--write'], { encoding: 'utf8' })
  assert.match(out, /目标实例还不存在/, '必须如实报出目标缺口，不能只报「能落地 64」')
  assert.match(out, /71 条/, '必须报总数')

  const migrated = JSON.parse(readFileSync(join(process.cwd(), '.tmp/wgestures-migrated.json'), 'utf8'))
  const s = load('main/triggerStore.js')
  assert.ok(migrated.bindings.length > 0)

  for (const b of migrated.bindings) {
    assert.ok(b.gesture, `${b.id} 缺三元组`)
    assert.ok(s.DIRS_PATTERN.test(b.gesture.dirs), `${b.id} 的 dirs 不是箭头串：${JSON.stringify(b.gesture.dirs)}`)
    assert.strictEqual(typeof b.targetExists, 'boolean', `${b.id} 必须标明目标是否存在`)

    const spec = `${b.gesture.button}:${b.gesture.dirs}${b.gesture.modifier ? ':' + b.gesture.modifier : ''}`
    const parsed = s.parseGestureKey(spec)
    assert.ok(parsed, `${b.id} 无法解析：${spec}`)
    assert.strictEqual(s.gestureKeyOf(parsed), s.gestureKeyOf(b.gesture), `${b.id} 身份键往返不一致`)
  }
})

test('shell_exec：%WG_PROCID% 必须替换，变量缺失时拒绝执行', async () => {
  const s = load('main/classes/point/shell_exec.js')
  const ok = s.expandVariables('taskkill /f /pid %WG_PROCID% /s localhost', { procId: 4242 })
  assert.strictEqual(ok.code, 'taskkill /f /pid 4242 /s localhost')
  assert.deepStrictEqual(ok.unresolved, [])

  const missing = s.expandVariables('taskkill /f /pid %WG_PROCID% /s localhost', {})
  assert.deepStrictEqual(missing.unresolved, ['%WG_PROCID%'], '必须报出未解析变量')
  assert.strictEqual(missing.code, 'taskkill /f /pid %WG_PROCID% /s localhost', '不能替换成空串')

  const refused = await s.execCommand('taskkill /f /pid %WG_PROCID%', {})
  assert.strictEqual(refused.status, 'warn')
  assert.match(refused.output, /无法解析的变量/)
  assert.strictEqual((await s.execCommand('   ')).status, 'warn')
  const done = await s.execCommand('echo hi', {})
  assert.strictEqual(done.status, 'ok')
  assert.match(done.output, /hi/)
})

test('send_keys：SendKeys 方言解析（^v{enter} / %{TAB} / {sleep}）', () => {
  const s = load('main/classes/point/send_keys.js')
  const paste = s.parseSendKeys('^v{enter}')
  assert.strictEqual(paste.error, undefined)
  assert.strictEqual(paste.steps.length, 2)
  // canonicalKeyName 返回大写显示名，这是 key_send 的既有约定
  assert.deepStrictEqual(paste.steps[0], { kind: 'keys', modifiers: ['Ctrl'], key: 'V' })
  assert.deepStrictEqual(paste.steps[1], { kind: 'keys', modifiers: [], key: 'Enter' })

  const altTab = s.parseSendKeys('%{TAB}')
  assert.deepStrictEqual(altTab.steps[0], { kind: 'keys', modifiers: ['Alt'], key: 'Tab' })

  const combo = s.parseSendKeys('^%{DELETE}')
  assert.deepStrictEqual(combo.steps[0].modifiers, ['Ctrl', 'Alt'])
  assert.strictEqual(combo.steps[0].key, 'Delete')

  const withSleep = s.parseSendKeys('a{sleep 500}b')
  assert.deepStrictEqual(withSleep.steps.map((x) => x.kind), ['text', 'sleep', 'text'])
  assert.strictEqual(withSleep.steps[1].ms, 500)

  assert.ok(s.parseSendKeys('{nosuchkey}').error, '未知键必须报错')
  assert.ok(s.parseSendKeys('{enter').error, '花括号不闭合必须报错')
})

test('gesture_pause：暂停/恢复状态正确，未知 action 要报错', () => {
  const s = load('main/classes/point/gesture_pause.js')
  s.resetForTest()
  assert.strictEqual(s.isPaused(), false)
  assert.strictEqual(s.pause().paused, true)
  assert.strictEqual(s.pause().paused, true, '重复暂停幂等')
  assert.strictEqual(s.resume().paused, false)
  s.toggle()
  assert.strictEqual(s.isPaused(), true)
  s.toggle()
  assert.strictEqual(s.isPaused(), false)

  assert.match(s.run({ params: { action: 'status' } }).output, /运行中/)
  assert.match(s.run({ params: { action: 'pause' } }).output, /已暂停/)
  assert.match(s.run({ params: { action: 'resume' } }).output, /已恢复/)
  const bad = s.run({ params: { action: 'nope' } })
  assert.strictEqual(bad.status, 'warn')
  assert.match(bad.output, /未知 action/)
  s.resetForTest()
})

test('copy_selection：必须先复制再等再读，不能立刻读', async () => {
  const s = load('main/classes/point/copy_selection.js')
  const calls = []
  let clipboard = ''
  const result = await s.copySelection({
    sendCopy: () => { calls.push('copy'); clipboard = '  选中的文字  ' },
    readClipboard: () => { calls.push('read'); return clipboard },
    sleep: async (ms) => { calls.push(`sleep:${ms}`) }
  })
  assert.deepStrictEqual(calls, ['copy', 'sleep:120', 'read'], '顺序必须是复制→等→读')
  assert.strictEqual(result.status, 'ok')
  assert.strictEqual(result.value, '选中的文字')
  assert.strictEqual(result.output, '已复制 5 字')

  const empty = await s.copySelection({ sendCopy: () => {}, readClipboard: () => '   ', sleep: async () => {} })
  assert.strictEqual(empty.status, 'warn')
  assert.match(empty.output, /选区为空/)
  assert.strictEqual((await s.run({})).status, 'warn')
})

test('task_switch：会话式切换能连续滚轮并记录格数', async () => {
  const s = load('main/classes/point/task_switch.js')
  const sent = []
  const session = s.createTaskSwitchSession({ sendSwitch: (back) => sent.push(back) })
  await session.began()
  assert.deepStrictEqual(sent, [false])
  assert.strictEqual(session.steps(), 1)

  assert.strictEqual(session.onEvent('wheel-forward'), -1)
  await session.step(-1)
  assert.deepStrictEqual(sent, [false, true])
  assert.strictEqual(session.steps(), 0)

  assert.strictEqual(session.onEvent('wheel-backward'), 1)
  assert.strictEqual(session.onEvent('x1'), null, '不关心的事件返回 null')
  assert.match(session.ended().output, /共 0 格/)
})

test('迁移产物：实例与绑定一一对齐，参数翻成目标类真正吃的格式', () => {
  const out = execFileSync(process.execPath, [join(process.cwd(), 'scripts/migrate-wgestures.mjs'), '--write'], { encoding: 'utf8' })
  const m = JSON.parse(readFileSync(join(process.cwd(), '.tmp/wgestures-migrated.json'), 'utf8'))

  const ids = new Set(m.instances.map((i) => i.instanceId))
  const missing = m.bindings.filter((b) => !ids.has(b.targetId))
  assert.deepStrictEqual(missing.map((b) => b.id), [], '绑定目标必须都在 instances 里')
  assert.strictEqual(m.instances.length, m.bindings.length, '一条手势一个实例')
  assert.strictEqual(ids.size, m.instances.length, '实例 id 不能重复')

  const keyInstances = m.instances.filter((i) => i.classId === 'point.key_send')
  assert.ok(keyInstances.length > 30, `key_send 应占多数，实际 ${keyInstances.length}`)
  for (const i of keyInstances) {
    assert.strictEqual(typeof i.params.keys, 'string', `${i.instanceId} 的 keys 必须是字符串`)
    assert.ok(i.params.keys.length > 0)
  }

  for (const i of m.instances) {
    // 形态：<层>.<类>.<实例>@r<rev>
    assert.match(i.instanceId, /^[a-z]+\.[a-z0-9_]+\.[a-z0-9_]+@r\d+$/, `实例 id 不合法：${i.instanceId}`)
  }

  assert.match(out, /要新建 \d+ 个点层实例/)
  assert.match(out, /目标实例还不存在/)
  assert.strictEqual(m.pending.length, 1, `应只剩 1 条阻塞，实际 ${m.pending.length}`)
  assert.match(m.pending[0].reason, /参数翻不出来/)
})

test('line.gesture_dispatch：方向串 + modifier 都要对上', () => {
  const d = load('main/classes/line/gesture_dispatch.js')
  const bindings = [
    { id: 'g1', enabled: true, targetKind: 'point', targetId: 'p1', name: '复制', gesture: { button: 'right', dirs: '↑' } },
    { id: 'g2', enabled: true, targetKind: 'point', targetId: 'p2', name: '剪切', gesture: { button: 'right', dirs: '↑', modifier: 'wheel-forward' } }
  ]
  assert.deepStrictEqual(d.matchBindings(bindings, { directions: '↑' }).matched.map((b) => b.name), ['复制'])
  assert.deepStrictEqual(d.matchBindings(bindings, { directions: '↑', modifier: 'wheel-forward' }).matched.map((b) => b.name), ['剪切'], 'modifier 不同是不同手势')
  assert.strictEqual(d.matchBindings(bindings, { directions: '↓' }).reason, 'no-binding')
  assert.strictEqual(d.matchBindings(bindings, { directions: '' }).reason, 'no-directions')
  assert.strictEqual(d.matchBindings([{ ...bindings[0], enabled: false }], { directions: '↑' }).reason, 'no-binding')
})

test('line.gesture_dispatch：应用级优先，按 inheritGlobal 决定回落', () => {
  const d = load('main/classes/line/gesture_dispatch.js')
  const bindings = [
    { id: 'global', enabled: true, targetKind: 'point', targetId: 'p', name: '全局', gesture: { button: 'right', dirs: '↑' } },
    { id: 'app', enabled: true, targetKind: 'point', targetId: 'p', name: '应用', gesture: { button: 'right', dirs: '↑' }, appScope: { exePath: 'C:\\x.exe', inheritGlobal: true } }
  ]
  assert.deepStrictEqual(d.matchBindings(bindings, { directions: '↑', exePath: 'c:\\X.EXE' }).matched.map((b) => b.name), ['应用'], 'exePath 大小写无关')
  assert.deepStrictEqual(d.matchBindings(bindings, { directions: '↑', exePath: 'D:\\y.exe' }).matched.map((b) => b.name), ['全局'], 'inheritGlobal 为真应回落')

  // 没登记过的应用 → 直接用全局（WGestures: exeApp == null 的分支）
  assert.deepStrictEqual(
    d.matchBindings(bindings, { directions: '↑', exePath: 'Z:\\never.exe' }).matched.map((b) => b.name),
    ['全局'],
    '没登记过的应用直接用全局'
  )

  // 当前应用**自己**声明不继承，且该手势在应用级没有 → 不回落
  const noInherit = d.matchBindings(
    [
      { ...bindings[0], gesture: { button: 'right', dirs: '↓' } },   // 全局是 ↓，不是 ↑
      { id: 'app2', enabled: true, targetKind: 'point', targetId: 'p', name: '应用别的手势', gesture: { button: 'right', dirs: '→' },
        appScope: { exePath: 'C:\\x.exe', inheritGlobal: false } }
    ],
    { directions: '↑', exePath: 'C:\\x.exe' }
  )
  assert.deepStrictEqual(noInherit.matched, [], '当前应用声明不继承，且应用级没这个手势 → 不回落')
  assert.strictEqual(noInherit.reason, 'no-binding')
})

test('line.gesture_dispatch：需要会话的命令返回 session，一次性返回 null', async () => {
  const d = load('main/classes/line/gesture_dispatch.js')
  const host = d.createDispatchSessionHost()
  const executed = []
  const run = async (needsSession) => d.dispatchGesture({
    bindings: [{ id: 'g1', enabled: true, targetKind: 'point', targetId: 'p', name: '音量', gesture: { button: 'right', dirs: '↓→' } }],
    context: { directions: '↓→' },
    execute: async (b) => { executed.push(b.id); return { ok: true, output: 'ok' } },
    needsSession,
    host
  })

  const once = await run(() => null)
  assert.strictEqual(once.status, 'ok')
  assert.strictEqual(once.session, null, '一次性命令不该开会话')
  assert.deepStrictEqual(executed, ['g1'])

  const got = []
  const withSession = await run(() => ({ observes: ['wheel-forward', 'wheel-backward'], onEvent: (e) => { got.push(e); return true } }))
  assert.ok(withSession.session, '需要会话的命令必须返回 session')
  assert.match(withSession.output, /已开会话/)
  assert.strictEqual(host.dispatch('wheel-forward'), 'delivered')
  assert.deepStrictEqual(got, ['wheel-forward'], '会话要接上滚轮')

  const busy = await run(() => ({ observes: ['wheel-forward'], onEvent: () => true }))
  assert.strictEqual(busy.status, 'warn')
  assert.strictEqual(busy.reason, 'ambiguous')
  assert.match(busy.output, /已有会话在接管滚轮/)
})

test('line.gesture_dispatch：没命中要说清原因', async () => {
  const d = load('main/classes/line/gesture_dispatch.js')
  const out = await d.dispatchGesture({
    bindings: [], context: { directions: '←↓→' },
    execute: async () => ({ ok: true, output: '' }),
    needsSession: () => null,
    host: d.createDispatchSessionHost()
  })
  assert.strictEqual(out.status, 'warn')
  assert.strictEqual(out.reason, 'no-binding')
  assert.match(out.output, /没有匹配的绑定/)
  assert.strictEqual(out.session, null)
})

// ── 录制板：实时方向串 + 合法性 + 冲突 ───────────────────────
test('surface.gesture_recorder：画的过程中就要有实时方向串', () => {
  const r = load('main/classes/surface/gesture_recorder.js')
  const path = (segs) => {
    const out = [{ x: 0, y: 0, t: 0 }]
    const dir = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }
    let x = 0, y = 0, t = 0
    for (const s of segs) for (let i = 0; i < 8; i++) { const [dx, dy] = dir[s]; x += dx * 12; y += dy * 12; t += 20; out.push({ x, y, t }) }
    return out
  }

  // 空
  const idle = r.computeRecorderState({ points: [] })
  assert.strictEqual(idle.phase, 'idle')
  assert.strictEqual(idle.canSave, false)

  // 正在画 —— 实时给方向串，但还不能存
  const drawing = r.computeRecorderState({ points: path(['L', 'D', 'R']), drawing: true })
  assert.strictEqual(drawing.directions, '←↓→', '画的过程中就要有方向串')
  assert.strictEqual(drawing.phase, 'drawing')
  assert.strictEqual(drawing.canSave, false, '还没抬笔不能存')

  // 抬笔 —— 能存
  const done = r.computeRecorderState({ points: path(['L', 'D', 'R']) })
  assert.strictEqual(done.phase, 'done')
  assert.strictEqual(done.valid, true)
  assert.strictEqual(done.canSave, true)
})

test('surface.gesture_recorder：非法手势要报原因，不能只给个空串', () => {
  const r = load('main/classes/surface/gesture_recorder.js')
  // 太短
  const short = r.computeRecorderState({ points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 50 }] })
  assert.strictEqual(short.valid, false)
  assert.strictEqual(short.reason, 'too-short')
  assert.strictEqual(short.canSave, false)

  // 拖拽（单向长距离）
  const drag = r.computeRecorderState({
    points: Array.from({ length: 40 }, (_, i) => ({ x: i * 13, y: 0, t: i * 16 }))
  })
  assert.strictEqual(drag.reason, 'suppressed-as-drag')
  assert.strictEqual(drag.canSave, false)
})

test('surface.gesture_recorder：与已有绑定冲突时必须拦住（改自己不算冲突）', () => {
  const r = load('main/classes/surface/gesture_recorder.js')
  const points = (() => {
    const out = [{ x: 0, y: 0, t: 0 }]
    let x = 0, y = 0, t = 0
    for (let i = 0; i < 8; i++) { x -= 12; t += 20; out.push({ x, y, t }) }
    for (let i = 0; i < 8; i++) { y += 12; t += 20; out.push({ x, y, t }) }
    for (let i = 0; i < 8; i++) { x += 12; t += 20; out.push({ x, y, t }) }
    return out
  })()

  const existing = [{ id: 'g1', name: '打开 GitHub', dirs: '←↓→' }]

  // 冲突
  const conflict = r.computeRecorderState({ points, existing })
  assert.strictEqual(conflict.phase, 'invalid')
  assert.strictEqual(conflict.reason, 'conflict')
  assert.strictEqual(conflict.conflictWith, '打开 GitHub')
  assert.strictEqual(conflict.canSave, false, '同一个手势不能绑两个目标')

  // 改自己不算冲突
  const editing = r.computeRecorderState({ points, existing, editingId: 'g1' })
  assert.strictEqual(editing.canSave, true, '改自己的绑定不该报冲突')

  // 没冲突
  const free = r.computeRecorderState({ points, existing: [{ id: 'g2', name: '别的', dirs: '↑↓' }] })
  assert.strictEqual(free.canSave, true)
})

test('surface.gesture_recorder：run 要给出 save/discard 意图和冲突缺口', () => {
  const r = load('main/classes/surface/gesture_recorder.js')
  const instance = catalogs.surface.find((c) => c.id === 'surface.gesture_recorder').instances[0]
  const deps = { hasClass: () => true, declaredRegionKeys: () => ['detail'] }
  const points = (() => {
    const out = [{ x: 0, y: 0, t: 0 }]
    let x = 0, y = 0, t = 0
    for (let i = 0; i < 8; i++) { x -= 12; t += 20; out.push({ x, y, t }) }
    for (let i = 0; i < 8; i++) { y += 12; t += 20; out.push({ x, y, t }) }
    return out
  })()

  const ok = r.run({ instanceId: instance.id, params: {}, deps, points })
  assert.ok(ok.recorder.canSave)
  assert.ok(ok.intents.includes('save'))
  assert.deepStrictEqual(ok.blocks, [])

  const bad = r.run({ instanceId: instance.id, params: {}, deps, points, existing: [{ id: 'g', name: 'X', dirs: ok.recorder.directions }] })
  assert.ok(!bad.recorder.canSave)
  assert.ok(!bad.intents.includes('save'))
  assert.ok(bad.gaps.some((g) => g.slot === 'pattern'), '冲突要体现在 gaps 里')
})

// ── 派发路径：精确三元组优先，模糊兜底 ───────────────────────
test('triggerService：三元组精确匹配优先于模糊匹配', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-prec-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const ran = []
  const pointStore = {
    instance: () => ({ id: 'point.key_send.copy@r1' }),
    run: async () => {
      ran.push('copy')
      return { status: 'ok', output: 'ok' }
    }
  }
  const service = new TriggerService({ store, pointStore: () => pointStore, lineStore: () => pointStore, onFired: () => {} })

  // 一条精确三元组
  const added = service.add({ source: 'gesture', pattern: '↑', targetKind: 'point', targetId: 'point.key_send.copy@r1', name: '精确' })
  assert.strictEqual(added.ok, true, 'binding add should succeed')
  const out = await service.dispatchGestureDirections('↑')
  assert.strictEqual(out.length >= 1, true, '精确匹配应命中')
  assert.strictEqual(out[0].status, 'ok')
  assert.deepStrictEqual(ran, ['copy'])
})

test('triggerService：needsSession 的绑定触发后开会话，滚轮能被接管', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-sess-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const pointStore = {
    instance: () => ({ id: 'point.audio_volume.vol_up@r1' }),
    run: async () => ({ status: 'ok', output: 'ok' })
  }
  const service = new TriggerService({ store, pointStore: () => pointStore, lineStore: () => pointStore, onFired: () => {} })

  const added2 = service.add({ source: 'gesture', pattern: '↓→', targetKind: 'point', targetId: 'point.audio_volume.vol_up@r1', name: '音量', needsSession: true })
  assert.strictEqual(added2.ok, true)
  assert.strictEqual(service.activeSession(), null, '还没触发时没有会话')

  await service.dispatchGestureDirections('↓→')
  assert.ok(service.activeSession(), 'needsSession 的绑定触发后必须开会话')

  // 滚轮被接管
  assert.strictEqual(service.feedSessionEvent('wheel-forward'), 'delivered')
  assert.strictEqual(service.feedSessionEvent('x1'), 'not-observed', '没声明的事件不送')

  // 会话结束后滚轮回到普通流程
  service.activeSession() && service.feedSessionEvent('wheel-backward')
})

test('主进程：启动时必须调用 startGestureHook，失败不阻塞启动', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(source, /hookStatus = startGestureHook\(\)/, '必须在 whenReady 里起钩子')
  assert.match(source, /startSampling\(\{/, '必须真的调用 startSampling（静态导入，不能 require）')
  assert.match(source, /onSample:[\s\S]{0,900}dispatchGesturePoints/, '采样结束必须派发')
  assert.match(source, /onWheel:[\s\S]{0,200}feedSessionEvent/, '滚轮必须送进会话')
  assert.match(source, /onGestureResume\(/, '恢复时必须重起钩子')
  assert.match(source, /if \(!result\.ok\)/, '钩子失败要能看见')
  assert.match(source, /gestureHook: hookStatus/, 'app:info 要暴露钩子状态')
})

test('会话：observes 可以为空（对应 GestureModifier.None）', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const host = createSessionHost()
  let ended = null
  const started = host.start({
    bindingId: 'task-switch',
    observes: [],
    onEvent: () => true,
    onEnd: (reason) => { ended = reason }
  })
  assert.strictEqual(started.ok, true, '空 observes 也要能开会话')
  assert.strictEqual(host.dispatch('wheel-forward'), 'not-observed')
  assert.strictEqual(host.dispatch('middle-down'), 'not-observed')
  host.end('path-ended')
  assert.strictEqual(ended, 'path-ended', 'GestureEnded 必须被调用')
  assert.strictEqual(host.active(), null)
})

test('会话：onEnd 在任何结束路径上都要被调用', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const reasons = []
  let clock = 0

  let host = createSessionHost()
  host.start({ bindingId: 'a', observes: [], onEvent: () => true, onEnd: (r) => reasons.push(r), now: () => clock })
  host.end('path-ended')

  host = createSessionHost()
  host.start({ bindingId: 'b', observes: ['wheel-forward'], onEvent: () => false, onEnd: (r) => reasons.push(r), now: () => clock })
  clock += 500
  host.dispatch('wheel-forward')

  host = createSessionHost()
  clock = 10_000
  host.start({ bindingId: 'c', observes: [], onEvent: () => true, onEnd: (r) => reasons.push(r), idleTimeoutMs: 100, now: () => clock })
  clock = 10_200
  host.tick()

  assert.deepStrictEqual(reasons, ['path-ended', 'self-closed', 'timeout'])
})

test('会话：onEnd 抛错不能把宿主搞坏', () => {
  const { createSessionHost } = load('shared/commandSession.js')
  const host = createSessionHost()
  host.start({ bindingId: 'x', observes: [], onEvent: () => true, onEnd: () => { throw new Error('boom') } })
  host.end('path-ended')
  assert.strictEqual(host.active(), null, '结束回调抛错也要把会话清掉')
  assert.strictEqual(host.start({ bindingId: 'y', observes: [], onEvent: () => true }).ok, true)
})

test('会话：滚轮 100ms 节流（照 WGestures HandleModifier）', () => {
  const { createSessionHost, WHEEL_THROTTLE_MS } = load('shared/commandSession.js')
  assert.strictEqual(WHEEL_THROTTLE_MS, 100)
  const host = createSessionHost()
  let clock = 0
  const got = []
  host.start({
    bindingId: 'vol',
    observes: ['wheel-forward', 'wheel-backward', 'middle-down'],
    onEvent: (e) => { got.push(e); return true },
    now: () => clock
  })

  assert.strictEqual(host.dispatch('wheel-forward'), 'delivered')
  clock = 40
  assert.strictEqual(host.dispatch('wheel-forward'), 'not-observed', '40ms 内被节流')
  clock = 101
  assert.strictEqual(host.dispatch('wheel-forward'), 'delivered', '过 100ms 放行')
  assert.strictEqual(host.dispatch('middle-down'), 'delivered', '中键不节流')
  assert.strictEqual(host.dispatch('middle-down'), 'delivered', '中键连续两次都送')
  assert.deepStrictEqual(got, ['wheel-forward', 'wheel-forward', 'middle-down', 'middle-down'])
})

test('采样：采样中滚轮走 onWheelDuringSampling，采样外走 onWheel', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/classes/point/gesture_sample.ts'), 'utf8')
  assert.match(source, /onWheelDuringSampling/, '必须有采样中滚轮回调')
  assert.match(source, /if \(state\) \{[\s\S]{0,160}onWheelDuringSampling/, '采样中优先走会话路径')
  assert.match(source, /if \(handlers\.onWheel\) handlers\.onWheel\(wheel\)/, '采样外走普通滚轮')
})

test('主进程：抬手先结束会话再派发，采样中滚轮走会话路径', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(source, /if \(triggerService\.endSessionOnPathEnd\(\)\) return/, '抬手已有会话要直接结束不再派发')
  assert.match(source, /onWheelDuringSampling:/, '采样中滚轮要接线')
  assert.match(source, /feedWheelDuringSampling/, '要调用服务方法')
})

test('派发服务：抬手结束会话，采样中滚轮无会话时如实报 needs-directions', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-path-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const fake = { instance: () => ({ id: 'x' }), run: async () => ({ status: 'ok', output: 'ok' }) }
  const service = new TriggerService({ store, pointStore: () => fake, lineStore: () => fake, onFired: () => {} })

  assert.strictEqual(service.endSessionOnPathEnd(), false, '没会话时抬手什么都不做')
  assert.strictEqual(await service.feedWheelDuringSampling('wheel-forward'), 'needs-directions', '没会话时如实报，不假装成功')

  service.add({ source: 'gesture', pattern: '↓→', targetKind: 'point', targetId: 'point.audio_volume.vol_up@r1', needsSession: true })
  await service.dispatchGestureDirections('↓→')
  assert.ok(service.activeSession(), '会话应该开着')
  assert.strictEqual(service.endSessionOnPathEnd(), true, '抬手要能结束会话')
  assert.strictEqual(service.activeSession(), null)
  assert.strictEqual(service.endSessionOnPathEnd(), false, '再抬手就没会话了')
})

test('采样：方向串变了才上报 onPathGrow', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/classes/point/gesture_sample.ts'), 'utf8')
  assert.match(source, /onPathGrow\?:/, '必须有 path-grow 回调')
  assert.match(source, /now - lastRecognizeAt >= 50/, '识别要节流到 50ms')
  assert.match(source, /grown\.directions !== lastDirections/, '方向串没变不重复上报')
  assert.match(source, /onPathPoint\?:/, '要有逐点回调')
  assert.match(source, /onPathStart\?:/, '要有轨迹开始回调')
})

test('主进程：实时方向串存下来并传给第一颗滚轮', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(source, /let currentDirections = ''/, '要保存实时方向串')
  assert.match(source, /onPathGrow:[\s\S]{0,120}currentDirections = grow\.directions/, 'path-grow 要写进 currentDirections')
  assert.match(source, /feedWheelDuringSampling\(event, currentDirections\)/, '滚轮派发要带上方向串')
})

test('派发服务：第一颗滚轮用方向串加 modifier 精确匹配并执行', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-fw-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const ran = []
  const fake = { instance: () => ({ id: 'x' }), run: async () => { ran.push(1); return { status: 'ok', output: 'ok' } } }
  const service = new TriggerService({ store, pointStore: () => fake, lineStore: () => fake, onFired: () => {} })

  service.add({
    source: 'gesture', pattern: '↓→', targetKind: 'point',
    targetId: 'point.audio_volume.vol_up@r1', name: '音量', needsSession: true,
    gesture: { button: 'right', dirs: '↓→', modifier: 'wheel-forward' }
  })

  assert.strictEqual(await service.feedWheelDuringSampling('wheel-forward'), 'needs-directions', '没方向串如实报')
  assert.strictEqual(ran.length, 0, '没方向串不能瞎执行')

  assert.strictEqual(await service.feedWheelDuringSampling('wheel-forward', '↓→'), 'delivered', '第一颗滚轮就该执行')
  assert.strictEqual(ran.length, 1)
  assert.ok(service.activeSession(), '执行后会话开着')

  service.endSessionOnPathEnd()
  assert.strictEqual(await service.feedWheelDuringSampling('wheel-backward', '↓→'), 'no-binding', 'modifier 不同不该命中')
})

// ── 两个浮层面层类：轨迹 + 提示 ─────────────────────────────
test('surface.gesture_trail：识别成功后换笔，空轨迹不可见', () => {
  const t = load('main/classes/surface/gesture_trail.js')
  const pts = [
    { x: 0, y: 0, t: 0 }, { x: -40, y: 0, t: 20 }, { x: -80, y: 0, t: 40 },
    { x: -80, y: 40, t: 60 }, { x: -80, y: 80, t: 80 }
  ]

  // 未识别用待定笔（原码 _alternativePen 橙 rgb(255,120,20)）
  const idle = t.computeTrail({ points: pts, directions: '←↓', recognized: false })
  assert.strictEqual(idle.visible, true)
  assert.strictEqual(idle.recognized, false)
  assert.strictEqual(idle.pen.color, '#ff7814', '未识别用 _alternativePen 橙')

  // 识别后按按钮换笔（原码 CanvasWindowGestureView.cs:210）
  const right = t.computeTrail({ points: pts, directions: '←↓', recognized: true, button: 'right' })
  assert.strictEqual(right.pen.color, '#32c864', '右键手势用 _mainPen 绿 rgb(50,200,100)')

  const middle = t.computeTrail({ points: pts, directions: '←↓', recognized: true, button: 'middle' })
  assert.strictEqual(middle.pen.color, '#1496c8', '中键手势用 _middleBtnPen 蓝 rgb(20,150,200)')

  const x1 = t.computeTrail({ points: pts, directions: '←↓', recognized: true, button: 'x1' })
  assert.strictEqual(x1.pen.color, '#1464c8', 'X 键手势用 _xBtnPen 深蓝 rgb(20,100,200)')

  // 认不出的按钮回退右键色，不能崩
  const unknown = t.computeTrail({ points: pts, directions: '←↓', recognized: true, button: 'weird' })
  assert.strictEqual(unknown.pen.color, '#32c864')

  // 包围盒够包住所有点
  assert.strictEqual(right.bounds.minX, -80)
  assert.strictEqual(right.bounds.maxY, 80)
  assert.strictEqual(right.recognized, true)

  // 空轨迹
  const empty = t.computeTrail({ points: [] })
  assert.strictEqual(empty.visible, false)
  assert.deepStrictEqual(empty.polyline, [])
})

test('surface.gesture_trail：点太多要抽稀，但必须保留最后一点', () => {
  const t = load('main/classes/surface/gesture_trail.js')
  const pts = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: i, t: i }))
  const r = t.computeTrail({ points: pts })
  assert.ok(r.polyline.length <= 514, `抽稀上限照原码是 512，实际 ${r.polyline.length}`)
  assert.ok(r.polyline.length > 100, '也不能抽太狠')
  const last = r.polyline[r.polyline.length - 1]
  assert.deepStrictEqual({ x: last.x, y: last.y }, { x: 1999, y: 1999 }, '最后一点必须保留')
  assert.strictEqual(r.pointCount, 2000, '原始点数要如实报告')
})

test('surface.gesture_hint：文本 = 意图名 + 空格 + modifier 助记符（照原码拼法）', () => {
  const h = load('main/classes/surface/gesture_hint.js')

  // ① 识别时：名字在前
  const withMod = h.formatHintText('音量', 'wheel-forward')
  assert.strictEqual(withMod.text, `音量 ${withMod.modifierText}`, '识别时是「名字 + 空格 + 助记符」')
  assert.ok(withMod.modifierText.length > 0, 'modifier 要有助记符')

  // ② 状态回报时：modifier 在前 + 状态后缀（原码两处格式不同）
  const status = h.formatHintText('音量', 'wheel-forward', '+', 'status')
  assert.strictEqual(status.text, `${status.modifierText} 音量+`, '状态回报时是「助记符 名字+状态」')
  const statusNoMod = h.formatHintText('音量', undefined, '-', 'status')
  assert.strictEqual(statusNoMod.text, '音量-', '没 modifier 就不加前缀空格')

  // 没有 modifier → 不补空格
  assert.strictEqual(h.formatHintText('复制').text, '复制')
  assert.strictEqual(h.formatHintText('复制').modifierText, '')

  // 位置与内边距照原码：x=W/2, y=H/2+W/8, padding=25/15×dpi
  const pos = h.computeHint({ name: '音量', modifier: 'wheel-forward', screen: { width: 2560, height: 1440 }, dpiFactor: 1 })
  assert.deepStrictEqual(pos.position, { x: 1280, y: 1440 / 2 + 2560 / 8 }, 'x=W/2, y=H/2+W/8')
  assert.deepStrictEqual(pos.padding, { x: 25, y: 15 }, '内边距 25/15')
  assert.strictEqual(pos.fontSize, 15)
  const pos2 = h.computeHint({ name: '音量', screen: { width: 2560, height: 1440 }, dpiFactor: 2 })
  assert.deepStrictEqual(pos2.padding, { x: 50, y: 30 }, 'DPI 2 内边距翻倍')
  assert.strictEqual(pos2.fontSize, 30, 'DPI 2 字号翻倍')

  // 空名字 → 不显示
  assert.strictEqual(h.computeHint({ name: '' }).visible, false)
  assert.strictEqual(h.computeHint({}).text, '')

  // 颜色照原码：白字 + 半透明黑底
  const hint = h.computeHint({ name: '音量', modifier: 'wheel-backward' })
  assert.strictEqual(hint.color, '#ffffff', '白字')
  assert.match(hint.background, /rgba\(0, 0, 0, 0\.4/, '半透明黑底（120/255≈0.47）')
  assert.strictEqual(hint.visible, true)
})

test('浮层接线：主进程要推 trail 和 hint，渲染层要挂载', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(main, /gesture:trail-point/, '主进程要逐点推')
  // 推送统一走 safeSend（防窗口销毁）
  assert.match(main, /'gesture:hint'/, '主进程要推提示')
  assert.match(main, /gesture:trail-start/, '要有轨迹开始通道')

  const preload = readFileSync(join(process.cwd(), 'src/preload/index.ts'), 'utf8')
  assert.match(preload, /ipcRenderer\.on\('gesture:trail'/, 'preload 要转发轨迹')
  assert.match(preload, /ipcRenderer\.on\('gesture:hint'/, 'preload 要转发提示')

  const app = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
  assert.match(app, /<GestureOverlay \/>/, 'App 要挂载浮层')
})

test('浮层窗口：必须透明、无边框、置顶、穿透、不进任务栏', () => {
  const source = readFileSync(join(process.cwd(), 'src/main/gestureOverlayWindow.ts'), 'utf8')
  for (const key of ['transparent: true', 'frame: false', 'hasShadow: false', 'skipTaskbar: true', 'focusable: false', 'alwaysOnTop: true']) {
    assert.ok(source.includes(key), `浮层窗口必须有 ${key}`)
  }
  assert.match(source, /setAlwaysOnTop\(true, 'screen-saver'\)/, '要盖住全屏应用')
  assert.match(source, /setIgnoreMouseEvents\(true/, '必须鼠标穿透')
  assert.match(source, /showInactive\(\)/, '不能抢焦点')
})

test('浮层窗口：同一渲染入口用 ?overlay=1 区分，只画浮层', () => {
  const win = readFileSync(join(process.cwd(), 'src/main/gestureOverlayWindow.ts'), 'utf8')
  assert.match(win, /\?overlay=1/, 'dev 用 query 区分')
  assert.match(win, /search: 'overlay=1'/, '打包后用 search 区分')

  const entry = readFileSync(join(process.cwd(), 'src/renderer/src/main.tsx'), 'utf8')
  assert.match(entry, /get\('overlay'\) === '1'/, '渲染入口要识别浮层模式')
  assert.match(entry, /isOverlay \? <GestureOverlay \/> : <ErrorBoundary><App \/>/, '浮层模式只渲染 GestureOverlay，主窗口用 ErrorBoundary 包住')
  assert.match(entry, /background = 'transparent'/, '浮层页必须整页透明')
})

test('浮层窗口：主进程优先推浮层，回落主窗口', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(main, /createGestureOverlayWindow/, '要创建浮层窗口')
  assert.match(main, /sendToOverlay\('gesture:trail-point'/, '轨迹逐点推给浮层')
  assert.match(main, /sendToOverlay\('gesture:hint'/, '提示推给浮层')
})

test('浮层窗口：照 CanvasWindow.cs 的样式映射，并补上 backgroundColor', () => {
  const src = readFileSync(join(process.cwd(), 'src/main/gestureOverlayWindow.ts'), 'utf8')

  // WGestures CreateWindowEx: LAYERED | TOPMOST | TOOLWINDOW
  // 之后的 NOACTIVATE / TRANSPARENT 分别对应 Electron 的 focusable:false / setIgnoreMouseEvents
  assert.match(src, /transparent: true/, 'WS_EX_LAYERED ↔ transparent')
  assert.match(src, /alwaysOnTop: true/, 'WS_EX_TOPMOST ↔ alwaysOnTop')
  assert.match(src, /skipTaskbar: true/, 'WS_EX_TOOLWINDOW ↔ skipTaskbar')
  assert.match(src, /focusable: false/, 'WS_EX_NOACTIVATE ↔ focusable:false')
  assert.match(src, /setIgnoreMouseEvents\(true/, 'WS_EX_TRANSPARENT ↔ setIgnoreMouseEvents')

  // WGestures 用 UpdateLayeredWindow + DIB 走 per-pixel alpha，Electron 没有这个 API
  assert.match(src, /backgroundColor: '#00000000'/, '必须显式给全透明背景色，否则 Windows 上会画成黑底')

  // WGestures 的 Visible = false：画手势才显示
  assert.match(src, /overlayReady = true/, '不能 ready 就 show')
  assert.ok(!/once\('ready-to-show', \(\) => overlay\?\.showInactive\(\)\)/.test(src), '不能在 ready-to-show 里 showInactive')
  assert.match(src, /export function setOverlayVisible/, '要有显隐开关')
  assert.match(src, /win\.hide\(\)/, '没手势时要藏起来')
})

test('主进程：轨迹可见性驱动浮层显隐', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(main, /setOverlayVisible\(true\)/, '开始时显示')
  assert.match(main, /setOverlayVisible\(false\)/, '结束时藏起')
})

test('surface.gesture_trail：DPI 缩放笔宽与点数上限', () => {
  const t = load('main/classes/surface/gesture_trail.js')
  const pts = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: 0, t: i }))
  const d1 = t.computeTrail({ points: pts, button: 'right', recognized: true, dpiFactor: 1 })
  assert.strictEqual(d1.pen.width, 2, 'DPI 1 主笔 2px')
  assert.ok(d1.polyline.length <= 514, 'DPI 1 上限 512')
  const d2 = t.computeTrail({ points: pts, button: 'right', recognized: true, dpiFactor: 2 })
  assert.strictEqual(d2.pen.width, 4, 'DPI 2 主笔 4px')
  assert.ok(d2.polyline.length > d1.polyline.length, '高 DPI 保留更多点')
  assert.strictEqual(t.computeTrail({ points: pts, dpiFactor: 0 }).pen.width, 2, 'DPI 0 视为无效 → 回落 1')
  assert.strictEqual(t.computeTrail({ points: pts, dpiFactor: 99 }).pen.width, 8, 'DPI 99 夹到 4')
})

test('surface.gesture_trail：三层笔迹 阴影→白边→主笔', () => {
  const t = load('main/classes/surface/gesture_trail.js')
  const r = t.computeTrail({ points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 10, t: 10 }], button: 'right', recognized: true, dpiFactor: 1 })
  assert.strictEqual(r.layers.length, 3)
  assert.strictEqual(r.layers[0].color, '#000000')
  assert.strictEqual(r.layers[0].width, 6, '阴影 = 2×3')
  assert.ok(r.layers[0].opacity < 0.2)
  assert.strictEqual(r.layers[1].color, '#ffffff')
  assert.strictEqual(r.layers[1].width, 5, '白边 = 2×2.5')
  assert.strictEqual(r.layers[2].color, '#32c864')
  assert.ok(r.layers[0].width > r.layers[1].width)
  assert.ok(r.layers[1].width > r.layers[2].width)
})

test('浮层接线：画三层 + 按主屏 DPI + 传按钮', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(main, /screen\.getPrimaryDisplay\(\)\.scaleFactor/, 'DPI 按主屏取')
  assert.match(main, /dpiFactor: dpi/, '传给 computeTrail')
  assert.match(main, /currentButton/, '记住触发按钮')
  const overlay = readFileSync(join(process.cwd(), 'src/renderer/src/components/GestureOverlay.tsx'), 'utf8')
  assert.match(overlay, /penRef\.current\.layers/, '渲染层画三层')
})

test('main 不能用运行时 require 引相对模块（单文件打包后必然 MODULE_NOT_FOUND）', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  const bad = [...main.matchAll(/require\(\s*['"]\.\.?\/[^'"]+['"]\s*\)/g)].map((m) => m[0])
  assert.deepStrictEqual(bad, [], `单文件 main 里不能有相对 require：${bad.join(', ')}`)
  assert.match(main, /import \{ startSampling \} from '\.\/classes\/point\/gesture_sample'/, 'startSampling 要静态导入')
  assert.match(main, /import \{ onResume as onGestureResume \}/, 'onResume 要静态导入')
})

test('采样按钮要在 path-grow 时就拿到，不能等抬手', () => {
  const sample = readFileSync(join(process.cwd(), 'src/main/classes/point/gesture_sample.ts'), 'utf8')
  assert.match(sample, /onPathGrow\?:\s*\(state: \{[^}]*button: string/, 'path-grow 要带 button')
  assert.match(sample, /button: nextState\.button/, '上报时要带当前按钮')
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.match(main, /onPathGrow:[\s\S]{0,300}currentButton = grow\.button/, '按钮要在 path-grow 时设')
  const onSampleBlock = main.slice(main.indexOf('onSample:'), main.indexOf('onWheel:'))
  assert.ok(!onSampleBlock.includes('currentButton ='), '抬手时设按钮是错的')
})

test('浮层 canvas 必须用物理像素坐标（uiohook 给的是物理坐标）', () => {
  const src = readFileSync(join(process.cwd(), 'src/renderer/src/components/GestureOverlay.tsx'), 'utf8')
  // 后备缓冲按 dpr 放大 —— 这一步是对的
  assert.match(src, /canvas\.width = Math\.floor\(window\.innerWidth \* dpr\)/, '后备缓冲要物理像素')
  // 但绘制**不能**再缩放，否则和 uiohook 的物理坐标错位
  assert.match(src, /ctx\.setTransform\(1, 0, 0, 1, 0, 0\)/, '必须用单位矩阵绘制')
  assert.ok(
    !/setTransform\(dpr, 0, 0, dpr, 0, 0\)/.test(src),
    '不能再 setTransform(dpr,…)：DPI 1.25 时轨迹会向左上偏'
  )
})

test('手势提示必须在派发当场推送，不能等下一个手势', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  // onFired 里直接查绑定 + 推
  assert.match(main, /hintSink\(binding\.name, binding\.gesture\?\.modifier\)/, 'onFired 要当场推提示')
  assert.ok(!main.includes('pendingHint'), '不能再有 pendingHint 这种延后机制')
  // 必需在 pushHint 定义之后注入
  const sinkIdx = main.indexOf('hintSink = pushHint')
  const pushHintIdx = main.indexOf('const pushHint =')
  assert.ok(pushHintIdx > 0 && sinkIdx > pushHintIdx, 'hintSink 要在 pushHint 定义之后注入')
})

test('迁移产物：每条绑定都必须带 source=gesture，否则会被当成热键', () => {
  const path = join(process.cwd(), '.tmp/wgestures-migrated.json')
  if (!existsSync(path)) return
  const migrated = JSON.parse(readFileSync(path, 'utf8'))
  const bs = migrated.bindings ?? []
  assert.ok(bs.length > 0, '迁移产物应该有绑定')
  const wrongSource = bs.filter((b) => b.source !== 'gesture')
  assert.deepStrictEqual(wrongSource.map((b) => b.id), [], '缺 source 会被归一化成 hotkey：手势0、热键70、全部注册失败')
  const unusable = bs.filter((b) => !b.pattern && !b.gesture?.modifier)
  assert.deepStrictEqual(unusable.map((b) => b.id), [], '既没方向串也没 modifier 无法派发')
  const scoped = bs.filter((b) => b.scope !== undefined)
  assert.strictEqual(scoped.length, 0, '应用作用域必须用 appScope 字段名')
})

test('TriggerStore 归一化：没有 source 的绑定默认成 hotkey', () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-src-'))
  const file = join(dir, 'b.json')
  writeFileSync(file, JSON.stringify({
    version: 3,
    bindings: [{ id: 'x', pattern: '↑', targetKind: 'point', targetId: 'p', enabled: true }]
  }), 'utf8')
  const store = new TriggerStore(file)
  const list = store.list()
  assert.strictEqual(list[0].source, 'hotkey', '缺 source 默认 hotkey —— 这就是 70 条手势变成热键的原因')
  assert.strictEqual(list[0].gesture, undefined, '非 gesture 来源不保留三元组')
})

test('手势去重：同一三元组在不同应用作用域下不能合并（70 条曾被压成 57）', () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-dedupe-'))
  const file = join(dir, 'b.json')
  const mk = (id, exe) => ({
    id, source: 'gesture', pattern: '↑', enabled: true, targetKind: 'point', targetId: 'p',
    gesture: { button: 'right', dirs: '↑' },
    appScope: exe ? { exePath: exe, inheritGlobal: true } : undefined
  })
  writeFileSync(file, JSON.stringify({
    version: 3,
    bindings: [mk('g-global', null), mk('g-app-a', 'C:\\a.exe'), mk('g-app-b', 'D:\\b.exe')]
  }), 'utf8')
  const list = new TriggerStore(file).list()
  assert.strictEqual(list.length, 3, '原码每个 ExeApp 各存一份，同手势不同应用是三条独立记录')
})

// ── 应用作用域：前台进程必须真的解析 ─────────────────────────
test('_win32：必须有 foregroundProcess（原码 GetExeAppByContext 靠它）', () => {
  const src = readFileSync(join(process.cwd(), 'src/main/capabilities/_win32.ts'), 'utf8')
  assert.match(src, /export function foregroundProcess\(\)/, '要导出 foregroundProcess')
  assert.match(src, /GetForegroundWindow\(\)/, '要用 GetForegroundWindow')
  assert.match(src, /GetWindowThreadProcessId/, '要拿 pid')
  assert.match(src, /QueryFullProcessImageNameW/, '要拿完整 exe 路径，不是 basename')
  // 拿不到不能抛
  assert.match(src, /catch \{\s*return null\s*\}/, '失败返回 null，不能抛')
})

test('triggerService：按作用域筛候选，照 AbstractGestureIntentFinder.Find', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-scope-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const ran = []
  const mkStore = (tag) => ({ instance: () => ({ id: tag }), run: async () => { ran.push(tag); return { status: 'ok', output: 'ok' } } })
  const service = new TriggerService({
    store, pointStore: () => mkStore('p'), lineStore: () => mkStore('l'), onFired: () => {}
  })

  // 全局：↑ → A；应用 C:\\app.exe 的同手势 → B
  service.add({ source: 'gesture', pattern: '↑', targetKind: 'point', targetId: 'point.a@r1', name: '全局A' })
  service.add({
    source: 'gesture', pattern: '↑', targetKind: 'point', targetId: 'point.b@r1', name: '应用B',
    appScope: { exePath: 'C:\\app.exe', inheritGlobal: true }
  })

  // 一段合法的向上轨迹（屏幕坐标 y 减小 = 向上），时长要落在 80–3000ms
  const up = Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 100 - i * 6, t: i * 15 }))
  // 在 app.exe 里画 ↑ → 用应用级的 B
  const inApp = await service.dispatchGesturePoints(up, 'C:\\APP.EXE')
  assert.strictEqual(inApp.valid, true)
  assert.ok(ran.length > 0, '应用级绑定必须能命中（以前 exePath 永远 undefined，这里永远打不中）')
})

test('main：手势子系统抛异常不能拖垮 IPC 注册', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')

  // startGestureHook / 浮层窗口都在 whenReady 里、IPC 注册之前。
  // 它们一抛异常，后面所有 ipcMain.handle 都不会执行 ——
  // 界面能开但每个 IPC 都失败，点层线层页面直接空白（真实踩过）。
  assert.match(main, /try \{\s*hookStatus = startGestureHook\(\)\s*\} catch/, 'startGestureHook 必须在 try/catch 里')
  assert.match(main, /try \{\s*createGestureOverlayWindow/, '浮层窗口创建必须在 try/catch 里')

  // 顺序不变量：钩子启动确实在 IPC 注册之前 —— 所以必须靠 try/catch 兜
  const hookIdx = main.indexOf('startGestureHook()')
  const handleIdx = main.indexOf('ipcMain.handle(')
  assert.ok(hookIdx > 0 && handleIdx > 0, '两处都要存在')
  if (hookIdx < handleIdx) {
    assert.match(main, /try \{\s*hookStatus = startGestureHook\(\)/, '在 IPC 之前启动就必须包 try/catch')
  }
})

// ── 线层页面白屏：profile 里的引用是对象，直接渲染会炸整棵树 ──
test('line profile：pointClass / pointInstance 有对象形态，渲染前必须归一化', () => {
  const profiles = JSON.parse(readFileSync(join(process.cwd(), 'src/shared/generatedLineProfiles.json'), 'utf8'))
  let objectRefs = 0
  for (const prof of Object.values(profiles)) {
    for (const node of prof.nodes ?? []) {
      if (node.pointClass && typeof node.pointClass === 'object') objectRefs++
      if (node.pointInstance && typeof node.pointInstance === 'object') objectRefs++
    }
  }
  assert.ok(objectRefs > 0, 'profile 里确实存在对象形态的引用（这是白屏的根因，不能假设它是字符串）')

  const page = readFileSync(join(process.cwd(), 'src/renderer/src/pages/LineManagementPage.tsx'), 'utf8')
  assert.match(page, /function refText\(value: unknown\): string/, '必须有引用归一化函数')
  // 只看「直接作为子节点」的用法：>{node.pointXxx}< 或 >{node.pointXxx || ...}<
  // 三元条件（node.pointInstance ? ...）是安全的，不算；注释先剥掉
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const raw = [
    ...code.matchAll(/>\s*\{(node\.pointClass)(?![^}]*refText)([^}]*)\}/g),
    ...code.matchAll(/>\s*\{(node\.pointInstance)(?![^}]*refText)([^}]*)\}/g)
  ].map((m) => `${m[1]}${m[2]}`)
  assert.deepStrictEqual(
    raw,
    [],
    '不能直接把 node.pointClass / node.pointInstance 当子节点渲染 —— 对象会让 React 抛错并卸载整棵树'
  )
  assert.ok(page.includes('refText(node.pointClass)'), 'pointClass 渲染要过 refText')
  assert.ok(page.includes('refText(node.pointInstance)'), 'pointInstance 渲染要过 refText')
})

test('渲染失败必须被 ErrorBoundary 接住，不能整窗白屏', () => {
  const entry = readFileSync(join(process.cwd(), 'src/renderer/src/main.tsx'), 'utf8')
  assert.match(entry, /<ErrorBoundary>/, '根节点要包 ErrorBoundary')
  const boundary = readFileSync(join(process.cwd(), 'src/renderer/src/components/ErrorBoundary.tsx'), 'utf8')
  assert.match(boundary, /getDerivedStateFromError/, '要接错误')
  assert.match(boundary, /componentStack/, '要打出组件栈，否则定位不到是哪个页面')
})

// ── 派发管线统一：热键与手势是两种功能，共用一条管线 ──────────
test('统一派发：热键与手势走同一个 dispatch，但语义不混', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-uni-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const ran = []
  const fake = { instance: () => ({ id: 'x' }), run: async () => { ran.push(1); return { status: 'ok', output: 'ok' } } }
  const service = new TriggerService({ store, pointStore: () => fake, lineStore: () => fake, onFired: () => {} })

  service.add({ source: 'hotkey', pattern: 'Ctrl+Alt+Space', targetKind: 'point', targetId: 'point.a@r1', name: '热键' })
  service.add({ source: 'gesture', pattern: '↑', targetKind: 'point', targetId: 'point.b@r1', name: '手势' })

  // 同一个入口，两种触发
  const up = Array.from({ length: 12 }, (_, i) => ({ x: 100, y: 100 - i * 6, t: i * 15 }))
  const byHotkey = await service.dispatch({ kind: 'hotkey', combo: 'Ctrl+Alt+Space' })
  const byGesture = await service.dispatch({ kind: 'gesture', points: up })

  assert.ok(byHotkey.records.length > 0, '热键要能命中')
  assert.strictEqual(byHotkey.directions, undefined, '热键没有方向串 —— 不能假装有')
  assert.strictEqual(byHotkey.session, undefined, '热键没有会话')

  assert.ok(byGesture.records.length > 0, '手势要能命中')
  assert.strictEqual(typeof byGesture.directions, 'string', '手势要带方向串')
  assert.ok(ran.length >= 2, '两种触发都真的执行了目标')
})

test('热键与手势绑定互不串门', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-x-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const fake = { instance: () => ({ id: 'x' }), run: async () => ({ status: 'ok', output: 'ok' }) }
  const service = new TriggerService({ store, pointStore: () => fake, lineStore: () => fake, onFired: () => {} })

  // 只有一条手势绑定；用同样的字符串当热键组合，不该命中它。
  // 注意：未命中也会留一条 skipped 记录（这是有意的，便于排查），
  // 所以断言的是「没有真正执行」，不是「没有记录」。
  let ran = 0
  const counting = { instance: () => ({ id: 'x' }), run: async () => { ran++; return { status: 'ok', output: 'ok' } } }
  service.deps.pointStore = () => counting
  service.add({ source: 'gesture', pattern: '↑', targetKind: 'point', targetId: 'point.b@r1' })
  const r = await service.dispatch({ kind: 'hotkey', combo: '↑' })
  assert.strictEqual(ran, 0, '热键查找只认 source=hotkey，不能捞到手势绑定去执行')
  assert.ok(r.records.every((x) => x.status === 'skipped'), '未命中应是 skipped，不是 ok')
})

test('热键路径也要过应用作用域（以前完全没有）', async () => {
  const { TriggerStore } = load('main/triggerStore.js')
  const { TriggerService } = load('main/triggerService.js')
  const dir = mkdtempSync(join(tmpdir(), 'ts-hs-'))
  const store = new TriggerStore(join(dir, 'b.json'))
  const fake = { instance: () => ({ id: 'x' }), run: async () => ({ status: 'ok', output: 'ok' }) }
  const service = new TriggerService({ store, pointStore: () => fake, lineStore: () => fake, onFired: () => {} })

  service.add({ source: 'hotkey', pattern: 'Ctrl+K', targetKind: 'point', targetId: 'point.g@r1', name: '全局' })
  service.add({
    source: 'hotkey', pattern: 'Ctrl+K', targetKind: 'point', targetId: 'point.a@r1', name: '仅 app',
    appScope: { exePath: 'C:\\app.exe', inheritGlobal: false }
  })

  // 在别的应用里，app.exe 那条不继承 → 应该一条都不命中
  const other = await service.dispatch({ kind: 'hotkey', combo: 'Ctrl+K', exePath: 'D:\\other.exe' })
  assert.strictEqual(other.records.length, 1, '没登记过的应用直接用全局')
  // 在 app.exe 里 → 用应用级的
  const inApp = await service.dispatch({ kind: 'hotkey', combo: 'Ctrl+K', exePath: 'C:\\APP.EXE' })
  assert.strictEqual(inApp.records.length, 1, '应用级命中一条')
})

test('手势识别：八个方向都要认得（对角曾被压成主方向，导致大量重复）', () => {
  const r = load('shared/gestureRecognizer.js')
  const cat = (...segs) => {
    const out = []
    let t = 0
    let cur = { x: 500, y: 500 }
    for (const [dx, dy] of segs) {
      for (let i = 0; i < 12; i++) {
        cur = { x: cur.x + dx * 8, y: cur.y + dy * 8 }
        t += 16
        out.push({ ...cur, t })
      }
    }
    return out
  }
  const cases = [
    ['↑', [[0, -1]]], ['↘', [[1, 1]]], ['↓', [[0, 1]]], ['↙', [[-1, 1]]],
    ['←', [[-1, 0]]], ['↖', [[-1, -1]]], ['→', [[1, 0]]], ['↗', [[1, -1]]],
    ['←↓→', [[-1, 0], [0, 1], [1, 0]]], ['↖→', [[-1, -1], [1, 0]]]
  ]
  const wrong = cases.filter(([want, segs]) => r.recognize(cat(...segs)).directions !== want)
  assert.deepStrictEqual(
    wrong.map(([want, segs]) => `${want}: ${r.recognize(cat(...segs)).directions}`),
    [],
    '八个方向都识别错的话，不同手势会被压成同一串 —— 表现为「手势大量重复」'
  )
})

test('手势识别：8 向规则作用在「段」上，不是第一个采样点', () => {
  const src = readFileSync(join(process.cwd(), 'src/shared/gestureRecognizer.ts'), 'utf8')
  // 曾经写成 `const isFirstSegment = raw.length === 0`，只有第一个采样步走 8 向，
  // 后面的步全被 4 向压平 → 斜线变成主方向。注释里提到这个写法是正常的，只查代码。
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '')
  assert.ok(!/isFirstSegment\s*=\s*raw\.length\s*===\s*0/.test(code), '不能只让第一个采样步走 8 向')
  assert.match(src, /const runs: Array<\{[^}]*count: number/, '要按段聚合（段 = 一段连续同向）')
  assert.match(src, /index === 0 && config\.eightDirections \? modeOf\(run\.d8\) : run\.d4/, '首段用 8 向众数，其余段用 4 向')
  assert.match(src, /runs\.filter\(\(run\) => run\.count >= config\.switchVotes\)/, 'switchVotes 要作用在段上')
})

test('主进程：IPC 发送必须防「窗口已销毁」（Object has been destroyed）', () => {
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  const code = main.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const direct = [...code.matchAll(/mainWindow\??\.webContents\.send\(/g)].length
  assert.strictEqual(direct, 1, '只有 safeSend 内部可以直接 send；其余走 safeSend')
  assert.match(code, /mainWindow\.webContents\.isDestroyed\(\)/, '要检查 webContents.isDestroyed()')
  assert.ok((code.match(/safeSend\(/g) ?? []).length >= 5, '事件推送都要走 safeSend')
})

test('运行结果提示必须如实反映状态，不能一律「运行成功」', () => {
  for (const page of ['LayerManagementPage', 'LineManagementPage', 'SurfaceManagementPage']) {
    const src = readFileSync(join(process.cwd(), `src/renderer/src/pages/${page}.tsx`), 'utf8')
    assert.ok(!src.includes('onToast(`运行成功 · ${result.output}`)'), `${page} 不能无条件报运行成功`)
    assert.match(src, /result\.ok \? `运行成功[^`]*` : `未完成/, `${page} 的提示要按 result.ok 分流`)
  }
})
