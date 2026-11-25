import { elapsed, type Capability } from '../../capabilities/_shared'

export const classId = 'field.diagnose'
export const summary = '故障诊断：按错误特征匹配已知原因与修法，纯规则不调用模型'

/** 这个类有自己的逻辑，不是只调通用实现 —— 清单靠它区分「真实实现」和「骨架」 */
export const specialized = true

/**
 * A1 · 诊断（纯规则）
 *
 * 输入一段错误文本（或一条失败的运行记录），输出「最可能的原因 + 具体修法 + 置信度」。
 * 判断不了就说判断不了 —— 硬猜一个原因比不诊断更糟，因为人会照着错的修。
 */

export interface Diagnosis {
  /** 命中的特征 */
  matched: string
  cause: string
  fix: string
  confidence: number
  /** 还有别的可能 */
  alternatives?: Array<{ cause: string; fix: string }>
}

interface Signature {
  /** 特征正则 */
  match: RegExp
  cause: string
  fix: string
  confidence: number
}

const SIGNATURES: Signature[] = [
  {
    match: /EACCES|EPERM|denied|拒绝访问|permission/i,
    cause: '权限不足：目标文件或注册表项当前账户不可写',
    fix: '用同样的权限运行目标程序，或把目标改到用户目录下',
    confidence: 0.95
  },
  {
    match: /ENOENT|no such file|找不到|not found|不存在/i,
    cause: '路径或目标不存在（拼写错、工作目录不同、文件已被移走）',
    fix: '打印实际解析出的绝对路径再核对；相对路径一律先 resolve 成绝对路径',
    confidence: 0.9
  },
  {
    match: /timeout|timed out|超时|ETIMEDOUT/i,
    cause: '目标没在预期时间内就绪（进程还没起、选择器失效、或真的慢）',
    fix: '先确认目标进程存在，再把「固定等待」改成「轮询到出现为止」',
    confidence: 0.8
  },
  {
    match: /UIA|automation|selector|元素|控件/i,
    cause: 'UIA 选择器匹配不到控件（界面结构变了，或控件在另一个窗口/层级）',
    fix: '重新枚举一遍控件树拿到真实 Name/AutomationId，别用坐标兜底',
    confidence: 0.85
  },
  {
    match: /ECONNREFUSED|ENOTFOUND|ECONNRESET|network|网络|无法连接/i,
    cause: '网络层不可达（DNS、代理、或对端没监听）',
    fix: '先 ping 通域名，再检查代理设置；VPN 场景要确认路由是否劫持了内网',
    confidence: 0.85
  },
  {
    match: /VPN|vpn/i,
    cause: 'VPN 状态与目标网络要求不符',
    fix: '先检测当前 VPN 状态再决定连/断，不要无条件连接',
    confidence: 0.7
  },
  {
    match: /OCR|recognize|识别|confidence|置信/i,
    cause: '识别质量不足（分辨率低、倾斜、对比度差，或模式选错）',
    fix: '先放大并灰度化再识别；公式/表格要切换到对应模式',
    confidence: 0.8
  },
  {
    match: /JSON|parse|Unexpected token|语法/i,
    cause: '输入不是合法 JSON（多余逗号、单引号、或字段被截断）',
    fix: '把原始字符串打出来看真实内容；别用字符串拼接构造 JSON',
    confidence: 0.9
  },
  {
    match: /undefined|null|cannot read|is not a function/i,
    cause: '取到了空值或类型不对（字段名拼错、或上游没返回）',
    fix: '在上游出口加断言，确认字段真的存在；不要在下游到处兜底',
    confidence: 0.75
  }
]

/** 纯函数：错误文本 → 诊断 */
export function diagnoseText(text: string): Diagnosis | null {
  const raw = String(text ?? '')
  if (!raw.trim()) return null
  const hits = SIGNATURES.filter((sig) => sig.match.test(raw))
  if (!hits.length) return null
  const [best, ...rest] = hits.sort((a, b) => b.confidence - a.confidence)
  return {
    matched: (best.match.exec(raw) ?? [''])[0],
    cause: best.cause,
    fix: best.fix,
    confidence: best.confidence,
    ...(rest.length ? { alternatives: rest.slice(0, 2).map((s) => ({ cause: s.cause, fix: s.fix })) } : {})
  }
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'flow-failure').toLowerCase()
  const text = String(ctx.input ?? ctx.params.error ?? ctx.params.input ?? '')

  if (!text.trim()) {
    return {
      status: 'warn',
      output: `需要错误文本才能诊断（mode=${mode}）：用 ctx.input 或 params.error 传入`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'diagnose', mode, problem: 'no-input' }
    }
  }

  const diagnosis = diagnoseText(text)
  if (!diagnosis) {
    // 不硬猜。给不出原因时，最有用的是告诉人「这段文本没有已知特征」
    return {
      status: 'warn',
      output: `没能识别这段错误特征（mode=${mode}）：${text.slice(0, 80)}`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'diagnose', mode, diagnosed: false, input: text.slice(0, 200) }
    }
  }

  return {
    status: 'ok',
    output: `诊断：${diagnosis.cause}。修法：${diagnosis.fix}`,
    value: JSON.stringify(diagnosis),
    elapsedMs: elapsed(startedAt),
    evidence: { kind: 'diagnose', mode, diagnosed: true, ...diagnosis }
  }
}
