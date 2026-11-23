import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowUpRight,
  CircleDot,
  Copy,
  Grip,
  Keyboard,
  LayoutGrid,
  PanelsTopLeft,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react'
import type { LayerClass, LayerInstance, LayerMeta, RunRecord } from '../data'
import type { InstanceDraft } from './instanceDraft'
import { gesturePath, type DockTab, type DockTile, type GestureBinding, type PanelClass, type PanelInstance } from '../surfaceData'
import { loadSurfaceResources, saveSurfaceResources, resetSurfaceResources } from '../surfaceResourceStore'
import { recognize } from '../../../shared/gestureRecognizer'

interface Props {
  layer: LayerMeta
  query: string
  onToast: (message: string) => void
  onCreateInstance: (layerKey: LayerMeta['key'], classId: string, draft: InstanceDraft) => Promise<LayerInstance | null>
  onUpdateInstance: (layerKey: LayerMeta['key'], classId: string, instanceId: string, patch: InstanceDraft) => Promise<LayerInstance | null>
  onArchiveInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<boolean>
  onRestoreInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<boolean>
  onDuplicateInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<LayerInstance | null>
  onRunComplete: (run: RunRecord) => void
  onNavigate: (section: 'point' | 'line') => void
  pointLayer: LayerMeta
  lineLayer: LayerMeta
}

type SurfaceView = 'surfaces' | 'panels' | 'gestures' | 'hotkeys' | 'dock'

const statusLabel: Record<string, string> = { active: '运行中', draft: '草稿', archived: '已归档' }
const PANEL_MODES = ['right', 'left', 'bottom', 'floating', 'modal', 'sheet']

type ResourceKind = 'panel-class' | 'panel-instance' | 'gesture' | 'dock-tab' | 'dock-tile'
interface ResourceEditorState { kind: ResourceKind; mode: 'create' | 'edit'; id?: string; parentId?: string }
interface ResourceField { key: string; label: string; placeholder?: string; multiline?: boolean; options?: string[] }

const resourceFields: Record<ResourceKind, ResourceField[]> = {
  'panel-class': [
    { key: 'id', label: 'PanelClass ID', placeholder: 'panel.my-panel' },
    { key: 'name', label: '名称', placeholder: 'My Panel' },
    { key: 'icon', label: '图标', placeholder: '◧' },
    { key: 'group', label: 'Group', placeholder: 'inspect' },
    { key: 'version', label: 'Version', placeholder: '1.0.0' },
    { key: 'status', label: 'Status', options: ['active', 'draft', 'archived'] },
    { key: 'content', label: 'Content', placeholder: 'surface.panel.content' },
    { key: 'desc', label: '说明', multiline: true },
    { key: 'modes', label: 'Modes（逗号分隔）', placeholder: 'right, floating' },
    { key: 'regions', label: 'Regions', placeholder: 'header, body, footer' },
    { key: 'states', label: 'States', placeholder: 'ready, empty, error' },
    { key: 'behaviors', label: 'Behaviors', placeholder: 'resizable, collapsible' },
    { key: 'a11y', label: 'A11y', placeholder: 'role=complementary, Esc close' }
  ],
  'panel-instance': [
    { key: 'label', label: 'Instance Label', placeholder: 'point' },
    { key: 'content', label: 'Content', placeholder: 'surface.inspector.point' },
    { key: 'mode', label: 'Mode', options: ['right', 'left', 'bottom', 'floating', 'modal', 'sheet'] },
    { key: 'width', label: 'Width', placeholder: '380' },
    { key: 'state', label: 'State', options: ['ready', 'loading', 'empty', 'error', 'streaming', 'needsApproval', 'blocked'] },
    { key: 'data', label: 'Data Binding', placeholder: 'selectedPoint + params' },
    { key: 'actions', label: 'Actions（逗号分隔）', placeholder: 'saveParams, reset' }
  ],
  gesture: [
    { key: 'pattern', label: 'Pattern', placeholder: 'LDR' },
    { key: 'name', label: '名称', placeholder: '打开 GitHub' },
    { key: 'kind', label: 'Kind', placeholder: 'flow 或 point' },
    { key: 'target', label: 'Target', placeholder: 'inst.site-github@r1' },
    { key: 'effect', label: 'Effect', placeholder: 'L2' },
    { key: 'desc', label: '说明', multiline: true }
  ],
  'dock-tab': [
    { key: 'id', label: 'Tab ID', placeholder: 'common' },
    { key: 'name', label: '名称', placeholder: '常用' }
  ],
  'dock-tile': [
    { key: 'tab', label: 'Tab ID', placeholder: 'common' },
    { key: 'id', label: 'Tile ID', placeholder: 'my-tile' },
    { key: 'name', label: '名称', placeholder: 'My Tile' },
    { key: 'icon', label: 'Icon', placeholder: '▣' },
    { key: 'kind', label: 'Kind', placeholder: 'flow 或 point' },
    { key: 'hotkey', label: 'Hotkey', placeholder: '1' },
    { key: 'target', label: 'Target', placeholder: 'inst.site-github@r1' },
    { key: 'sub', label: 'Sub Label', placeholder: 'inst.site-github' },
    { key: 'effect', label: 'Effect', placeholder: 'L2' }
  ]
}

function splitResourceList(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

function resourceSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || `item-${Date.now()}`
}



/** 触发器服务返回的绑定（与 GestureBinding 同构，多了主进程 id） */
interface TriggerRecord {
  id: string
  source: 'hotkey' | 'gesture'
  pattern: string
  name?: string
  effect?: string
  targetKind: 'point' | 'line'
  targetId: string
  enabled: boolean
  note: string
  fireCount: number
  lastFiredAt: number | null
}

type GestureBindingView = GestureBinding & { id?: string }

interface GestureTarget {
  id: string
  kind: 'point' | 'line'
  label: string
  sub: string
  atomRef: string
  href: string
}

interface GestureEditorState {
  editPattern?: string
  pattern: string
  name: string
  effect: string
  desc: string
  targetKind: 'point' | 'line'
  targetId: string
  search: string
}

function gestureTargetsFor(layer: LayerMeta, kind: 'point' | 'line'): GestureTarget[] {
  return layer.classes.flatMap((classItem) => classItem.instances.map((instance) => ({
    id: `${kind}:${classItem.id}/${instance.id}`,
    kind,
    label: `${classItem.name} / ${instance.name}`,
    sub: `${classItem.id} / ${instance.id}`,
    atomRef: instance.id.includes('@r') ? instance.id : `${instance.id}@r${instance.rev}`,
    href: `${kind}-management`
  })))
}

