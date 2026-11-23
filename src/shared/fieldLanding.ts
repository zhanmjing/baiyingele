/**
 * 场层的「落点」。
 *
 * 设计依据 design/field/FIELD-LAYER-CLASSES.md：
 *   - FieldLanding 声明这次建议要落到点/线/面/体的哪个位置
 *   - 没有 landing 的 FieldClass 不允许发布（由 validate 强制）
 *   - A0 只建议、A1 出草稿、A2 自动应用但必须可撤销、A3 禁止
 */

export type FieldLandingLayer = 'point' | 'line' | 'surface' | 'body'

export type FieldLanding =
  | { layer: 'point'; target: 'param' | 'default' | 'visibility'; instanceId: string; param?: string; value?: string }
  | { layer: 'line'; target: 'draft' | 'patch' | 'slotBinding' | 'errorPolicy'; ref?: string; value?: string }
  | { layer: 'surface'; target: 'order' | 'layout' | 'filter' | 'emptyState'; ref?: string; value?: string }
  | { layer: 'body'; target: 'manifest' | 'composition' | 'settings' | 'migration'; ref?: string; value?: string }

export type Autonomy = 'A0' | 'A1' | 'A2' | 'A3'

export type LandingDecision =
  | { action: 'none'; reason: string }
  | { action: 'draft'; reason: string }
  | { action: 'apply'; reason: string }
  | { action: 'refuse'; reason: string }

/** 纯函数：自主度 + 落点 → 该不该真落地 */
export function decideLanding(autonomy: string, landing: FieldLanding | undefined): LandingDecision {
  if (!landing) return { action: 'none', reason: '本次运行没有落点，只产出结果' }
  switch (autonomy) {
    case 'A0':
      return { action: 'draft', reason: 'A0 只给建议，不自动执行' }
    case 'A1':
      return { action: 'draft', reason: 'A1 只出草稿，等人工确认' }
    case 'A2':
      return { action: 'apply', reason: 'A2 自动应用，必须可撤销' }
    case 'A3':
      return { action: 'refuse', reason: 'A3 禁止自主执行' }
    default:
      return { action: 'refuse', reason: `未知自主度 ${autonomy}，按最保守处理` }
  }
}
