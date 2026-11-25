import { elapsed, type Capability } from '../../capabilities/_shared'
import fullCatalogs from '../../../shared/generatedFullCatalogs.json'

export const classId = 'field.route'
export const summary = '路由决策：本地/云端/回退的模型选择、能力/流程/体的工具选择、文件与触发器到体实例'

/**
 * A2 · 路由（确定性规则，不调用模型）
 *
 * 三个实例各管一个维度：
 *   model  本地 / 云端 / 回退 —— 按输入长度、是否需要推理、可用端点决定
 *   tool   point / flow / body —— 按目录里真实存在的东西决定，不猜
 *   body   文件/触发器 → 具体体实例 —— 按扩展名与目录匹配
 *
 * **判断不了就明说判断不了**，不硬塞一个默认值。
 * 路由错了比路由失败更糟：失败会被发现，错的路由会一路错到底。
 */

export type RouteTargetKind = 'local' | 'cloud' | 'fallback' | 'point' | 'flow' | 'body'

export interface RouteDecision {
  /** 选中的目标 id 或端点名 */
  target: string
  kind: RouteTargetKind
  /** 为什么选它 —— 必须能解释，否则就是黑箱 */
  reason: string
  /** 0..1；确定性规则命中得高，模糊匹配得低 */
  confidence: number
  /** 首选不可用时的退路 */
  fallback?: string
}

/** 本地模型能吃多长的输入（字符）。超过就走云端。 */
const LOCAL_MAX_CHARS = 2000

/** 需要推理的迹象词。命中任一就倾向云端。 */
const REASONING_HINTS = ['分析', '推理', '为什么', '比较', '设计', '重构', '解释', '权衡', '方案', 'review']

function looksLikeReasoning(text: string): boolean {
  const lower = text.toLowerCase()
  return REASONING_HINTS.some((hint) => lower.includes(hint))
}

/** ── model：本地 / 云端 / 回退 ─────────────────────────────── */
export function routeModel(input: string, params: Record<string, string>): RouteDecision | null {
  const local = String(params.localEndpoint ?? '').trim()
  const cloud = String(params.cloudEndpoint ?? '').trim()
  const fallback = String(params.fallbackEndpoint ?? '').trim()
  const text = String(input ?? '')
  const maxChars = Number(params.localMaxChars ?? LOCAL_MAX_CHARS) || LOCAL_MAX_CHARS
  const offline = String(params.offline ?? '').toLowerCase() === 'true'

  if (offline) {
    if (fallback) return { target: fallback, kind: 'fallback', reason: '离线模式，只能用回退端点', confidence: 0.9 }
    if (local) return { target: local, kind: 'local', reason: '离线模式，用本地端点', confidence: 0.9 }
    return null
  }
  if (!local && !cloud && !fallback) return null

  const tooLong = text.length > maxChars
  const reasoning = looksLikeReasoning(text)

  if (tooLong && cloud) {
    return {
      target: cloud, kind: 'cloud',
      reason: `输入 ${text.length} 字符超过本地上限 ${maxChars}`,
      confidence: 0.85,
      ...(local ? { fallback: local } : {})
    }
  }
  if (reasoning && cloud) {
    return {
      target: cloud, kind: 'cloud',
      reason: '输入包含需要推理的意图，本地模型不保证质量',
      confidence: 0.7,
      ...(local ? { fallback: local } : {})
    }
  }
  if (local) {
    return {
      target: local, kind: 'local',
      reason: `输入 ${text.length} 字符在本地能力内，且没有推理迹象`,
      confidence: 0.8,
      ...(cloud ? { fallback: cloud } : {})
    }
  }
  // 只有云端可用
  return { target: cloud, kind: 'cloud', reason: '只有云端端点可用', confidence: 0.6 }
}

/** ── tool：point / flow / body ──────────────────────────────── */
export interface CatalogLookup {
  hasClass: (layer: string, name: string) => boolean
  /** 该类是否被任何流程图引用过 */
  isUsedInFlows: (classId: string) => boolean
}

/**
 * 按真实目录决定走哪一层。
 *
 * 顺序刻意是 body → flow → point：
 * 体是产品级封装，能覆盖用户想做的事就不要往下拆；
 * 拆到点层意味着用户要自己编排，体验更差。
 */
