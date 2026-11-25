import { defineClassImpl } from '../../../shared/classImpl'
import {
  createSessionHost,
  type CommandSession,
  type SessionEvent,
  type SessionHost
} from '../../../shared/commandSession'
import { formatGesture, parseGesture } from '../../../shared/gestureNotation'
import type { GestureTriple } from '../../triggerStore'

/**
 * line.gesture_dispatch —— 手势派发线
 *
 * 把「方向串 → 找绑定 → 执行 → 需要的话开一个命令会话」串成一条线。
 *
 * 为什么它是线层：它是有先后依赖的编排，不是原子操作。
 * 单次调用表达不了「触发后继续接滚轮」这一步。
 *
 * 为什么返回里带 session：「DR + 音量」这类命令触发后不结束，
 * 继续接管滚轮。返回 session 让主进程接到鼠标钩子上；null 表示一次性命令。
 * 这就是先定 commandSession 模型的原因 —— 返回类型必须现在就对。
 */

export const classId = 'line.gesture_dispatch'
export const summary = '手势派发：方向串 → 匹配绑定 → 执行 → 必要时开命令会话'
export const specialized = true

export interface DispatchBinding {
  id: string
  gesture?: GestureTriple
  executeOnModifier?: boolean
  appScope?: { exePath: string; inheritGlobal: boolean }
  enabled: boolean
  targetKind: 'point' | 'line'
  targetId: string
  name?: string
}

export interface DispatchContext {
  directions: string
  exePath?: string
  modifier?: string
}

export interface DispatchOutcome {
  status: 'ok' | 'warn'
  output: string
  matched: DispatchBinding[]
  session: CommandSession | null
  reason?: 'no-directions' | 'no-binding' | 'ambiguous'
  elapsedMs: number
}

/**
 * 匹配绑定（纯函数）。
 *   1. 应用级（exePath 相同）
 *   2. 应用级没命中且 inheritGlobal 为真 → 回落全局
 *   3. 没有应用级记录 → 直接用全局
 */
export function matchBindings(
  bindings: DispatchBinding[],
  context: DispatchContext
): { matched: DispatchBinding[]; reason?: DispatchOutcome['reason'] } {
  const directions = String(context.directions ?? '').trim()
  if (!directions) return { matched: [], reason: 'no-directions' }

  const enabled = bindings.filter((b) => b.enabled && b.gesture)
  if (!enabled.length) return { matched: [], reason: 'no-binding' }

  // 方向串 + modifier 都要对上 —— 这就是三元组存在的理由
  const candidates = enabled.filter((b) => {
    const g = b.gesture!
    if (g.dirs !== directions) return false
    return (g.modifier ?? undefined) === (context.modifier ?? undefined)
  })
  if (!candidates.length) return { matched: [], reason: 'no-binding' }

  const globalOnly = candidates.filter((b) => !b.appScope)
  if (!context.exePath) return globalOnly.length ? { matched: globalOnly } : { matched: [], reason: 'no-binding' }

  const target = context.exePath.toLowerCase()
  const atApp = candidates.filter((b) => b.appScope && b.appScope.exePath.toLowerCase() === target)
  if (atApp.length) return { matched: atApp }

  // 回落规则照 WGestures AbstractGestureIntentFinder.Find：
  //   if (exeApp != null) { found = exeApp.Find(g); if (!found && exeApp.InheritGlobalGestures) found = global.Find(g) }
  //   else { found = global.Find(g) }
  // 关键：InheritGlobalGestures 是「当前应用自己那条记录」的属性。
  const currentAppRecord = bindings.find((b) => b.appScope && b.appScope.exePath.toLowerCase() === target)
  if (!currentAppRecord) return globalOnly.length ? { matched: globalOnly } : { matched: [], reason: 'no-binding' }
  if (!currentAppRecord.appScope!.inheritGlobal) return { matched: [], reason: 'no-binding' }
  return globalOnly.length ? { matched: globalOnly } : { matched: [], reason: 'no-binding' }
}

export function createDispatchSessionHost(): SessionHost {
  return createSessionHost()
}

export interface GestureDispatchInput {
  bindings: DispatchBinding[]
  context: DispatchContext
  execute: (binding: DispatchBinding) => Promise<{ ok: boolean; output: string }>
  needsSession: (binding: DispatchBinding) => { observes: SessionEvent[]; onEvent: (event: SessionEvent) => boolean } | null
  host: SessionHost
}

export async function dispatchGesture(input: GestureDispatchInput): Promise<DispatchOutcome> {
  const startedAt = Date.now()
  const { matched, reason } = matchBindings(input.bindings, input.context)

  if (!matched.length) {
    return {
      status: 'warn',
      output: reason === 'no-directions' ? '没有方向串' : `方向串 ${input.context.directions} 没有匹配的绑定`,
      matched: [],
      session: null,
      reason,
      elapsedMs: Date.now() - startedAt
    }
  }

  const results = []
  for (const binding of matched) results.push({ binding, result: await input.execute(binding) })
  const failed = results.filter((r) => !r.result.ok)

  // 会话只在单个目标时开 —— 多个目标同时接管滚轮没有意义
  let session: CommandSession | null = null
  if (matched.length === 1) {
    const spec = input.needsSession(matched[0])
    if (spec) {
      const started = input.host.start({
        bindingId: matched[0].id,
        observes: spec.observes,
        onEvent: spec.onEvent
      })
      if (!started.ok) {
        return {
          status: 'warn',
          output: `已有会话在接管滚轮（${started.activeBindingId}），这次不覆盖`,
          matched,
          session: input.host.active(),
          reason: 'ambiguous',
          elapsedMs: Date.now() - startedAt
        }
      }
      session = started.session
    }
  }

  const names = matched.map((b) => b.name ?? b.id).join('、')
  return {
    status: failed.length ? 'warn' : 'ok',
    output: failed.length
      ? `命中 ${names}，${failed.length} 个失败：${failed[0].result.output}`
      : `命中 ${names}${session ? '（已开会话，滚轮可继续调）' : ''}`,
    matched,
    session,
    elapsedMs: Date.now() - startedAt
  }
}

export function describeBinding(binding: DispatchBinding): string {
  return binding.gesture ? formatGesture(binding.gesture) : binding.id
}

export function isValidGesture(text: string): boolean {
  return parseGesture(text) !== null
}

export const run = defineClassImpl<GestureDispatchInput, DispatchOutcome>({
  classId,
  summary,
  run: (input) => dispatchGesture(input)
}).run