function parseHash(): { view: SurfaceView; id: string } {
  const [head, tail] = window.location.hash.replace(/^#/, '').split('/')
  if (head.startsWith('panel.')) return { view: 'panels', id: decodeURIComponent(head) }
  const view: SurfaceView = head === 'panels' || head === 'gestures' || head === 'hotkeys' || head === 'dock' ? head : 'surfaces'
  return { view, id: decodeURIComponent(tail ?? '') }
}

export function SurfaceManagementPage({
  layer, query, onToast, onCreateInstance, onUpdateInstance,
  onArchiveInstance, onRestoreInstance, onDuplicateInstance, onRunComplete, onNavigate, pointLayer, lineLayer
}: Props) {
  const [resources, setResources] = useState(loadSurfaceResources)
  const { panelClasses, dockTabs, dockTiles } = resources
  // 手势/热键绑定唯一数据源是主进程的触发器服务（trigger-bindings.json）
  const [gestureBindings, setGestureBindings] = useState<GestureBindingView[]>([])
  const [hotkeyBindings, setHotkeyBindings] = useState<TriggerRecord[]>([])
  const [hotkeyCombos, setHotkeyCombos] = useState<string[]>([])
  const [hotkeyFailures, setHotkeyFailures] = useState<string[]>([])
  const [hotkeyCombo, setHotkeyCombo] = useState('')
  const [hotkeyTargetId, setHotkeyTargetId] = useState('')
  const [hotkeyNote, setHotkeyNote] = useState('')
  const [hotkeyPattern, setHotkeyPattern] = useState('')
  const initialHash = useMemo(parseHash, [])
  const [view, setView] = useState<SurfaceView>(initialHash.view)
  const [surfaceClassId, setSurfaceClassId] = useState(layer.classes[0]?.id ?? '')
  const [surfaceInstanceId, setSurfaceInstanceId] = useState('')
  const [panelId, setPanelId] = useState(initialHash.view === 'panels' && initialHash.id ? initialHash.id : panelClasses[0].id)
  const [panelInstanceLabel, setPanelInstanceLabel] = useState('')
  const [gesturePattern, setGesturePattern] = useState(initialHash.view === 'gestures' && initialHash.id ? initialHash.id : 'LDR')
  const [dockTabId, setDockTabId] = useState(initialHash.view === 'dock' && initialHash.id ? initialHash.id : dockTabs[0].id)
  const [dockTileId, setDockTileId] = useState('')
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; instance?: LayerInstance } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParams, setFormParams] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [resourceEditor, setResourceEditor] = useState<ResourceEditorState | null>(null)
  const [resourceForm, setResourceForm] = useState<Record<string, string>>({})
  const [gestureRecorder, setGestureRecorder] = useState<{ editPattern?: string } | null>(null)
  const [recordPoints, setRecordPoints] = useState<Array<{ x: number; y: number }>>([])
  const [drawing, setDrawing] = useState(false)
  const [gestureEditor, setGestureEditor] = useState<GestureEditorState | null>(null)
  const [panelMode, setPanelMode] = useState('right')
  const [panelWidth, setPanelWidth] = useState(380)
  const [panelViewState, setPanelViewState] = useState('ready')
  const [panelAnatomy, setPanelAnatomy] = useState(false)

  const surfaceClass = layer.classes.find((item) => item.id === surfaceClassId) ?? layer.classes[0]
  const surfaceInstance = surfaceClass?.instances.find((item) => item.id === surfaceInstanceId) ?? null
  const panelClass = panelClasses.find((item) => item.id === panelId) ?? panelClasses[0]
  const panelInstance = panelClass?.instances.find((item) => item.label === panelInstanceLabel) ?? panelClass?.instances[0]
  const gesture = gestureBindings.find((item) => item.pattern === gesturePattern) ?? gestureBindings[0]
  const dockTab = dockTabs.find((item) => item.id === dockTabId) ?? dockTabs[0]
  const visibleTiles = dockTiles.filter((item) => item.tab === dockTab.id)
  const dockTile = visibleTiles.find((item) => item.id === dockTileId) ?? visibleTiles[0]
  const gestureTargets = useMemo(() => [...gestureTargetsFor(pointLayer, 'point'), ...gestureTargetsFor(lineLayer, 'line')], [pointLayer, lineLayer])
  const selectedGestureTarget = gesture ? gestureTargets.find((target) => target.id === gesture.targetId) ?? gestureTargets.find((target) => target.atomRef === gesture.target || target.sub.endsWith(gesture.target)) : undefined
  const filteredSurfaceClasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return layer.classes.filter((item) => !q || [item.id, item.name, item.description].join(' ').toLowerCase().includes(q))
  }, [layer.classes, query])
  const filteredPanelClasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return panelClasses.filter((item) => !q || [item.id, item.name, item.desc, item.group, item.content, ...item.instances.map((instance) => `${instance.label} ${instance.content}`)].join(' ').toLowerCase().includes(q))
  }, [panelClasses, query])

  useEffect(() => {
    const onHash = () => {
      const next = parseHash()
      setView(next.view)
      if (next.view === 'panels' && next.id) setPanelId(next.id)
      if (next.view === 'gestures' && next.id) setGesturePattern(next.id)
      if (next.view === 'dock' && next.id) setDockTabId(next.id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => { saveSurfaceResources(resources) }, [resources])

  const gesturesBootstrapped = useRef(false)
  useEffect(() => {
    if (gesturesBootstrapped.current) return
    gesturesBootstrapped.current = true
    void bootstrapGestures()
  }, [])

  // 主进程每次派发后推事件过来：不用轮询，触发次数立刻刷新
  useEffect(() => {
    const unsubscribe = window.baiying?.onTriggerFired?.(() => {
      void reloadTriggers()
    })
    return () => {
      unsubscribe?.()
    }
  }, [])
  useEffect(() => {
    if (panelInstance) {
      setPanelMode(panelInstance.mode)
      setPanelWidth(panelInstance.width)
      setPanelViewState(panelInstance.state)
    } else if (panelClass) {
      setPanelMode(panelClass.modes[0] ?? 'right')
      setPanelWidth(380)
      setPanelViewState(panelClass.states[0] ?? 'ready')
    }
  }, [panelInstance?.label, panelClass?.id])

  function changeView(next: SurfaceView) {
    setView(next)
    const suffix =
      next === 'panels'
        ? `panels/${panelId}`
        : next === 'gestures'
          ? `gestures/${gesturePattern}`
          : next === 'hotkeys'
            ? 'hotkeys'
            : next === 'dock'
              ? `dock/${dockTab.id}`
              : 'surfaces'
    window.history.replaceState(null, '', `#${suffix}`)
  }
  function selectPanel(item: PanelClass) {
    setPanelId(item.id)
    setPanelInstanceLabel('')
    window.history.replaceState(null, '', `#panels/${encodeURIComponent(item.id)}`)
  }
  function selectGesture(item: GestureBinding) {
    setGesturePattern(item.pattern)
    window.history.replaceState(null, '', `#gestures/${encodeURIComponent(item.pattern)}`)
  }
  function selectDockTab(id: string) {
    setDockTabId(id)
    setDockTileId('')
    window.history.replaceState(null, '', `#dock/${encodeURIComponent(id)}`)
  }
  function selectDockTile(tile: DockTile) {
    setDockTileId(tile.id)
    window.history.replaceState(null, '', `#dock/${encodeURIComponent(dockTab.id)}/${encodeURIComponent(tile.id)}`)
  }
  function openCreate() {
    if (!surfaceClass) return
    setEditor({ mode: 'create' })
    setFormName('')
    setFormDescription('')
    setFormParams(Object.fromEntries(surfaceClass.params.map((param) => [param.key, param.defaultValue ?? ''])))
  }
  function openEdit(instance: LayerInstance) {
    if (!surfaceClass) return
    setEditor({ mode: 'edit', instance })
    setFormName(instance.name)
    setFormDescription(instance.description)
    setFormParams({
      ...Object.fromEntries(surfaceClass.params.map((param) => [param.key, param.defaultValue ?? ''])),
      ...(instance.params ?? {})
    })
  }
  async function submitEditor() {
    if (!surfaceClass || !formName.trim() || saving) return
    setSaving(true)
    try {
      if (editor?.mode === 'edit' && editor.instance) {
        const updated = await onUpdateInstance(layer.key, surfaceClass.id, editor.instance.id, {
          name: formName.trim(), description: formDescription.trim(), params: formParams
        })
        if (updated) { setSurfaceInstanceId(updated.id); onToast(`实例已保存 · rev ${updated.rev}`) }
      } else {
        const created = await onCreateInstance(layer.key, surfaceClass.id, {
          name: formName.trim(), description: formDescription.trim(), params: formParams
        })
        if (created) { setSurfaceInstanceId(created.id); onToast(`实例已创建 · ${created.name}`) }
      }
      setEditor(null)
    } catch (error) { onToast(`保存失败：${error instanceof Error ? error.message : '未知错误'}`) }
    finally { setSaving(false) }
  }
  async function runSurfaceInstance() {
    if (!surfaceClass || !surfaceInstance || running) return
    setRunning(true)
    try {
      const result = await window.baiying.runSurface({ classId: surfaceClass.id, instanceId: surfaceInstance.id })
      const record: RunRecord = {
        id: result.runId, layer: 'surface', classId: surfaceClass.id, instanceId: surfaceInstance.id,
        status: result.ok ? 'ok' : 'warn', output: result.output, elapsedMs: result.elapsedMs,
        at: '刚刚', createdAt: new Date(result.at).getTime()
      }
      setLastRun(record)
      onRunComplete(record)
      onToast(`运行成功 · ${result.output}`)
    } catch (error) { onToast(`运行失败：${error instanceof Error ? error.message : '未知错误'}`) }
    finally { setRunning(false) }
  }
  async function duplicateSurface(instance: LayerInstance) {
    if (!surfaceClass) return
    const copy = await onDuplicateInstance(layer.key, instance.id)
    if (copy) { setSurfaceInstanceId(copy.id); onToast(`已复制 · ${copy.name}`) }
  }
  async function archiveSurface(instance: LayerInstance) {
    if (!surfaceClass) return
    const archived = instance.status === 'archived'
    const ok = archived ? await onRestoreInstance(layer.key, instance.id) : await onArchiveInstance(layer.key, instance.id)
    if (ok) { setSurfaceInstanceId(instance.id); onToast(archived ? '实例已恢复' : '实例已归档') }
  }


  function openResource(kind: ResourceKind, mode: 'create' | 'edit', id?: string, parentId?: string) {
    let form: Record<string, string> = {}
    if (kind === 'panel-class') {
      const item = mode === 'edit' ? panelClasses.find((panel) => panel.id === id) : undefined
      form = item ? {
        id: item.id, name: item.name, icon: item.icon, group: item.group, version: item.version, status: item.status ?? 'active', content: item.content, desc: item.desc,
        modes: item.modes.join(', '), regions: item.regions.join(', '), states: item.states.join(', '),
        behaviors: item.behaviors.join(', '), a11y: item.a11y.join(', ')
      } : { id: '', name: '', icon: '◧', group: 'custom', version: '1.0.0', status: 'active', content: 'surface.custom', desc: '', modes: 'right', regions: 'header, body, footer', states: 'ready', behaviors: 'resizable', a11y: '' }
    } else if (kind === 'panel-instance') {
      const owner = panelClasses.find((panel) => panel.id === parentId) ?? panelClass
      const item = mode === 'edit' ? owner?.instances.find((instance) => instance.label === id) : undefined
      form = item ? {
        label: item.label, content: item.content, mode: item.mode, width: String(item.width),
        state: item.state, data: item.data, actions: item.actions.join(', ')
      } : { label: '', content: owner?.content ?? '', mode: owner?.modes[0] ?? 'right', width: '380', state: 'ready', data: '', actions: '' }
    } else if (kind === 'gesture') {
      const item = mode === 'edit' ? gestureBindings.find((binding) => binding.pattern === id) : undefined
      form = item ? { pattern: item.pattern, name: item.name, kind: item.kind, target: item.target, effect: item.effect, desc: item.desc } : { pattern: '', name: '', kind: 'flow', target: '', effect: 'L1', desc: '' }
    } else if (kind === 'dock-tab') {
      const item = mode === 'edit' ? dockTabs.find((tab) => tab.id === id) : undefined
      form = item ? { id: item.id, name: item.name } : { id: '', name: '' }
    } else {
      const owner = dockTabs.find((tab) => tab.id === parentId) ?? dockTab
      const item = mode === 'edit' ? dockTiles.find((tile) => tile.id === id) : undefined
      form = item ? { tab: item.tab, id: item.id, name: item.name, icon: item.icon, kind: item.kind, hotkey: item.hotkey, target: item.target, sub: item.sub, effect: item.effect } : { tab: owner?.id ?? dockTab?.id ?? 'common', id: '', name: '', icon: '▣', kind: 'flow', hotkey: '', target: '', sub: '', effect: 'L1' }
    }
    setResourceForm(form)
    setResourceEditor({ kind, mode, id, parentId })
  }

  function saveResource() {
    if (!resourceEditor) return
    const value = (key: string) => (resourceForm[key] ?? '').trim()
    if (resourceEditor.kind === 'panel-class') {
      const id = resourceEditor.mode === 'edit' ? resourceEditor.id ?? value('id') : resourceSlug(value('id') || value('name'))
      if (!value('name')) { onToast('PanelClass 名称不能为空'); return }
      if (resourceEditor.mode === 'create' && panelClasses.some((item) => item.id === id)) { onToast('PanelClass ID 已存在'); return }
      const item: PanelClass = {
        id, name: value('name'), icon: value('icon') || '◧', group: value('group') || 'custom', desc: value('desc'),
        modes: splitResourceList(value('modes')), regions: splitResourceList(value('regions')),
        states: splitResourceList(value('states')), behaviors: splitResourceList(value('behaviors')),
        a11y: splitResourceList(value('a11y')), content: value('content') || `surface.${id.replace(/^panel\./, '')}.content`,
        version: value('version') || '1.0.0', status: value('status') || 'active',
        instances: resourceEditor.mode === 'edit' ? panelClasses.find((panel) => panel.id === id)?.instances ?? [] : []
      }
      setResources((current) => ({ ...current, panelClasses: resourceEditor.mode === 'edit' ? current.panelClasses.map((panel) => panel.id === id ? item : panel) : [...current.panelClasses, item] }))
      setPanelId(id); setPanelInstanceLabel(''); setView('panels')
      onToast(resourceEditor.mode === 'edit' ? 'PanelClass 已更新' : 'PanelClass 已创建')
    } else if (resourceEditor.kind === 'panel-instance') {
      const owner = panelClasses.find((panel) => panel.id === (resourceEditor.parentId ?? panelClass?.id))
      if (!owner) return
      if (!value('label')) { onToast('PanelInstance label 不能为空'); return }
      if (resourceEditor.mode === 'create' && owner.instances.some((item) => item.label === value('label'))) { onToast('PanelInstance label 已存在'); return }
      const item: PanelInstance = {
        label: value('label'), content: value('content'), mode: value('mode') || 'right', width: Number(value('width')) || 380,
        state: value('state') || 'ready', data: value('data'), actions: splitResourceList(value('actions')),
        rev: resourceEditor.mode === 'edit' ? (owner.instances.find((instance) => instance.label === resourceEditor.id)?.rev ?? 1) + 1 : 1,
        status: resourceEditor.mode === 'edit' ? (owner.instances.find((instance) => instance.label === resourceEditor.id)?.status ?? 'draft') : 'draft'
      }
      setResources((current) => ({ ...current, panelClasses: current.panelClasses.map((panel) => panel.id !== owner.id ? panel : ({
        ...panel,
        instances: resourceEditor.mode === 'edit' ? panel.instances.map((instance) => instance.label === resourceEditor.id ? item : instance) : [...panel.instances, item]
      })) }))
      setPanelId(owner.id); setPanelInstanceLabel(item.label); setView('panels')
      onToast(resourceEditor.mode === 'edit' ? 'PanelInstance 已更新 · rev +1' : 'PanelInstance 已创建')
    } else if (resourceEditor.kind === 'gesture') {
      const pattern = value('pattern').toUpperCase()
      if (!pattern || !value('name')) { onToast('Gesture pattern 和名称必填'); return }
      if (resourceEditor.mode === 'create' && gestureBindings.some((binding) => binding.pattern === pattern)) { onToast('Gesture pattern 已存在'); return }
      const item: GestureBinding = { pattern, name: value('name'), kind: value('kind') === 'point' ? 'point' : 'flow', target: value('target'), effect: value('effect') || 'L0', desc: value('desc') }
      setResources((current) => ({ ...current, gestures: resourceEditor.mode === 'edit' ? current.gestures.map((binding) => binding.pattern === resourceEditor.id ? item : binding) : [...current.gestures, item] }))
      setGesturePattern(pattern); setView('gestures')
      onToast(resourceEditor.mode === 'edit' ? 'GestureBinding 已更新' : 'GestureBinding 已创建')
    } else if (resourceEditor.kind === 'dock-tab') {
      const id = resourceEditor.mode === 'edit' ? resourceEditor.id ?? value('id') : resourceSlug(value('id') || value('name'))
      if (!value('name')) { onToast('Tab 名称不能为空'); return }
      if (resourceEditor.mode === 'create' && dockTabs.some((tab) => tab.id === id)) { onToast('Tab ID 已存在'); return }
      const item: DockTab = { id, name: value('name') }
      setResources((current) => ({ ...current, dockTabs: resourceEditor.mode === 'edit' ? current.dockTabs.map((tab) => tab.id === id ? item : tab) : [...current.dockTabs, item] }))
      setDockTabId(id); setDockTileId(''); setView('dock')
      onToast(resourceEditor.mode === 'edit' ? 'Dock Tab 已更新' : 'Dock Tab 已创建')
    } else {
      const tab = value('tab') || dockTab?.id
      if (!tab || !dockTabs.some((item) => item.id === tab)) { onToast('请选择有效 Tab ID'); return }
      if (!value('name')) { onToast('Tile 名称不能为空'); return }
      const id = resourceEditor.mode === 'edit' ? resourceEditor.id ?? value('id') : resourceSlug(value('id') || value('name'))
      if (resourceEditor.mode === 'create' && dockTiles.some((tile) => tile.id === id)) { onToast('Tile ID 已存在'); return }
      const item: DockTile = { id, tab, name: value('name'), icon: value('icon') || '▣', kind: value('kind') === 'point' ? 'point' : 'flow', hotkey: value('hotkey'), target: value('target'), sub: value('sub'), effect: value('effect') || 'L1' }
      setResources((current) => ({ ...current, dockTiles: resourceEditor.mode === 'edit' ? current.dockTiles.map((tile) => tile.id === id ? item : tile) : [...current.dockTiles, item] }))
      setDockTabId(tab); setDockTileId(id); setView('dock')
      onToast(resourceEditor.mode === 'edit' ? 'Dock Tile 已更新' : 'Dock Tile 已创建')
    }
    setResourceEditor(null)
  }

  function deletePanelClass() {
    if (!panelClass || !window.confirm(`删除 ${panelClass.name} 及其 ${panelClass.instances.length} 个实例？`)) return
    setResources((current) => ({ ...current, panelClasses: current.panelClasses.filter((item) => item.id !== panelClass.id) }))
    setPanelId(''); setPanelInstanceLabel(''); onToast('PanelClass 已删除')
  }
  function duplicatePanelInstance() {
    if (!panelClass || !panelInstance) return
    const copy: PanelInstance = { ...panelInstance, label: `${panelInstance.label} 副本`, rev: 1, status: 'draft', actions: [...panelInstance.actions] }
    setResources((current) => ({ ...current, panelClasses: current.panelClasses.map((item) => item.id === panelClass.id ? { ...item, instances: [...item.instances, copy] } : item) }))
    setPanelInstanceLabel(copy.label)
    onToast('PanelInstance 已复制 · r1 draft')
  }
  function deletePanelInstance() {
    if (!panelClass || !panelInstance || !window.confirm(`删除 PanelInstance ${panelInstance.label}？`)) return
    setResources((current) => ({ ...current, panelClasses: current.panelClasses.map((item) => item.id === panelClass.id ? { ...item, instances: item.instances.filter((instance) => instance.label !== panelInstance.label) } : item) }))
    setPanelInstanceLabel(''); onToast('PanelInstance 已删除')
  }
  async function deleteGesture() {
    if (!gesture || !window.confirm(`删除手势 ${gesture.pattern}？`)) return
    const record = gestureBindings.find((item) => item.pattern === gesture.pattern)
    if (record?.id && window.baiying?.removeTrigger) await window.baiying.removeTrigger(record.id)
    await reloadTriggers()
    setGesturePattern(''); onToast('GestureBinding 已删除')
  }
  function deleteDockTab() {
    if (!dockTab || dockTabs.length <= 1 || !window.confirm(`删除 Tab ${dockTab.name} 及其 ${visibleTiles.length} 个 Tile？`)) return
    setResources((current) => ({ ...current, dockTabs: current.dockTabs.filter((item) => item.id !== dockTab.id), dockTiles: current.dockTiles.filter((item) => item.tab !== dockTab.id) }))
    setDockTabId(''); setDockTileId(''); onToast('Dock Tab 已删除')
  }
  function deleteDockTile() {
    if (!dockTile || !window.confirm(`删除 Tile ${dockTile.name}？`)) return
    setResources((current) => ({ ...current, dockTiles: current.dockTiles.filter((item) => item.id !== dockTile.id) }))
    setDockTileId(''); onToast('Dock Tile 已删除')
  }
  function moveDockTile(direction: -1 | 1) {
    if (!dockTile) return
    setResources((current) => {
      const index = current.dockTiles.findIndex((item) => item.id === dockTile.id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.dockTiles.length) return current
      if (current.dockTiles[target].tab !== dockTile.tab) return current
      const tiles = [...current.dockTiles]
      const [moving] = tiles.splice(index, 1)
      tiles.splice(target, 0, moving)
      return { ...current, dockTiles: tiles }
    })
  }
  function resetReferenceData() {
    if (!window.confirm('重置面板/手势/启动坞为参考数据？')) return
    setResources(resetSurfaceResources())
    setPanelId(''); setPanelInstanceLabel(''); setGesturePattern(''); setDockTabId(''); setDockTileId('')
    onToast('面层参考数据已重置')
  }

  function openGestureRecorder(editPattern?: string) {
    setRecordPoints([])
    setDrawing(false)
    setGestureRecorder({ editPattern })
  }

  function openGestureEditor(editPattern?: string, patternOverride?: string) {
    const current = gestureBindings.find((item) => item.pattern === editPattern)
    const target = current ? gestureTargets.find((item) => item.id === current.targetId) ?? gestureTargets.find((item) => item.atomRef === current.target) : undefined
    setGestureEditor({
      editPattern,
      pattern: patternOverride ?? current?.pattern ?? '',
      name: current?.name ?? '',
      effect: current?.effect ?? 'L1',
      desc: current?.desc ?? '',
      targetKind: target?.kind ?? (current?.kind === 'point' ? 'point' : 'line'),
      targetId: target?.id ?? '',
      search: ''
    })
  }

  /** 主进程绑定 → 视图模型；目标解析不到时保留原始 id（显示成 placeholder） */
  function toGestureBinding(record: TriggerRecord): GestureBindingView {
    const match = gestureTargets.find(
      (target) => target.atomRef === record.targetId && target.kind === record.targetKind
    )
    return {
      id: record.id,
      pattern: record.pattern,
      name: record.name || record.pattern,
      kind: record.targetKind === 'line' ? 'flow' : 'point',
      target: record.targetId,
      effect: record.effect || 'L2',
      desc: record.note || '',
      targetKind: record.targetKind,
      targetId: match?.id ?? record.targetId,
      targetLabel: match?.label ?? record.targetId,
      href: match?.href ?? `${record.targetKind}-management`
    }
  }

  async function reloadTriggers() {
    if (!window.baiying?.getTriggers) return
    try {
      const payload = (await window.baiying.getTriggers()) as {
        bindings: TriggerRecord[]
        combos?: string[]
        failures?: string[]
      }
      setGestureBindings(payload.bindings.filter((item) => item.source === 'gesture').map(toGestureBinding))
      setHotkeyBindings(payload.bindings.filter((item) => item.source === 'hotkey'))
      setHotkeyCombos(payload.combos ?? [])
      setHotkeyFailures(payload.failures ?? [])
    } catch {
      // 读取失败保持原样，由用户操作触发重试
    }
  }

  /** 在输入框里按下组合键 → 拼成 "Ctrl+Alt+Space" */
  function captureHotkey(event: ReactKeyboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const parts: string[] = []
    if (event.ctrlKey) parts.push('Ctrl')
    if (event.altKey) parts.push('Alt')
    if (event.shiftKey) parts.push('Shift')
    if (event.metaKey) parts.push('Meta')
    const key = event.key
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key)
    }
    setHotkeyCombo(parts.join('+'))
  }

  async function addHotkeyBinding() {
    if (!hotkeyCombo) { onToast('先在输入框里按一个组合键'); return }
    const target = gestureTargets.find((item) => item.id === hotkeyTargetId)
    if (!target) { onToast('请选择目标实例'); return }
    if (!window.baiying?.addTrigger) { onToast('当前环境不支持'); return }
    const result = (await window.baiying.addTrigger({
      source: 'hotkey',
      pattern: hotkeyCombo,
      targetKind: target.kind,
      targetId: target.atomRef,
      note: hotkeyNote.trim(),
      name: hotkeyCombo
    })) as { ok?: boolean; message?: string }
    if (!result?.ok) { onToast(`添加失败：${result?.message ?? '未知错误'}`); return }
    setHotkeyCombo('')
    setHotkeyNote('')
    await reloadTriggers()
    onToast(`已绑定 ${hotkeyCombo} → ${target.label}`)
  }

  async function removeHotkeyBinding(id: string) {
    if (!window.baiying?.removeTrigger) return
    await window.baiying.removeTrigger(id)
    await reloadTriggers()
    onToast('热键绑定已删除')
  }

  /** 首次启动：把 localStorage 里的旧手势迁到主进程，之后就以主进程为准 */
  async function bootstrapGestures() {
    if (!window.baiying?.addTrigger) {
      setGestureBindings(resources.gestures ?? [])
      return
    }

    const MIGRATION_KEY = 'baiying.gestures.migrated.v1'
    const legacy = resources.gestures ?? []
    if (!localStorage.getItem(MIGRATION_KEY) && legacy.length) {
      let migrated = 0
      let skipped = 0
      for (const item of legacy) {
        const kind = item.targetKind ?? (item.kind === 'flow' ? 'line' : 'point')
        const exists = gestureTargets.some((target) => target.atomRef === item.target && target.kind === kind)
        if (!exists) {
          skipped += 1
          continue
        }
        const result = (await window.baiying.addTrigger({
          source: 'gesture',
          pattern: item.pattern,
          targetKind: kind,
          targetId: item.target,
          note: item.desc,
          name: item.name,
          effect: item.effect
        })) as { ok?: boolean }
        if (result?.ok) migrated += 1
        else skipped += 1
      }
      localStorage.setItem(MIGRATION_KEY, '1')
      setResources((current) => ({ ...current, gestures: [] }))
      if (migrated || skipped) {
        onToast(`已迁移 ${migrated} 个手势绑定${skipped ? `，跳过 ${skipped} 个悬空目标` : ''}`)
      }
    }

    await reloadTriggers()
  }

  function recordPoint(event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number; t: number } {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * 600) / rect.width,
      y: ((event.clientY - rect.top) * 230) / rect.height,
      t: Date.now()
    }
  }

  /** 用手绘轨迹真跑一次触发器（和热键走同一条 dispatch） */
  async function testTrigger() {
    const result = recognize(recordPoints)
    if (!result.directions) {
      onToast('先画一个手势')
      return
    }
    if (!window.baiying?.dispatchGesture) {
      onToast('当前环境不支持手势派发')
      return
    }
    try {
      const payload = (await window.baiying.dispatchGesture(recordPoints)) as {
        directions?: string
        records?: { status: string; output: string }[]
      }
      const first = payload?.records?.[0]
      if (!first) {
        onToast(`手势 ${payload?.directions ?? result.directions} 识别成功，但没有匹配的绑定`)
      } else if (first.status === 'ok') {
        onToast(`手势 ${payload?.directions ?? result.directions} → 已触发`)
      } else {
        onToast(`手势 ${payload?.directions ?? result.directions} → ${first.output}`)
      }
    } catch (error) {
      onToast(`派发失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  function finishRecording() {
    if (!drawing) return
    setDrawing(false)
    const pattern = recognize(recordPoints).directions
    if (!pattern) { onToast('请画出至少一段方向'); return }
    const editPattern = gestureRecorder?.editPattern
    setGestureRecorder(null)
    openGestureEditor(editPattern, pattern)
  }

  async function saveGestureBinding() {
    if (!gestureEditor) return
    const target = gestureTargets.find((item) => item.id === gestureEditor.targetId)
    const pattern = gestureEditor.pattern.trim().toUpperCase()
    if (!pattern || !gestureEditor.name.trim()) { onToast('pattern 和名称必填'); return }
    if (!target) { onToast('请选择点层或线层目标实例'); return }
    if (gestureBindings.some((item) => item.pattern === pattern && item.pattern !== gestureEditor.editPattern)) {
      onToast('Gesture pattern 已存在')
      return
    }
    if (!window.baiying?.addTrigger) { onToast('当前环境不支持'); return }

    // 编辑时 pattern 或目标可能变，绑定 id 会跟着变：先删旧的
    if (gestureEditor.editPattern) {
      const previous = gestureBindings.find((item) => item.pattern === gestureEditor.editPattern)
      if (previous?.id) await window.baiying.removeTrigger(previous.id)
    }

    const result = (await window.baiying.addTrigger({
      source: 'gesture',
      pattern,
      targetKind: target.kind,
      targetId: target.atomRef,
      note: gestureEditor.desc.trim(),
      name: gestureEditor.name.trim(),
      effect: gestureEditor.effect
    })) as { ok?: boolean; message?: string }

    if (!result?.ok) {
      onToast(`保存失败：${result?.message ?? '未知错误'}`)
      return
    }

    await reloadTriggers()
    setGesturePattern(pattern)
    window.history.replaceState(null, '', `#gestures/${encodeURIComponent(pattern)}`)
    setGestureEditor(null)
    setView('gestures')
    onToast(gestureEditor.editPattern ? 'GestureBinding 已更新' : 'GestureBinding 已创建')
  }

  function openGestureTarget(target: GestureTarget) {
    onNavigate(target.kind)
  }
  const tabItems: { id: SurfaceView; label: string; count: string; icon: typeof LayoutGrid }[] = [
    { id: 'surfaces', label: '目录', count: `${layer.classes.length}/${layer.classes.reduce((n, c) => n + c.instances.length, 0)}`, icon: LayoutGrid },
    { id: 'panels', label: '面板', count: `${panelClasses.length}/${panelClasses.reduce((n, c) => n + c.instances.length, 0)}`, icon: PanelsTopLeft },
    { id: 'gestures', label: '手势', count: String(gestureBindings.length), icon: Grip },
    { id: 'hotkeys', label: '热键', count: String(hotkeyBindings.length), icon: Keyboard },
    { id: 'dock', label: '启动坞', count: String(dockTiles.length), icon: Sparkles }
  ]

  return (
    <div className="page surface-manager">
      <header className="surface-head">
        <div><div className="eyebrow">SURFACE LAYER / MANAGEMENT</div><div className="surface-title-row"><div className="surface-title-icon"><PanelsTopLeft size={23} /></div><div><h1>面层管理</h1><p>面负责承载与交互：目录、面板、手势、启动坞。面不拥有业务，只提供入口与呈现。</p></div></div></div>
        <div className="surface-head-actions"><button className="btn ghost" onClick={() => onToast('面层资源加载接口待接入')}><DownloadIcon /> 导入 Pack</button><button className="btn primary" onClick={openCreate}><Plus size={14} /> 新建实例</button></div>
      </header>

      <div className="surface-stat-grid">
        <div className="point-stat"><span>SurfaceClass</span><strong>{layer.totalClasses}</strong><em>{layer.classes.length} loaded</em></div>
        <div className="point-stat"><span>SurfaceInstance</span><strong>{layer.classes.reduce((n, c) => n + c.instances.length, 0)}</strong><em>all surfaces</em></div>
        <div className="point-stat"><span>PanelClass</span><strong>{panelClasses.length}</strong><em>{panelClasses.reduce((n, c) => n + c.instances.length, 0)} instances</em></div>
        <div className="point-stat"><span>Dock Tiles</span><strong>{dockTiles.length}</strong><em>{gestureBindings.length} gestures</em></div>
      </div>

      <div className="surface-tabs">
        {tabItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)}><Icon size={13} /><span>{item.label}</span><em>{item.count}</em></button> })}
      </div>

      <div className="surface-layout">
        <aside className="surface-sidebar">
          {view === 'surfaces' ? <SurfaceClassList classes={filteredSurfaceClasses} selectedId={surfaceClass?.id} onSelect={(item) => { setSurfaceClassId(item.id); setSurfaceInstanceId('') }} /> : null}
          {view === 'panels' ? <PanelClassList classes={filteredPanelClasses} selectedId={panelClass?.id} onSelect={selectPanel} /> : null}
          {view === 'gestures' ? <GestureList bindings={gestureBindings} selected={gesture?.pattern} onSelect={selectGesture} /> : null}
          {view === 'hotkeys' ? (
            <div className="surface-list">
              {hotkeyBindings.length === 0 && <div className="surface-list-item">还没有热键绑定</div>}
              {hotkeyBindings.map((binding) => (
                <button
                  key={binding.id}
                  className={`surface-list-item ${hotkeyPattern === binding.pattern ? 'active' : ''}`}
                  onClick={() => setHotkeyPattern(binding.pattern)}
                >
                  <span className="surface-list-icon">⌘</span>
                  <div><strong>{binding.pattern}</strong><code>{binding.targetId}</code></div>
                  <em>{binding.fireCount}</em>
                </button>
              ))}
            </div>
          ) : null}
          {view === 'dock' ? <DockTabList tabs={dockTabs} tiles={dockTiles} selected={dockTab?.id} onSelect={selectDockTab} /> : null}
        </aside>

        <main className="surface-main">
          {view === 'panels' && (
            <div className="surface-action-bar">
              <button className="btn primary" onClick={() => openResource('panel-class', 'create')}><Plus size={12} /> 新建 PanelClass</button>
              <button className="btn ghost" onClick={() => openResource('panel-instance', 'create', undefined, panelClass?.id)} disabled={!panelClass}><Plus size={12} /> 新建实例</button>
              <button className="btn ghost" onClick={() => panelClass && openResource('panel-class', 'edit', panelClass.id)} disabled={!panelClass}><Pencil size={12} /> 编辑类</button>
              <button className="btn ghost" onClick={() => panelClass && panelInstance && openResource('panel-instance', 'edit', panelInstance.label, panelClass.id)} disabled={!panelInstance}><Pencil size={12} /> 编辑实例</button>
              <button className="btn ghost" onClick={duplicatePanelInstance} disabled={!panelInstance}>⧉ 复制实例</button>
              <button className="btn ghost" onClick={deletePanelInstance} disabled={!panelInstance}><X size={12} /> 删除实例</button>
              <button className="btn ghost danger-text" onClick={deletePanelClass} disabled={!panelClass}>删除类</button>
              <button className="text-btn" onClick={resetReferenceData}>重置参考数据</button>
            </div>
          )}
          {view === 'gestures' && (
            <div className="surface-action-bar">
              <button className="btn primary" onClick={() => openGestureRecorder()}><Plus size={12} /> 新建手势</button>
              <button className="btn ghost" onClick={() => gesture && openGestureEditor(gesture.pattern)} disabled={!gesture}><Pencil size={12} /> 编辑</button>
              <button className="btn ghost" onClick={() => gesture && openGestureRecorder(gesture.pattern)} disabled={!gesture}>● 重录</button>
              <button className="btn ghost" onClick={deleteGesture} disabled={!gesture}><X size={12} /> 删除</button>
              <button className="text-btn" onClick={resetReferenceData}>重置参考数据</button>
            </div>
          )}
          {view === 'hotkeys' && (
            <div className="surface-action-bar">
              <button className="btn ghost" onClick={() => void reloadTriggers()}><RefreshCw size={12} /> 刷新钩子状态</button>
              <span className="text-btn">已挂载 {hotkeyCombos.length} 个组合{hotkeyFailures.length ? ` · ${hotkeyFailures.length} 个失败` : ''}</span>
            </div>
          )}
          {view === 'dock' && (
            <div className="surface-action-bar">
              <button className="btn primary" onClick={() => openResource('dock-tile', 'create', undefined, dockTab?.id)}><Plus size={12} /> 新建 Tile</button>
              <button className="btn ghost" onClick={() => openResource('dock-tab', 'create')}><Plus size={12} /> 新建 Tab</button>
              <button className="btn ghost" onClick={() => dockTile && openResource('dock-tile', 'edit', dockTile.id, dockTab?.id)} disabled={!dockTile}><Pencil size={12} /> 编辑 Tile</button>
              <button className="btn ghost" onClick={() => dockTab && openResource('dock-tab', 'edit', dockTab.id)}><Pencil size={12} /> 编辑 Tab</button>
              <button className="btn ghost" onClick={() => moveDockTile(-1)} disabled={!dockTile}>← 左移</button>
              <button className="btn ghost" onClick={() => moveDockTile(1)} disabled={!dockTile}>右移 →</button>
              <button className="btn ghost" onClick={deleteDockTile} disabled={!dockTile}><X size={12} /> 删除 Tile</button>
              <button className="btn ghost danger-text" onClick={deleteDockTab} disabled={!dockTab}>删除 Tab</button>
              <button className="text-btn" onClick={resetReferenceData}>重置参考数据</button>
            </div>
          )}
          {view === 'surfaces' ? (
            <SurfaceCatalogView classItem={surfaceClass} selectedInstance={surfaceInstance} lastRun={lastRun} running={running} onSelectInstance={setSurfaceInstanceId} onRun={runSurfaceInstance} onEdit={openEdit} onDuplicate={duplicateSurface} onArchive={archiveSurface} onNew={openCreate} />
          ) : view === 'panels' ? (
            <PanelView classItem={panelClass} instance={panelInstance} mode={panelMode} width={panelWidth} viewState={panelViewState} anatomy={panelAnatomy} onModeChange={setPanelMode} onWidthChange={setPanelWidth} onViewStateChange={setPanelViewState} onAnatomyChange={setPanelAnatomy} onSelectInstance={setPanelInstanceLabel} onToast={onToast} />
          ) : view === 'gestures' ? (
            <GestureView gesture={gesture} bindings={gestureBindings} target={selectedGestureTarget} targets={gestureTargets} onOpenTarget={openGestureTarget} onSelectPattern={selectGesture} onToast={onToast} />
          ) : view === 'hotkeys' ? (
            <div className="hotkey-view">
              <div className="surface-hero">
                <span className="surface-hero-icon gesture">⌘</span>
                <div>
                  <div className="panel-eyebrow">TRIGGER · HOTKEY</div>
                  <h2>全局热键 → 实例</h2>
                  <p>按下组合键直接跑一个点层或线层实例。钩子由主进程常驻，和手势共用同一条 dispatch。</p>
                </div>
                <div className="surface-hero-actions">
                  <span className={`status-pill ${hotkeyCombos.length ? 'active' : 'draft'}`}>
                    {hotkeyCombos.length ? `${hotkeyCombos.length} 个组合已挂载` : '钩子未启动'}
                  </span>
                </div>
              </div>

              <div className="hotkey-form">
                <label>组合键
                  <input readOnly value={hotkeyCombo || '点这里，然后按下组合键'} onKeyDown={captureHotkey} />
                </label>
                <label>目标实例
                  <select value={hotkeyTargetId} onChange={(event) => setHotkeyTargetId(event.target.value)}>
                    <option value="">选择点层或线层实例…</option>
                    {gestureTargets.map((target) => (
                      <option key={target.id} value={target.id}>{target.kind === 'point' ? '点' : '线'} · {target.label}</option>
                    ))}
                  </select>
                </label>
                <label>备注
                  <input value={hotkeyNote} onChange={(event) => setHotkeyNote(event.target.value)} placeholder="可选" />
                </label>
                <button className="btn primary" onClick={() => void addHotkeyBinding()} disabled={!hotkeyCombo || !hotkeyTargetId}>
                  <Plus size={12} /> 绑定
                </button>
              </div>

              {hotkeyFailures.length > 0 && (
                <div className="hotkey-failures">
                  <strong>注册失败 {hotkeyFailures.length} 条</strong>
                  {hotkeyFailures.map((failure) => <code key={failure}>{failure}</code>)}
                </div>
              )}

              <div className="point-table-wrap">
                <table className="point-catalog-table">
                  <thead><tr><th>组合键</th><th>目标</th><th>挂载</th><th>触发</th><th>备注</th><th /></tr></thead>
                  <tbody>
                    {hotkeyBindings.length === 0 && (
                      <tr><td colSpan={6}><span className="text-btn">还没有热键绑定，用上面的表单添加一个</span></td></tr>
                    )}
                    {hotkeyBindings.map((binding) => (
                      <tr key={binding.id} className={hotkeyPattern === binding.pattern ? 'on' : ''} onClick={() => setHotkeyPattern(binding.pattern)}>
                        <td><strong>{binding.pattern}</strong></td>
                        <td><code>{binding.targetKind} · {binding.targetId}</code></td>
                        <td>{hotkeyCombos.includes(binding.pattern) ? <span className="status-pill active">已挂载</span> : <span className="status-pill draft">未挂载</span>}</td>
                        <td>{binding.fireCount}</td>
                        <td>{binding.note || '—'}</td>
                        <td><button className="text-btn" onClick={(event) => { event.stopPropagation(); void removeHotkeyBinding(binding.id) }}>删除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <DockView tab={dockTab} tabs={dockTabs} allTiles={dockTiles} tiles={visibleTiles} selected={dockTile} onSelect={selectDockTile} onToast={onToast} />
          )}
        </main>

        <aside className="surface-inspector">
          {view === 'surfaces' && surfaceClass ? <SurfaceInspector classItem={surfaceClass} instance={surfaceInstance} lastRun={lastRun} onRun={runSurfaceInstance} onEdit={openEdit} onDuplicate={duplicateSurface} onArchive={archiveSurface} onNew={openCreate} /> : null}
          {view === 'panels' && panelClass ? <PanelInspector classItem={panelClass} instance={panelInstance} /> : null}
          {view === 'gestures' && gesture ? <GestureInspector gesture={gesture} target={selectedGestureTarget} onOpenTarget={openGestureTarget} /> : null}
          {view === 'dock' && dockTile ? <DockInspector tab={dockTab} tile={dockTile} /> : null}
        </aside>
      </div>

      {gestureRecorder && (
        <div className="modal-overlay" onClick={() => setGestureRecorder(null)}>
          <div className="modal point-editor gesture-recorder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><div className="panel-eyebrow">GESTURE RECORDER</div><h2>{gestureRecorder.editPattern ? '重录手势' : '新建手势 · 录制'}</h2><p>按住左键在画布上画手势；抬手后自动识别方向序列，再选择点层或线层目标。</p></div><button className="icon-btn" onClick={() => setGestureRecorder(null)}><X size={16} /></button></div>
            <div className="gesture-record-pad" onPointerDown={(event) => { event.preventDefault(); try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic pointer */ } setDrawing(true); setRecordPoints([recordPoint(event)]) }} onPointerMove={(event) => { if (!drawing) return; const point = recordPoint(event); setRecordPoints((points) => [...points, point]) }} onPointerUp={finishRecording} onPointerCancel={() => setDrawing(false)}>
              <div className="gesture-record-grid" />
              <svg viewBox="0 0 600 230" preserveAspectRatio="none"><polyline points={recordPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {!recordPoints.length && <div className="gesture-record-hint"><b>Gesture Pad</b><span>按住左键画手势</span></div>}
              <div className="gesture-record-readout">Recognized <strong>{recognize(recordPoints).directions || '—'}</strong></div>
            </div>
            <div className="gesture-record-foot"><span>方向序列：{recognize(recordPoints).directions || '—'}</span><span>fuzzy ≤ 1 segment</span><button className="text-btn" onClick={() => { void testTrigger() }}>试触发</button><button className="text-btn" onClick={() => setRecordPoints([])}>清空</button></div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setGestureRecorder(null)}>取消</button><span className="gesture-record-tip">画完会自动进入绑定编辑</span></div>
          </div>
        </div>
      )}
      {gestureEditor && (
        <div className="modal-overlay" onClick={() => setGestureEditor(null)}>
          <div className="modal point-editor gesture-binding-editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><div className="panel-eyebrow">GESTURE BINDING</div><h2>{gestureEditor.editPattern ? '编辑手势绑定' : '新建手势绑定'}</h2><p>选择真实 PointInstance 或 FlowInstance；保存后手势映射状态变为 mapped。</p></div><button className="icon-btn" onClick={() => setGestureEditor(null)}><X size={16} /></button></div>
            <div className="modal-form">
              <div className="param-form-grid">
                <label>Pattern<input value={gestureEditor.pattern} onChange={(event) => setGestureEditor((current) => current ? { ...current, pattern: event.target.value.toUpperCase() } : current)} /></label>
                <label>名称<input value={gestureEditor.name} onChange={(event) => setGestureEditor((current) => current ? { ...current, name: event.target.value } : current)} placeholder="例如：打开 GitHub" /></label>
                <label>Effect<select value={gestureEditor.effect} onChange={(event) => setGestureEditor((current) => current ? { ...current, effect: event.target.value } : current)}><option>L0</option><option>L1</option><option>L2</option></select></label>
                <label className="full-field">说明<textarea rows={2} value={gestureEditor.desc} onChange={(event) => setGestureEditor((current) => current ? { ...current, desc: event.target.value } : current)} /></label>
              </div>
              <div className="gesture-target-tabs"><button className={gestureEditor.targetKind === 'point' ? 'active' : ''} onClick={() => setGestureEditor((current) => current ? { ...current, targetKind: 'point', targetId: '', search: '' } : current)}>点层实例 · {gestureTargets.filter((target) => target.kind === 'point').length}</button><button className={gestureEditor.targetKind === 'line' ? 'active' : ''} onClick={() => setGestureEditor((current) => current ? { ...current, targetKind: 'line', targetId: '', search: '' } : current)}>线层实例 · {gestureTargets.filter((target) => target.kind === 'line').length}</button></div>
              <input className="gesture-target-search" value={gestureEditor.search} onChange={(event) => setGestureEditor((current) => current ? { ...current, search: event.target.value } : current)} placeholder="搜索实例 / class / flow…" />
              <div className="gesture-target-list">
                {gestureTargets.filter((target) => target.kind === gestureEditor.targetKind).filter((target) => !gestureEditor.search.trim() || [target.label, target.sub, target.atomRef].join(' ').toLowerCase().includes(gestureEditor.search.toLowerCase())).map((target) => <button key={target.id} className={gestureEditor.targetId === target.id ? 'active' : ''} onClick={() => setGestureEditor((current) => current ? { ...current, targetId: target.id } : current)}><span className={`line-kind-pill ${target.kind}`}>{target.kind}</span><div><strong>{target.label}</strong><code>{target.sub}</code></div><em>{target.atomRef}</em></button>)}
              </div>
              <div className="gesture-target-summary">{gestureEditor.targetId ? (() => { const target = gestureTargets.find((item) => item.id === gestureEditor.targetId); return target ? <><span className={`line-kind-pill ${target.kind}`}>{target.kind}</span><strong>{target.label}</strong><code>{target.atomRef}</code></> : null })() : <span className="placeholder">尚未选择目标 · 保存前请选择点层或线层实例</span>}</div>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setGestureEditor(null)}>取消</button><button className="btn primary" onClick={saveGestureBinding}>保存绑定</button></div>
          </div>
        </div>
      )}
      {resourceEditor && (
        <div className="modal-overlay" onClick={() => setResourceEditor(null)}><div className="modal point-editor resource-editor" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><div className="panel-eyebrow">{resourceEditor.mode === 'edit' ? 'EDIT RESOURCE' : 'NEW RESOURCE'} · {resourceEditor.kind}</div><h2>{resourceEditor.mode === 'edit' ? '编辑' : '新建'} {resourceEditor.kind === 'panel-class' ? 'PanelClass' : resourceEditor.kind === 'panel-instance' ? 'PanelInstance' : resourceEditor.kind === 'gesture' ? 'GestureBinding' : resourceEditor.kind === 'dock-tab' ? 'Dock Tab' : 'Dock Tile'}</h2></div><button className="icon-btn" onClick={() => setResourceEditor(null)}><X size={16} /></button></div>
          <div className="modal-form"><div className="param-form-grid">{resourceFields[resourceEditor.kind].map((field) => <label key={field.key} className={field.multiline ? 'full-field' : ''}>{field.label}{field.multiline ? <textarea rows={3} value={resourceForm[field.key] ?? ''} onChange={(event) => setResourceForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /> : field.options ? <select value={resourceForm[field.key] ?? ''} onChange={(event) => setResourceForm((current) => ({ ...current, [field.key]: event.target.value }))}>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input value={resourceForm[field.key] ?? ''} onChange={(event) => setResourceForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} disabled={resourceEditor.mode === 'edit' && field.key === 'id'} />}</label>)}</div></div>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setResourceEditor(null)}>取消</button><button className="btn primary" onClick={saveResource}>保存</button></div>
        </div></div>
      )}
      {editor && surfaceClass && (
        <div className="modal-overlay" onClick={() => setEditor(null)}><div className="modal point-editor" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><div className="panel-eyebrow">{editor.mode === 'edit' ? 'EDIT SURFACE INSTANCE' : 'NEW SURFACE INSTANCE'}</div><h2>{editor.mode === 'edit' ? '编辑面层实例' : '新建面层实例'}</h2><p>类：<code>{surfaceClass.id}</code></p></div><button className="icon-btn" onClick={() => setEditor(null)}><X size={16} /></button></div>
          <div className="modal-form"><label>实例名称<input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="例如：启动坞 · 开发" autoFocus /></label><label>说明<textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={2} /></label><div className="form-section-label">实例参数</div><div className="param-form-grid">{surfaceClass.params.map((param) => <label key={param.key}>{param.label}<input value={formParams[param.key] ?? ''} onChange={(event) => setFormParams((current) => ({ ...current, [param.key]: event.target.value }))} placeholder={param.defaultValue || param.description} /><span className="param-key">{param.key}{param.required ? ' · required' : ''}</span></label>)}</div></div>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setEditor(null)}>取消</button><button className="btn primary" disabled={!formName.trim() || saving} onClick={() => void submitEditor()}>{saving ? '保存中…' : editor.mode === 'edit' ? '保存并升 revision' : '创建实例'}</button></div>
        </div></div>
      )}
    </div>
  )
}