export function routeTool(
  input: string,
  params: Record<string, string>,
  lookup: CatalogLookup
): RouteDecision | null {
  const requested = String(params.classId ?? '').trim()
  const text = String(input ?? '').trim()

  // 1. 明确点名了类：按它属于哪层路由
  if (requested) {
    const layer = requested.split('.')[0]
    if (layer === 'body' && lookup.hasClass('body', requested.slice(5))) {
      return { target: requested, kind: 'body', reason: '明确指定的体', confidence: 0.95 }
    }
    if (layer === 'line' && lookup.hasClass('line', requested.slice(5))) {
      return { target: requested, kind: 'flow', reason: '明确指定的流程', confidence: 0.95 }
    }
    if (layer === 'point' && lookup.hasClass('point', requested.slice(6))) {
      return { target: requested, kind: 'point', reason: '明确指定的能力', confidence: 0.95 }
    }
    return null // 点名了但目录里没有 —— 不猜
  }

  // 2. 没点名：用关键词在目录里做同义匹配
  if (!text) return null
  const keyword = text.toLowerCase()
  const matches = (layer: string, names: string[]): string | null => {
    const hit = names.find((name) => {
      const bare = name.replace(/_/g, '')
      return keyword.includes(bare) || bare.split('_').some((part) => part.length >= 3 && keyword.includes(part))
    })
    return hit ? `${layer}.${hit}` : null
  }

  const bodyNames = []
  // 用 hasClass 反查出候选不可行（没有枚举接口），所以只按命名约定试
  for (const guess of ['ocr', 'file_preview', 'image_resizer', 'pdf_toolkit', 'clipboard_history', 'file_organizer', 'advanced_paste']) {
    if (lookup.hasClass('body', guess)) bodyNames.push(guess)
  }
  const bodyHit = matches('body', bodyNames)
  if (bodyHit) {
    return { target: bodyHit, kind: 'body', reason: `输入描述的是「${bodyHit.split('.')[1]}」这类产品级任务`, confidence: 0.65 }
  }

  // 3. 落到点层：能匹配到单个能力就是它
  for (const guess of ['ocr_read', 'clipboard_get', 'clipboard_write', 'file_read', 'file_move', 'key_send', 'window_query', 'screen_capture']) {
    if (!lookup.hasClass('point', guess)) continue
    const cls = `point.${guess}`
    if (lookup.isUsedInFlows(cls)) {
      return { target: cls, kind: 'point', reason: `单个能力就能办到，且它已被流程使用`, confidence: 0.55 }
    }
    return { target: cls, kind: 'point', reason: '单个能力就能办到，目前没有流程封装它', confidence: 0.5 }
  }

  return null
}

/** ── body：文件扩展名 / 触发器 → 体实例 ──────────────────── */
const EXT_TO_BODY: Array<{ exts: string[]; body: string; why: string }> = [
  { exts: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.pdf'], body: 'body.ocr', why: '图片/PDF，适合先做文字识别' },
  { exts: ['.mp4', '.mov', '.mkv', '.avi', '.mp3', '.wav', '.flac'], body: 'body.media_converter', why: '音视频文件，适合转码' },
  { exts: ['.md', '.txt', '.json', '.log', '.csv', '.ts', '.js', '.py'], body: 'body.file_preview', why: '文本类文件，适合直接预览' }
]

export function routeBody(input: string, lookup: { hasClass: (l: string, n: string) => boolean }): RouteDecision | null {
  const text = String(input ?? '').trim()
  if (!text) return null
  const lower = text.toLowerCase()

  for (const rule of EXT_TO_BODY) {
    const ext = rule.exts.find((candidate) => lower.includes(candidate))
    if (!ext) continue
    const name = rule.body.slice(5)
    if (!lookup.hasClass('body', name)) continue
    return { target: rule.body, kind: 'body', reason: `看到 ${ext}（${rule.why}）`, confidence: 0.8 }
  }

  if (/^https?:\/\//.test(lower) && lookup.hasClass('body', 'external_access')) {
    return { target: 'body.external_access', kind: 'body', reason: '输入是网址', confidence: 0.75 }
  }
  if (lookup.hasClass('body', 'file_organizer') && (lower.includes('整理') || lower.includes('归类'))) {
    return { target: 'body.file_organizer', kind: 'body', reason: '输入表达的是整理意图', confidence: 0.6 }
  }
  return null
}

export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const mode = String(ctx.params.mode ?? ctx.instance.name ?? 'tool').toLowerCase()
  const input = String(ctx.input ?? ctx.params.input ?? '')

  /**
   * 路由必须看得见**所有层**，不能只看自己那层。
   * 之前用 ctx.def.classes 判断，结果 field.route 拿 field 层的类去查 body.ocr，
   * 永远查不到，把「photo.png 应该去 OCR」判成了「无法路由」。
   */
  const lookup: CatalogLookup = {
    hasClass: (layer, name) => {
      const list = (fullCatalogs as Record<string, Array<{ id: string }>>)[layer] ?? []
      return list.some((cls) => cls.id === `${layer}.${name}`)
    },
    isUsedInFlows: () => false
  }

  let decision: RouteDecision | null = null
  if (mode.includes('model')) decision = routeModel(input, ctx.params)
  else if (mode.includes('body')) decision = routeBody(input, lookup)
  else decision = routeTool(input, ctx.params, lookup)

  if (!decision) {
    // 判断不了就说判断不了。硬塞默认值会让错误一路传下去。
    return {
      status: 'warn',
      output: `无法路由（mode=${mode}）：输入里没有足够信息，或目录里没有匹配的目标`,
      elapsedMs: elapsed(startedAt),
      evidence: { kind: 'route', mode, decided: false, input: input.slice(0, 120) }
    }
  }

  return {
    status: 'ok',
    output: `路由到 ${decision.target}（${decision.kind}）：${decision.reason}`,
    value: JSON.stringify(decision),
    elapsedMs: elapsed(startedAt),
    // 不能直接展开 decision：它的 kind 是目标类型（body/point…），
    // 会覆盖掉 evidence 自己的语义标记 kind: 'route'
    evidence: {
      kind: 'route',
      mode,
      decided: true,
      target: decision.target,
      targetKind: decision.kind,
      reason: decision.reason,
      confidence: decision.confidence,
      fallback: decision.fallback
    }
  }
}
