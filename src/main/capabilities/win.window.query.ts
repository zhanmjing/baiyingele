import { isWindows, runPowerShell } from './_powershell'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'win.window.query'
export const summary = 'PowerShell 枚举有主窗口的进程；支持按进程名/标题筛选'

export interface WindowInfo {
  id: number
  process: string
  title: string
}

export interface WindowSelector {
  strategy?: string
  process?: string
  title?: string
  titleMatch?: 'contains' | 'exact'
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
 * 注意：Windows 的 z 序拿不到（PowerShell 读不到 GetWindow 的 z-order），
 * 所以 sort=z_order 时退化为「按进程名、再按标题」的稳定顺序，并在输出里说明。
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

/** 真实枚举：拿 PowerShell 的进程窗口列表 */
async function listWindows(): Promise<WindowInfo[]> {
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
    const all = await listWindows()
    const picked = selectWindows(all, selector, Number.isFinite(limit) ? limit : 50)
    const notes = [
      selector.process ? `进程 ~ ${selector.process}` : '',
      selector.title ? `标题 ${selector.titleMatch === 'exact' ? '=' : '~'} ${selector.title}` : '',
      sort === 'z_order' ? 'z 序不可用，已按进程名排序' : ''
    ].filter(Boolean)

    const sample = picked
      .slice(0, 3)
      .map((window) => `${window.process}「${window.title.slice(0, 30)}」`)
      .join(' · ')

    return {
      status: 'ok',
      output:
        `命中 ${picked.length} / 总共 ${all.length} 个窗口` +
        `${notes.length ? `（${notes.join('；')}）` : ''}` +
        `${sample ? ` · 前 3 个：${sample}` : ''}`,
      value: JSON.stringify(picked),
      evidence: {
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
