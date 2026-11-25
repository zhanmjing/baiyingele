import { useEffect, useMemo, useState } from 'react'
import { stringParams } from '../../../shared/layerTypes'
import {
  ArrowUpRight,
  Archive,
  ChevronRight,
  CircleDot,
  Copy,
  GitBranch,
  Link2,
  Pencil,
  Play,
  Plus,
  Search,
  X
} from 'lucide-react'
import type { LayerClass, LayerInstance, LayerMeta, RunRecord } from '../data'
import type { InstanceDraft } from './instanceDraft'
import { lineProfiles, type LineNode, type LineProfile } from '../../../shared/lineCatalog'

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
  onNavigate: (section: 'point') => void
}

const statusLabel: Record<string, string> = { active: '运行中', draft: '草稿', archived: '已归档' }

/**
 * profile 里的引用有两种形态，必须归一化后再渲染。
 *
 *   'point.key_send'                             字符串（旧）
 *   { layer: 'point', name: 'screen_capture' }   类引用（ClassRef）
 *   { layer, name, instance, rev }               实例引用（InstanceRef）
 *
 * generatedLineProfiles.json 里 39 个节点是对象形态。
 * 直接 {node.pointClass} 渲染对象会让 React 抛
 * 「Objects are not valid as a React child」，整棵树被卸载 —— 页面直接全黑。
 */
function refText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const layer = typeof o.layer === 'string' ? o.layer : ''
    const name = typeof o.name === 'string' ? o.name : ''
    const instance = typeof o.instance === 'string' ? o.instance : ''
    const rev = typeof o.rev === 'number' ? `@r${o.rev}` : ''
    if (instance) return layer ? `${layer}.${name}.${instance}${rev}` : `${name}.${instance}${rev}`
    if (name) return layer ? `${layer}.${name}` : name
  }
  return ''
}

function fallbackProfile(classItem: LayerClass): LineProfile {
  const entry: LineNode = { id: 'entry', x: 30, y: 98, w: 145, h: 76, label: '流程入口', kind: 'gate', gate: 'start', role: '类定义入口' }
  const nodes: LineNode[] = [entry, ...classItem.instances.slice(0, 4).map((instance, index) => ({
    id: `instance-${index + 1}`,
    x: 235 + index * 190,
    y: 98,
    w: 145,
    h: 76,
    label: instance.name,
    kind: 'point' as const,
    pointClass: classItem.id,
    pointInstance: instance.id,
    role: instance.description
  }))]
  return {
    classId: classItem.id,
    nodes,
    edges: nodes.slice(1).map((node) => ({ from: 'entry', to: node.id, label: 'LineInstance' }))
  }
}

