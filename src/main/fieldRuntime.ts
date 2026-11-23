/**
 * 场层落地的执行侧：把 FieldLanding 真正写到目标位置上，并为 A2 记录撤销令牌。
 *
 * 目前只实现了 { layer: 'point', target: 'param' }（改点实例的一个参数）；
 * 其余落点先明确返回「暂不支持」，不假装成功。
 */
import type { LandingDecision } from '../shared/fieldLanding'
import type { FieldLanding } from '../shared/fieldLanding'
import type { LayerStore } from './layerStore'
import type { UndoJournal } from './undoJournal'

export interface LandingResult {
  applied: boolean
  note: string
  undoToken?: string
}

export async function applyLanding(params: {
  decision: LandingDecision
  landing: FieldLanding
  pointStore: LayerStore
  journal: UndoJournal
}): Promise<LandingResult> {
  const { decision, landing, pointStore, journal } = params

  if (decision.action !== 'apply') {
    return { applied: false, note: `未落地：${decision.reason}` }
  }
  if (landing.layer !== 'point' || landing.target !== 'param') {
    return { applied: false, note: `未落地：暂不支持 ${landing.layer}.${landing.target}` }
  }

  const instance = pointStore.instance(landing.instanceId)
  if (!instance) {
    return { applied: false, note: `未落地：目标实例不存在 ${landing.instanceId}` }
  }
  if (!landing.param) {
    return { applied: false, note: '未落地：没有指定参数名' }
  }

  const previous = instance.params?.[landing.param]
  const next = landing.value ?? ''
  const updated = pointStore.update(landing.instanceId, { params: { [landing.param]: next } })
  const undoToken = journal.record({
    instanceId: landing.instanceId,
    param: landing.param,
    previous: previous ?? null,
    next,
    classId: updated.classId
  })

  return {
    applied: true,
    note: `已写入 ${landing.instanceId}.${landing.param}（rev ${updated.rev}）`,
    undoToken
  }
}
