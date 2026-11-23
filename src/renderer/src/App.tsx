import { useEffect, useMemo, useState } from 'react'
import { Command, CornerDownLeft, Search, X } from 'lucide-react'
import { Sidebar, type Section } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './pages/Dashboard'
import type { InstanceDraft } from './pages/LayerWorkspace'
import { LayerManagementPage } from './pages/LayerManagementPage'
import { LineManagementPage } from './pages/LineManagementPage'
import { SurfaceManagementPage } from './pages/SurfaceManagementPage'
import { RunHistoryPage } from './pages/RunHistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import type { SettingsLanguage } from './settingsI18n'
import type { PointInstanceRecord, PointRunRecord } from '../../shared/pointCatalog'
import type { RunHistoryItem } from '../../shared/runHistory'
import {
  layers,
  layerOrder,
  recentRuns,
  type LayerInstance,
  type LayerKey,
  type LayerMeta,
  type RunRecord
} from './data'

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

type Catalog = Record<LayerKey, LayerMeta>

function addInstanceToCatalog(
  current: Catalog,
  layerKey: LayerKey,
  classId: string,
  instance: LayerInstance
): Catalog {
  const layer = current[layerKey]
  return {
    ...current,
    [layerKey]: {
      ...layer,
      totalInstances: layer.totalInstances + 1,
      classes: layer.classes.map((item) =>
        item.id === classId ? { ...item, instances: [...item.instances, instance] } : item
      )
    }
  }
}

function replaceInstanceInCatalog(
  current: Catalog,
  layerKey: LayerKey,
  instance: LayerInstance
): Catalog {
  return {
    ...current,
    [layerKey]: {
      ...current[layerKey],
      classes: current[layerKey].classes.map((item) => ({
        ...item,
        instances: item.instances.map((currentInstance) =>
          currentInstance.id === instance.id ? instance : currentInstance
        )
      }))
    }
  }
}

function mergeLayerSnapshot(
  current: Catalog,
  layerKey: LayerKey,
  instances: PointInstanceRecord[]
): Catalog {
  const layer = current[layerKey]
  return {
    ...current,
    [layerKey]: {
      ...layer,
      classes: layer.classes.map((item) => ({
        ...item,
        instances: instances.filter((instance) => instance.classId === item.id)
      }))
    }
  }
}

