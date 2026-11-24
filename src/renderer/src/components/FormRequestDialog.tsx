import { useEffect, useState } from 'react'
import { validateFormValues, type FormSpec } from '../../../shared/formSpec'

/** 主进程通过 ui:form:request 推过来的请求 */
interface FormRequestPayload {
  requestId: string
  spec: FormSpec
  createdAt: number
  timeoutMs: number
}

/**
 * `point.ui_form` 能力的界面端：收到请求就弹一个模态，用户填完或取消后回传。
 *
 * 关键点：
 *   - 取消/超时在能力侧会被记成 warn，**不会**假装成功
 *   - 校验用 shared/formSpec 里的同一份规则，主进程收到后还会再校验一次
 *   - 显示剩余秒数，让用户知道超时会自动失效
 */
export function FormRequestDialog() {
  const [request, setRequest] = useState<FormRequestPayload | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [remaining, setRemaining] = useState(0)

  // 订阅请求
  useEffect(() => {
    const unsubscribe = window.baiying?.onFormRequest?.((raw) => {
      const payload = raw as FormRequestPayload
      if (!payload?.spec?.fields) return
      const initial: Record<string, string> = {}
      for (const field of payload.spec.fields) {
        initial[field.name] = field.type === 'boolean' ? 'false' : ''
      }
      setValues(initial)
      setErrors([])
      setSending(false)
      setRequest(payload)
    })
    return () => unsubscribe?.()
  }, [])

  // 倒计时
  useEffect(() => {
    if (!request) return
    const tick = (): void => {
      setRemaining(Math.max(0, Math.round((request.createdAt + request.timeoutMs - Date.now()) / 1000)))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [request])

  async function submit(): Promise<void> {
    if (!request) return
    const found = validateFormValues(request.spec, values)
    if (found.length) {
      setErrors(found)
      return
    }
    setSending(true)
    const result = await window.baiying.resolveForm(request.requestId, { kind: 'submitted', values })
    if (!result?.ok) {
      setErrors([result?.message ?? '提交失败'])
      setSending(false)
      return
    }
    setRequest(null)
  }

  async function cancel(): Promise<void> {
    if (!request) return
    await window.baiying.resolveForm(request.requestId, { kind: 'cancelled' })
    setRequest(null)
  }

  // Esc = 取消（和点「取消」同一条路径）
  useEffect(() => {
    if (!request) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [request])

  if (!request) return null

  return (
    <div className="form-overlay">
      <div className="form-dialog" role="dialog" aria-modal="true">
        <div className="form-head">
          <div>
            <div className="panel-eyebrow">UI.FORM · 需要你的输入</div>
            <h2>{request.spec.title}</h2>
            {request.spec.description ? <p>{request.spec.description}</p> : null}
          </div>
          <span className={`form-timer ${remaining <= 10 ? 'urgent' : ''}`}>{remaining}s</span>
        </div>

        <div className="form-body">
          {request.spec.fields.map((field, index) => (
            <label className="form-field" key={field.name}>
              <span>
                {field.label}
                {field.required ? <em> *</em> : null}
              </span>
              {field.type === 'boolean' || field.type === 'select' ? (
                <select
                  value={values[field.name] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                >
                  {field.type === 'boolean' ? (
                    <>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </>
                  ) : (
                    (field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  autoFocus={index === 0}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.name] ?? ''}
                  placeholder={field.placeholder ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void submit()
                    }
                  }}
                />
              )}
            </label>
          ))}
        </div>

        {errors.length > 0 ? (
          <div className="form-errors">
            {errors.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </div>
        ) : null}

        <div className="form-actions">
          <span className="form-hint">Esc 取消 · Enter 提交</span>
          <button className="btn ghost" onClick={() => void cancel()} disabled={sending}>
            取消
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={sending}>
            {sending ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
