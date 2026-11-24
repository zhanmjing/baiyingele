import { closeWindow, enumWindows, focusWindow, isTopmost, moveWindow, primaryWorkArea, setTopmost, win32Available } from './_win32'
import { isWindows } from './_powershell'
import { parseSelector, selectWindows, type WindowInfo } from './win.window.query'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.window_control'
export const summary = 'koffi 控制窗口：focus / move / topmost / close（focus 用 AttachThreadInput 绕前台锁）'

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 纯函数：把 "0,0,0.5,1" 解析成像素矩形。
 * 四个值都 ≤ 1 时视为相对工作区的比例，否则视为绝对像素。
 */
export function computeRect(spec: string, area: WorkArea): Rect | null {
  const parts = String(spec ?? '')
    .split(',')
    .map((part) => Number(part.trim()))
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null

  const [rx, ry, rw, rh] = parts
  const fractional = parts.every((value) => Math.abs(value) <= 1)
  if (fractional) {
    return {
      x: Math.round(area.x + rx * area.width),
      y: Math.round(area.y + ry * area.height),
      width: Math.round(rw * area.width),
      height: Math.round(rh * area.height)
    }
  }
  return { x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh) }
}

function stripExe(name: string): string {
  return name.replace(/\.exe$/i, '')
}

export interface ResolvedTarget {
  window: WindowInfo
  /** 匹配到的候选数；>1 说明按标题/进程选会有歧义 */
  matchCount: number
  matchedBy: 'hwnd' | 'selector'
}

/** 解析目标窗口：优先按 hwnd 精确匹配，否则枚举后按 selector 取第一个 */
export function resolveTarget(selectorRaw: string): ResolvedTarget | null {
  const windows = enumWindows(500)
  if (!windows) return null

  const infos: WindowInfo[] = windows.map((window) => ({
    id: window.pid,
    hwnd: window.hwnd,
    process: stripExe(window.process),
    title: window.title
  }))

  const selector = parseSelector(selectorRaw)
  if (selector.hwnd) {
    const exact = infos.find((window) => window.hwnd === selector.hwnd)
    return exact ? { window: exact, matchCount: 1, matchedBy: 'hwnd' } : null
  }

  const matched = selectWindows(infos, selector, 500)
  if (!matched.length) return null
  return { window: matched[0], matchCount: matched.length, matchedBy: 'selector' }
}

/** L1 · 控制窗口 */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }
  if (!win32Available()) {
    return { status: 'warn', output: '窗口控制需要 koffi（未加载成功），暂无 PowerShell 等价实现', elapsedMs: elapsed(startedAt) }
  }

  const op = String(ctx.params.op ?? '').trim().toLowerCase()
  const selectorRaw = String(ctx.params.selector ?? '')
  const monitor = String(ctx.params.monitor ?? '1').trim()
  const rectSpec = String(ctx.params.rect ?? '')
  const mode = String(ctx.params.mode ?? 'toggle').trim().toLowerCase()

  if (!['focus', 'move', 'topmost', 'close'].includes(op)) {
    return { status: 'warn', output: `未知 op：${op || '(空)'}（支持 focus / move / topmost / close）`, elapsedMs: elapsed(startedAt) }
  }

  try {
    const resolved = resolveTarget(selectorRaw)
    if (!resolved) {
      return {
        status: 'warn',
        output: `没有匹配的窗口（selector=${selectorRaw || '(空)'}）`,
        evidence: { op, selector: parseSelector(selectorRaw) },
        elapsedMs: elapsed(startedAt)
      }
    }
    const target = resolved.window
    if (!target.hwnd) {
      return { status: 'warn', output: '目标窗口缺少句柄（koffi 枚举异常）', elapsedMs: elapsed(startedAt) }
    }

    const label = `${target.process}「${target.title.slice(0, 30)}」`
    const ambiguity =
      resolved.matchCount > 1
        ? `（注意：按条件匹配到 ${resolved.matchCount} 个窗口，已取第一个；传 hwnd 可精确指定）`
        : ''

    if (op === 'focus') {
      const result = focusWindow(target.hwnd)
      return {
        status: result.ok ? 'ok' : 'warn',
        output: result.ok ? `已聚焦 ${label}${ambiguity}` : `聚焦失败：${result.reason}`,
        value: target.hwnd,
        evidence: { op, hwnd: target.hwnd, target: label, ok: result.ok, reason: result.reason },
        elapsedMs: elapsed(startedAt)
      }
    }

    if (op === 'close') {
      const result = closeWindow(target.hwnd)
      return {
        status: result.ok ? 'ok' : 'warn',
        output: result.ok ? `已向 ${label} 发送关闭请求` : `关闭失败：${result.reason}`,
        value: target.hwnd,
        evidence: { op, hwnd: target.hwnd, target: label, ok: result.ok, reason: result.reason },
        elapsedMs: elapsed(startedAt)
      }
    }

    if (op === 'topmost') {
      const current = isTopmost(target.hwnd)
      const next = mode === 'on' ? true : mode === 'off' ? false : !(current ?? false)
      const result = setTopmost(target.hwnd, next)
      return {
        status: result.ok ? 'ok' : 'warn',
        output: result.ok
          ? `${next ? '置顶' : '取消置顶'} ${label}（原状态 ${current === null ? '未知' : current ? '置顶' : '普通'}）${ambiguity}`
          : `置顶失败：${result.reason}`,
        value: target.hwnd,
        evidence: { op, hwnd: target.hwnd, target: label, mode, before: current, after: next, ok: result.ok, reason: result.reason },
        elapsedMs: elapsed(startedAt)
      }
    }

    // move
    if (monitor !== '1') {
      return { status: 'warn', output: `暂不支持多显示器（monitor=${monitor}），当前只处理主屏工作区`, elapsedMs: elapsed(startedAt) }
    }
    const area = primaryWorkArea()
    if (!area) return { status: 'warn', output: '读取主屏工作区失败', elapsedMs: elapsed(startedAt) }
    const rect = computeRect(rectSpec, area)
    if (!rect) {
      return { status: 'warn', output: `rect 格式不对：${rectSpec || '(空)'}（应为 "x,y,w,h"，比例或像素）`, elapsedMs: elapsed(startedAt) }
    }
    const result = moveWindow(target.hwnd, rect)
    return {
      status: result.ok ? 'ok' : 'warn',
      output: result.ok
        ? `已移动 ${label} 到 ${rect.x},${rect.y} ${rect.width}×${rect.height}（工作区 ${area.width}×${area.height}）${ambiguity}`
        : `移动失败：${result.reason}`,
      value: target.hwnd,
      evidence: { op, hwnd: target.hwnd, target: label, rect, area, ok: result.ok, reason: result.reason },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `控制窗口失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
