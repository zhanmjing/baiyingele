import {
  parseFormSpec,
  summarizeFormValues,
  validateFormValues,
  type FormAnswer,
  type FormSpec
} from '../../shared/formSpec'
import { elapsed, type Capability } from './_shared'

export const id = 'ui.form'
export const summary = '向界面要用户输入并等待答复；取消/超时都返回明确状态，绝不当成成功'

export interface FormRequest {
  requestId: string
  spec: FormSpec
  createdAt: number
  timeoutMs: number
}

interface Pending {
  request: FormRequest
  settle: (answer: FormAnswer) => void
  timer: ReturnType<typeof setTimeout>
}

/** 把请求送到界面的通道；由主进程注入（能力模块不直接摸 BrowserWindow） */
let sink: ((request: FormRequest) => void) | null = null
let pending: Pending | null = null
let counter = 0

export function setFormSink(next: ((request: FormRequest) => void) | null): void {
  sink = next
}

/** 当前挂起的请求 id（调试与测试用） */
export function pendingFormId(): string | null {
  return pending?.request.requestId ?? null
}

function finish(answer: FormAnswer): void {
  if (!pending) return
  const current = pending
  pending = null
  clearTimeout(current.timer)
  current.settle(answer)
}

/**
 * 界面答复入口。
 * 会做和渲染层同一套校验 —— 不信任调用方传进来的值。
 */
export function resolveForm(requestId: string, answer: FormAnswer): { ok: boolean; message: string } {
  if (!pending || pending.request.requestId !== requestId) {
    return { ok: false, message: `没有这个请求：${requestId}` }
  }
  if (answer.kind === 'submitted') {
    const errors = validateFormValues(pending.request.spec, answer.values ?? {})
    if (errors.length) return { ok: false, message: errors.join('；') }
    finish({ kind: 'submitted', values: answer.values ?? {} })
    return { ok: true, message: '已提交' }
  }
  finish({ kind: answer.kind, reason: answer.reason })
  return { ok: true, message: answer.kind === 'cancelled' ? '已取消' : answer.kind }
}

/**
 * 发起一次表单请求并等待。同一时间只允许一个：
 * 新请求来了先把旧的判为 superseded，避免弹窗排队卡死整条流程。
 */
export function requestForm(spec: FormSpec, timeoutMs = 120000): Promise<FormAnswer> {
  if (pending) finish({ kind: 'cancelled', reason: 'superseded' })

  const request: FormRequest = {
    requestId: `form-${Date.now()}-${++counter}`,
    spec,
    createdAt: Date.now(),
    timeoutMs
  }

  if (!sink) {
    return Promise.resolve({ kind: 'unavailable', reason: '没有可用的界面（sink 未注入）' })
  }

  return new Promise<FormAnswer>((resolve) => {
    const timer = setTimeout(() => {
      finish({ kind: 'timeout', reason: `超过 ${timeoutMs}ms 没有答复` })
    }, Math.max(1000, timeoutMs))
    // 让计时器不要拖住进程退出
    if (typeof timer === 'object' && timer && 'unref' in timer) (timer as { unref: () => void }).unref()

    pending = { request, settle: resolve, timer }
    try {
      sink?.(request)
    } catch (error) {
      finish({ kind: 'unavailable', reason: error instanceof Error ? error.message : String(error) })
    }
  })
}

/** L0 · 询问用户（人工确认 / 选择目标） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  const title = String(ctx.params.title ?? '').trim()
  const fieldsRaw = String(ctx.params.fields ?? '').trim()
  const schemaRaw = String(ctx.params.schema ?? '').trim()
  const timeoutRaw = Number(ctx.params.timeoutMs ?? 120000)
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.max(1000, Math.min(600000, Math.trunc(timeoutRaw))) : 120000

  const spec = parseFormSpec(title, fieldsRaw, schemaRaw)
  if (!spec) {
    return {
      status: 'warn',
      output: schemaRaw
        ? 'schema 解析失败：既不是合法 JSON，也没有 properties 字段'
        : `表单没有字段（fields=${fieldsRaw || '(空)'}），拒绝弹出空表单`,
      elapsedMs: elapsed(startedAt)
    }
  }

  const answer = await requestForm(spec, timeoutMs)

  if (answer.kind === 'submitted') {
    const values = answer.values ?? {}
    const errors = validateFormValues(spec, values)
    if (errors.length) {
      return {
        status: 'warn',
        output: `表单校验未通过：${errors.join('；')}`,
        evidence: { backend: 'renderer', kind: answer.kind, errors },
        elapsedMs: elapsed(startedAt)
      }
    }
    const summary = summarizeFormValues(spec, values)
    return {
      status: 'ok',
      output: `表单「${spec.title}」已提交${summary ? `：${summary}` : ''}`,
      value: JSON.stringify(values),
      evidence: { backend: 'renderer', kind: 'submitted', title: spec.title, fields: spec.fields.length, values },
      elapsedMs: elapsed(startedAt)
    }
  }

  if (answer.kind === 'cancelled') {
    return {
      status: 'warn',
      output: `表单「${spec.title}」已取消${answer.reason === 'superseded' ? '（被新的表单请求顶替）' : ''}`,
      evidence: { backend: 'renderer', kind: 'cancelled', reason: answer.reason, title: spec.title },
      elapsedMs: elapsed(startedAt)
    }
  }

  if (answer.kind === 'timeout') {
    return {
      status: 'warn',
      output: `表单「${spec.title}」超时未答复（${timeoutMs}ms）`,
      evidence: { backend: 'renderer', kind: 'timeout', timeoutMs, title: spec.title },
      elapsedMs: elapsed(startedAt)
    }
  }

  return {
    status: 'warn',
    output: `表单「${spec.title}」无法显示：${answer.reason ?? '没有可用界面'}`,
    evidence: { backend: 'renderer', kind: answer.kind, reason: answer.reason },
    elapsedMs: elapsed(startedAt)
  }
}