function DownloadIcon() { return <span className="surface-download-icon">↓</span> }

function SurfaceClassList({ classes, selectedId, onSelect }: { classes: LayerClass[]; selectedId?: string; onSelect: (item: LayerClass) => void }) {
  return <><div className="surface-pane-head"><span>SurfaceClass · 面层类</span><em>{classes.length}</em></div><div className="surface-list">{classes.map((item) => <button key={item.id} className={`surface-list-item ${selectedId === item.id ? 'active' : ''}`} onClick={() => onSelect(item)}><span className="surface-list-icon">▦</span><div><strong>{item.name}</strong><code>{item.id}</code></div><em>{item.instances.length}</em></button>)}</div></>
}

function PanelClassList({ classes, selectedId, onSelect }: { classes: PanelClass[]; selectedId?: string; onSelect: (item: PanelClass) => void }) {
  return <><div className="surface-pane-head"><span>PanelClass · 面板类</span><em>{classes.length}</em></div><div className="surface-list">{classes.map((item) => <button key={item.id} className={`surface-list-item ${selectedId === item.id ? 'active' : ''}`} onClick={() => onSelect(item)}><span className="surface-list-icon">{item.icon}</span><div><strong>{item.name}</strong><code>{item.id}</code></div><em>{item.instances.length}</em></button>)}</div></>
}

