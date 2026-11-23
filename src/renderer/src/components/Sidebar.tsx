import type { CSSProperties } from 'react'
import { Activity, Command, LayoutDashboard, Settings, Wifi } from 'lucide-react'
import { layers, layerOrder, type LayerKey } from '../data'
import type { SettingsLanguage } from '../settingsI18n'

export type Section = 'dashboard' | LayerKey | 'runs' | 'settings'

interface Props {
  active: Section
  onNavigate: (section: Section) => void
  counts: Record<LayerKey, { classes: number; instances: number }>
  runCount: number
  version?: string
  language?: SettingsLanguage
}

export function Sidebar({ active, onNavigate, counts, runCount, version, language = 'zh' }: Props) {
  const isEn = language === 'en'
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">{isEn ? 'B' : '百'}</div>
        <div>
          <div className="brand-name">{isEn ? 'Baiying' : '百应'}</div>
          <div className="brand-sub">{isEn ? 'BAIYING · FIVE LAYERS' : '百应 · 五层工作台'}</div>
        </div>
      </div>

      <div className="sidebar-section-label">{isEn ? 'Workspace' : '工作台'}</div>
      <nav className="nav">
        <button
          className={`nav-item ${active === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <LayoutDashboard size={17} strokeWidth={1.8} />
          <span>{isEn ? 'Overview' : '总览'}</span>
          <span className="nav-key">01</span>
        </button>

        <div className="nav-divider" />

        {layerOrder.map((key, index) => {
          const meta = layers[key]
          const Icon = meta.icon
          return (
            <button
              key={key}
              className={`nav-item layer-nav ${active === key ? 'active' : ''}`}
              onClick={() => onNavigate(key)}
              style={{ '--nav-accent': meta.accent } as CSSProperties}
            >
              <span className="nav-icon">
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <span className="nav-layer-text">
                <span>{isEn ? meta.en : meta.label}</span>
                <em>{isEn ? meta.en.toUpperCase() : '层'}</em>
              </span>
              <span className="nav-count">{counts[key].classes}</span>
              <span className="nav-index">0{index + 2}</span>
            </button>
          )
        })}

        <div className="nav-divider" />

        <button
          className={`nav-item ${active === 'runs' ? 'active' : ''}`}
          onClick={() => onNavigate('runs')}
        >
          <Activity size={16} strokeWidth={1.8} />
          <span>{isEn ? 'Run history' : '运行历史'}</span>
          <span className="nav-count">{runCount}</span>
          <span className="nav-key">08</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-card">
        <div className="sidebar-card-head">
          <Command size={14} />
          <span>{isEn ? 'Quick dev' : '快速开发'}</span>
        </div>
        <p>{isEn ? 'Electron + React + Vite. All pages and IPC are ready.' : '桌面端 + React + Vite。所有页面和 IPC 已就绪，可直接修改。'}</p>
        <div className="sidebar-card-meta">
          <span className="status-dot" />
          <span>{isEn ? 'HMR connected' : '热更新已连接'}</span>
        </div>
      </div>

      <button
        className={`nav-item settings-nav ${active === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <Settings size={16} strokeWidth={1.8} />
        <span>{isEn ? 'Settings' : '设置'}</span>
      </button>

      <div className="sidebar-footer">
        <div className="connection">
          <span className="status-dot" />
          <span>{isEn ? 'Desktop connected' : '桌面端已连接'}</span>
          <Wifi size={12} />
        </div>
        <div className="version">v{version ?? '0.1.0'} · {isEn ? 'local' : '本地'}</div>
      </div>
    </aside>
  )
}
