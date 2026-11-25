import { enumWindows, win32Available, win32LoadError } from '../../capabilities/_win32'
import { isWindows, runPowerShell } from '../../capabilities/_powershell'
import { elapsed, errorMessage, type Capability } from '../../capabilities/_shared'

export const classId = 'point.window_query'
export const summary = 'koffi 直调 user32 枚举窗口（微秒级）；koffi 不可用时回退 PowerShell'

export interface WindowInfo {
  id: number
  process: string
  title: string
  /** 窗口句柄，供 win.window.control 使用 */
  hwnd?: string
}

export interface WindowSelector {
  strategy?: string
  process?: string
  title?: string
  titleMatch?: 'contains' | 'exact'
  /** 精确指定窗口句柄（优先于 process/title）。同名窗口有多个时用它消歧 */
  hwnd?: string
}

/** 解析实例里的 selector（JSON 字符串）；解析不了就当没有条件 */
export function parseSelector(raw: string): WindowSelector {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as WindowSelector) : {}
  } catch {
    return {}
  }
}

/**
 * 纯函数：筛选 + 排序 + 限流。
 * 排序用「进程名、再标题」做稳定顺序——真正的 z 序要额外调 GetWindow(hwnd, GW_HWNDPREV)，
 * 目前没有实现，所以 sort=z_order 时退化处理并在输出里说明。
 */
export function selectWindows(
  windows: WindowInfo[],
  selector: WindowSelector,
  limit: number
): WindowInfo[] {
  const processFilter = String(selector.process ?? '').trim().toLowerCase()
  const titleFilter = String(selector.title ?? '').trim().toLowerCase()
  const titleMatch = selector.titleMatch === 'exact' ? 'exact' : 'contains'

  const filtered = windows.filter((window) => {
    if (processFilter && !window.process.toLowerCase().includes(processFilter)) return false
    if (titleFilter) {
      const title = window.title.toLowerCase()
      if (titleMatch === 'exact' ? title !== titleFilter : !title.includes(titleFilter)) return false
    }
    return true
  })

  filtered.sort((a, b) => a.process.localeCompare(b.process) || a.title.localeCompare(b.title))
  return filtered.slice(0, Math.max(1, Math.min(limit, 500)))
}

function stripExe(name: string): string {
  return name.replace(/\.exe$/i, '')
}

/** 主路径：koffi 直接枚举（返回 null 表示 koffi 不可用，交给调用方回退） */
function listWindowsNative(limit: number): WindowInfo[] | null {
  const windows = enumWindows(limit)
  if (!windows) return null
  return windows.map((window) => ({
    id: window.pid,
    hwnd: window.hwnd,
    process: stripExe(window.process),
    title: window.title
  }))
}

/** 回退路径：PowerShell Get-Process */
async function listWindowsPowerShell(): Promise<WindowInfo[]> {
  const script = [
    '$items = @(Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | ForEach-Object {',
    '  [pscustomobject]@{ id = $_.Id; process = $_.ProcessName; title = $_.MainWindowTitle }',
    '})',
    'ConvertTo-Json -InputObject $items -Compress'
  ].join('\n')

  const raw = await runPowerShell(script)
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list
    .map((item) => item as { id?: unknown; process?: unknown; title?: unknown })
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: Number(item.id ?? 0),
      process: String(item.process ?? ''),
      title: String(item.title ?? '')
    }))
}

/** L0 · 查询窗口（只读） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }

  const selector = parseSelector(String(ctx.params.selector ?? ''))
  const limit = Number(ctx.params.limit ?? 50)
  const sort = String(ctx.params.sort ?? 'z_order')

  try {
    const native = listWindowsNative(500)
    const backend = native ? 'koffi' : 'powershell'
    const all = native ?? (await listWindowsPowerShell())
    const picked = selectWindows(all, selector, Number.isFinite(limit) ? limit : 50)

    const notes = [
      selector.process ? `进程 ~ ${selector.process}` : '',
      selector.title ? `标题 ${selector.titleMatch === 'exact' ? '=' : '~'} ${selector.title}` : '',
      sort === 'z_order' ? 'z 序未实现，已按进程名排序' : '',
      backend === 'powershell' ? `koffi 不可用，已回退 PowerShell（${win32LoadError() ?? '未知原因'}）` : ''
    ].filter(Boolean)

    const sample = picked
      .slice(0, 3)
      .map((window) => `${window.process}「${window.title.slice(0, 30)}」`)
      .join(' · ')

    return {
      status: 'ok',
      output:
        `命中 ${picked.length} / 总共 ${all.length} 个窗口 · ${backend}` +
        `${notes.length ? `（${notes.join('；')}）` : ''}` +
        `${sample ? ` · 前 3 个：${sample}` : ''}`,
      value: JSON.stringify(picked),
      evidence: {
        backend,
        koffiAvailable: win32Available(),
        total: all.length,
        matched: picked.length,
        selector,
        sort,
        limit
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `查询窗口失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