function GestureList({ bindings, selected, onSelect }: { bindings: GestureBinding[]; selected?: string; onSelect: (item: GestureBinding) => void }) {
  return <><div className="surface-pane-head"><span>GestureBinding · 手势</span><em>{bindings.length}</em></div><div className="surface-list">{bindings.map((item) => <button key={item.pattern} className={`surface-list-item ${selected === item.pattern ? 'active' : ''}`} onClick={() => onSelect(item)}><span className="surface-list-icon gesture-icon">G</span><div><strong>{item.pattern} · {item.name}</strong><code>{item.target}</code></div><em>{item.effect}</em></button>)}</div></>
}

function DockTabList({ tabs, tiles, selected, onSelect }: { tabs: DockTab[]; tiles: DockTile[]; selected?: string; onSelect: (id: string) => void }) {
  return <><div className="surface-pane-head"><span>Launch Dock · Tabs</span><em>{tabs.length}</em></div><div className="surface-list">{tabs.map((item) => <button key={item.id} className={`surface-list-item ${selected === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)}><span className="surface-list-icon">⌘</span><div><strong>{item.name}</strong><code>{item.id}</code></div><em>{tiles.filter((tile) => tile.tab === item.id).length}</em></button>)}</div></>
}

function paramsText(instance: LayerInstance): string {
  const entries = Object.entries(instance.params ?? {})
  return entries.length ? entries.slice(0, 3).map(([key, value]) => `${key}=${value || '—'}`).join(' · ') : '未设置参数'
}

function SurfaceCatalogView({ classItem, selectedInstance, lastRun, running, onSelectInstance, onRun, onEdit, onDuplicate, onArchive, onNew }: {
  classItem?: LayerClass
  selectedInstance: LayerInstance | null
  lastRun: RunRecord | null
  running: boolean
  onSelectInstance: (id: string) => void
  onRun: () => void
  onEdit: (instance: LayerInstance) => void
  onDuplicate: (instance: LayerInstance) => void
  onArchive: (instance: LayerInstance) => void
  onNew: () => void
}) {
  if (!classItem) return <div className="point-empty"><PanelsTopLeft size={22} /><strong>没有面层类</strong></div>
  return (
    <div className="surface-catalog-view">
      <div className="surface-hero"><span className="surface-hero-icon">▦</span><div><div className="panel-eyebrow">SURFACECLASS · {classItem.family}</div><h2>{classItem.name}</h2><p>{classItem.description}</p></div><div className="surface-hero-actions"><button className="btn ghost" onClick={onNew}><Plus size={13} /> 实例</button><button className="btn primary" onClick={onRun} disabled={!selectedInstance || running}><Play size={13} /> 运行</button></div></div>
      <div className="surface-instance-table">
        <div className="surface-table-head"><span>实例</span><span>参数摘要</span><span>状态</span><span>操作</span></div>
        {classItem.instances.map((instance) => <div key={instance.id} className={`surface-instance-row ${selectedInstance?.id === instance.id ? 'active' : ''}`} onClick={() => onSelectInstance(instance.id)}><div><span className={`point-status-dot ${instance.status}`} /><strong>{instance.name}</strong><code>{instance.id}</code></div><span>{paramsText(instance)}</span><span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span><span className="surface-row-actions" onClick={(event) => event.stopPropagation()}><button title="运行" onClick={onRun} disabled={running || instance.status === 'archived'}>▶</button><button title="编辑" onClick={() => onEdit(instance)}>✎</button><button title="复制" onClick={() => onDuplicate(instance)}>⧉</button><button title={instance.status === 'archived' ? '恢复' : '归档'} onClick={() => onArchive(instance)}>{instance.status === 'archived' ? '↺' : '⌫'}</button></span></div>)}
      </div>
      <div className="surface-catalog-foot"><span>{classItem.instances.length} SurfaceInstance</span><span>最近运行：{lastRun ? `${lastRun.elapsedMs}ms · 刚刚` : '未运行'}</span><span>选择实例查看 Inspector</span></div>
    </div>
  )
}

function SurfaceInspector({ classItem, instance, lastRun, onRun, onEdit, onDuplicate, onArchive, onNew }: {
  classItem: LayerClass
  instance: LayerInstance | null
  lastRun: RunRecord | null
  onRun: () => void
  onEdit: (instance: LayerInstance) => void
  onDuplicate: (instance: LayerInstance) => void
  onArchive: (instance: LayerInstance) => void
  onNew: () => void
}) {
  return <div className="surface-inspector-body">
    <div className="line-insp-kicker">{instance ? 'SURFACE INSTANCE' : 'SURFACE CLASS'}</div>
    <div className="line-insp-title">{instance ? instance.name : classItem.name}</div>
    <div className="line-insp-id">{instance ? `${instance.id} · r${instance.rev}` : `${classItem.id} · v1.0.0`}</div>
    <div className="line-insp-badges"><span className={`priority ${classItem.priority.toLowerCase()}`}>{classItem.priority}</span><span className={`effect ${classItem.effect.toLowerCase()}`}>{classItem.effect}</span><span>{classItem.family}</span></div>
    <p className="line-insp-desc">{instance ? instance.description : classItem.description}</p>
    {instance ? <>
      <div className="line-insp-section"><div className="field-policy-title">参数</div>{classItem.params.map((param) => <div className="line-insp-param" key={param.key}><span>{param.label}</span><code>{String(instance.params?.[param.key] ?? '—')}</code></div>)}</div>
      <div className="line-insp-section"><div className="field-policy-title">运行</div><div className="line-run-info"><span>最近运行</span><strong>{lastRun ? `${lastRun.elapsedMs}ms · 刚刚` : '未运行'}</strong><span>状态</span><strong>{statusLabel[instance.status]}</strong></div></div>
      <div className="line-insp-actions"><button className="btn primary" onClick={onRun}>▶ 运行</button><button className="btn ghost" onClick={() => onEdit(instance)}><Pencil size={12} /> 编辑</button><button className="btn ghost" onClick={() => onDuplicate(instance)}><Copy size={12} /> 复制</button><button className="btn ghost" onClick={() => onArchive(instance)}>{instance.status === 'archived' ? '恢复' : '归档'}</button></div>
    </> : <>
      <div className="line-insp-section"><div className="field-policy-title">参数 Schema</div>{classItem.params.map((param) => <div className="line-insp-param" key={param.key}><span>{param.label}</span><code>{param.type}</code></div>)}</div>
      <div className="line-insp-section"><div className="field-policy-title">实例</div>{classItem.instances.map((item) => <button className="line-insp-instance" key={item.id} onClick={() => onEdit(item)}><span className={`point-status-dot ${item.status}`} /><strong>{item.name}</strong><em>r{item.rev}</em></button>)}</div>
      <button className="btn primary line-insp-new" onClick={onNew}><Plus size={13} /> 新建实例</button>
    </>}
  </div>
}

function panelContentFor(classItem: PanelClass, instance?: PanelInstance) {
  const key = classItem.id.replace(/^panel\./, '')
  if (key === 'inspector') return <div className="panel-wire-content"><div className="panel-wire-box"><div className="panel-wire-title">Selection</div><div className="panel-wire-row"><span>class</span><code>point.vpn.status</code></div><div className="panel-wire-row"><span>instance</span><code>{instance?.label ?? 'vpn.default.status'}@r1</code></div><div className="panel-wire-row"><span>revision</span><code>r{instance?.rev ?? 1}</code></div><div className="panel-wire-row"><span>effect</span><code>L0</code></div></div><div className="panel-wire-box"><div className="panel-wire-title">Params</div><div className="panel-wire-chips"><span>profile=work</span><span>timeoutMs=12000</span></div></div><div className="panel-wire-chips"><span className="primary">Save</span><span>Reset</span></div></div>
  if (key === 'settings') return <div className="panel-wire-content"><div className="panel-wire-box"><div className="panel-wire-title">General</div><div className="panel-wire-field"><span>Profile</span><strong>work</strong></div><div className="panel-wire-field"><span>Auto connect</span><strong>on</strong></div><div className="panel-wire-field"><span>Protocol</span><strong>WireGuard</strong></div></div><div className="panel-wire-box"><div className="panel-wire-title">Advanced</div><div className="panel-wire-field"><span>MTU</span><strong>1420</strong></div><div className="panel-wire-field"><span>DNS</span><strong>1.1.1.1</strong></div></div><div className="panel-wire-chips"><span className="primary">Save changes</span><span>Cancel</span></div></div>
  if (key === 'command') return <div className="panel-wire-content"><div className="panel-wire-search">⌘ Type a command…</div>{['Open GitHub', 'Ensure VPN', 'Preview file', 'Archive invoice'].map((item, index) => <div className="panel-wire-list-row" key={item}><i style={{ background: index === 0 ? '#22d3ee' : '#22c55e' }} /><div><strong>{item}</strong><span>{index === 0 ? 'flow · L2' : 'point · L0'}</span></div><em>↵</em></div>)}<div className="panel-wire-chips"><span>↑↓ navigate</span><span>↵ run</span><span>esc close</span></div></div>
  if (key === 'run-history') return <div className="panel-wire-content"><div className="panel-wire-chips"><span className="primary">All</span><span>Errors</span><span>Slow</span></div>{['flow.ensure-vpn · ok · 842ms', 'flow.open-site · failed · E_TARGET', 'flow.preview · ok · 120ms', 'flow.archive · ok · 2.4s'].map((item, index) => <div className="panel-wire-list-row" key={item}><i style={{ background: index === 1 ? '#ef4444' : '#22c55e' }} /><div><strong>{item.split(' · ')[0]}</strong><span>{item.split(' · ').slice(1).join(' · ')}</span></div><em>↻</em></div>)}</div>
  if (key === 'artifact') return <div className="panel-wire-content"><div className="panel-wire-chips"><span className="primary">Preview</span><span>Source</span><span>Versions</span></div><pre className="panel-wire-code">{`export function PriceTag({ value }) {\n  return <span className="tag">{value}</span>;\n}`}</pre><div className="panel-wire-chips"><span className="primary">Edit</span><span>Export</span><span>v2</span></div></div>
  if (key === 'chat') return <div className="panel-wire-content panel-wire-chat"><div className="panel-wire-msg me">这个面板应该用什么 placement？</div><div className="panel-wire-msg">持续工作的 side panel 用 docked right；短任务用 floating；不可逆动作才用 modal。</div><div className="panel-wire-search">Ask anything… <span>Send ↵</span></div></div>
  if (key === 'approval') return <div className="panel-wire-content"><div className="panel-wire-box"><div className="panel-wire-title">Risk · L2</div><div className="panel-wire-chips"><span className="warn">irreversible</span><span className="warn">external tool</span><span>approval required</span></div><pre className="panel-wire-code"><span className="del">- openExternal(url)</span>{'\n'}<span className="add">+ ensureVpn()</span>{'\n'}<span className="add">+ openExternal(url)</span></pre><div className="panel-wire-chips"><span className="primary">Approve</span><span className="danger">Deny</span><span>Reason…</span></div></div></div>
  if (key === 'notifications') return <div className="panel-wire-content">{['VPN connected · just now · network', 'Update available · 2 min ago · system'].map((item, index) => <div className="panel-wire-list-row" key={item}><i style={{ background: index ? '#f59e0b' : '#22c55e' }} /><div><strong>{item.split(' · ')[0]}</strong><span>{item.split(' · ').slice(1).join(' · ')}</span></div><em>{index ? 'install' : 'dismiss'}</em></div>)}</div>
  if (key === 'launcher') return <div className="panel-wire-content"><div className="panel-wire-chips"><span className="primary">常用</span><span>开发</span><span>系统</span></div><div className="panel-wire-tile-grid">{['GitHub', 'VS Code', '终端', '设置', '翻译', '发票', '剪贴板', '系统'].map((item, index) => <div className="panel-wire-tile" key={item}><i style={{ background: index % 2 ? '#8b5cf6' : '#22d3ee' }} /><strong>{item}</strong></div>)}</div></div>
  if (key === 'dashboard') return <div className="panel-wire-content"><div className="panel-wire-metrics">{[['CPU', '42%'], ['GPU', '18%'], ['MEM', '64%']].map(([name, value]) => <div className="panel-wire-metric" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div><div className="panel-wire-box"><div className="panel-wire-title">Trend</div><div className="panel-wire-spark">▁▂▃▅▆▇█▇▆▅▃▂▁▂▄▆▇█▆▄▂</div></div></div>
  if (key === 'diff') return <div className="panel-wire-content"><pre className="panel-wire-code"><span className="del">- timeout: 12000</span>{'\n'}<span className="add">+ timeout: 15000</span>{'\n\n'}<span className="del">- retry: 1</span>{'\n'}<span className="add">+ retry: 3</span></pre><div className="panel-wire-chips"><span className="primary">Accept</span><span className="danger">Revert</span></div></div>
  if (key === 'preview') return <div className="panel-wire-content"><div className="panel-wire-preview-box">PDF / Image / Video preview</div><div className="panel-wire-chips"><span>Zoom</span><span>Open external</span></div></div>
  if (key === 'trace') return <div className="panel-wire-content">{['tool: github.diff · 42 files · 120ms', 'tool: vpn.status · ok · 8ms', 'tool: file.preview · error · E_PERM'].map((item, index) => <div className="panel-wire-list-row" key={item}><i style={{ background: index === 2 ? '#ef4444' : '#22c55e' }} /><div><strong>{item.split(' · ')[0]}</strong><span>{item.split(' · ').slice(1).join(' · ')}</span></div><em>↻</em></div>)}</div>
  if (key === 'console') return <div className="panel-wire-content"><pre className="panel-wire-code">$ npm run dev{'\n'}<span className="add">ready in 820ms</span>{'\n'}$ npm test{'\n'}<span className="add">✓ 42 passing</span>{'\n'}<span className="del">✗ 1 failing</span>{'\n'}$ _</pre></div>
  return <div className="panel-wire-content"><div className="panel-wire-box"><div className="panel-wire-title">Content</div><div className="panel-wire-row"><span>class</span><code>{classItem.id}</code></div><div className="panel-wire-row"><span>instance</span><code>{instance?.label ?? '—'}</code></div><div className="panel-wire-row"><span>state</span><code>{instance?.state ?? 'ready'}</code></div><div className="panel-wire-row"><span>content</span><code>{instance?.content ?? classItem.content}</code></div></div></div>
}
function PanelView({ classItem, instance, mode, width, viewState, anatomy, onModeChange, onWidthChange, onViewStateChange, onAnatomyChange, onSelectInstance, onToast }: {
  classItem?: PanelClass
  instance?: PanelInstance
  mode: string
  width: number
  viewState: string
  anatomy: boolean
  onModeChange: (mode: string) => void
  onWidthChange: (width: number) => void
  onViewStateChange: (state: string) => void
  onAnatomyChange: (value: boolean) => void
  onSelectInstance: (label: string) => void
  onToast: (message: string) => void
}) {
  if (!classItem) return <div className="point-empty"><PanelsTopLeft size={22} /><strong>没有面板类</strong></div>
  const previewContent = viewState === 'loading' ? <div className="panel-preview-skeleton">{[72, 90, 58, 82, 46].map((w, index) => <span key={index} style={{ width: `${w}%` }} />)}</div>
    : viewState === 'empty' ? <div className="panel-preview-empty"><strong>No content</strong><span>{instance?.content || classItem.content} 还没有数据。可以运行上游流程或切换实例。</span><button className="btn small">Run upstream</button></div>
      : viewState === 'error' ? <div className="panel-preview-empty error"><strong>Panel failed to load</strong><span>内容返回错误。检查权限 / 网络 / 上游流程。</span><button className="btn small">Retry</button></div>
        : viewState === 'needsApproval' ? <div className="panel-preview-approval"><span className="line-kind-pill point">L2</span><span className="line-bind-state ph">irreversible · approval required</span><div><button className="btn small primary">Approve</button><button className="btn small">Deny</button></div></div>
          : viewState === 'streaming' ? <div className="panel-preview-stream"><div className="wire-msg me">帮我总结这个 PR 的风险。</div><div className="wire-msg">正在阅读 diff… tool: github.diff · 42 files</div><div className="wire-msg">发现 3 个风险点：权限检查缺失 / 错误分支未覆盖 / 缺少回归测试<span>▍</span></div></div>
            : panelContentFor(classItem, instance)
  return (
    <div className="panel-view">
      <div className="surface-hero"><span className="surface-hero-icon panel">{classItem.icon}</span><div><div className="panel-eyebrow">PANELCLASS · {classItem.group}</div><h2>{classItem.name}</h2><p>{classItem.desc}</p></div><div className="surface-hero-actions"><button className="btn ghost" onClick={() => onToast('面板预览已刷新')}>预览</button><button className="btn primary" onClick={() => onToast('使用上方「新建实例」管理 PanelInstance')}>＋ 实例</button></div></div>
      <div className="panel-view-toolbar">
        <div className="panel-mode-group">{PANEL_MODES.map((item) => <button key={item} className={mode === item ? 'active' : ''} onClick={() => onModeChange(item)}>{item}</button>)}</div>
        <label>width<input type="range" min="300" max="720" value={width} onChange={(event) => onWidthChange(Number(event.target.value))} /><strong>{width}px</strong></label>
        <label>state<select value={viewState} onChange={(event) => onViewStateChange(event.target.value)}>{['ready', 'loading', 'empty', 'error', 'streaming', 'needsApproval', 'blocked'].map((state) => <option key={state}>{state}</option>)}</select></label>
        <label className="panel-check"><input type="checkbox" checked={anatomy} onChange={(event) => onAnatomyChange(event.target.checked)} /> anatomy</label>
        <button className="text-btn" onClick={() => { onModeChange(instance?.mode ?? classItem.modes[0] ?? 'right'); onWidthChange(instance?.width ?? 380); onViewStateChange(instance?.state ?? classItem.states[0] ?? 'ready'); onAnatomyChange(false) }}>reset view</button>
      </div>
      <div className="panel-preview-wrap">
        <div className="panel-preview-head"><span>PANEL PREVIEW</span><em>{instance?.label ?? 'no instance'} · {mode} · {width}px</em></div>
        <div className={`panel-preview-stage stage-${mode}`}>
          <div className="panel-stage-fake" aria-hidden="true">
            <div className="panel-fake-sidebar"><span className="active" /><span /><span /><span /><span /></div>
            <div className="panel-fake-main"><div className="panel-fake-kicker" /><div className="panel-fake-title" /><div className="panel-fake-cards"><span /><span /><span /></div><div className="panel-fake-lines"><span /><span /><span /></div></div>
          </div>
          {(mode === 'modal' || mode === 'sheet') && <div className="panel-stage-backdrop" />}
          <div className="panel-stage-label"><span>{mode}</span><em>{mode === 'right' || mode === 'left' ? 'docked' : mode === 'bottom' ? 'bottom dock' : mode === 'floating' ? 'floating layer' : mode === 'modal' ? 'modal overlay' : 'bottom sheet'}</em></div>
          <div className={`panel-preview mode-${mode} ${anatomy ? 'anatomy' : ''}`} style={{ width: mode === 'bottom' ? '100%' : mode === 'sheet' ? '88%' : mode === 'modal' ? 'min(460px, 88%)' : mode === 'floating' ? 'min(72%, 520px)' : `${Math.min(width, 360)}px` }}>
            <div className="panel-preview-top"><strong>{classItem.icon} {instance?.label ?? classItem.name}</strong><span>{mode} · {viewState}</span></div>
            <div className="panel-preview-toolbar">{classItem.regions.map((region) => <span key={region}>{region}</span>)}</div>
            <div className="panel-preview-body">{previewContent}</div>
            <div className="panel-preview-foot"><span>{classItem.behaviors.join(' · ')}</span><span>{classItem.a11y[0]}</span></div>
          </div>
        </div>
      </div>
      <div className="panel-instance-list">
        <div className="surface-table-head"><span>PanelInstance</span><span>Mode</span><span>State</span><span>Rev</span></div>
        {classItem.instances.map((item) => <button key={item.label} className={`panel-instance-row ${instance?.label === item.label ? 'active' : ''}`} onClick={() => onSelectInstance(item.label)}><div><strong>{item.label}</strong><code>{item.content}</code></div><span>{item.mode}</span><span className={`status-pill ${item.status}`}>{item.state}</span><em>r{item.rev}</em></button>)}
      </div>
      <div className="panel-meta-strip">{classItem.states.map((state) => <span key={state}>{state}</span>)}{classItem.behaviors.map((behavior) => <span key={behavior}>{behavior}</span>)}</div>
    </div>
  )
}

function PanelInspector({ classItem, instance }: { classItem: PanelClass; instance?: PanelInstance }) {
  return <div className="surface-inspector-body">
    <div className="line-insp-kicker">PANELCLASS · 面板类</div>
    <div className="line-insp-title">{classItem.icon} {classItem.name}</div>
    <div className="line-insp-id">{classItem.id} · v{classItem.version}</div>
    <div className="line-insp-badges"><span>{classItem.group}</span><span>{classItem.modes.join(' / ')}</span></div>
    <p className="line-insp-desc">{classItem.desc}</p>
    <div className="line-insp-section"><div className="field-policy-title">Regions</div><div className="surface-token-list">{classItem.regions.map((region) => <span key={region}>{region}</span>)}</div></div>
    <div className="line-insp-section"><div className="field-policy-title">States</div><div className="surface-token-list">{classItem.states.map((state) => <span key={state}>{state}</span>)}</div></div>
    <div className="line-insp-section"><div className="field-policy-title">Behaviors</div><div className="surface-token-list">{classItem.behaviors.map((behavior) => <span key={behavior}>{behavior}</span>)}</div></div>
    <div className="line-insp-section"><div className="field-policy-title">Instances · {classItem.instances.length}</div>{classItem.instances.map((item) => <div className={`panel-insp-instance ${instance?.label === item.label ? 'active' : ''}`} key={item.label}><strong>{item.label}</strong><code>{item.mode} · {item.width}px · r{item.rev}</code></div>)}</div>
  </div>
}

function GestureView({ gesture, bindings, target, targets, onOpenTarget, onSelectPattern, onToast }: {
  gesture?: GestureBinding
  bindings: GestureBinding[]
  target?: GestureTarget
  targets: GestureTarget[]
  onOpenTarget: (target: GestureTarget) => void
  onSelectPattern: (g: GestureBinding) => void
  onToast: (message: string) => void
}) {
  if (!gesture) return <div className="point-empty"><Grip size={22} /><strong>没有手势绑定</strong></div>
  const points = gesturePath(gesture.pattern)
  const polyline = points.map((point) => point.join(',')).join(' ')
  const start = points[0]
  const end = points[points.length - 1]
  return (
    <div className="gesture-view">
      <div className="surface-hero"><span className="surface-hero-icon gesture">G</span><div><div className="panel-eyebrow">GESTUREBINDING · {target?.kind ?? (gesture.kind === 'point' ? 'point' : 'line')}</div><h2>{gesture.pattern} · {gesture.name}</h2><p>{gesture.desc}</p></div><div className="surface-hero-actions"><button className="btn ghost" onClick={() => onToast(`识别预览 · ${gesture.pattern} 匹配成功`)}>识别预览</button>{target && <button className="btn primary" onClick={() => onOpenTarget(target)}>打开目标 <ArrowUpRight size={11} /></button>}</div></div>
      <div className="gesture-map-chain"><div className="gesture-map-node"><span>Gesture</span><strong>{gesture.pattern}</strong></div><i>→</i><div className={`gesture-map-node ${target?.kind ?? 'pending'}`}><span>Target Layer</span><strong>{target ? (target.kind === 'point' ? 'PointInstance' : 'FlowInstance') : '未映射'}</strong></div><i>→</i><div className="gesture-map-node target"><span>AtomRef</span><strong>{target?.label ?? gesture.target}</strong></div><em className={target ? 'mapped' : 'placeholder'}>{target ? 'mapped' : 'placeholder'}</em></div>
      <div className="gesture-stage">
        <div className="gesture-pad"><svg viewBox="0 0 400 280" preserveAspectRatio="none"><polyline points={polyline} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={start[0]} cy={start[1]} r="5" fill="#22d3ee" /><circle cx={end[0]} cy={end[1]} r="5" fill="#fbbf24" /></svg><div className="gesture-pattern">{gesture.pattern}</div><span>Gesture Pad</span><em>fuzzy ≤1 segment</em></div>
        <div className="gesture-presets">{bindings.map((item) => <button key={item.pattern} className={item.pattern === gesture.pattern ? 'active' : ''} onClick={() => onSelectPattern(item)}>{item.pattern}</button>)}</div>
        <div className="gesture-match"><span className={`line-kind-pill ${gesture.kind}`}>{gesture.kind}</span><strong>{gesture.name}</strong><code>{target?.atomRef ?? gesture.target}</code><em>{gesture.effect}</em></div>
      </div>
      <div className="gesture-binding-table">
        <div className="surface-table-head"><span>Pattern</span><span>Kind</span><span>Target / Mapping</span><span>Effect</span></div>
        {bindings.map((item) => {
          const itemTarget = targets.find((entry) => entry.id === item.targetId) ?? targets.find((entry) => entry.atomRef === item.target)
          return <button key={item.pattern} className={`gesture-binding-row ${item.pattern === gesture.pattern ? 'active' : ''}`} onClick={() => onSelectPattern(item)}><strong>{item.pattern}</strong><span className={`line-kind-pill ${item.kind}`}>{item.kind}</span><code>{itemTarget ? `${itemTarget.label} · mapped` : `${item.target} · placeholder`}</code><em>{item.effect}</em></button>
        })}
      </div>
    </div>
  )
}

function GestureInspector({ gesture, target, onOpenTarget }: { gesture: GestureBinding; target?: GestureTarget; onOpenTarget: (target: GestureTarget) => void }) {
  return <div className="surface-inspector-body">
    <div className="line-insp-kicker">GESTUREBINDING · 手势绑定</div>
    <div className="line-insp-title">{gesture.pattern} · {gesture.name}</div>
    <div className="line-insp-id">{target?.atomRef ?? gesture.target}</div>
    <div className="line-insp-badges"><span className={`line-kind-pill ${gesture.kind}`}>{gesture.kind}</span><span className={`effect ${gesture.effect.toLowerCase()}`}>{gesture.effect}</span><span className={`line-bind-state ${target ? 'ok' : 'ph'}`}>{target ? 'mapped' : 'placeholder'}</span></div>
    <p className="line-insp-desc">{gesture.desc}</p>
    <div className="line-insp-section"><div className="field-policy-title">Pattern</div><div className="gesture-insp-path">{gesturePath(gesture.pattern).map((point, index) => <span key={`${point[0]}-${index}`}>{index + 1}</span>)}<code>{gesture.pattern}</code></div></div>
    <div className="line-insp-section"><div className="field-policy-title">Target</div><div className="line-node-binding"><div><span>Kind</span><code>{target?.kind ?? gesture.kind}</code></div><div><span>Effect</span><code>{gesture.effect}</code></div><div><span>Target</span><code>{target?.label ?? gesture.target}</code></div><div><span>AtomRef</span><code>{target?.atomRef ?? '—'}</code></div></div>{target ? <button className="btn primary line-insp-new" onClick={() => onOpenTarget(target)}>打开{target.kind === 'point' ? '点层' : '线层'}实例 <ArrowUpRight size={11} /></button> : <div className="line-placeholder-note"><CircleDot size={12} /> 当前 target 还没有映射到真实实例，请编辑手势选择目标。</div>}</div>
  </div>
}

function DockView({ tab, tabs, allTiles, tiles, selected, onSelect, onToast }: { tab: { id: string; name: string }; tabs: DockTab[]; allTiles: DockTile[]; tiles: DockTile[]; selected?: DockTile; onSelect: (tile: DockTile) => void; onToast: (message: string) => void }) {
  return <div className="dock-view">
    <div className="surface-hero"><span className="surface-hero-icon dock">⌘</span><div><div className="panel-eyebrow">SURFACEINSTANCE · launch-dock.desktop@r1</div><h2>CLaunch 式启动坞</h2><p>{tabs.length} 个分页 · {allTiles.length} 个 Tile；flow 与 point 混合启动。</p></div><div className="surface-hero-actions"><button className="btn ghost" onClick={() => onToast('启动坞预览已刷新')}>预览</button><button className="btn primary" onClick={() => onToast('Tile 编辑器待接入')}>＋ Tile</button></div></div>
    <div className="dock-preview">
      <div className="dock-preview-head"><strong>Launch Dock · {tab.name}</strong><span>{tiles.length} tiles · page 1</span></div>
      <div className="dock-tabs">{tabs.map((item) => <button key={item.id} className={item.id === tab.id ? 'active' : ''} onClick={() => onToast(`切换到 ${item.name} 分页`)}>{item.name}<em>{allTiles.filter((tile) => tile.tab === item.id).length}</em></button>)}</div>
      <div className="dock-grid">{tiles.map((tile) => <button key={tile.id} className={`dock-tile ${selected?.id === tile.id ? 'active' : ''}`} data-kind={tile.kind} onClick={() => onSelect(tile)}><span className="dock-tile-icon">{tile.icon}</span><strong>{tile.name}</strong><em>{tile.kind} · {tile.hotkey}</em></button>)}</div>
      <div className="dock-foot"><span className="dock-page active" /><span className="dock-page" /><span className="dock-page" /><em>{tiles.length} tiles · page 1</em></div>
    </div>
    <div className="dock-table"><div className="surface-table-head"><span>Tile</span><span>Kind</span><span>Target</span><span>Effect</span></div>{tiles.map((tile) => <button key={tile.id} className={`dock-table-row ${selected?.id === tile.id ? 'active' : ''}`} onClick={() => onSelect(tile)}><strong>{tile.icon} {tile.name}</strong><span className={`line-kind-pill ${tile.kind}`}>{tile.kind}</span><code>{tile.target}</code><em>{tile.effect}</em></button>)}</div>
  </div>
}

function DockInspector({ tab, tile }: { tab: { id: string; name: string }; tile: DockTile }) {
  return <div className="surface-inspector-body">
    <div className="line-insp-kicker">LAUNCH DOCK · SURFACEINSTANCE</div>
    <div className="line-insp-title">{tile.icon} {tile.name}</div>
    <div className="line-insp-id">{tile.target} · {tab.name}</div>
    <div className="line-insp-badges"><span className={`line-kind-pill ${tile.kind}`}>{tile.kind}</span><span className={`effect ${tile.effect.toLowerCase()}`}>{tile.effect}</span></div>
    <p className="line-insp-desc">{tile.sub} · 启动坞 Tile</p>
    <div className="line-insp-section"><div className="field-policy-title">Tile</div><div className="line-node-binding"><div><span>Tab</span><code>{tab.name}</code></div><div><span>Hotkey</span><code>{tile.hotkey}</code></div><div><span>Kind</span><code>{tile.kind}</code></div><div><span>Effect</span><code>{tile.effect}</code></div></div></div>
    <div className="line-insp-section"><div className="field-policy-title">Target</div><div className="line-node-binding"><div><span>ID</span><code>{tile.target}</code></div><div><span>Binding</span><code>{tile.sub}</code></div></div></div>
    <div className="line-insp-section"><div className="field-policy-title">Actions</div><div className="line-insp-actions"><button className="btn primary">▶ 启动</button><button className="btn ghost">编辑 Tile</button><button className="btn ghost">复制</button></div></div>
  </div>
}