export function LineManagementPage({
  layer, query, onToast, onCreateInstance, onUpdateInstance,
  onArchiveInstance, onRestoreInstance, onDuplicateInstance, onRunComplete, onNavigate
}: Props) {
  const [classId, setClassId] = useState(layer.classes[0]?.id ?? '')
  const [instanceId, setInstanceId] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [mode, setMode] = useState<'class' | 'instance'>('class')
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; instance?: LayerInstance } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParams, setFormParams] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return layer.classes.filter((item) => !q || [item.id, item.name, item.description].join(' ').toLowerCase().includes(q))
  }, [layer.classes, query])
  const selectedClass = layer.classes.find((item) => item.id === classId) ?? filteredClasses[0] ?? layer.classes[0]
  const selectedInstance = selectedClass?.instances.find((item) => item.id === instanceId) ?? null
  const profile = selectedClass ? lineProfiles[selectedClass.id] ?? fallbackProfile(selectedClass) : undefined
  const selectedNode = profile?.nodes.find((item) => item.id === nodeId) ?? null

  useEffect(() => {
    if (!selectedClass && layer.classes[0]) setClassId(layer.classes[0].id)
  }, [layer.classes, selectedClass])

  const allInstances = layer.classes.reduce((sum, item) => sum + item.instances.length, 0)
  const allNodes = Object.values(lineProfiles).reduce((sum, item) => sum + item.nodes.length, 0)
  const linked = profile?.nodes.filter((node) => node.kind === 'point' && node.pointInstance).length ?? 0
  const placeholders = profile?.nodes.filter((node) => node.kind === 'point' && !node.pointInstance).length ?? 0

  function selectClass(item: LayerClass) {
    setClassId(item.id)
    setInstanceId('')
    setNodeId('')
    setMode('class')
  }
  function selectInstance(item: LayerInstance) {
    setInstanceId(item.id)
    setNodeId('')
    setMode('instance')
  }
  function openCreate() {
    if (!selectedClass) return
    setEditor({ mode: 'create' })
    setFormName('')
    setFormDescription('')
    setFormParams(Object.fromEntries(selectedClass.params.map((param) => [param.key, param.defaultValue ?? ''])))
  }
  function openEdit(instance: LayerInstance) {
    if (!selectedClass) return
    setEditor({ mode: 'edit', instance })
    setFormName(instance.name)
    setFormDescription(instance.description)
    setFormParams({
      ...Object.fromEntries(selectedClass.params.map((param) => [param.key, param.defaultValue ?? ''])),
      ...stringParams(instance.params)
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
        if (updated) { setInstanceId(updated.id); setMode('instance'); onToast(`实例已保存 · rev ${updated.rev}`) }
      } else {
        const created = await onCreateInstance(layer.key, selectedClass.id, {
          name: formName.trim(), description: formDescription.trim(), params: formParams
        })
        if (created) { setInstanceId(created.id); setMode('instance'); onToast(`实例已创建 · ${created.name}`) }
      }
      setEditor(null)
    } catch (error) { onToast(`保存失败：${error instanceof Error ? error.message : '未知错误'}`) }
    finally { setSaving(false) }
  }
  async function runInstance() {
    if (!selectedClass || !selectedInstance || running) return
    setRunning(true)
    try {
      const result = window.baiying
        ? await window.baiying.runLine({ classId: selectedClass.id, instanceId: selectedInstance.id })
        : { ok: true, runId: `run-${Date.now()}`, classId: selectedClass.id, instanceId: selectedInstance.id, output: '浏览器预览模式 · 模拟执行成功', elapsedMs: 42, at: new Date().toISOString() }
      const record: RunRecord = {
        id: result.runId, layer: 'line', classId: selectedClass.id, instanceId: selectedInstance.id,
        status: result.ok ? 'ok' : 'warn', output: result.output, elapsedMs: result.elapsedMs,
        at: '刚刚', createdAt: new Date(result.at).getTime()
      }
      setLastRun(record)
      onRunComplete(record)
      onToast(`运行成功 · ${result.output}`)
    } catch (error) { onToast(`运行失败：${error instanceof Error ? error.message : '未知错误'}`) }
    finally { setRunning(false) }
  }
  async function duplicate(instance: LayerInstance) {
    if (!selectedClass) return
    const copy = await onDuplicateInstance(layer.key, instance.id)
    if (copy) { setInstanceId(copy.id); setMode('instance'); onToast(`已复制 · ${copy.name}`) }
  }
  async function toggleArchive(instance: LayerInstance) {
    if (!selectedClass) return
    const archived = instance.status === 'archived'
    const ok = archived ? await onRestoreInstance(layer.key, instance.id) : await onArchiveInstance(layer.key, instance.id)
    if (ok) { setInstanceId(instance.id); setMode('instance'); onToast(archived ? '实例已恢复' : '实例已归档') }
  }

  return (
    <div className="page line-manager">
      <header className="line-head">
        <div><div className="eyebrow">LINE LAYER / MANAGEMENT</div><div className="line-title-row"><div className="line-title-icon"><GitBranch size={23} /></div><div><h1>线层管理</h1><p>LineClass 定义数据流图，LineInstance 绑定点层实现。线负责编排，不拥有点能力。</p></div></div></div>
        <div className="line-head-actions"><button className="btn ghost" onClick={openCreate}><Plus size={14} /> 新建实例</button><button className="btn primary" onClick={() => void runInstance()} disabled={!selectedInstance || running}><Play size={14} /> {running ? '运行中…' : '运行实例'}</button></div>
      </header>

      <div className="line-stat-grid">
        <div className="point-stat"><span>LineClass</span><strong>{layer.totalClasses}</strong><em>{layer.classes.length} loaded</em></div>
        <div className="point-stat"><span>LineInstance</span><strong>{allInstances}</strong><em>所有线层实例</em></div>
        <div className="point-stat"><span>FlowNode</span><strong>{profile?.nodes.length ?? 0}</strong><em>{allNodes} across classes</em></div>
        <div className="point-stat"><span>绑定状态</span><strong>{linked}</strong><em>{placeholders} placeholders</em></div>
      </div>

      <div className="line-layout">
        <aside className="line-sidebar">
          <div className="line-pane-head"><span>LineClass · 线层类</span><em>{filteredClasses.length}</em></div>
          <div className="line-class-list">
            {filteredClasses.map((item) => <button key={item.id} className={`line-class-item ${selectedClass?.id === item.id ? 'active' : ''}`} onClick={() => selectClass(item)}><span className="line-class-icon">↝</span><div><strong>{item.name}</strong><code>{item.id}</code></div><em>{item.instances.length}</em></button>)}
          </div>
          <div className="line-pane-head"><span>LineInstance · 线层实例</span><em>{selectedClass?.instances.length ?? 0}</em></div>
          <div className="line-instance-list">
            {selectedClass?.instances.map((item) => <button key={item.id} className={`line-instance-item ${instanceId === item.id ? 'active' : ''}`} onClick={() => selectInstance(item)}><span className={`point-status-dot ${item.status}`} /><div><strong>{item.name}</strong><code>{item.id}</code></div><em>r{item.rev}</em></button>)}
            {!selectedClass?.instances.length && <div className="line-empty-small">暂无实例</div>}
          </div>
        </aside>

        <main className="line-main">
          <div className="line-graph-panel">
            <div className="line-panel-head"><div><span className="panel-eyebrow">LINE / GRAPH</span><strong>{selectedClass?.name ?? 'LineClass'}</strong><em>{selectedClass?.id ?? ''}</em></div><div className="line-mode-tabs"><button className={mode === 'class' ? 'active' : ''} onClick={() => { setMode('class'); setNodeId('') }}>类定义</button><button className={mode === 'instance' ? 'active' : ''} onClick={() => setMode('instance')}>实例绑定</button></div></div>
            {profile ? <FlowGraph profile={profile} mode={mode} instance={selectedInstance} selectedNodeId={nodeId} onSelectNode={setNodeId} /> : <div className="point-empty"><GitBranch size={22} /><strong>没有数据流图</strong><span>此 LineClass 还没有 graph profile。</span></div>}
            <div className="line-legend"><span><i className="impl" />点层已实现</span><span><i className="ph" />占位符</span><span><i className="gate" />gate</span><span><i className="sub" />subflow</span></div>
          </div>
          <BindingTable profile={profile} selectedNodeId={nodeId} onSelectNode={setNodeId} onNavigate={onNavigate} />
        </main>

        <aside className="line-inspector">
          {selectedNode ? (
            <NodeInspector node={selectedNode} onBack={() => setNodeId('')} onNavigate={onNavigate} onToast={onToast} />
          ) : mode === 'instance' && selectedInstance ? (
            <InstanceInspector classItem={selectedClass} instance={selectedInstance} lastRun={lastRun} onRun={runInstance} onEdit={() => openEdit(selectedInstance)} onDuplicate={() => void duplicate(selectedInstance)} onArchive={() => void toggleArchive(selectedInstance)} />
          ) : selectedClass ? (
            <ClassInspector classItem={selectedClass} profile={profile} onNew={openCreate} instance={selectedInstance} onSelectInstance={selectInstance} />
          ) : null}
        </aside>
      </div>

      {editor && selectedClass && (
        <div className="modal-overlay" onClick={() => setEditor(null)}><div className="modal point-editor" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><div className="panel-eyebrow">{editor.mode === 'edit' ? 'EDIT FLOW INSTANCE' : 'NEW FLOW INSTANCE'}</div><h2>{editor.mode === 'edit' ? '编辑线层实例' : '新建线层实例'}</h2><p>类：<code>{selectedClass.id}</code></p></div><button className="icon-btn" onClick={() => setEditor(null)}><X size={16} /></button></div>
          <div className="modal-form"><label>实例名称<input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="例如：GitHub 工作流" autoFocus /></label><label>说明<textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={2} /></label><div className="form-section-label">实例参数</div><div className="param-form-grid">{selectedClass.params.map((param) => <label key={param.key}>{param.label}<input value={formParams[param.key] ?? ''} onChange={(event) => setFormParams((current) => ({ ...current, [param.key]: event.target.value }))} placeholder={param.defaultValue || param.description} /><span className="param-key">{param.key}{param.required ? ' · required' : ''}</span></label>)}</div></div>
          <div className="modal-actions"><button className="btn ghost" onClick={() => setEditor(null)}>取消</button><button className="btn primary" disabled={!formName.trim() || saving} onClick={() => void submitEditor()}>{saving ? '保存中…' : editor.mode === 'edit' ? '保存并升 revision' : '创建实例'}</button></div>
        </div></div>
      )}
    </div>
  )
}

