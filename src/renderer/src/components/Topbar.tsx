import { Bell, Command, Search, Sparkles } from 'lucide-react'
import type { SettingsLanguage } from '../settingsI18n'

interface Props {
  title: string
  eyebrow: string
  query: string
  onQueryChange: (value: string) => void
  onPalette: () => void
  language?: SettingsLanguage
}

export function Topbar({ title, eyebrow, query, onQueryChange, onPalette, language = 'zh' }: Props) {
  const isEn = language === 'en'
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="breadcrumb-root">{isEn ? 'Workspace' : '工作台'}</span>
        <span className="breadcrumb-slash">/</span>
        <span className="breadcrumb-current">{title}</span>
        <span className="eyebrow-chip">{eyebrow}</span>
      </div>

      <div className="topbar-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={isEn ? 'Search classes, instances, params…' : '搜索类、实例、参数…'}
          spellCheck={false}
        />
        <button className="kbd" onClick={onPalette} title={isEn ? 'Open command palette' : '打开命令面板'}>
          <Command size={11} /> K
        </button>
      </div>

      <div className="topbar-actions">
        <div className="topbar-badge">
          <Sparkles size={12} />
          <span>{isEn ? 'Local first' : '本地优先'}</span>
        </div>
        <button className="icon-btn" title={isEn ? 'Notifications' : '通知'}>
          <Bell size={16} />
          <span className="notification-dot" />
        </button>
        <div className="avatar">{isEn ? 'B' : '百'}</div>
      </div>
    </header>
  )
}