function formatRunTime(createdAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

function runToRecord(run: PointRunRecord, layer: 'point' | 'line' | 'surface' | 'body' | 'field'): RunRecord {
  return {
    id: run.id,
    layer,
    classId: run.classId,
    instanceId: run.instanceId,
    status: run.status,
    output: run.output,
    elapsedMs: run.elapsedMs,
    at: formatRunTime(run.createdAt)
  }
}

function createCatalog(): Catalog {
  return Object.fromEntries(
    layerOrder.map((key) => {
      const layer = layers[key]
      return [key, { ...layer, classes: structuredClone(layer.classes) }]
    })
  ) as Catalog
}

const sectionMetaEn: Record<Section, { title: string; eyebrow: string }> = {
  dashboard: { title: 'Overview', eyebrow: 'OVERVIEW' },
  point: { title: 'Point', eyebrow: 'LAYER / POINT' },
  line: { title: 'Line', eyebrow: 'LAYER / LINE' },
  surface: { title: 'Surface', eyebrow: 'LAYER / SURFACE' },
  body: { title: 'Body', eyebrow: 'LAYER / BODY' },
  field: { title: 'Field', eyebrow: 'LAYER / FIELD' },
  runs: { title: 'Run history', eyebrow: 'OBSERVABILITY / RUNS' },
  settings: { title: 'Settings', eyebrow: 'SETTINGS' }
}

function readLanguage(): SettingsLanguage {
  try {
    const saved = JSON.parse(localStorage.getItem('baiying.settings.v1') || 'null') as Record<string, unknown> | null
    return saved?.['general.language'] === 'en-US' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

const sectionMeta: Record<Section, { title: string; eyebrow: string }> = {
  dashboard: { title: '总览', eyebrow: '总览' },
  point: { title: '点层', eyebrow: '工作区 / 点层' },
  line: { title: '线层', eyebrow: '工作区 / 线层' },
  surface: { title: '面层', eyebrow: '工作区 / 面层' },
  body: { title: '体层', eyebrow: '工作区 / 体层' },
  field: { title: '场层', eyebrow: '工作区 / 场层' },
  runs: { title: '运行历史', eyebrow: '工作区 / 运行历史' },
  settings: { title: '设置', eyebrow: '工作区 / 设置' }
}

export default function App() {
  const [section, setSection] = useState<Section>(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (/^(panel\.|panels\b|gestures\b|dock\b|surfaces\b)/.test(hash)) return 'surface'
    return 'dashboard'
  })
  const [query, setQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [language, setLanguage] = useState<SettingsLanguage>(readLanguage)
  const [catalog, setCatalog] = useState<Catalog>(createCatalog)
  const [runs, setRuns] = useState<RunRecord[]>(recentRuns)
  const [history, setHistory] = useState<RunHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!window.baiying) {
      setAppInfo({
        version: '0.1.0',
        electron: 'browser-preview',
        chrome: '—',
        node: '—',
        platform: 'web',
        arch: '—',
        dev: true
      })
      return
    }

    window.baiying.getAppInfo().then(setAppInfo).catch(() => undefined)
    window.baiying
      .getPointCatalog()
      .then((snapshot) => setCatalog((current) => mergeLayerSnapshot(current, 'point', snapshot.instances)))
      .catch((error) => setToast(`点层目录加载失败：${error instanceof Error ? error.message : '未知错误'}`))
    window.baiying
      .getLineCatalog()
      .then((snapshot) => setCatalog((current) => mergeLayerSnapshot(current, 'line', snapshot.instances)))
      .catch((error) => setToast(`线层目录加载失败：${error instanceof Error ? error.message : '未知错误'}`))
    window.baiying
      .getSurfaceCatalog()
      .then((snapshot) => setCatalog((current) => mergeLayerSnapshot(current, 'surface', snapshot.instances)))
      .catch((error) => setToast(`面层目录加载失败：${error instanceof Error ? error.message : '未知错误'}`))
    window.baiying
      .getBodyCatalog()
      .then((snapshot) => setCatalog((current) => mergeLayerSnapshot(current, 'body', snapshot.instances)))
      .catch((error) => setToast(`体层目录加载失败：${error instanceof Error ? error.message : '未知错误'}`))
    window.baiying
      .getFieldCatalog()
      .then((snapshot) => setCatalog((current) => mergeLayerSnapshot(current, 'field', snapshot.instances)))
      .catch((error) => setToast(`场层目录加载失败：${error instanceof Error ? error.message : '未知错误'}`))
    Promise.all([
      window.baiying.getPointRuns(8),
      window.baiying.getLineRuns(8),
      window.baiying.getSurfaceRuns(8),
      window.baiying.getBodyRuns(8),
      window.baiying.getFieldRuns(8)
    ])
      .then(([pointRuns, lineRuns, surfaceRuns, bodyRuns, fieldRuns]) => {
        const realRuns = [
          ...pointRuns.map((run) => runToRecord(run, 'point')),
          ...lineRuns.map((run) => runToRecord(run, 'line')),
          ...surfaceRuns.map((run) => runToRecord(run, 'surface')),
          ...bodyRuns.map((run) => runToRecord(run, 'body')),
          ...fieldRuns.map((run) => runToRecord(run, 'field'))
        ]
        if (!realRuns.length) return
        setRuns((current) => [
          ...realRuns,
          ...current.filter((run) => !['point', 'line', 'surface', 'body', 'field'].includes(run.layer))
        ])
      })
      .catch(() => undefined)
    window.baiying
      .getRunHistory(100)
      .then(setHistory)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    function applyFontScale() {
      try {
        const saved = JSON.parse(localStorage.getItem('baiying.settings.v1') || 'null') as Record<string, unknown> | null
        const raw = Number(saved?.['general.fontScale'] ?? 100)
        const scale = Number.isFinite(raw) ? Math.min(1.4, Math.max(0.8, raw / 100)) : 1
        document.documentElement.style.setProperty('--font-scale', String(scale))
      } catch {
        document.documentElement.style.setProperty('--font-scale', '1')
      }
    }
    applyFontScale()
    window.addEventListener('baiying-settings-changed', applyFontScale)
    return () => window.removeEventListener('baiying-settings-changed', applyFontScale)
  }, [])

  useEffect(() => {
    const sync = () => setLanguage(readLanguage())
    window.addEventListener('baiying-settings-changed', sync)
    return () => window.removeEventListener('baiying-settings-changed', sync)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const counts = useMemo(
    () =>
      Object.fromEntries(
        layerOrder.map((key) => [key, { classes: catalog[key].totalClasses, instances: catalog[key].totalInstances }])
      ) as Record<LayerKey, { classes: number; instances: number }>,
    [catalog]
  )

  const paletteItems = useMemo(() => {
    const isEn = language === 'en'
    const items: { section: Section; label: string; hint: string }[] = [
      { section: 'dashboard', label: isEn ? 'Overview' : '总览', hint: isEn ? 'Workspace home' : '工作台首页' },
      ...layerOrder.map((key) => ({
        section: key as Section,
        label: isEn ? catalog[key].en : catalog[key].label,
        hint: isEn ? `${catalog[key].totalClasses} classes · ${catalog[key].totalInstances} instances` : `${catalog[key].totalClasses} 类 · ${catalog[key].totalInstances} 实例`
      })),
      { section: 'runs', label: isEn ? 'Run history' : '运行历史', hint: isEn ? `${history.length} real runs` : `${history.length} 条真实运行记录` },
      { section: 'settings', label: isEn ? 'Settings' : '设置', hint: isEn ? 'Workspace policy and run defaults' : '工作区策略与运行默认值' }
    ]
    const q = paletteQuery.trim().toLowerCase()
    return q ? items.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q)) : items
  }, [catalog, history.length, language, paletteQuery])

  function navigate(next: Section) {
    setSection(next)
    setQuery('')
    setPaletteOpen(false)
    setPaletteQuery('')
  }

  function hasBackend(layerKey: LayerKey): boolean {
    return layerKey === 'point' || layerKey === 'line' || layerKey === 'surface' || layerKey === 'body' || layerKey === 'field'
  }

  async function createInstance(
    layerKey: LayerKey,
    classId: string,
    draft: InstanceDraft
  ): Promise<LayerInstance | null> {
    if (hasBackend(layerKey) && window.baiying) {
      const input = {
        classId,
        name: draft.name,
        description: draft.description,
        params: draft.params
      }
      const record =
        layerKey === 'point'
          ? await window.baiying.createPointInstance(input)
          : layerKey === 'line'
            ? await window.baiying.createLineInstance(input)
            : layerKey === 'surface'
              ? await window.baiying.createSurfaceInstance(input)
              : layerKey === 'body'
                ? await window.baiying.createBodyInstance(input)
                : await window.baiying.createFieldInstance(input)
      setCatalog((current) => addInstanceToCatalog(current, layerKey, classId, record))
      return record
    }

    const stamp = Date.now()
    const instance: LayerInstance = {
      id: `${classId}.${draft.name.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')}@r1`,
      classId,
      name: draft.name.trim(),
      description: draft.description.trim() || '新建实例',
      params: draft.params,
      rev: 1,
      status: 'draft',
      createdAt: stamp,
      updatedAt: stamp
    }
    setCatalog((current) => addInstanceToCatalog(current, layerKey, classId, instance))
    return instance
  }

  async function updateInstance(
    layerKey: LayerKey,
    classId: string,
    instanceId: string,
    patch: InstanceDraft
  ): Promise<LayerInstance | null> {
    if (hasBackend(layerKey) && window.baiying) {
      const update = { name: patch.name, description: patch.description, params: patch.params }
      const record =
        layerKey === 'point'
          ? await window.baiying.updatePointInstance(instanceId, update)
          : layerKey === 'line'
            ? await window.baiying.updateLineInstance(instanceId, update)
            : layerKey === 'surface'
              ? await window.baiying.updateSurfaceInstance(instanceId, update)
              : layerKey === 'body'
                ? await window.baiying.updateBodyInstance(instanceId, update)
                : await window.baiying.updateFieldInstance(instanceId, update)
      setCatalog((current) => replaceInstanceInCatalog(current, layerKey, record))
      return record
    }

    const layer = catalog[layerKey]
    const targetClass = layer.classes.find((item) => item.id === classId)
    const currentInstance = targetClass?.instances.find((item) => item.id === instanceId)
    if (!currentInstance) return null
    const updated: LayerInstance = {
      ...currentInstance,
      name: patch.name.trim(),
      description: patch.description.trim(),
      params: patch.params,
      rev: currentInstance.rev + 1,
      updatedAt: Date.now()
    }
    setCatalog((current) => replaceInstanceInCatalog(current, layerKey, updated))
    return updated
  }

  async function archiveInstance(layerKey: LayerKey, instanceId: string): Promise<boolean> {
    if (hasBackend(layerKey) && window.baiying) {
      const record =
        layerKey === 'point'
          ? await window.baiying.archivePointInstance(instanceId)
          : layerKey === 'line'
            ? await window.baiying.archiveLineInstance(instanceId)
            : layerKey === 'surface'
              ? await window.baiying.archiveSurfaceInstance(instanceId)
              : layerKey === 'body'
                ? await window.baiying.archiveBodyInstance(instanceId)
                : await window.baiying.archiveFieldInstance(instanceId)
      setCatalog((current) => replaceInstanceInCatalog(current, layerKey, record))
      return true
    }
    const instance = catalog[layerKey].classes.flatMap((item) => item.instances).find((item) => item.id === instanceId)
    if (!instance) return false
    const updated: LayerInstance = { ...instance, status: 'archived', rev: instance.rev + 1, updatedAt: Date.now() }
    setCatalog((current) => replaceInstanceInCatalog(current, layerKey, updated))
    return true
  }

  async function restoreInstance(layerKey: LayerKey, instanceId: string): Promise<boolean> {
    if (hasBackend(layerKey) && window.baiying) {
      const record =
        layerKey === 'point'
          ? await window.baiying.restorePointInstance(instanceId)
          : layerKey === 'line'
            ? await window.baiying.restoreLineInstance(instanceId)
            : layerKey === 'surface'
              ? await window.baiying.restoreSurfaceInstance(instanceId)
              : layerKey === 'body'
                ? await window.baiying.restoreBodyInstance(instanceId)
                : await window.baiying.restoreFieldInstance(instanceId)
      setCatalog((current) => replaceInstanceInCatalog(current, layerKey, record))
      return true
    }
    const instance = catalog[layerKey].classes.flatMap((item) => item.instances).find((item) => item.id === instanceId)
    if (!instance) return false
    const updated: LayerInstance = { ...instance, status: 'active', rev: instance.rev + 1, updatedAt: Date.now() }
    setCatalog((current) => replaceInstanceInCatalog(current, layerKey, updated))
    return true
  }

  async function duplicateInstance(
    layerKey: LayerKey,
    instanceId: string
  ): Promise<LayerInstance | null> {
    if (hasBackend(layerKey) && window.baiying) {
      const record =
        layerKey === 'point'
          ? await window.baiying.duplicatePointInstance(instanceId)
          : layerKey === 'line'
            ? await window.baiying.duplicateLineInstance(instanceId)
            : layerKey === 'surface'
              ? await window.baiying.duplicateSurfaceInstance(instanceId)
              : layerKey === 'body'
                ? await window.baiying.duplicateBodyInstance(instanceId)
                : await window.baiying.duplicateFieldInstance(instanceId)
      const source = catalog[layerKey].classes
        .flatMap((item) => item.instances)
        .find((item) => item.id === instanceId)
      const classId = record.classId ?? source?.classId ?? ''
      setCatalog((current) => addInstanceToCatalog(current, layerKey, classId, record))
      return record
    }

    const layer = catalog[layerKey]
    const sourceClass = layer.classes.find((item) => item.instances.some((instance) => instance.id === instanceId))
    const source = sourceClass?.instances.find((item) => item.id === instanceId)
    if (!source || !sourceClass) return null
    const stamp = Date.now()
    const copy: LayerInstance = {
      ...source,
      id: `${source.id.replace(/@r\d+$/, '')}-copy-${String(stamp).slice(-5)}@r1`,
      name: `${source.name} 副本`,
      status: 'draft',
      rev: 1,
      createdAt: stamp,
      updatedAt: stamp,
      params: { ...(source.params ?? {}) }
    }
    setCatalog((current) => addInstanceToCatalog(current, layerKey, sourceClass.id, copy))
    return copy
  }

  function recordRun(run: RunRecord) {
    setRuns((current) => [run, ...current].slice(0, 20))
    if (run.layer === 'point' || run.layer === 'line' || run.layer === 'surface' || run.layer === 'body' || run.layer === 'field') {
      const item: RunHistoryItem = {
        id: run.id,
        layer: run.layer,
        classId: run.classId,
        instanceId: run.instanceId,
        status: run.status,
        output: run.output,
        elapsedMs: run.elapsedMs,
        createdAt: run.createdAt ?? Date.now()
      }
      setHistory((current) => [item, ...current].slice(0, 200))
    }
  }

  async function refreshHistory() {
    if (!window.baiying) return
    setHistoryLoading(true)
    try {
      setHistory(await window.baiying.getRunHistory(100))
    } catch (error) {
      setToast(`运行历史刷新失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setHistoryLoading(false)
    }
  }

  const meta = (language === 'en' ? sectionMetaEn : sectionMeta)[section]
  const activeLayer = layerOrder.includes(section as LayerKey) ? catalog[section as LayerKey] : null

  return (
    <div className="app-shell">
      <Sidebar active={section} onNavigate={navigate} counts={counts} runCount={history.length} version={appInfo?.version} language={language} />
      <div className="app-main">
        <Topbar
          title={meta.title}
          eyebrow={meta.eyebrow}
          query={query}
          onQueryChange={setQuery}
          onPalette={() => setPaletteOpen(true)}
          language={language}
        />
        <main className="main-scroll">
          <div className="content" key={section}>
            {section === 'dashboard' && (
              <Dashboard appInfo={appInfo} runs={runs} onNavigate={navigate} />
            )}
            {section === 'runs' && (
              <RunHistoryPage
                items={history}
                loading={historyLoading}
                onRefresh={refreshHistory}
                onNavigate={navigate}
              />
            )}
            {section === 'settings' && (
              <SettingsPage appInfo={appInfo} onToast={setToast} onNavigate={navigate} language={language} />
            )}
            {activeLayer && section === 'line' && (
              <LineManagementPage
                layer={activeLayer}
                query={query}
                onToast={setToast}
                onCreateInstance={createInstance}
                onUpdateInstance={updateInstance}
                onArchiveInstance={archiveInstance}
                onRestoreInstance={restoreInstance}
                onDuplicateInstance={duplicateInstance}
                onRunComplete={recordRun}
                onNavigate={(next) => navigate(next)}
              />
            )}
            {activeLayer && section === 'surface' && (
              <SurfaceManagementPage
                layer={activeLayer}
                query={query}
                onToast={setToast}
                onCreateInstance={createInstance}
                onUpdateInstance={updateInstance}
                onArchiveInstance={archiveInstance}
                onRestoreInstance={restoreInstance}
                onDuplicateInstance={duplicateInstance}
                onRunComplete={recordRun}
                onNavigate={(next) => navigate(next)}
                pointLayer={catalog.point}
                lineLayer={catalog.line}
              />
            )}
            {activeLayer && section !== 'line' && section !== 'surface' && (
              <LayerManagementPage
                layer={activeLayer}
                query={query}
                onToast={setToast}
                onCreateInstance={createInstance}
                onUpdateInstance={updateInstance}
                onArchiveInstance={archiveInstance}
                onRestoreInstance={restoreInstance}
                onDuplicateInstance={duplicateInstance}
                onRunComplete={recordRun}
                runs={runs}
              />
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div className="toast">
          <span className="toast-dot" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)}><X size={13} /></button>
        </div>
      )}

      {paletteOpen && (
        <div className="palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette" onClick={(event) => event.stopPropagation()}>
            <div className="palette-search">
              <Search size={17} />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder={language === 'en' ? 'Jump to page, layer or settings…' : '跳到页面、层或设置…'}
              />
              <span className="kbd">ESC</span>
            </div>
            <div className="palette-list">
              {paletteItems.map((item) => (
                <button key={item.section} className="palette-item" onClick={() => navigate(item.section)}>
                  <div className="palette-icon"><Command size={15} /></div>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </div>
                  <CornerDownLeft size={14} className="palette-enter" />
                </button>
              ))}
              {paletteItems.length === 0 && <div className="palette-empty">{language === 'en' ? 'No matches' : '没有匹配项'}</div>}
            </div>
            <div className="palette-footer">
              <span><span className="kbd">↑</span><span className="kbd">↓</span> {language === 'en' ? 'Navigate' : '导航'}</span>
              <span><span className="kbd">↵</span> {language === 'en' ? 'Open' : '打开'}</span>
              <span>{language === 'en' ? 'Baiying command palette' : '百应命令面板'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