function FlowGraph({ profile, mode, instance, selectedNodeId, onSelectNode }: {
  profile: LineProfile
  mode: 'class' | 'instance'
  instance: LayerInstance | null
  selectedNodeId: string
  onSelectNode: (id: string) => void
}) {
  const width = Math.max(...profile.nodes.map((node) => node.x + node.w), 500) + 25
  const height = Math.max(...profile.nodes.map((node) => node.y + node.h), 190) + 25
  return (
    <div className="line-graph-scroll">
      <div className="line-canvas" style={{ width, height }}>
        <svg width={width} height={height} className="line-edge-layer">
          {profile.edges.map((edge) => {
            const from = profile.nodes.find((node) => node.id === edge.from)
            const to = profile.nodes.find((node) => node.id === edge.to)
            if (!from || !to) return null
            const x1 = from.x + from.w
            const y1 = from.y + from.h / 2
            const x2 = to.x
            const y2 = to.y + to.h / 2
            return <g key={`${edge.from}-${edge.to}`}><line x1={x1} y1={y1} x2={x2} y2={y2} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle">{edge.label}</text></g>
          })}
        </svg>
        {profile.nodes.map((node) => {
          const isPoint = node.kind === 'point'
          const implemented = isPoint && Boolean(node.pointInstance)
          return (
            <button key={node.id} className={`line-node ${node.kind} ${implemented ? 'impl' : isPoint ? 'placeholder' : ''} ${selectedNodeId === node.id ? 'selected' : ''}`} style={{ left: node.x, top: node.y, width: node.w, height: node.h }} onClick={() => onSelectNode(node.id)}>
              <span className="line-node-kind">{node.kind === 'point' ? 'POINT SLOT' : node.kind === 'gate' ? 'GATE' : 'SUBFLOW'}</span>
              <strong>{node.label}</strong>
              <em>{refText(node.pointClass) || (node.kind === 'gate' ? `gate:${node.gate}` : 'LineInstance')}</em>
              <span className={`line-node-badge ${implemented ? 'ok' : isPoint ? 'ph' : node.kind}`}>{node.kind === 'gate' ? 'gate' : node.kind === 'subflow' ? 'subflow' : implemented ? '点层已实现' : '占位符'}</span>
              {mode === 'instance' && instance && <span className="line-node-pin">{node.pointInstance ? `${refText(node.pointInstance)} · bound` : 'unbound'}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BindingTable({ profile, selectedNodeId, onSelectNode, onNavigate }: {
  profile?: LineProfile
  selectedNodeId: string
  onSelectNode: (id: string) => void
  onNavigate: (section: 'point') => void
}) {
  return (
    <div className="line-bind-panel">
      <div className="line-panel-head"><div><span className="panel-eyebrow">BINDINGS</span><strong>节点与点层绑定</strong></div><span className="line-bind-count">{profile?.nodes.filter((node) => node.kind === 'point').length ?? 0} point slots</span></div>
      <div className="line-bind-table-wrap">
        <table className="line-bind-table"><thead><tr><th>节点</th><th>Kind</th><th>PointClass</th><th>PointInstance</th><th>状态</th><th /></tr></thead><tbody>
          {profile?.nodes.map((node) => {
            const implemented = node.kind === 'point' && Boolean(node.pointInstance)
            return <tr key={node.id} className={selectedNodeId === node.id ? 'on' : ''} onClick={() => onSelectNode(node.id)}><td><strong>{node.label}</strong><code>slot.{node.id}</code></td><td><span className={`line-kind-pill ${node.kind}`}>{node.kind}</span></td><td><code>{refText(node.pointClass) || (node.kind === 'gate' ? `gate:${node.gate}` : 'LineInstance')}</code></td><td><code>{refText(node.pointInstance) || '—'}</code></td><td>{node.kind === 'point' ? <span className={`line-bind-state ${implemented ? 'ok' : 'ph'}`}>{implemented ? '已实现' : '占位符'}</span> : <span className="line-bind-state muted">—</span>}</td><td>{implemented && <button className="text-btn" onClick={(event) => { event.stopPropagation(); onNavigate('point') }}>打开点层 <ArrowUpRight size={10} /></button>}</td></tr>
          })}
        </tbody></table>
      </div>
    </div>
  )
}

function ClassInspector({ classItem, profile, onNew, instance, onSelectInstance }: {
  classItem: LayerClass
  profile?: LineProfile
  onNew: () => void
  instance: LayerInstance | null
  onSelectInstance: (instance: LayerInstance) => void
}) {
  const points = profile?.nodes.filter((node) => node.kind === 'point') ?? []
  const linked = points.filter((node) => node.pointInstance).length
  return (
    <div className="line-inspector-body">
      <div className="line-insp-kicker">LineClass · 线层类</div>
      <div className="line-insp-title">{classItem.name}</div>
      <div className="line-insp-id">{classItem.id} · v1.0.0</div>
      <div className="line-insp-badges"><span className={`priority ${classItem.priority.toLowerCase()}`}>{classItem.priority}</span><span className={`effect ${classItem.effect.toLowerCase()}`}>{classItem.effect}</span><span>{classItem.family}</span></div>
      <p className="line-insp-desc">{classItem.description}</p>
      <div className="line-insp-section"><div className="field-policy-title">Graph</div><div className="line-insp-stats"><div><strong>{profile?.nodes.length ?? 0}</strong><span>nodes</span></div><div><strong>{profile?.edges.length ?? 0}</strong><span>edges</span></div><div><strong>{linked}</strong><span>linked</span></div><div><strong>{points.length - linked}</strong><span>placeholder</span></div></div></div>
      <div className="line-insp-section"><div className="field-policy-title">参数 Schema</div>{classItem.params.map((param) => <div className="line-insp-param" key={param.key}><span>{param.label}</span><code>{param.type}{param.required ? ' · required' : ''}</code></div>)}</div>
      <div className="line-insp-section"><div className="field-policy-title">实例 · {classItem.instances.length}</div>{classItem.instances.map((item) => <button className={`line-insp-instance ${instance?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => onSelectInstance(item)}><span className={`point-status-dot ${item.status}`} /><strong>{item.name}</strong><em>r{item.rev}</em></button>)}</div>
      <button className="btn primary line-insp-new" onClick={onNew}><Plus size={13} /> 新建 LineInstance</button>
    </div>
  )
}

function InstanceInspector({ classItem, instance, lastRun, onRun, onEdit, onDuplicate, onArchive }: {
  classItem?: LayerClass
  instance: LayerInstance
  lastRun: RunRecord | null
  onRun: () => void
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
}) {
  return (
    <div className="line-inspector-body">
      <div className="line-insp-kicker">LineInstance · 线层实例</div>
      <div className="line-insp-title">{instance.name}</div>
      <div className="line-insp-id">{instance.id} · r{instance.rev}</div>
      <div className="line-insp-badges"><span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span><span>{classItem?.name}</span></div>
      <p className="line-insp-desc">{instance.description || '流程实例没有说明。'}</p>
      <div className="line-insp-section"><div className="field-policy-title">参数</div>{Object.entries(instance.params ?? {}).map(([key, value]) => <div className="line-insp-param" key={key}><span>{key}</span><code>{String(value || '—')}</code></div>)}</div>
      <div className="line-insp-section"><div className="field-policy-title">运行</div><div className="line-run-info"><span>最近运行</span><strong>{lastRun ? `${lastRun.elapsedMs}ms · 刚刚` : '未运行'}</strong><span>状态</span><strong>{statusLabel[instance.status]}</strong></div></div>
      <div className="line-insp-actions"><button className="btn primary" onClick={onRun}>▶ 运行</button><button className="btn ghost" onClick={onEdit}><Pencil size={12} /> 编辑</button><button className="btn ghost" onClick={onDuplicate}><Copy size={12} /> 复制</button><button className="btn ghost" onClick={onArchive}><Archive size={12} /> {instance.status === 'archived' ? '恢复' : '归档'}</button></div>
    </div>
  )
}

function NodeInspector({ node, onBack, onNavigate, onToast }: {
  node: LineNode
  onBack: () => void
  onNavigate: (section: 'point') => void
  onToast: (message: string) => void
}) {
  const implemented = node.kind === 'point' && Boolean(node.pointInstance)
  return (
    <div className="line-inspector-body">
      <button className="line-insp-back" onClick={onBack}><ChevronRight size={12} /> 返回</button>
      <div className="line-insp-kicker">FlowNode · {node.kind.toUpperCase()}</div>
      <div className="line-insp-title">{node.label}</div>
      <div className="line-insp-id">slot.{node.id} · {refText(node.pointClass) || (node.kind === 'gate' ? `gate:${node.gate}` : 'LineInstance')}</div>
      <div className="line-insp-badges"><span className={`line-kind-pill ${node.kind}`}>{node.kind}</span>{node.kind === 'point' && <span className={`line-bind-state ${implemented ? 'ok' : 'ph'}`}>{implemented ? '已实现' : '占位符'}</span>}</div>
      <p className="line-insp-desc">{node.role || '流程节点'}</p>
      {node.kind === 'point' && <div className="line-insp-section"><div className="field-policy-title">Point Binding</div><div className="line-node-binding"><div><span>PointClass</span><code>{refText(node.pointClass) || '—'}</code></div><div><span>PointInstance</span><code>{refText(node.pointInstance) || '—'}</code></div></div>{implemented ? <button className="btn primary line-insp-new" onClick={() => onNavigate('point')}><Link2 size={12} /> 打开点层实例 <ArrowUpRight size={11} /></button> : <div className="line-placeholder-note"><CircleDot size={12} /> 该点层实例尚未实现，线层先用占位符。点层实现后这里会出现跳转入口。</div>}</div>}
      {node.kind === 'gate' && <div className="line-insp-section"><div className="field-policy-title">Gate</div><div className="line-placeholder-note"><CircleDot size={12} /> 门节点由线层引擎执行，不绑定 PointInstance。</div></div>}
      {node.kind === 'subflow' && <div className="line-insp-section"><div className="field-policy-title">Subflow</div><div className="line-placeholder-note"><CircleDot size={12} /> 该节点绑定的是子流程 LineInstance，在 LineInstance 中维护。</div></div>}
      <button className="text-btn" onClick={() => onToast('节点编辑将在 LineClass 编辑器接入后启用')}>编辑节点定义</button>
    </div>
  )
}
