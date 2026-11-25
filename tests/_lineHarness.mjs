/**
 * 线层测试夹具。
 *
 * 从 scripts/smoke-flow.cjs 第 135–216 行提取。提取的理由：
 * 抽 gate 注册表需要 if / if-status / foreach 三条路径的回归测试，
 * 而重造这套夹具（真实 LayerStore + 脚本化点 store + 线 store）两次都没调对。
 * 复制已验证过的代码比重新发明快，也比继续猜安全。
 *
 * 用法：
 *   const fx = makeLineFixture({ 'point.http_request': 'warn' })
 *   const { outcome, ran } = await fx.runFlow(profile, 'input')
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load, catalogs, lineProfiles } from './_harness.mjs'

const { LayerStore } = load('main/layerStore.js')
const { createLineRunner } = load('main/lineRuntime.js')

export { lineProfiles, catalogs }

/** 取某点类的第一个真实实例 id —— 运行器需要 pointInstance 才能解析绑定 */
export const instanceOf = (classId) => {
  const cls = catalogs.point.find((c) => c.id === classId)
  if (!cls) throw new Error(`目录里没有 ${classId}`)
  return cls.instances[0].id
}

/** 点节点的简写：pointClass + 真实 pointInstance */
export const pointNode = (id, classId, extra = {}) => ({
  id,
  kind: 'point',
  label: id,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  pointClass: classId,
  pointInstance: instanceOf(classId),
  ...extra
})

export const gateNode = (id, gate) => ({ id, kind: 'gate', label: id, gate, x: 0, y: 0, w: 1, h: 1 })
export const edge = (from, to, label) => ({ from, to, ...(label ? { label } : {}) })

/**
 * 造一套夹具。
 *
 * @param statusByClass 按点类预设状态，例如 { 'point.http_request': 'warn' }
 */
export function makeLineFixture(statusByClass = {}) {
  const workdir = mkdtempSync(join(tmpdir(), 'line-fx-'))
  const ran = []

  // 脚本化点 store：记录跑过哪些实例，按 classId 返回预设状态
  const pointStore = new LayerStore(
    join(workdir, 'point-state.json'),
    { key: 'point', classLabel: 'PointClass', classes: catalogs.point, outputs: {} },
    async (ctx) => {
      ran.push({ id: ctx.instance.id, classId: ctx.instance.classId })
      const status = statusByClass[ctx.instance.classId] ?? 'ok'
      return { status, output: `${ctx.instance.classId}:${status}`, elapsedMs: 1 }
    }
  )

  // 线 store 必须是真实 LayerStore —— 子流程会走它
  const lineStore = new LayerStore(
    join(workdir, 'line-state.json'),
    { key: 'line', classLabel: 'LineClass', classes: catalogs.line, outputs: {} },
    createLineRunner({ profiles: lineProfiles, pointStore: () => pointStore })
  )

  const runner = createLineRunner({
    profiles: lineProfiles,
    pointStore: () => pointStore,
    lineStore: () => lineStore
  })

  /** 跑一个临时图谱（不在 lineProfiles 里也能跑：按 classId 注入） */
  async function runFlow(profile, input = '') {
    const custom = { ...lineProfiles, [profile.classId]: profile }
    const customRunner = createLineRunner({
      profiles: custom,
      pointStore: () => pointStore,
      lineStore: () => lineStore
    })
    const result = await customRunner({
      def: { key: 'line', classLabel: 'LineClass', classes: [], outputs: {} },
      instance: { id: `inst.${profile.classId}`, classId: profile.classId, description: '', params: {} },
      input,
      args: {},
      params: {},
      findInstance: () => undefined
    })
    return { result, ran: ran.map((r) => r.classId) }
  }

  return { workdir, pointStore, lineStore, runner, runFlow, ran }
}
