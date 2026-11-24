import { isWindows, runPowerShell } from './_powershell'
import { elapsed, errorMessage, type Capability } from './_shared'

export const id = 'point.theme_mode'
export const summary = 'Windows 深浅主题：读写 HKCU Personalize 注册表键并读回校验'

export interface ThemeTargets {
  apps?: number
  system?: number
}

/**
 * 纯函数：决定这次要写哪些值。
 * 注册表约定：AppsUseLightTheme / SystemUsesLightTheme = 0 表示深色、1 表示浅色。
 */
export function planThemeChange(input: {
  action: string
  mode: string
  scope: string
  currentApps: number
  currentSystem: number
}): ThemeTargets {
  const scope = input.scope === 'system' ? 'system' : input.scope === 'both' ? 'both' : 'apps'
  const targets: ThemeTargets = {}

  const next = (): number => {
    if (input.action === 'toggle') return 0 // 占位，下面按当前值翻转
    return input.mode === 'light' ? 1 : 0
  }

  if (input.action === 'toggle') {
    if (scope === 'apps' || scope === 'both') targets.apps = input.currentApps === 1 ? 0 : 1
    if (scope === 'system' || scope === 'both') targets.system = input.currentSystem === 1 ? 0 : 1
    return targets
  }

  const value = next()
  if (scope === 'apps' || scope === 'both') targets.apps = value
  if (scope === 'system' || scope === 'both') targets.system = value
  return targets
}

const KEY_PATH = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

async function readTheme(): Promise<{ apps: number; system: number }> {
  const script = [
    `$v = Get-ItemProperty -Path '${KEY_PATH}' -ErrorAction SilentlyContinue`,
    'if ($null -eq $v) { "-1,-1" } else { "$($v.AppsUseLightTheme),$($v.SystemUsesLightTheme)" }'
  ].join('\n')
  const raw = await runPowerShell(script)
  const [apps, system] = raw.split(',').map((part) => Number(part.trim()))
  return { apps: Number.isFinite(apps) ? apps : -1, system: Number.isFinite(system) ? system : -1 }
}

function buildWriteScript(targets: ThemeTargets): string {
  const lines = [`$p = '${KEY_PATH}'`, 'if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }']
  if (targets.apps !== undefined) {
    lines.push(`Set-ItemProperty -Path $p -Name AppsUseLightTheme -Value ${targets.apps} -Type DWord`)
  }
  if (targets.system !== undefined) {
    lines.push(`Set-ItemProperty -Path $p -Name SystemUsesLightTheme -Value ${targets.system} -Type DWord`)
  }
  return lines.join('\n')
}

const label = (value: number): string => (value === 0 ? '深色' : value === 1 ? '浅色' : '未知')

/** L1 · 切换深浅主题（可逆：把值写回去即可恢复） */
export const run: Capability = async (ctx) => {
  const startedAt = Date.now()

  if (!isWindows()) {
    return { status: 'warn', output: '仅支持 Windows', elapsedMs: elapsed(startedAt) }
  }

  const action = String(ctx.params.action ?? 'set').toLowerCase()
  const mode = String(ctx.params.mode ?? 'dark').toLowerCase()
  const scope = String(ctx.params.scope ?? 'apps').toLowerCase()

  try {
    const current = await readTheme()
    const targets = planThemeChange({
      action,
      mode,
      scope,
      currentApps: current.apps,
      currentSystem: current.system
    })
    if (targets.apps === undefined && targets.system === undefined) {
      return { status: 'warn', output: `没有可写的目标（action=${action} scope=${scope}）`, elapsedMs: elapsed(startedAt) }
    }

    await runPowerShell(buildWriteScript(targets))
    const after = await readTheme()

    const verify =
      (targets.apps === undefined || after.apps === targets.apps) &&
      (targets.system === undefined || after.system === targets.system)

    const parts = [
      targets.apps !== undefined ? `apps=${label(after.apps)}` : '',
      targets.system !== undefined ? `system=${label(after.system)}` : ''
    ].filter(Boolean)

    return {
      status: verify ? 'ok' : 'warn',
      output:
        `${verify ? '已切换' : '写入后读回不一致'}：${parts.join(' / ')}` +
        `（原值 apps=${label(current.apps)} system=${label(current.system)}）` +
        '；任务栏与已开应用需重新登录或重启资源管理器才完全生效',
      value: JSON.stringify(after),
      evidence: {
        action,
        mode,
        scope,
        before: current,
        targets,
        after,
        verified: verify
      },
      elapsedMs: elapsed(startedAt)
    }
  } catch (error) {
    return { status: 'warn', output: `切换主题失败：${errorMessage(error)}`, elapsedMs: elapsed(startedAt) }
  }
}
