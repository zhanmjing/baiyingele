import { readFile } from 'node:fs/promises'
import { desktopCapturer, screen } from 'electron'
import { chatWithImages, describeTierConfig, resolveTiers } from './_llm'
import { elapsed, errorMessage, expandPath, type Capability } from './_shared'

export const id = 'win.ocr.read'
export const summary = '视觉模型 OCR：支持截图 / 本地图片 / 图片 URL，复用 provider 降级链'

/** 视觉模型的建议上限，超过就等比缩小，避免几 MB 的 base64 把请求打爆 */
const MAX_EDGE = 1600
const MAX_DATA_URL_BYTES = 8 * 1024 * 1024

interface ResolvedImage {
  dataUrl: string
  bytes: number
  source: string
}

async function resolveImage(raw: string): Promise<ResolvedImage | { error: string }> {
  const value = raw.trim()
  if (!value) return { error: '未提供 image（可为 $screenshot / 本地路径 / 图片 URL / data URL）' }

  if (value.startsWith('data:image/')) {
    const base64 = value.slice(value.indexOf(',') + 1)
    return { dataUrl: value, bytes: Buffer.from(base64, 'base64').byteLength, source: 'data-url' }
  }

  if (/^https?:\/\//i.test(value)) {
    return { dataUrl: value, bytes: 0, source: value }
  }

  if (value === '$screenshot' || value === 'screenshot') {
    try {
      const { size } = screen.getPrimaryDisplay()
      const scale = Math.min(1, MAX_EDGE / Math.max(size.width, size.height))
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale))
        }
      })
      const primary = sources.find((source) => source.id.startsWith('screen:')) ?? sources[0]
      if (!primary) return { error: '没有可用的屏幕源' }
      const png = primary.thumbnail.toPNG()
      return {
        dataUrl: `data:image/png;base64,${png.toString('base64')}`,
        bytes: png.byteLength,
        source: `screenshot:${primary.name}`
      }
    } catch (error) {
      return { error: `截屏失败：${errorMessage(error)}` }
    }
  }

  const filePath = expandPath(value)
  try {
    const buffer = await readFile(filePath)
    const lower = filePath.toLowerCase()
    const mime = lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
    return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, bytes: buffer.byteLength, source: filePath }
  } catch (error) {
    return { error: `读取图片失败：${errorMessage(error)}` }
  }
}

/** L0 · OCR 识别（只读：不写文件、不改系统） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()
  const lang = String(ctx.params.lang ?? 'auto')
  const layout = String(ctx.params.layout) === 'true'

  const resolved = await resolveImage(String(ctx.params.image ?? ''))
  if ('error' in resolved) {
    return { status: 'warn', output: resolved.error, elapsedMs: elapsed(startedAt) }
  }
  if (resolved.dataUrl.length > MAX_DATA_URL_BYTES) {
    return {
      status: 'warn',
      output: `图片过大（约 ${Math.round(resolved.dataUrl.length / 1024 / 1024)}MB），超过 8MB 上限`,
      elapsedMs: elapsed(startedAt)
    }
  }
  if (!resolveTiers().length) {
    return {
      status: 'warn',
      output: '未配置 OCR provider（本地/网络/API 三档都没设环境变量），未发起任何请求',
      elapsedMs: elapsed(startedAt)
    }
  }

  const prompt =
    `请识别这张图片里的全部文字。` +
    (layout ? '保留原有的换行、缩进与表格结构。' : '只输出纯文本，不要排版。') +
    `不要翻译、不要解释、不要加任何前后缀。`

  try {
    const result = await chatWithImages(
      prompt,
      `你是 OCR 引擎。识别语言：${lang === 'auto' ? '自动判断' : lang}。只输出识别结果。`,
      [resolved.dataUrl]
    )

    if (!result.text.trim()) {
      return {
        status: 'warn',
        output: '模型没有识别到文字',
        evidence: { tier: result.tier, imageSource: resolved.source, bytes: resolved.bytes, attempts: result.attempts },
        elapsedMs: elapsed(startedAt)
      }
    }

    return {
      status: 'ok',
      output:
        `识别完成 · ${result.text.length} 字符 · 来源 ${resolved.source}` +
        `${resolved.bytes ? `（${Math.round(resolved.bytes / 1024)}KB）` : ''}｜${describeTierConfig()}`,
      value: result.text,
      evidence: {
        tier: result.tier,
        imageSource: resolved.source,
        bytes: resolved.bytes,
        lang,
        layout,
        chars: result.text.length,
        attempts: result.attempts
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `OCR 失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
