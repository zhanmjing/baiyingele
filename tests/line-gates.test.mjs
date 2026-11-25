/**
 * 线层 gate 分派的回归测试。
 *
 * 存在的理由：准备把 if / if-status / foreach 的分派从三处硬判断抽成注册表。
 * 抽之前必须有这三条路径的回归测试 —— 本轮会话已经误伤过一次 foreach
 * （加了环保护，把合法的循环当带环图拒了）。
 *
 * 这三个用例在抽取前后都必须通过。
 */
import test from 'node:test'
import assert from 'node:assert'
import { makeLineFixture, pointNode, gateNode, edge } from './_lineHarness.mjs'

// ── if：按值分支，两条边只跑一条 ──────────────────────────────
test('gate:if —— true 走 true 边，false 走 false 边，另一边不执行', async () => {
  const profile = {
    classId: 'test.if',
    nodes: [gateNode('g', 'if'), pointNode('yes', 'point.notify_toast'), pointNode('no', 'point.clipboard_get')],
    edges: [edge('g', 'yes', 'true'), edge('g', 'no', 'false')]
  }

  const t = makeLineFixture()
  const trueRun = await t.runFlow(profile, 'true')
  assert.deepStrictEqual(trueRun.ran, ['point.notify_toast'], 'true 只该跑 yes')
  assert.strictEqual(trueRun.result.status, 'ok')

  const f = makeLineFixture()
  const falseRun = await f.runFlow(profile, 'false')
  assert.deepStrictEqual(falseRun.ran, ['point.clipboard_get'], 'false 只该跑 no')
  assert.strictEqual(falseRun.result.status, 'ok')

  // 判断不了必须停下，不能替用户猜
  const bad = makeLineFixture()
  const badRun = await bad.runFlow(profile, 'maybe-not-a-bool')
  assert.strictEqual(badRun.result.status, 'warn', 'if 判断不了必须 warn')
  assert.ok(badRun.result.evidence.halted, 'if 判断不了必须 halted')
  assert.deepStrictEqual(badRun.ran, [], '判断不了时一条分支都不该跑')
})

// ── if-status：按上游状态分支 ─────────────────────────────────
test('gate:if-status —— 上游 ok 走 ok 边，上游 warn 走 warn 边', async () => {
  const profile = {
    classId: 'test.if-status',
    nodes: [
      pointNode('first', 'point.http_request'),
      gateNode('g', 'if-status'),
      pointNode('okb', 'point.notify_toast'),
      pointNode('badb', 'point.clipboard_get')
    ],
    edges: [edge('first', 'g'), edge('g', 'okb', 'ok'), edge('g', 'badb', 'warn')]
  }

  const ok = makeLineFixture()
  const okRun = await ok.runFlow(profile, '')
  assert.deepStrictEqual(okRun.ran, ['point.http_request', 'point.notify_toast'], '上游 ok → 只跑 ok 边')

  const warn = makeLineFixture({ 'point.http_request': 'warn' })
  const warnRun = await warn.runFlow(profile, '')
  assert.deepStrictEqual(warnRun.ran, ['point.http_request', 'point.clipboard_get'], '上游 warn → 只跑 warn 边')
  assert.strictEqual(warnRun.result.status, 'warn', '中途 warn，整条流程就是 warn')
})

// ── foreach：按列表逐项跑循环体 ───────────────────────────────
test('gate:foreach —— 跑 N 项就执行 N 次循环体，然后跑一次 done', async () => {
  const profile = {
    classId: 'test.foreach',
    nodes: [gateNode('loop', 'foreach'), pointNode('body', 'point.clipboard_write'), pointNode('done', 'point.notify_toast')],
    edges: [edge('loop', 'body', 'each'), edge('body', 'loop'), edge('loop', 'done', 'done')]
  }

  const fx = makeLineFixture()
  const { result, ran } = await fx.runFlow(profile, JSON.stringify(['a', 'b', 'c']))
  assert.strictEqual(result.status, 'ok')
  assert.strictEqual(ran.filter((id) => id === 'point.clipboard_write').length, 3, '循环体该跑 3 次')
  assert.strictEqual(ran.filter((id) => id === 'point.notify_toast').length, 1, 'done 该跑 1 次')
  assert.match(result.output, /遍历 3\/3 项/)

  // 输入不是列表 → 停下，不猜
  const bad = makeLineFixture()
  const badRun = await bad.runFlow(profile, 'not a list at all')
  assert.strictEqual(badRun.result.status, 'warn', 'foreach 输入不是列表必须 warn')
  assert.deepStrictEqual(badRun.ran, [], '输入不合法时一项都不该跑')
})

// ── 未实现的 gate：明确停下 ───────────────────────────────────
test('未知 gate —— 明确停下并报「尚未实现」，不静默跳过', async () => {
  const profile = {
    classId: 'test.unknown-gate',
    nodes: [gateNode('g', 'while'), pointNode('after', 'point.notify_toast')],
    edges: [edge('g', 'after')]
  }
  const fx = makeLineFixture()
  const { result, ran } = await fx.runFlow(profile, '')
  assert.strictEqual(result.status, 'warn')
  assert.match(result.output, /尚未实现/)
  assert.deepStrictEqual(ran, [], '未知 gate 后面的节点不该跑')
})
