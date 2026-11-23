import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  Grid3X3,
  Layers3,
  List,
  Network,
  Pencil,
  Boxes,
  FileJson,
  History,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Play,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X
} from 'lucide-react'
import type { LayerClass, LayerInstance, LayerMeta, RunRecord } from '../data'
import { bodyProfiles, type BodyProfile } from '../../../shared/bodyCatalog'
import { hasRealImpl, IMPL_SUMMARY, type ImplementedClassId } from '../../../shared/implRegistry'
import { gapSummary, isUnmet, topGaps } from '../../../shared/requirements'
import type { InstanceDraft } from './instanceDraft'

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
  runs?: RunRecord[]
}

type View = 'cards' | 'table' | 'graph' | 'matrix' | 'manage' | 'resources' | 'policy' | 'evidence' | 'cost' | 'composition' | 'manifest' | 'lifecycle'
type Selection = { type: 'class' | 'instance'; classId: string; instanceId?: string }

const viewItems: { id: View; label: string; icon: typeof List }[] = [
  { id: 'cards', label: '卡片', icon: Layers3 },
  { id: 'table', label: '表格', icon: List },
  { id: 'graph', label: '图谱', icon: Network },
  { id: 'matrix', label: '矩阵', icon: Grid3X3 },
  { id: 'manage', label: '管理', icon: CircleDot },
  { id: 'resources', label: '资源', icon: Download }
]

const fieldViewItems: { id: View; label: string; icon: typeof List }[] = [
  { id: 'policy', label: '策略', icon: ShieldCheck },
  { id: 'evidence', label: '证据', icon: Sparkles },
  { id: 'cost', label: '成本', icon: ReceiptText }
]

const bodyViewItems: { id: View; label: string; icon: typeof List }[] = [
  { id: 'composition', label: '组合', icon: Boxes },
  { id: 'manifest', label: 'Manifest', icon: FileJson },
  { id: 'lifecycle', label: '生命周期', icon: History }
]

const familyColors: Record<string, string> = {
  Window: '#22d3ee', Screen: '#34d399', Input: '#a78bfa', Network: '#fbbf24'
}

const statusLabel: Record<string, string> = {
  active: '运行中', draft: '草稿', archived: '已归档'
}

const layerLabels: Record<string, { classLabel: string; instanceLabel: string; runLabel: string; description: string }> = {
  point: { classLabel: 'PointClass', instanceLabel: 'PointInstance', runLabel: 'PointRun', description: '点类契约、实例配置、运行与资源加载。类定义能力，实例保存参数；设置页只管策略。' },
  line: { classLabel: 'FlowClass', instanceLabel: 'FlowInstance', runLabel: 'FlowRun', description: '流程类、流程实例、步骤绑定与运行。线负责编排，不拥有点能力。' },
  surface: { classLabel: 'SurfaceClass', instanceLabel: 'SurfaceInstance', runLabel: 'SurfaceRun', description: '界面类、界面实例与交互承载。面只负责呈现，不拥有业务。' },
  body: { classLabel: 'BodyClass', instanceLabel: 'BodyInstance', runLabel: 'BodyRun', description: '产品体类、体实例与可安装能力。体负责组合，不替代点/线/面。' },
  field: { classLabel: 'FieldClass', instanceLabel: 'FieldInstance', runLabel: 'FieldRun', description: '智能场能力与实例。' }
}


function summary(instance: LayerInstance): string {
  const entries = Object.entries(instance.params ?? {})
  return entries.length ? entries.slice(0, 3).map(([key, value]) => `${key}=${value || '—'}`).join(' · ') : '未设置参数'
}

