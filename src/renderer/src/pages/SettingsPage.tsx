import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Database,
  ExternalLink,
  Info,
  Lock,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Undo2
} from 'lucide-react'
import type { LayerKey } from '../data'
import {
  allSettings,
  infoCards,
  sectionDirtyKeys,
  settingMap,
  settingSections,
  settingsForSection,
  type InfoCard,
  type SettingSection,
  type SettingSpec
} from '../settingsData'
import {
  groupCopy,
  groupDescCopy,
  infoCopy,
  optionCopy,
  sectionCopy,
  settingCopy,
  settingsUi,
  type SettingsLanguage
} from '../settingsI18n'

interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  dev: boolean
  dataDir?: string
}

interface Props {
  language?: SettingsLanguage
  appInfo: AppInfo | null
  onToast: (message: string) => void
  onNavigate?: (section: LayerKey) => void
}

type Scope = 'User' | 'Workspace' | 'Machine' | 'Policy'
const STORAGE_KEY = 'baiying.settings.v1'
const scopes: Scope[] = ['User', 'Workspace', 'Machine', 'Policy']

function defaults(): Record<string, unknown> {
  return Object.fromEntries(allSettings.map(({ setting }) => [setting.key, setting.default]))
}

function loadValues(): Record<string, unknown> {
  const base = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Record<string, unknown> | null
    return saved ? { ...base, ...saved } : base
  } catch {
    return base
  }
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      className={`toggle ${value ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span />
    </button>
  )
}

function effectClass(effect?: string): string {
  return (effect ?? 'l0').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function SettingsPage({ language: languageProp, appInfo, onToast, onNavigate }: Props) {
  const initial = useMemo(loadValues, [])
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [savedValues, setSavedValues] = useState<Record<string, unknown>>(initial)
  const [sectionId, setSectionId] = useState('general')
  const [scope, setScope] = useState<Scope>('User')
  const [query, setQuery] = useState('')
  const lang: SettingsLanguage = values['general.language'] === 'en-US' ? 'en' : 'zh'
  const t = settingsUi[lang]

  const section = settingSections.find((item) => item.id === sectionId) ?? settingSections[0]
  const dirtyKeys = useMemo(
    () => Object.keys(values).filter((key) => JSON.stringify(values[key]) !== JSON.stringify(savedValues[key])),
    [values, savedValues]
  )
  const readOnly = scope === 'Policy'
  const sectionDirty = dirtyKeys.filter((key) => settingMap.get(key)?.section.id === sectionId).length

  function setValue(setting: SettingSpec, value: unknown) {
    if (readOnly) return
    if (setting.key === 'general.language') {
      const next = { ...values, [setting.key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setValues(next)
      setSavedValues(next)
      window.dispatchEvent(new Event('baiying-settings-changed'))
      onToast(value === 'en-US' ? 'Language switched to English' : '界面语言已切换为中文')
      return
    }
    setValues((current) => ({ ...current, [setting.key]: value }))
  }

  function resetSetting(setting: SettingSpec) {
    setValue(setting, setting.default)
  }

  function resetSection() {
    if (readOnly) return
    const updates = Object.fromEntries(settingsForSection(sectionId).map((item) => [item.key, item.default]))
    setValues((current) => ({ ...current, ...updates }))
    onToast(`${t.resetSectionToast} · ${sectionCopy(section, lang).title}`)
  }

  function apply() {
    if (readOnly || !dirtyKeys.length) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    window.dispatchEvent(new Event('baiying-settings-changed'))
    setSavedValues(values)
    onToast(`${t.applied} · ${dirtyKeys.length}`)
  }

  function discard() {
    setValues(savedValues)
    onToast(t.discard)
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allSettings
      .filter(({ setting, group, section: resultSection }) => {
        const copy = settingCopy(setting, lang)
        const groupLabel = groupCopy(resultSection.id, resultSection.groups?.indexOf(group) ?? 0, lang)
        const sectionTitle = sectionCopy(resultSection, lang).title
        return [setting.key, copy.label, copy.desc, groupLabel, sectionTitle, ...(setting.options ?? []).map((option) => optionCopy(option, lang))]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .map(({ setting, group, section: resultSection }) => ({
        setting,
        group,
        section: resultSection,
        copy: settingCopy(setting, lang),
        groupLabel: groupCopy(resultSection.id, resultSection.groups?.indexOf(group) ?? 0, lang)
      }))
  }, [query, lang])

  return (
    <div className="page settings-page">
      <header className="page-head">
        <div className="page-head-main">
          <div className="eyebrow">{t.eyebrow}</div>
          <div className="page-title-row">
            <div className="page-title-icon neutral">
              <Settings2 size={22} />
            </div>
            <div>
              <h1>{t.title}</h1>
              <p>{t.desc}</p>
            </div>
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn ghost" onClick={discard} disabled={!dirtyKeys.length || readOnly}>
            <Undo2 size={14} /> {t.undo}
          </button>
          <button className="btn primary" onClick={apply} disabled={!dirtyKeys.length || readOnly}>
            <Save size={14} /> {t.apply}{dirtyKeys.length ? ` · ${dirtyKeys.length}` : ''}
          </button>
        </div>
      </header>

      <div className="settings-toolbar">
        <div className="scope-control">
          <span>{t.scope}</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
            {scopes.map((item) => <option key={item} value={item}>{t.scopes[item]}</option>)}
          </select>
          {scope === 'Policy' && <span className="policy-lock"><Lock size={11} /> {t.readOnly}</span>}
        </div>
        <div className="settings-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search.replace('{count}', String(allSettings.length))}
          />
          {query && <button className="icon-btn" onClick={() => setQuery('')}><span>×</span></button>}
        </div>
        <div className="settings-status">
          <span className={`status-dot ${dirtyKeys.length ? 'dirty' : ''}`} />
          <span>{dirtyKeys.length ? t.dirty.replace('{count}', String(dirtyKeys.length)) : t.synced}</span>
          <span className="settings-status-meta">{t.scopes[scope]} {t.scopeSuffix}</span>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav">
          {settingSections.map((item) => {
            const Icon = item.info ? Info : item.id === 'general' ? Settings2 : ShieldCheck
            const sectionDirtyCount = dirtyKeys.filter((key) => settingMap.get(key)?.section.id === item.id).length
            return (
              <button
                key={item.id}
                className={`settings-tab ${section.id === item.id ? 'active' : ''}`}
                onClick={() => { setSectionId(item.id); setQuery('') }}
              >
                <span className="settings-tab-icon" style={{ color: item.color }}>
                  {item.icon || <Icon size={15} />}
                </span>
                <span className="settings-tab-main">
                  <span>{sectionCopy(item, lang).title}</span>
                  <em>{sectionCopy(item, lang).group} · {item.info ? t.readOnly : `${item.groups?.length ?? 0} ${t.groups}`}</em>
                </span>
                {sectionDirtyCount > 0 && <span className="dirty-dot" />}
              </button>
            )
          })}
        </nav>

        <div className="settings-content">
          {query ? (
            <section className="panel settings-search-results">
              <div className="settings-section-head">
                <div>
                  <div className="panel-eyebrow">{t.searchEyebrow.replace('{count}', String(searchResults.length))}</div>
                  <h2>{t.searchTitle}</h2>
                </div>
                <span className="settings-section-badge">{query}</span>
              </div>
              {searchResults.length ? (
                <div className="search-result-list">
                  {searchResults.map(({ setting, copy, groupLabel, section: resultSection }) => (
                    <button
                      key={setting.key}
                      className="search-result"
                      onClick={() => { setSectionId(resultSection.id); setQuery('') }}
                    >
                      <span className="search-result-icon" style={{ color: resultSection.color }}>{resultSection.icon}</span>
                      <span className="search-result-main">
                        <strong>{copy.label}</strong>
                        {lang === 'en' && <em>{setting.key}</em>}
                        <span>{groupLabel} · {sectionCopy(resultSection, lang).title}</span>
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="settings-empty">{t.noResults}</div>
              )}
            </section>
          ) : section.info ? (
            <InfoSection appInfo={appInfo} onToast={onToast} language={lang} />
          ) : (
            <>
              <section className="settings-section-hero" style={{ '--section-color': section.color } as React.CSSProperties}>
                <div className="settings-section-icon">{section.icon}</div>
                <div>
                  <div className="panel-eyebrow">{sectionCopy(section, lang).group} / {sectionCopy(section, lang).title}</div>
                  <h1>{sectionCopy(section, lang).title}</h1>
                  <p>{sectionCopy(section, lang).desc}</p>
                </div>
                <div className="settings-section-count">
                  <strong>{settingsForSection(section.id).length}</strong>
                  <span>{t.settings}</span>
                </div>
              </section>

              {section.id !== 'general' && section.id !== 'info' && (
                <div className="manage-jump-card">
                  <div className="manage-jump-icon"><ShieldCheck size={17} /></div>
                  <div>
                    <strong>{t.managePage}</strong>
                    <p>{t.manageDesc}</p>
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() => onNavigate?.(section.id as LayerKey)}
                  >
                    {t.openManage.replace('{name}', sectionCopy(section, lang).title.replace('设置', '').replace(' settings', ''))} <ArrowUpRight size={13} />
                  </button>
                </div>
              )}

              {(section.groups ?? []).map((group, groupIndex) => (
                <section className="panel settings-section" key={group.label}>
                  <div className="settings-section-head">
                    <div>
                      <div className="panel-eyebrow">{groupCopy(section.id, groupIndex, lang)}</div>
                      <h2>{groupCopy(section.id, groupIndex, lang)}</h2>
                      <p>{groupDescCopy(section.id, groupIndex, group.desc, lang)}</p>
                    </div>
                    <button className="text-btn" onClick={resetSection} disabled={readOnly}>
                      <RotateCcw size={12} /> {t.resetSection}
                    </button>
                  </div>
                  <div className="setting-list">
                    {group.settings.map((setting) => (
                      <SettingRow
                        key={setting.key}
                        setting={setting}
                        value={values[setting.key]}
                        dirty={JSON.stringify(values[setting.key]) !== JSON.stringify(savedValues[setting.key])}
                        readOnly={readOnly}
                        language={lang}
                        onChange={(value) => setValue(setting, value)}
                        onReset={() => resetSetting(setting)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="settings-footer-note">
        <Lock size={12} />
        <span>{t.footer}</span>
      </div>
    </div>
  )
}

function SettingRow({
  setting,
  value,
  dirty,
  readOnly,
  language,
  onChange,
  onReset
}: {
  setting: SettingSpec
  value: unknown
  dirty: boolean
  readOnly: boolean
  language: SettingsLanguage
  onChange: (value: unknown) => void
  onReset: () => void
}) {
  const isBool = setting.type === 'bool'
  const copy = settingCopy(setting, language)
  const t = settingsUi[language]
  const options = (setting.options ?? []).filter((option) => setting.key !== 'general.language' || option !== 'ja-JP')
  return (
    <div className={`setting-row ${dirty ? 'dirty' : ''}`}>
      <div className="setting-copy">
        <div className="setting-title-line">
          <strong>{copy.label}</strong>
          {setting.effect && <span className={`effect ${effectClass(setting.effect)}`}>{t.effect} {optionCopy(setting.effect, language)}</span>}
          {setting.restart && <span className="setting-badge restart">{t.restart}</span>}
          {setting.policy && <span className="setting-badge policy"><Lock size={8} /> {t.policy}</span>}
          {setting.advanced && <span className="setting-badge">{t.advanced}</span>}
        </div>
        <p>{copy.desc}</p>
        {language === 'en' && <code>{setting.key}</code>}
      </div>
      <div className="setting-control">
        {isBool ? (
          <Toggle value={Boolean(value)} onChange={(next) => onChange(next)} disabled={readOnly} />
        ) : options.length ? (
          <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} disabled={readOnly}>
            {options.map((option) => <option key={option} value={option}>{optionCopy(option, language)}</option>)}
          </select>
        ) : (
          <div className="number-control">
            <input
              type={setting.type === 'number' ? 'number' : setting.secret ? 'password' : 'text'}
              value={String(value ?? '')}
              min={setting.min}
              max={setting.max}
              disabled={readOnly}
              placeholder={setting.secret ? (language === 'zh' ? '密钥引用 / 环境变量:名称' : 'secretRef / env:NAME') : undefined}
              onChange={(event) =>
                onChange(setting.type === 'number' ? Number(event.target.value) : event.target.value)
              }
            />
            {setting.unit && <span>{setting.unit}</span>}
          </div>
        )}
        {dirty && !readOnly && (
          <button className="reset-setting" onClick={onReset} title={language === 'zh' ? '恢复默认' : 'Reset to default'}>
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

function InfoSection({ appInfo, onToast, language }: { appInfo: AppInfo | null; onToast: (message: string) => void; language: SettingsLanguage }) {
  return (
    <div className="info-grid">
      {infoCards.map((card) => (
        <InfoCardView key={card.title} card={card} appInfo={appInfo} onToast={onToast} language={language} />
      ))}
    </div>
  )
}

function InfoCardView({
  card,
  appInfo,
  onToast,
  language
}: {
  card: InfoCard
  appInfo: AppInfo | null
  onToast: (message: string) => void
  language: SettingsLanguage
}) {
  const copy = infoCopy(card, language)
  const rows = card.rows.map(([key, value], index) => {
    const label = copy.rows[index]?.[0] ?? key
    if (key === 'Version') return [label, appInfo?.version ? `v${appInfo.version}` : value] as [string, string]
    if (key === 'OS') return [label, appInfo?.platform ?? value] as [string, string]
    if (key === 'Data') return [label, appInfo?.dataDir ?? value] as [string, string]
    return [label, copy.rows[index]?.[1] ?? value] as [string, string]
  })

  function action(label: string, message: string, localizedMessage: string) {
    if (label === 'Open data folder' && window.baiying) {
      void window.baiying.openDataDir().then(() => onToast(language === 'zh' ? '已打开数据目录' : 'Data folder opened')).catch(() => onToast(localizedMessage))
      return
    }
    onToast(localizedMessage)
  }

  return (
    <section className={`panel info-card ${card.danger ? 'danger' : ''}`}>
      <div className="info-card-head">
        <span className="info-card-icon">{card.icon}</span>
        <h2>{copy.title}</h2>
      </div>
      <div className="info-rows">
        {rows.map(([key, value]) => (
          <div className="info-row" key={key}>
            <span>{key}</span>
            <strong title={value}>{value}</strong>
          </div>
        ))}
      </div>
      <div className="info-actions">
        {card.actions.map(([label, message], index) => {
          const localized = copy.actions[index] ?? [label, message]
          return (
            <button key={label} className="text-btn" onClick={() => action(label, message, localized[1])}>
              {localized[0]} <ExternalLink size={11} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
