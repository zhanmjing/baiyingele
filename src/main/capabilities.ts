/**
 * 真实能力实现表。
 *
 * 只有在这里登记的 classId 才会真正产生副作用；其余类仍走 layerStore 的模拟 runner，
 * 并由 shared/implRegistry 在 UI 上标为「模拟」——避免"看起来能跑"的假象。
 *
 * 返回 null 表示"这个类没有真实实现"，调用方回落到模拟输出。
 */
import { app, clipboard, desktopCapturer, Notification } from 'electron'
import { appendFile, copyFile, mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { IMPLEMENTED_CLASS_IDS, type ImplementedClassId } from '../shared/implRegistry'
import type { RunContext, RunOutcome } from './layerStore'

type Capability = (context: RunContext) => Promise<RunOutcome>

function elapsed(startedAt: number): number {
  return Date.now() - startedAt
}

function expandPath(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('~')) return join(homedir(), value.slice(1).replace(/^[\\/]+/, ''))
  return value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * L0 · 读取剪贴板
 * Electron 45 的 clipboard 已改为 W3C 风格异步 API：
 * readText(): Promise<string>、read(): Promise<ClipboardItem[]>，不再有 readImage()。
 */
const clipboardGet: Capability = async (ctx) => {
  const startedAt = Date.now()
  const format = String(ctx.params.format ?? 'text').toLowerCase()

  if (format === 'image') {
    const items = await clipboard.read()
    const imageItem = items.find((item) => item.types.some((type) => type.startsWith('image/')))
    if (!imageItem) {
      const available = [...new Set(items.flatMap((item) => item.types))].join(', ')
      return {
        status: 'warn',
        output: available ? `剪贴板里没有图片 · 现有类型：${available}` : '剪贴板为空',
        elapsedMs: elapsed(startedAt)
      }
    }
    const mime = imageItem.types.find((type) => type.startsWith('image/'))!
    const blob = (await imageItem.getType(mime)) as Blob
    return {
      status: 'ok',
      output: `剪贴板图片 · ${mime} · ${blob.size} bytes`,
      value: mime,
      elapsedMs: elapsed(startedAt)
    }
  }

  const text = await clipboard.readText()
  if (!text) return { status: 'warn', output: '剪贴板为空', value: '', elapsedMs: elapsed(startedAt) }
  const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text
  return {
    status: 'ok',
    output: `剪贴板文本 · ${text.length} 字符 · ${JSON.stringify(preview)}`,
    value: text,
    elapsedMs: elapsed(startedAt)
  }
}

/** L0 · 套模板（纯函数） */
const textTemplate: Capability = async (ctx) => {
  const startedAt = Date.now()
  const template = String(ctx.params.template ?? '{{input}}')
  const input = String(ctx.params.input ?? ctx.input ?? '')
  const rendered = template.split('{{input}}').join(input)
  return {
    status: 'ok',
    output: `模板已套用 · ${rendered.length} 字符`,
    value: rendered,
    elapsedMs: elapsed(startedAt)
  }
}

/** L1 · 写文件 */
const fileWrite: Capability = async (ctx) => {
  const startedAt = Date.now()
  const text = String(ctx.params.text ?? ctx.input ?? '')
  const append = String(ctx.params.append) === 'true'
  let note = ''
  let target = expandPath(String(ctx.params.path ?? ctx.args?.path ?? ''))

  // 实例没给有效路径（或只有原型里的占位 "..."）时落到应用数据目录，并在输出里说明
  if (!target || target.includes('...')) {
    const fallbackDir = join(app.getPath('userData'), 'flow-out')
    await mkdir(fallbackDir, { recursive: true })
    target = join(fallbackDir, `clipboard-${Date.now()}.md`)
    note = '（实例未提供有效 path，已写入默认目录）'
  }

  await mkdir(dirname(target), { recursive: true })
  if (append) await appendFile(target, text, 'utf8')
  else await writeFile(target, text, 'utf8')

  return {
    status: 'ok',
    output: `已${append ? '追加' : '写入'} ${target} · ${text.length} 字符${note}`,
    value: target,
    elapsedMs: elapsed(startedAt)
  }
}

/** L0 · 读文件 */
const fileRead: Capability = async (ctx) => {
  const startedAt = Date.now()
  const target = expandPath(String(ctx.params.path ?? ''))
  if (!target) return { status: 'warn', output: '未提供 path', elapsedMs: elapsed(startedAt) }

  const encoding = String(ctx.params.encoding ?? 'utf-8') || 'utf-8'
  const requested = Number(ctx.params.maxBytes ?? 262144)
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 16 * 1024 * 1024) : 262144

  try {
    const info = await stat(target)
    if (info.isDirectory()) {
      return { status: 'warn', output: `是目录而不是文件：${target}`, elapsedMs: elapsed(startedAt) }
    }

    const handle = await open(target, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(limit, info.size))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const text = buffer.subarray(0, bytesRead).toString(encoding as BufferEncoding)
      const truncated = info.size > bytesRead
      const firstLine = (text.split(/\r?\n/)[0] ?? '').slice(0, 60)
      return {
        status: 'ok',
        output: `读取 ${target} · ${bytesRead} bytes${truncated ? `（原文 ${info.size}，已截断）` : ''} · ${JSON.stringify(firstLine)}`,
        value: text,
        elapsedMs: elapsed(startedAt)
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    return { status: 'warn', output: `读取失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** L1 · 移动 / 重命名文件 */
const fileMove: Capability = async (ctx) => {
  const startedAt = Date.now()
  const from = expandPath(String(ctx.params.from ?? ''))
  const to = expandPath(String(ctx.params.to ?? ''))
  const overwrite = String(ctx.params.overwrite) === 'true'

  if (!from || !to) {
    return { status: 'warn', output: '需要 from 和 to 两个参数', elapsedMs: elapsed(startedAt) }
  }
  if (!(await pathExists(from))) {
    return { status: 'warn', output: `源文件不存在：${from}`, elapsedMs: elapsed(startedAt) }
  }
  if (!overwrite && (await pathExists(to))) {
    return {
      status: 'warn',
      output: `目标已存在且 overwrite=false，未改动任何文件：${to}`,
      elapsedMs: elapsed(startedAt)
    }
  }

  try {
    await mkdir(dirname(to), { recursive: true })
    try {
      await rename(from, to)
    } catch (error) {
      // 跨盘移动会抛 EXDEV：退化成复制 + 删除
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await copyFile(from, to)
        await unlink(from)
      } else {
        throw error
      }
    }
    return {
      status: 'ok',
      output: `已移动 ${from} → ${to}${overwrite ? '（overwrite=true）' : ''}`,
      value: to,
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `移动失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}

/** L1 · 系统通知 */
const notifyToast: Capability = async (ctx) => {
  const startedAt = Date.now()
  const title = String(ctx.params.title ?? '百应')
  const body = String(ctx.params.body ?? ctx.input ?? '').slice(0, 180)
  if (!Notification.isSupported()) {
    return { status: 'warn', output: '当前系统不支持通知', value: body, elapsedMs: elapsed(startedAt) }
  }
  new Notification({ title, body }).show()
  return { status: 'ok', output: `已发送系统通知 · ${body.length} 字符`, value: body, elapsedMs: elapsed(startedAt) }
}

/** L1 · HTTP 请求 */
const httpRequest: Capability = async (ctx) => {
  const startedAt = Date.now()
  const method = String(ctx.params.method ?? 'GET').toUpperCase()
  const url = String(ctx.params.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return { status: 'warn', output: `非法 URL：${url || '(空)'}`, elapsedMs: elapsed(startedAt) }
  }
  try {
    const response = await fetch(url, {
      method,
      body: method === 'GET' || method === 'HEAD' ? undefined : String(ctx.params.body ?? ''),
      signal: AbortSignal.timeout(10_000)
    })
    const bytes = (await response.arrayBuffer()).byteLength
    return {
      status: response.ok ? 'ok' : 'warn',
      output: `HTTP ${response.status} ${response.statusText} · ${bytes} bytes · ${elapsed(startedAt)}ms`,
      value: `HTTP ${response.status}`,
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `请求失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}

/** L0 · 抓屏（枚举屏幕源，不保存文件） */
const screenCapture: Capability = async (ctx) => {
  const startedAt = Date.now()
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
    const names = sources.map((source) => source.name).join(', ')
    return {
      status: sources.length ? 'ok' : 'warn',
      output: sources.length ? `已捕获 ${sources.length} 个屏幕源 · ${names}` : '没有可用的屏幕源',
      value: String(sources.length),
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `抓屏失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}

/** 键类型来自 shared/implRegistry：两边不同步会直接编译失败 */
export const CAPABILITIES: Record<ImplementedClassId, Capability> = {
  'win.clipboard.get': clipboardGet,
  'text.template': textTemplate,
  'file.write': fileWrite,
  'file.read': fileRead,
  'file.move': fileMove,
  'notify.toast': notifyToast,
  'win.http.request': httpRequest,
  'win.screen.capture': screenCapture
}

export { IMPLEMENTED_CLASS_IDS }

export async function runCapability(context: RunContext): Promise<RunOutcome | null> {
  const capability = CAPABILITIES[context.instance.classId as ImplementedClassId]
  if (!capability) return null
  try {
    return await capability(context)
  } catch (error) {
    return { status: 'warn', output: `执行异常：${errorMessage(error)}`, elapsedMs: 0 }
  }
}