export function LayerManagementPage({
  layer, query, onToast, onCreateInstance, onUpdateInstance,
  onArchiveInstance, onRestoreInstance, onDuplicateInstance, onRunComplete, runs = []
}: Props) {
  const [view, setView] = useState<View>('cards')
  const [family, setFamily] = useState('all')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; instance?: LayerInstance } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParams, setFormParams] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const families = useMemo(() => [...new Set(layer.classes.map((item) => item.family))], [layer.classes])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return layer.classes.filter((item) => {
      if (family !== 'all' && item.family !== family) return false
      if (!q) return true
      return [item.id, item.name, item.family, item.description, ...item.instances.map((instance) => `${instance.id} ${instance.name}`)]
        .join(' ').toLowerCase().includes(q)
    })
  }, [family, layer.classes, query])

  const selectedClass = useMemo(
    () => layer.classes.find((item) => item.id === selected?.classId) ?? layer.classes[0],
    [layer.classes, selected?.classId]
  )
  const selectedInstance = useMemo(
    () => selected?.type === 'instance' ? selectedClass?.instances.find((item) => item.id === selected.instanceId) ?? null : null,
    [selected, selectedClass]
  )

  useEffect(() => {
    if (!selected && layer.classes[0]) setSelected({ type: 'class', classId: layer.classes[0].id })
  }, [layer.classes, selected])

  const totalInstances = layer.classes.reduce((sum, item) => sum + item.instances.length, 0)
  const activeInstances = layer.classes.reduce(
    (sum, item) => sum + item.instances.filter((instance) => instance.status !== 'archived').length, 0
  )
  const p0Count = layer.classes.filter((item) => item.priority === 'P0').length
  const labels = layerLabels[layer.key] ?? layerLabels.point
  const LayerIcon = layer.icon
  const viewChoices = layer.key === 'field'
    ? [...viewItems, ...fieldViewItems]
    : layer.key === 'body'
      ? [...viewItems, ...bodyViewItems]
      : viewItems

  function selectClass(item: LayerClass) { setSelected({ type: 'class', classId: item.id }) }
  function selectInstance(classItem: LayerClass, instance: LayerInstance) {
    setSelected({ type: 'instance', classId: classItem.id, instanceId: instance.id })
  }
  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function openCreate(classItem: LayerClass | undefined = selectedClass) {
    if (!classItem) return
    setEditor({ mode: 'create' })
    setFormName('')
    setFormDescription('')
    setFormParams(Object.fromEntries(classItem.params.map((param) => [param.key, param.defaultValue ?? ''])))
  }
  function openEdit(classItem: LayerClass, instance: LayerInstance) {
    setEditor({ mode: 'edit', instance })
    setFormName(instance.name)
    setFormDescription(instance.description)
    setFormParams({
      ...Object.fromEntries(classItem.params.map((param) => [param.key, param.defaultValue ?? ''])),
      ...(instance.params ?? {})
    })
  }
  async function submitEditor() {
    if (!selectedClass || !formName.trim() || saving) return
    setSaving(true)
    try {
      if (editor?.mode === 'edit' && editor.instance) {
        const updated = await onUpdateInstance(layer.key, selectedClass.id, editor.instance.id, {
          name: formName.trim(), description: formDescription.trim(), params: formParams
        })
        if (updated) {
          setSelected({ type: 'instance', classId: selectedClass.id, instanceId: updated.id })
          onToast(`实例已保存 · rev ${updated.rev}`)
        }
      } else {
        const created = await onCreateInstance(layer.key, selectedClass.id, {
          name: formName.trim(), description: formDescription.trim(), params: formParams
        })
        if (created) {
          setSelected({ type: 'instance', classId: selectedClass.id, instanceId: created.id })
          setView('cards')
          onToast(`实例已创建 · ${created.name}`)
        }
      }
      setEditor(null)
    } catch (error) {
      onToast(`保存失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally { setSaving(false) }
  }
  async function runInstance(classItem: LayerClass, instance: LayerInstance) {
    if (instance.status === 'archived' || runningId) return
    setRunningId(instance.id)
    try {
      const result = window.baiying
        ? layer.key === 'line'
          ? await window.baiying.runLine({ classId: classItem.id, instanceId: instance.id })
          : layer.key === 'surface'
            ? await window.baiying.runSurface({ classId: classItem.id, instanceId: instance.id })
            : layer.key === 'body'
              ? await window.baiying.runBody({ classId: classItem.id, instanceId: instance.id })
              : layer.key === 'field'
                ? await window.baiying.runField({ classId: classItem.id, instanceId: instance.id })
                : await window.baiying.runPoint({ classId: classItem.id, instanceId: instance.id })
        : { ok: true, runId: `run-${Date.now()}`, classId: classItem.id, instanceId: instance.id, output: '浏览器预览模式 · 模拟执行成功', elapsedMs: 42, at: new Date().toISOString() }
      const record: RunRecord = {
        id: result.runId, layer: layer.key as 'point' | 'line' | 'surface' | 'body', classId: classItem.id, instanceId: instance.id,
        status: result.ok ? 'ok' : 'warn', output: result.output, elapsedMs: result.elapsedMs,
        at: '刚刚', createdAt: new Date(result.at).getTime(),
        evidence: 'evidence' in result ? result.evidence : undefined
      }
      setLastRun(record)
      setSelected({ type: 'instance', classId: classItem.id, instanceId: instance.id })
      onRunComplete(record)
      onToast(`运行成功 · ${result.output}`)
    } catch (error) {
      onToast(`运行失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally { setRunningId(null) }
  }
  async function duplicate(classItem: LayerClass, instance: LayerInstance) {
    try {
      const copy = await onDuplicateInstance(layer.key, instance.id)
      if (copy) {
        setSelected({ type: 'instance', classId: classItem.id, instanceId: copy.id })
        onToast(`已复制 · ${copy.name}`)
      }
    } catch (error) { onToast(`复制失败：${error instanceof Error ? error.message : '未知错误'}`) }
  }
  async function toggleArchive(classItem: LayerClass, instance: LayerInstance) {
    const archived = instance.status === 'archived'
    try {
      const ok = archived ? await onRestoreInstance(layer.key, instance.id) : await onArchiveInstance(layer.key, instance.id)
      if (ok) {
        setSelected({ type: 'instance', classId: classItem.id, instanceId: instance.id })
        onToast(archived ? '实例已恢复' : '实例已归档')
      }
    } catch (error) { onToast(`${archived ? '恢复' : '归档'}失败：${error instanceof Error ? error.message : '未知错误'}`) }
  }

  return (
    <div className="page point-manager">
      <header className="point-head">
        <div>
          <div className="eyebrow">{layer.en.toUpperCase()} LAYER / MANAGEMENT</div>
          <div className="point-title-row">
            <div className="point-title-icon"><LayerIcon size={23} /></div>
            <div><h1>{layer.label}管理</h1><p>{labels.description}</p></div>
          </div>
        </div>
        <div className="point-head-actions">
          <button className="btn ghost" onClick={() => onToast('资源加载器将在 Pack 安装接口接入后启用')}><Upload size={14} /> 导入 Pack</button>
          <button className="btn ghost" onClick={() => onToast('目录已刷新')}><RefreshCw size={14} /> 刷新</button>
          <button className="btn primary" onClick={() => openCreate()}><Plus size={14} /> 新建实例</button>
        </div>
      </header>

      <div className="point-stat-grid">
        <div className="point-stat"><span>{labels.classLabel}</span><strong>{layer.totalClasses}</strong><em>{layer.classes.length} loaded</em></div>
        <div className="point-stat"><span>{labels.instanceLabel}</span><strong>{activeInstances}</strong><em>{totalInstances} total</em></div>
        <div className="point-stat"><span>P0 核心</span><strong>{p0Count}</strong><em>first ship</em></div>
        <div className="point-stat"><span>本次运行</span><strong>{lastRun ? '1' : '—'}</strong><em>{lastRun ? `${lastRun.elapsedMs}ms · 刚刚` : 'not run yet'}</em></div>
      </div>

      <div className="point-toolbar">
        <div className="point-family-nav">
          <button className={family === 'all' ? 'active' : ''} onClick={() => setFamily('all')}>全部家族</button>
          {families.map((item) => <button key={item} className={family === item ? 'active' : ''} onClick={() => setFamily(item)}>{item}</button>)}
        </div>
        <div className="point-view-switch">
          {viewChoices.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon size={12} />{item.label}</button> })}
        </div>
        <div className="point-search"><Search size={13} /><span>{query ? `搜索：${query}` : '上方搜索类 / 实例 / 参数'}</span></div>
      </div>

      <div className="point-layout">
        <main className="point-content">
          {filtered.length === 0 ? (
            <div className="point-empty"><Search size={22} /><strong>没有匹配的 {labels.classLabel}</strong><span>清空搜索或切换家族。</span></div>
          ) : view === 'cards' ? (
            <CardsView classes={filtered} selected={selected} onClass={selectClass} onInstance={selectInstance} onRun={runInstance} onEdit={openEdit} onDuplicate={duplicate} onArchive={toggleArchive} runningId={runningId} onNew={openCreate} />
          ) : view === 'table' ? (
            <TableView classes={filtered} expanded={expanded} onToggle={toggleExpanded} onInstance={selectInstance} onRun={runInstance} onEdit={openEdit} runningId={runningId} />
          ) : view === 'graph' ? (
            <GraphView classes={filtered} onClass={selectClass} onInstance={selectInstance} />
          ) : view === 'matrix' ? (
            <MatrixView classes={filtered} onClass={selectClass} onInstance={selectInstance} />
          ) : view === 'manage' ? (
            <ManageView classes={filtered} onClass={selectClass} onInstance={selectInstance} onRun={runInstance} onEdit={openEdit} onDuplicate={duplicate} onArchive={toggleArchive} runningId={runningId} onNew={openCreate} />
          ) : view === 'policy' ? (
            <FieldPolicyView classes={filtered} onToast={onToast} />
          ) : view === 'evidence' ? (
            <FieldEvidenceView runs={runs.filter((run) => run.layer === 'field')} onToast={onToast} />
          ) : view === 'cost' ? (
            <FieldCostView classes={filtered} />
          ) : view === 'composition' ? (
            <BodyCompositionView classes={filtered} onClass={selectClass} />
          ) : view === 'manifest' ? (
            <BodyManifestView classes={filtered} />
          ) : view === 'lifecycle' ? (
            <BodyLifecycleView classes={filtered} onToast={onToast} />
          ) : (
            <ResourcesView classes={filtered} onClass={selectClass} onToast={onToast} />
          )}
        </main>

        <aside className="point-inspector">
          {selected ? (
            <Inspector classItem={selectedClass} instance={selectedInstance} lastRun={lastRun} onRun={runInstance} onEdit={openEdit} onDuplicate={duplicate} onArchive={toggleArchive} onNew={openCreate} />
          ) : (
            <div className="point-inspector-empty"><span>◇</span><strong>Inspector</strong><p>点击类或实例查看契约、参数和运行。</p></div>
          )}
        </aside>
      </div>

      {editor && selectedClass && (
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div className="modal point-editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><div className="panel-eyebrow">{editor.mode === 'edit' ? 'EDIT INSTANCE' : 'NEW INSTANCE'}</div><h2>{editor.mode === 'edit' ? '编辑实例' : '新建实例'}</h2><p>类：<code>{selectedClass.id}</code></p></div>
              <button className="icon-btn" onClick={() => setEditor(null)}><X size={16} /></button>
            </div>
            <div className="modal-form">
              <label>实例名称<input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="例如：查找 VS Code" autoFocus /></label>
              <label>说明<textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={2} /></label>
              <div className="form-section-label">实例参数</div>
              <div className="param-form-grid">
                {selectedClass.params.map((param) => (
                  <label key={param.key}>{param.label}<input value={formParams[param.key] ?? ''} onChange={(event) => setFormParams((current) => ({ ...current, [param.key]: event.target.value }))} placeholder={param.defaultValue || param.description} /><span className="param-key">{param.key}{param.required ? ' · required' : ''}</span></label>
                ))}
              </div>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setEditor(null)}>取消</button><button className="btn primary" disabled={!formName.trim() || saving} onClick={() => { void submitEditor() }}>{saving ? '保存中…' : editor.mode === 'edit' ? '保存并升 revision' : '创建实例'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function CardsView(props: {
  classes: LayerClass[]
  selected: Selection | null
  onClass: (c: LayerClass) => void
  onInstance: (c: LayerClass, i: LayerInstance) => void
  onRun: (c: LayerClass, i: LayerInstance) => void
  onEdit: (c: LayerClass, i: LayerInstance) => void
  onDuplicate: (c: LayerClass, i: LayerInstance) => void
  onArchive: (c: LayerClass, i: LayerInstance) => void
  runningId: string | null
  onNew: (c: LayerClass) => void
}) {
  return (
    <div className="point-cards">
      {props.classes.map((classItem) => {
        const color = familyColors[classItem.family] ?? '#22d3ee'
        return (
          <article className={`point-class-card ${props.selected?.classId === classItem.id ? 'selected' : ''}`} key={classItem.id}>
            <button className="point-class-head" onClick={() => props.onClass(classItem)}>
              <span className="point-class-icon" style={{ color, borderColor: `${color}33`, background: `${color}12` }}>◆</span>
              <span className="point-class-main">
                <span className="point-class-title">{classItem.name}<em className={`priority ${classItem.priority.toLowerCase()}`}>{classItem.priority}</em><em className="point-mini-badge">{classItem.effect}</em><em className={`point-mini-badge ${hasRealImpl(classItem.id) ? 'impl-real' : 'impl-mock'}`}>{hasRealImpl(classItem.id) ? '真实' : '模拟'}</em></span>
                <span className="point-class-id">{classItem.id}</span>
                <span className="point-class-desc">{classItem.description}</span>
              </span>
              <span className="point-class-meta"><strong>{classItem.instances.length}</strong><em>实例</em></span>
              <ChevronRight size={14} />
            </button>
            <div className="point-instance-head"><span>实例</span><span>参数摘要</span><span>状态</span><span /></div>
            {classItem.instances.map((instance) => (
              <div className={`point-instance-row ${props.selected?.type === 'instance' && props.selected.instanceId === instance.id ? 'selected' : ''}`} key={instance.id} onClick={() => props.onInstance(classItem, instance)}>
                <button className="point-instance-name" onClick={(event) => { event.stopPropagation(); props.onInstance(classItem, instance) }}><span className={`point-status-dot ${instance.status}`} />{instance.name}<em>r{instance.rev}</em></button>
                <span className="point-param-summary" title={JSON.stringify(instance.params)}>{summary(instance)}</span>
                <span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span>
                <span className="point-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button title="运行" onClick={() => props.onRun(classItem, instance)} disabled={props.runningId === instance.id || instance.status === 'archived'}>▶</button>
                  <button title="编辑" onClick={() => props.onEdit(classItem, instance)}>✎</button>
                  <button title="复制" onClick={() => props.onDuplicate(classItem, instance)}>⧉</button>
                  <button title={instance.status === 'archived' ? '恢复' : '归档'} onClick={() => props.onArchive(classItem, instance)}>{instance.status === 'archived' ? '↺' : '⌫'}</button>
                </span>
              </div>
            ))}
            <button className="point-add-instance" onClick={() => props.onNew(classItem)}><Plus size={12} /> 新建实例</button>
          </article>
        )
      })}
    </div>
  )
}

function TableView(props: {
  classes: LayerClass[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onInstance: (c: LayerClass, i: LayerInstance) => void
  onRun: (c: LayerClass, i: LayerInstance) => void
  onEdit: (c: LayerClass, i: LayerInstance) => void
  runningId: string | null
}) {
  return (
    <div className="point-table-wrap">
      <table className="point-catalog-table">
        <thead><tr><th>类 / 实例</th><th>家族</th><th>版本 / 参数</th><th>状态</th><th>实例</th><th /></tr></thead>
        <tbody>
          {props.classes.map((classItem) => (
            <Fragment key={classItem.id}>
              <tr className="point-class-row" onClick={() => props.onToggle(classItem.id)}>
                <td><span className={`point-chevron ${props.expanded.has(classItem.id) ? 'open' : ''}`}>▸</span><span className="point-tree-icon">◆</span><strong>{classItem.name}</strong><code>{classItem.id}</code></td>
                <td>{classItem.family}</td><td>v1.0.0 · {classItem.instances.length} 实例</td>
                <td><span className={`status-pill ${classItem.status}`}>{statusLabel[classItem.status]}</span></td><td>{classItem.instances.length}</td>
                <td><button className="point-row-plus" onClick={(event) => { event.stopPropagation(); props.onToggle(classItem.id) }}>＋</button></td>
              </tr>
              {props.expanded.has(classItem.id) && classItem.instances.map((instance) => (
                <tr className="point-instance-table-row" key={instance.id} onClick={() => props.onInstance(classItem, instance)}>
                  <td><span className="point-tree-line">└</span><span className={`point-status-dot ${instance.status}`} />{instance.name}<code>{instance.id}</code></td>
                  <td>{summary(instance)}</td><td>r{instance.rev}</td><td><span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span></td><td />
                  <td><span className="point-row-actions"><button onClick={(event) => { event.stopPropagation(); props.onRun(classItem, instance) }} disabled={props.runningId === instance.id || instance.status === 'archived'}>▶</button><button onClick={(event) => { event.stopPropagation(); props.onEdit(classItem, instance) }}>✎</button></span></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GraphView({ classes, onClass, onInstance }: { classes: LayerClass[]; onClass: (c: LayerClass) => void; onInstance: (c: LayerClass, i: LayerInstance) => void }) {
  return (
    <div className="point-graph">
      {classes.map((classItem) => {
        const color = familyColors[classItem.family] ?? '#22d3ee'
        return (
          <div className="point-graph-row" key={classItem.id}>
            <button className="point-graph-class" onClick={() => onClass(classItem)} style={{ '--c': color } as React.CSSProperties}>
              <span>◆</span><strong>{classItem.name}</strong><em>{classItem.id}</em><i>{classItem.instances.length} instances</i>
            </button>
            <span className="point-graph-line">→</span>
            <div className="point-graph-instances">
              {classItem.instances.map((instance) => <button key={instance.id} className="point-graph-instance" onClick={() => onInstance(classItem, instance)}><span className={`point-status-dot ${instance.status}`} />{instance.name}<em>{summary(instance)}</em></button>)}
              {!classItem.instances.length && <span className="point-muted">暂无实例</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatrixView({ classes, onClass, onInstance }: { classes: LayerClass[]; onClass: (c: LayerClass) => void; onInstance: (c: LayerClass, i: LayerInstance) => void }) {
  return (
    <div className="point-matrix">
      {classes.map((classItem) => (
        <button className="point-matrix-cell" key={classItem.id} onClick={() => onClass(classItem)}>
          <div className="point-matrix-head"><span>◆</span><strong>{classItem.name}</strong><em>{classItem.priority}</em></div>
          <div className="point-matrix-id">{classItem.id}</div>
          <div className="point-matrix-count"><strong>{classItem.instances.length}</strong> instances</div>
          <div className="point-matrix-instances">
            {classItem.instances.slice(0, 4).map((instance) => <span key={instance.id} onClick={(event) => { event.stopPropagation(); onInstance(classItem, instance) }}>{instance.name}</span>)}
          </div>
        </button>
      ))}
    </div>
  )
}

function ManageView(props: {
  classes: LayerClass[]
  onClass: (c: LayerClass) => void
  onInstance: (c: LayerClass, i: LayerInstance) => void
  onRun: (c: LayerClass, i: LayerInstance) => void
  onEdit: (c: LayerClass, i: LayerInstance) => void
  onDuplicate: (c: LayerClass, i: LayerInstance) => void
  onArchive: (c: LayerClass, i: LayerInstance) => void
  runningId: string | null
  onNew: (c: LayerClass) => void
}) {
  return (
    <div className="point-manage">
      <div className="point-manage-summary"><span>{props.classes.length} classes</span><span>{props.classes.reduce((n, c) => n + c.instances.length, 0)} instances</span><span>选中行打开 Inspector</span></div>
      <div className="point-table-wrap">
        <table className="point-catalog-table">
          <thead><tr><th>类 / 实例</th><th>Group</th><th>Status</th><th>Effect</th><th>Inst</th><th>参数 / 操作</th></tr></thead>
          <tbody>
            {props.classes.map((classItem) => (
              <Fragment key={classItem.id}>
                <tr className="point-class-row" onClick={() => props.onClass(classItem)}>
                  <td><span className="point-tree-icon">◆</span><strong>{classItem.name}</strong><code>{classItem.id}</code></td>
                  <td>{classItem.family}</td><td><span className={`status-pill ${classItem.status}`}>{statusLabel[classItem.status]}</span></td>
                  <td><span className={`effect ${classItem.effect.toLowerCase()}`}>{classItem.effect}</span></td><td>{classItem.instances.length}</td>
                  <td><button className="point-row-plus" onClick={(event) => { event.stopPropagation(); props.onNew(classItem) }}>＋</button></td>
                </tr>
                {classItem.instances.map((instance) => (
                  <tr className="point-instance-table-row" key={instance.id} onClick={() => props.onInstance(classItem, instance)}>
                    <td><span className="point-tree-line">└</span><span className={`point-status-dot ${instance.status}`} />{instance.name}<code>{instance.id}</code></td>
                    <td>{classItem.family}</td><td><span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span></td>
                    <td>r{instance.rev}</td><td>{Object.keys(instance.params ?? {}).length}</td>
                    <td><span className="point-row-actions"><button onClick={(event) => { event.stopPropagation(); props.onRun(classItem, instance) }} disabled={props.runningId === instance.id || instance.status === 'archived'}>▶</button><button onClick={(event) => { event.stopPropagation(); props.onEdit(classItem, instance) }}>✎</button><button onClick={(event) => { event.stopPropagation(); props.onDuplicate(classItem, instance) }}>⧉</button><button onClick={(event) => { event.stopPropagation(); props.onArchive(classItem, instance) }}>{instance.status === 'archived' ? '↺' : '⌫'}</button></span></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResourcesView({ classes, onClass, onToast }: { classes: LayerClass[]; onClass: (c: LayerClass) => void; onToast: (message: string) => void }) {
  return (
    <div className="point-resources">
      <div className="point-resource-note"><Download size={15} /><span>资源与加载：显示类的加载状态与资源估算。真实安装/卸载接口后续接入。</span></div>
      {classes.map((classItem) => (
        <div className="point-resource-row" key={classItem.id} onClick={() => onClass(classItem)}>
          <span className="point-resource-icon">◆</span>
          <div><strong>{classItem.name}</strong><code>{classItem.id}</code></div>
          <span className={`status-pill ${classItem.status === 'active' ? 'active' : 'draft'}`}>{classItem.status === 'active' ? '已加载' : '可加载'}</span>
          <span className="point-resource-size">{classItem.instances.length * 8 + 12} MB</span>
          <button className="btn ghost small" onClick={(event) => { event.stopPropagation(); onToast(classItem.status === 'active' ? '资源已在内存中' : '资源加载接口待接入') }}>{classItem.status === 'active' ? '已加载' : '加载'}</button>
        </div>
      ))}
    </div>
  )
}

function Inspector({
  classItem, instance, lastRun, onRun, onEdit, onDuplicate, onArchive, onNew
}: {
  classItem?: LayerClass
  instance?: LayerInstance | null
  lastRun: RunRecord | null
  onRun: (c: LayerClass, i: LayerInstance) => void
  onEdit: (c: LayerClass, i: LayerInstance) => void
  onDuplicate: (c: LayerClass, i: LayerInstance) => void
  onArchive: (c: LayerClass, i: LayerInstance) => void
  onNew: (c: LayerClass) => void
}) {
  if (!classItem) return null
  const color = familyColors[classItem.family] ?? '#22d3ee'
  return (
    <>
      <div className="point-inspector-head">
        <div className="point-inspector-kicker">{instance ? 'INSTANCE' : 'POINT CLASS'}</div>
        <div className="point-inspector-title">{instance ? instance.name : classItem.name}</div>
        <div className="point-inspector-id">{instance ? `${instance.id} · r${instance.rev}` : `${classItem.id} · v1.0.0`}</div>
        <div className="point-inspector-badges"><span className={`priority ${classItem.priority.toLowerCase()}`}>{classItem.priority}</span><span className={`effect ${classItem.effect.toLowerCase()}`}>{classItem.effect}</span><span style={{ color }}>{classItem.family}</span><span className={`point-mini-badge ${hasRealImpl(classItem.id) ? 'impl-real' : 'impl-mock'}`}>{hasRealImpl(classItem.id) ? '真实实现' : '模拟实现'}</span></div>
      </div>
      {!instance ? (
        <>
          <p className="point-inspector-desc">{classItem.description}</p>
          <div className="point-inspector-section"><div className="point-inspector-label">契约</div><div className="kv-grid"><span>类 ID</span><strong>{classItem.id}</strong><span>家族</span><strong>{classItem.family}</strong><span>优先级</span><strong>{classItem.priority}</strong><span>副作用</span><strong>{classItem.effect}</strong><span>实例</span><strong>{classItem.instances.length}</strong><span>实现</span><strong>{hasRealImpl(classItem.id) ? IMPL_SUMMARY[classItem.id as ImplementedClassId] : '模拟 runner（无真实副作用）'}</strong></div></div>
          <div className="point-inspector-section"><div className="point-inspector-label">参数 Schema</div><div className="point-schema-list">{classItem.params.map((param) => <div key={param.key}><code>{param.key}</code><span>{param.type}{param.required ? ' · required' : ''}</span></div>)}</div></div>
          <div className="point-inspector-section"><div className="point-inspector-label">实例</div>{classItem.instances.map((item) => <button className="point-inspector-instance" key={item.id} onClick={() => onEdit(classItem, item)}><span className={`point-status-dot ${item.status}`} /><strong>{item.name}</strong><em>r{item.rev}</em></button>)}</div>
          <div className="point-inspector-actions"><button className="btn primary" onClick={() => onNew(classItem)}>＋ 新建实例</button></div>
        </>
      ) : (
        <>
          <p className="point-inspector-desc">{instance.description}</p>
          <div className="point-inspector-section"><div className="point-inspector-label">参数</div>{classItem.params.map((param) => <div className="point-inspector-param" key={param.key}><span>{param.label}</span><code>{String(instance.params?.[param.key] ?? '—')}</code></div>)}</div>
          <div className="point-inspector-section"><div className="point-inspector-label">运行</div><div className="point-run-info"><span>最近运行</span><strong>{lastRun ? `${lastRun.elapsedMs}ms · 刚刚` : '未运行'}</strong><span>状态</span><strong>{statusLabel[instance.status]}</strong></div></div>
          <div className="point-inspector-actions"><button className="btn primary" onClick={() => onRun(classItem, instance)} disabled={instance.status === 'archived'}>▶ 运行</button><button className="btn ghost" onClick={() => onEdit(classItem, instance)}><Pencil size={13} /> 编辑</button><button className="btn ghost" onClick={() => onDuplicate(classItem, instance)}><Copy size={13} /> 复制</button><button className="btn ghost" onClick={() => onArchive(classItem, instance)}><Archive size={13} /> {instance.status === 'archived' ? '恢复' : '归档'}</button></div>
        </>
      )}
    </>
  )
}

function FieldPolicyView({ classes, onToast }: { classes: LayerClass[]; onToast: (message: string) => void }) {
  const [autonomy, setAutonomy] = useState('A1')
  const levels = [
    ['A0', '建议', '只给建议，不自动执行', '低风险'],
    ['A1', '草稿', '生成草稿，用户确认', '默认'],
    ['A2', '自动可撤销', '自动执行，必须可撤销', '需审批'],
    ['A3', '禁止', '不允许自主执行', '最高风险']
  ]
  return (
    <div className="field-policy">
      <div className="field-policy-head">
        <div><div className="panel-eyebrow">FIELD / POLICY</div><h3>自主度与审批</h3><p>场给出建议或草稿；是否允许自动执行由 Policy 决定，单次运行不能绕过。</p></div>
        <span className="status-pill active">Policy v1</span>
      </div>
      <div className="field-autonomy-grid">
        {levels.map(([id, name, desc, risk]) => (
          <button key={id} className={`field-autonomy-card ${autonomy === id ? 'active' : ''}`} onClick={() => { setAutonomy(id); onToast(`自主度草稿：${id} ${name}`) }}>
            <div className="field-autonomy-id">{id}</div>
            <strong>{name}</strong>
            <span>{desc}</span>
            <em>{risk}</em>
          </button>
        ))}
      </div>
      <div className="field-policy-columns">
        <div className="field-policy-panel">
          <div className="field-policy-title">审批闸门</div>
          {[['L2 自动执行', true], ['跨层写入', true], ['访问外部网络', false], ['读取剪贴板', true]].map(([label, enabled]) => (
            <div className="field-policy-row" key={String(label)}><span>{label}</span><span className={`field-policy-switch ${enabled ? 'on' : ''}`}><i /></span></div>
          ))}
        </div>
        <div className="field-policy-panel">
          <div className="field-policy-title">允许落点</div>
          {['点层 · Point', '线层 · Line', '面层 · Surface', '体层 · Body'].map((label, index) => (
            <div className="field-policy-row" key={label}><span>{label}</span><span className={`field-policy-check ${index < 3 ? 'on' : ''}`}>{index < 3 ? '✓' : '—'}</span></div>
          ))}
        </div>
        <div className="field-policy-panel">
          <div className="field-policy-title">预算与成本</div>
          <div className="field-budget"><strong>$3.28</strong><span>/ $50.00 本月</span></div>
          <div className="field-budget-bar"><span style={{ width: '6.5%' }} /></div>
          <div className="field-policy-note">当前 6.5% · 预算告警 80%</div>
        </div>
      </div>
      <div className="field-policy-table">
        <div className="field-policy-title">按类策略</div>
        <table><thead><tr><th>FieldClass</th><th>Family</th><th>Effect</th><th>默认自主度</th><th>审批</th></tr></thead><tbody>
          {classes.map((classItem) => <tr key={classItem.id}><td><strong>{classItem.name}</strong><code>{classItem.id}</code></td><td>{classItem.family}</td><td><span className={`effect ${classItem.effect.toLowerCase()}`}>{classItem.effect}</span></td><td>{classItem.effect === 'A0' ? 'A0 · 建议' : 'A1 · 草稿'}</td><td><span className="status-pill active">required</span></td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function FieldEvidenceView({ runs, onToast }: { runs: RunRecord[]; onToast: (message: string) => void }) {
  return (
    <div className="field-evidence">
      <div className="field-evidence-head"><div><div className="panel-eyebrow">FIELD / EVIDENCE</div><h3>证据与引用</h3><p>每次场层运行留下的输出、置信度、时间与可撤销入口。</p></div><button className="btn ghost small" onClick={() => onToast('证据导出将在审计接口接入后启用')}>导出证据</button></div>
      {runs.length ? (
        <div className="field-evidence-list">
          {runs.map((run) => {
            const confidence = typeof run.evidence?.confidence === 'number'
              ? (run.evidence.confidence as number).toFixed(2)
              : '—'
            const tier = typeof run.evidence?.tier === 'string' ? (run.evidence.tier as string) : null
            const attempts = Array.isArray(run.evidence?.attempts) ? run.evidence.attempts.length : 0
            return (
              <article className="field-evidence-card" key={run.id}>
                <div className="field-evidence-icon"><Sparkles size={15} /></div>
                <div className="field-evidence-main"><div><strong>{run.output}</strong><span className={`status-pill ${run.status}`}>{run.status === 'ok' ? '证据完整' : '需复核'}</span></div><code>{run.classId} · {run.instanceId}</code><div className="field-evidence-meta"><span>{run.elapsedMs}ms</span><span>confidence {confidence}</span>{tier && <span>{tier} 档{attempts > 1 ? ` · 重试 ${attempts - 1}` : ''}</span>}<span>{run.at}</span><span>evidence {run.id.slice(-8)}</span></div></div>
                <button className="text-btn" onClick={() => onToast('证据详情面板待接入')}>查看 →</button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="point-empty"><Sparkles size={22} /><strong>还没有场层证据</strong><span>在卡片/管理视图运行一个 FieldInstance，证据会出现在这里。</span></div>
      )}
      <div className="field-evidence-foot">证据不是日志：输出必须带来源、时间、置信度与可撤销状态。</div>
    </div>
  )
}

function FieldCostView({ classes }: { classes: LayerClass[] }) {
  const rows = classes.map((classItem, index) => ({
    classItem,
    route: index === 0 ? 'gpt-4.1-mini' : index === 1 ? 'local/embed' : 'gpt-4.1-mini',
    tokens: index === 0 ? '1.8k' : index === 1 ? '420' : '640',
    cost: index === 0 ? '$0.018' : index === 1 ? '$0.000' : '$0.006',
    calls: index === 0 ? 42 : index === 1 ? 120 : 68
  }))
  return (
    <div className="field-cost">
      <div className="field-cost-head"><div><div className="panel-eyebrow">FIELD / COST</div><h3>模型与成本</h3><p>模型是包资源；provider、路由与预算在设置中配置，单次运行不能超上限。</p></div><span className="status-pill active">本月 $3.28</span></div>
      <div className="field-cost-grid">
        <div className="field-cost-card"><span>本月预算</span><strong>$50.00</strong><em>已用 $3.28 · 6.5%</em><div className="field-budget-bar"><span style={{ width: '6.5%' }} /></div></div>
        <div className="field-cost-card"><span>今日调用</span><strong>230</strong><em>成功率 98.7%</em></div>
        <div className="field-cost-card"><span>单次上限</span><strong>$0.50</strong><em>policy cap</em></div>
        <div className="field-cost-card"><span>默认路由</span><strong>auto</strong><em>fallback: local</em></div>
      </div>
      <div className="point-table-wrap">
        <table className="point-catalog-table"><thead><tr><th>FieldClass</th><th>Provider / Model</th><th>Tokens / call</th><th>Calls</th><th>Cost</th><th>Status</th></tr></thead><tbody>
          {rows.map(({ classItem, route, tokens, cost, calls }) => <tr key={classItem.id}><td><strong>{classItem.name}</strong><code>{classItem.id}</code></td><td>{route}</td><td>{tokens}</td><td>{calls}</td><td>{cost}</td><td><span className="status-pill active">within budget</span></td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function profileFor(classId: string): BodyProfile | undefined {
  return bodyProfiles[classId]
}

function BodyCompositionView({ classes, onClass }: { classes: LayerClass[]; onClass: (c: LayerClass) => void }) {
  const [selectedId, setSelectedId] = useState(classes[0]?.id ?? '')
  const selected = classes.find((item) => item.id === selectedId) ?? classes[0]
  const profile = selected ? profileFor(selected.id) : undefined
  const layerMeta: Record<string, { label: string; color: string }> = {
    point: { label: '点', color: '#22d3ee' },
    line: { label: '线', color: '#60a5fa' },
    surface: { label: '面', color: '#34d399' },
    field: { label: '场', color: '#f472b6' }
  }
  return (
    <div className="body-composition">
      <div className="body-view-head"><div><div className="panel-eyebrow">BODY / COMPOSITION</div><h3>组合</h3><p>体是点、线、面、场的组合；组合引用必须可解析、可替换、可回滚。</p></div><span className="status-pill active">composition graph</span></div>
      <div className="body-composition-layout">
        <div className="body-class-picker">
          {classes.map((classItem) => {
            const itemProfile = profileFor(classItem.id)
            return <button key={classItem.id} className={selectedId === classItem.id ? 'active' : ''} onClick={() => { setSelectedId(classItem.id); onClass(classItem) }}><span>◆</span><div><strong>{classItem.name}</strong><code>{classItem.id}</code></div><em>{itemProfile?.composition.length ?? 0} parts</em></button>
          })}
        </div>
        <div className="body-composition-graph">
          {selected && profile ? (
            <>
              <div className="body-composition-root"><span>▣</span><div><strong>{selected.name}</strong><code>{profile.manifest.id} · v{profile.manifest.version}</code></div><em>{profile.composition.filter((part) => part.required).length} required</em></div>
              <div className="body-composition-connector">└─ composition</div>
              <div className="body-composition-parts">
                {profile.composition.map((part) => {
                  const meta = layerMeta[part.layer]
                  const unmet = isUnmet(part.layer, part.ref)
                  return (
                    <div className={`body-part${unmet ? ' unmet' : ''}`} key={`${part.layer}:${part.ref}`} title={unmet ? `未满足：缺少 ${part.layer}:${part.ref}` : undefined}>
                      <span className="body-part-layer" style={{ color: meta?.color, borderColor: `${meta?.color}33`, background: `${meta?.color}10` }}>{meta?.label}</span>
                      <div><strong>{part.ref}</strong><span>{part.role}</span></div>
                      {unmet ? <em className="body-part-gap">缺</em> : <em>{part.required ? 'required' : 'optional'}</em>}
                    </div>
                  )
                })}
              </div>
            </>
          ) : <div className="point-empty"><Boxes size={22} /><strong>没有组合定义</strong><span>这个体类还没有 composition profile。</span></div>}
        </div>
      </div>
      <div className="body-composition-foot">
        <span>组合解析：{profile?.composition.length ?? 0} 个引用</span>
        <span>已满足：{profile?.composition.filter((part) => !isUnmet(part.layer, part.ref)).length ?? 0}</span>
        <span>未满足：{profile?.composition.filter((part) => isUnmet(part.layer, part.ref)).length ?? 0}</span>
        <span>全局缺口：{gapSummary().unmetClasses} 个能力 / {gapSummary().owners} 处引用</span>
      </div>
      <div className="body-gap-panel">
        <div className="field-policy-title">缺口优先级（补哪个能力能解锁最多组合）</div>
        <div className="body-gap-list">
          {topGaps(5).map((gap) => (
            <div className="body-gap-row" key={gap.id}>
              <span className="body-gap-count">{gap.requiredBy.length} 处</span>
              <code>{gap.capability}</code>
              <span className="body-gap-owners">{[...new Set(gap.requiredBy.map((owner) => owner.owner))].slice(0, 3).join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BodyManifestView({ classes }: { classes: LayerClass[] }) {
  const [selectedId, setSelectedId] = useState(classes[0]?.id ?? '')
  const selected = classes.find((item) => item.id === selectedId) ?? classes[0]
  const profile = selected ? profileFor(selected.id) : undefined
  const manifest = profile?.manifest
  return (
    <div className="body-manifest">
      <div className="body-view-head"><div><div className="panel-eyebrow">BODY / MANIFEST</div><h3>Manifest</h3><p>安装、校验与权限审查都以 manifest 为准。签名无效的体不能进入生产。</p></div><span className={`status-pill ${manifest?.signature === 'valid' ? 'active' : 'draft'}`}>{manifest?.signature ?? 'unknown'} signature</span></div>
      <div className="body-manifest-layout">
        <div className="body-class-picker">
          {classes.map((classItem) => <button key={classItem.id} className={selectedId === classItem.id ? 'active' : ''} onClick={() => setSelectedId(classItem.id)}><span>◆</span><div><strong>{classItem.name}</strong><code>{classItem.id}</code></div><em>{profileFor(classItem.id)?.manifest.version ?? '—'}</em></button>)}
        </div>
        <div className="body-manifest-main">
          {manifest ? (
            <>
              <div className="body-manifest-meta-grid">
                <div><span>Version</span><strong>{manifest.version}</strong></div>
                <div><span>Channel</span><strong>{manifest.channel}</strong></div>
                <div><span>Publisher</span><strong>{manifest.publisher}</strong></div>
                <div><span>Digest</span><strong>{manifest.digest}</strong></div>
                <div><span>Entry</span><strong>{manifest.entry}</strong></div>
                <div><span>Signature</span><strong className={manifest.signature === 'valid' ? 'ok' : 'warn'}>{manifest.signature}</strong></div>
              </div>
              <div className="body-manifest-block"><div className="field-policy-title">Permissions</div><div className="body-permission-list">{manifest.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div></div>
              <div className="body-manifest-block"><div className="field-policy-title">Resources</div><div className="body-resource-grid"><div><span>CPU</span><strong>{manifest.resources.cpu}</strong></div><div><span>Memory</span><strong>{manifest.resources.memory}</strong></div><div><span>Disk</span><strong>{manifest.resources.disk}</strong></div></div></div>
              <div className="body-manifest-json"><div className="field-policy-title">manifest.json</div><pre>{JSON.stringify(manifest, null, 2)}</pre></div>
            </>
          ) : <div className="point-empty"><FileJson size={22} /><strong>没有 Manifest</strong><span>这个体类还没有 manifest profile。</span></div>}
        </div>
      </div>
    </div>
  )
}

function BodyLifecycleView({ classes, onToast }: { classes: LayerClass[]; onToast: (message: string) => void }) {
  const stageLabel: Record<string, string> = { draft: '草稿', active: '运行中', 'update-available': '可更新', archived: '已归档' }
  return (
    <div className="body-lifecycle">
      <div className="body-view-head"><div><div className="panel-eyebrow">BODY / LIFECYCLE</div><h3>生命周期</h3><p>安装、更新、回滚、归档。体更新与应用更新分开，更新前必须备份。</p></div><span className="status-pill active">3 bodies</span></div>
      <div className="body-lifecycle-stages">{['安装', '校验', '运行', '更新', '回滚'].map((stage, index) => <div className={`body-stage ${index < 3 ? 'done' : ''}`} key={stage}><span>{index + 1}</span><strong>{stage}</strong>{index < 4 && <i>→</i>}</div>)}</div>
      <div className="body-lifecycle-list">
        {classes.map((classItem) => {
          const profile = profileFor(classItem.id)
          const lifecycle = profile?.lifecycle
          if (!lifecycle) return null
          return <div className="body-lifecycle-row" key={classItem.id}><span className="body-lifecycle-icon">▣</span><div className="body-lifecycle-main"><strong>{classItem.name}</strong><code>{profile.manifest.id} · v{profile.manifest.version}</code><span>安装于 {lifecycle.installedAt} · 最近检查 {lifecycle.lastChecked}</span></div><span className={`status-pill ${lifecycle.stage === 'draft' ? 'draft' : 'active'}`}>{stageLabel[lifecycle.stage]}</span><div className="body-lifecycle-actions">{lifecycle.stage === 'update-available' && <button className="btn primary small" onClick={() => onToast(`已排队更新 ${classItem.name} · 先备份`)}>更新</button>}{lifecycle.previousVersion && <button className="btn ghost small" onClick={() => onToast(`回滚 ${classItem.name} → ${lifecycle.previousVersion}`)}>回滚</button>}<button className="btn ghost small" onClick={() => onToast(`已检查 ${classItem.name} 更新`)}>检查</button></div></div>
        })}
      </div>
      <div className="body-lifecycle-instances"><div className="field-policy-title">实例状态</div>{classes.map((classItem) => classItem.instances.map((instance) => <div className="body-instance-life" key={instance.id}><span className={`point-status-dot ${instance.status}`} /><strong>{instance.name}</strong><code>{instance.id}</code><span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span><em>r{instance.rev}</em></div>))}</div>
      <div className="body-lifecycle-foot">更新前备份 · 至少保留 2 个回滚版本 · 签名无效的体不可安装到生产。</div>
    </div>
  )
}
