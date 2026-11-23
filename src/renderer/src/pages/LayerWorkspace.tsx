import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  FileText,
  Layers3,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  X
} from 'lucide-react'
import type { LayerClass, LayerInstance, LayerMeta, RunRecord } from '../data'

export interface InstanceDraft {
  name: string
  description: string
  params: Record<string, string>
}

interface Props {
  layer: LayerMeta
  query: string
  onToast: (message: string) => void
  onCreateInstance: (
    layerKey: LayerMeta['key'],
    classId: string,
    draft: InstanceDraft
  ) => Promise<LayerInstance | null>
  onUpdateInstance: (
    layerKey: LayerMeta['key'],
    classId: string,
    instanceId: string,
    patch: Omit<InstanceDraft, 'name'> & { name: string }
  ) => Promise<LayerInstance | null>
  onArchiveInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<boolean>
  onRestoreInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<boolean>
  onDuplicateInstance: (layerKey: LayerMeta['key'], instanceId: string) => Promise<LayerInstance | null>
  onRunComplete: (run: RunRecord) => void
}

type DetailTab = 'overview' | 'params' | 'instances'

const statusLabel: Record<string, string> = {
  active: '运行中',
  draft: '草稿',
  archived: '已归档'
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'instance'
}

export function LayerWorkspace({
  layer,
  query,
  onToast,
  onCreateInstance,
  onUpdateInstance,
  onArchiveInstance,
  onRestoreInstance,
  onDuplicateInstance,
  onRunComplete
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState(layer.classes[0]?.id ?? '')
  const [selectedInstanceId, setSelectedInstanceId] = useState(layer.classes[0]?.instances[0]?.id ?? '')
  const [tab, setTab] = useState<DetailTab>('overview')
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [running, setRunning] = useState(false)
  const [instanceEditor, setInstanceEditor] = useState<{
    mode: 'create' | 'edit'
    instance?: LayerInstance
  } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParams, setFormParams] = useState<Record<string, string>>({})
  const [savingInstance, setSavingInstance] = useState(false)

  useEffect(() => {
    const first = layer.classes[0]
    setSelectedClassId(first?.id ?? '')
    setSelectedInstanceId(first?.instances[0]?.id ?? '')
    setTab('overview')
    setLastRun(null)
    setInstanceEditor(null)
  }, [layer.key])

  const selectedClass = useMemo(
    () => layer.classes.find((item) => item.id === selectedClassId) ?? layer.classes[0],
    [layer.classes, selectedClassId]
  )

  const selectedInstance = useMemo(
    () => selectedClass?.instances.find((item) => item.id === selectedInstanceId) ?? selectedClass?.instances[0],
    [selectedClass, selectedInstanceId]
  )

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return layer.classes
    return layer.classes.filter((item) => {
      const haystack = [
        item.id,
        item.name,
        item.family,
        item.description,
        item.priority,
        item.effect,
        ...item.params.map((param) => `${param.key} ${param.label}`),
        ...item.instances.map((instance) => `${instance.id} ${instance.name} ${instance.description}`)
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [layer.classes, query])

  function selectClass(item: LayerClass) {
    setSelectedClassId(item.id)
    setSelectedInstanceId(item.instances[0]?.id ?? '')
    setTab('overview')
    setLastRun(null)
  }

  function openCreateInstance() {
    const defaults = Object.fromEntries(
      selectedClass.params.map((param) => [param.key, param.defaultValue ?? ''])
    )
    setFormName('')
    setFormDescription('')
    setFormParams(defaults)
    setInstanceEditor({ mode: 'create' })
  }

  function openEditInstance(instance: LayerInstance) {
    const defaults = Object.fromEntries(
      selectedClass.params.map((param) => [param.key, param.defaultValue ?? ''])
    )
    setFormName(instance.name)
    setFormDescription(instance.description)
    setFormParams({ ...defaults, ...(instance.params ?? {}) })
    setInstanceEditor({ mode: 'edit', instance })
  }

  async function submitInstance() {
    if (!selectedClass || !formName.trim() || savingInstance) return
    setSavingInstance(true)
    try {
      if (instanceEditor?.mode === 'edit' && instanceEditor.instance) {
        const saved = await onUpdateInstance(layer.key, selectedClass.id, instanceEditor.instance.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          params: formParams
        })
        if (saved) {
          setSelectedInstanceId(saved.id)
          onToast(`实例已保存 · rev ${saved.rev}`)
        }
      } else {
        const saved = await onCreateInstance(layer.key, selectedClass.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          params: formParams
        })
        if (saved) {
          setSelectedInstanceId(saved.id)
          setTab('instances')
          onToast(`实例已创建 · ${saved.name}`)
        }
      }
      setInstanceEditor(null)
    } catch (error) {
      onToast(`保存失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSavingInstance(false)
    }
  }

  async function duplicateSelected() {
    if (!selectedInstance) return
    try {
      const copy = await onDuplicateInstance(layer.key, selectedInstance.id)
      if (copy) {
        setSelectedInstanceId(copy.id)
        setTab('instances')
        onToast(`实例已复制 · ${copy.name}`)
      }
    } catch (error) {
      onToast(`复制失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async function toggleArchive() {
    if (!selectedInstance) return
    const archived = selectedInstance.status === 'archived'
    try {
      const ok = archived
        ? await onRestoreInstance(layer.key, selectedInstance.id)
        : await onArchiveInstance(layer.key, selectedInstance.id)
      if (ok) onToast(archived ? '实例已恢复' : '实例已归档')
    } catch (error) {
      onToast(`${archived ? '恢复' : '归档'}失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async function runSelected() {
    if (!selectedClass || !selectedInstance || running) return
    if (selectedInstance.status === 'archived') {
      onToast('已归档实例不能运行，请先恢复')
      return
    }
    setRunning(true)
    try {
      const useBackend = Boolean(window.baiying) && ['point', 'line', 'surface', 'body'].includes(layer.key)
      const result = useBackend
        ? layer.key === 'line'
          ? await window.baiying.runLine({ classId: selectedClass.id, instanceId: selectedInstance.id })
          : layer.key === 'surface'
            ? await window.baiying.runSurface({ classId: selectedClass.id, instanceId: selectedInstance.id })
            : layer.key === 'body'
              ? await window.baiying.runBody({ classId: selectedClass.id, instanceId: selectedInstance.id })
              : await window.baiying.runPoint({ classId: selectedClass.id, instanceId: selectedInstance.id })
        : {
            ok: true,
            runId: `run-${String(Date.now()).slice(-6)}`,
            classId: selectedClass.id,
            instanceId: selectedInstance.id,
            output: `${layer.label}预览模式 · 模拟执行成功`,
            elapsedMs: 42,
            at: new Date().toISOString()
          }
      const record: RunRecord = {
        id: result.runId,
        layer: layer.key,
        classId: selectedClass.id,
        instanceId: selectedInstance.id,
        status: result.ok ? 'ok' : 'warn',
        output: result.output,
        elapsedMs: result.elapsedMs,
        at: '刚刚',
        createdAt: new Date(result.at).getTime()
      }
      setLastRun(record)
      onRunComplete(record)
      onToast(`运行成功 · ${result.output}`)
    } catch (error) {
      onToast(`运行失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setRunning(false)
    }
  }

  const LayerIcon = layer.icon
  const classLabel = layer.key === 'point' ? 'PointClass' : layer.key === 'line' ? 'FlowClass' : layer.key === 'surface' ? 'SurfaceClass' : layer.key === 'body' ? 'BodyClass' : 'FieldClass'

  if (!selectedClass) {
    return (
      <div className="page">
        <div className="empty-state">这个层还没有可用的类。</div>
      </div>
    )
  }

  return (
    <div className="page layer-page" style={{ '--layer-accent': layer.accent } as CSSProperties}>
      <header className="page-head">
        <div className="page-head-main">
          <div className="eyebrow">LAYER / {layer.en.toUpperCase()} / MANAGEMENT</div>
          <div className="page-title-row">
            <div className="page-title-icon">
              <LayerIcon size={22} />
            </div>
            <div>
              <h1>{layer.label}管理</h1>
              <p>{layer.description}</p>
            </div>
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn ghost" onClick={() => onToast('类由代码契约注册；当前环境先创建实例')}>
            <Plus size={14} /> 新建类
          </button>
          <button className="btn primary" onClick={openCreateInstance}>
            <Plus size={14} /> 新建实例
          </button>
        </div>
      </header>

      <div className="layer-overview">
        <div className="layer-overview-cell">
          <span>{classLabel}</span>
          <strong>{layer.totalClasses}</strong>
          <em>Class</em>
        </div>
        <div className="layer-overview-cell">
          <span>实例</span>
          <strong>{layer.totalInstances}</strong>
          <em>Instance</em>
        </div>
        <div className="layer-overview-cell">
          <span>P0 类</span>
          <strong>{layer.classes.filter((item) => item.priority === 'P0').length}</strong>
          <em>First ship</em>
        </div>
        <div className="layer-overview-cell">
          <span>示例类</span>
          <strong>{layer.classes.length}</strong>
          <em>In this view</em>
        </div>
        <div className="layer-overview-note">
          <Sparkles size={14} />
          <span>类定义契约，实例保存配置。先选实例，再运行。</span>
        </div>
      </div>

      <div className="layer-grid">
        <section className="panel class-list-panel">
          <div className="panel-head compact">
            <div>
              <div className="panel-eyebrow">CATALOG</div>
              <h2>类目录</h2>
            </div>
            <span className="panel-count">{filteredClasses.length}</span>
          </div>
          <div className="list-search">
            <Search size={13} />
            <span>{query ? `筛选：${query}` : '从上方搜索类、实例、参数'}</span>
          </div>
          <div className="class-list">
            {filteredClasses.map((item) => {
              const active = item.id === selectedClass.id
              return (
                <button
                  key={item.id}
                  className={`class-item ${active ? 'active' : ''}`}
                  onClick={() => selectClass(item)}
                >
                  <div className="class-item-top">
                    <div className="class-item-name">
                      <span className="class-dot" />
                      {item.name}
                    </div>
                    <span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
                  </div>
                  <div className="class-item-id">{item.id}</div>
                  <div className="class-item-meta">
                    <span>{item.family}</span>
                    <span className={`effect ${item.effect.toLowerCase()}`}>{item.effect}</span>
                    <span>{item.instances.length} 实例</span>
                  </div>
                </button>
              )
            })}
            {filteredClasses.length === 0 && (
              <div className="list-empty">
                <Search size={16} />
                <span>没有匹配的类</span>
              </div>
            )}
          </div>
          <div className="class-list-footer">
            <span>点击类查看契约</span>
            <ChevronRight size={13} />
          </div>
        </section>

        <section className="panel class-detail-panel">
          <div className="class-detail-head">
            <div className="class-detail-icon">
              <LayerIcon size={22} />
            </div>
            <div className="class-detail-title">
              <div className="class-detail-kicker">
                <span>{selectedClass.family}</span>
                <span className="meta-sep">·</span>
                <span>{selectedClass.id}</span>
              </div>
              <h2>{selectedClass.name}</h2>
              <p>{selectedClass.description}</p>
            </div>
            <div className="class-detail-actions">
              <button className="icon-btn" title="复制类 ID" onClick={() => { void navigator.clipboard?.writeText(selectedClass.id); onToast('类 ID 已复制') }}>
                <Copy size={15} />
              </button>
              <button className="icon-btn" title="更多">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          <div className="detail-stats">
            <div className="detail-stat">
              <span>优先级</span>
              <strong className={`priority-text ${selectedClass.priority.toLowerCase()}`}>{selectedClass.priority}</strong>
            </div>
            <div className="detail-stat">
              <span>副作用</span>
              <strong>{selectedClass.effect}</strong>
            </div>
            <div className="detail-stat">
              <span>参数</span>
              <strong>{selectedClass.params.length}</strong>
            </div>
            <div className="detail-stat">
              <span>实例</span>
              <strong>{selectedClass.instances.length}</strong>
            </div>
            <div className="detail-stat">
              <span>状态</span>
              <strong className="status-active">{statusLabel[selectedClass.status]}</strong>
            </div>
          </div>

          <div className="detail-tabs">
            {([
              ['overview', '概览'],
              ['params', '参数'],
              ['instances', `实例 ${selectedClass.instances.length}`]
            ] as const).map(([id, label]) => (
              <button key={id} className={`detail-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
            <div className="detail-tab-spacer" />
            <div className="effect-legend">
              <ShieldCheck size={12} />
              <span>权限按 effect 分级</span>
            </div>
          </div>

          {tab === 'overview' && (
            <div className="detail-body">
              <div className="overview-grid">
                <div className="overview-block">
                  <div className="block-label">契约摘要</div>
                  <div className="kv-grid">
                    <span>类 ID</span><strong>{selectedClass.id}</strong>
                    <span>家族</span><strong>{selectedClass.family}</strong>
                    <span>优先级</span><strong>{selectedClass.priority}</strong>
                    <span>副作用</span><strong>{selectedClass.effect}</strong>
                    <span>状态</span><strong>{statusLabel[selectedClass.status]}</strong>
                    <span>实例数</span><strong>{selectedClass.instances.length}</strong>
                  </div>
                </div>
                <div className="overview-block">
                  <div className="block-label">输入参数</div>
                  <div className="param-preview">
                    {selectedClass.params.map((param) => (
                      <div className="param-preview-row" key={param.key}>
                        <code>{param.key}</code>
                        <span>{param.type}</span>
                        {param.required && <em>required</em>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overview-block">
                <div className="block-label">实例</div>
                <div className="instance-strip">
                  {selectedClass.instances.map((instance) => (
                    <button
                      key={instance.id}
                      className={`mini-instance ${selectedInstance?.id === instance.id ? 'active' : ''}`}
                      onClick={() => { setSelectedInstanceId(instance.id); setTab('instances') }}
                    >
                      <span className="mini-instance-dot" />
                      <span>{instance.name}</span>
                      <em>r{instance.rev}</em>
                    </button>
                  ))}
                </div>
              </div>

              {lastRun && (
                <div className="last-run-card">
                  <div className="last-run-head">
                    <div>
                      <span className="block-label">最近运行</span>
                      <strong>{lastRun.classId}</strong>
                    </div>
                    <span className={`run-pill ${lastRun.status}`}>
                      <CheckCircle2 size={12} /> {lastRun.status === 'ok' ? '成功' : '需注意'}
                    </span>
                  </div>
                  <div className="last-run-output">{lastRun.output}</div>
                  <div className="last-run-meta">
                    <span>{lastRun.id}</span>
                    <span>{lastRun.elapsedMs}ms</span>
                    <span>刚刚</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'params' && (
            <div className="detail-body">
              <div className="table-wrap">
                <table className="params-table">
                  <thead>
                    <tr>
                      <th>参数</th>
                      <th>类型</th>
                      <th>必填</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClass.params.map((param) => (
                      <tr key={param.key}>
                        <td><code>{param.key}</code></td>
                        <td><span className="type-chip">{param.type}</span></td>
                        <td>{param.required ? <span className="required-chip">required</span> : <span className="muted">optional</span>}</td>
                        <td className="param-desc">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hint-box">
                <FileText size={15} />
                <span>参数 schema 来自类契约。实例只保存覆盖值，运行时输入优先级最高。</span>
              </div>
            </div>
          )}

          {tab === 'instances' && (
            <div className="detail-body">
              <div className="instances-head">
                <div>
                  <div className="block-label">实例列表</div>
                  <p>实例 = 类 + 参数 + 输出绑定 + revision。</p>
                </div>
                <button className="btn small primary" onClick={openCreateInstance}>
                  <Plus size={13} /> 新建实例
                </button>
              </div>
              <div className="instance-grid">
                {selectedClass.instances.map((instance) => (
                  <button
                    key={instance.id}
                    className={`instance-card ${selectedInstance?.id === instance.id ? 'active' : ''}`}
                    onClick={() => setSelectedInstanceId(instance.id)}
                  >
                    <div className="instance-card-top">
                      <span className="instance-dot" />
                      <strong>{instance.name}</strong>
                      <span className="instance-rev">r{instance.rev}</span>
                    </div>
                    <div className="instance-id">{instance.id}</div>
                    <div className="instance-desc">{instance.description}</div>
                    <div className="instance-card-meta">
                      <span className={`status-pill ${instance.status}`}>{statusLabel[instance.status]}</span>
                      <span className="instance-run-hint">{instance.status === 'archived' ? '已归档' : '选中后可运行'}</span>
                    </div>
                  </button>
                ))}
              </div>
              {selectedInstance && (
                <div className="instance-actions">
                  <button className="btn small ghost" onClick={() => openEditInstance(selectedInstance)}>
                    <Pencil size={12} /> 编辑参数
                  </button>
                  <button className="btn small ghost" onClick={() => { void duplicateSelected() }}>
                    <Copy size={12} /> 复制
                  </button>
                  <button className="btn small ghost" onClick={() => { void toggleArchive() }}>
                    {selectedInstance.status === 'archived' ? <RotateCcw size={12} /> : <Archive size={12} />}
                    {selectedInstance.status === 'archived' ? '恢复' : '归档'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="run-bar">
            <div className="run-target">
              <div className="run-target-icon"><Circle size={9} fill="currentColor" /></div>
              <div>
                <span>运行目标</span>
                <strong>{selectedInstance?.name ?? '未选择实例'}</strong>
              </div>
              <code>{selectedInstance?.id ?? '—'}</code>
              {selectedInstance && <span className={`status-pill ${selectedInstance.status}`}>{statusLabel[selectedInstance.status]}</span>}
            </div>
            <div className="run-bar-actions">
              <button className="btn ghost" onClick={() => onToast('试运行会先走 dry-run，再按 effect 决定是否确认')}>
                <ShieldCheck size={14} /> Dry-run
              </button>
              <button
                className="btn primary run-button"
                disabled={!selectedInstance || running || selectedInstance.status === 'archived'}
                onClick={() => { void runSelected() }}
              >
                {running ? <span className="spinner" /> : <Play size={14} fill="currentColor" />}
                {running ? '运行中…' : selectedInstance?.status === 'archived' ? '已归档' : '运行实例'}
              </button>
            </div>
          </div>

          {lastRun && (
            <div className="run-console">
              <div className="run-console-head">
                <div><Terminal size={14} /> <span>run console</span></div>
                <span>{lastRun.id}</span>
              </div>
              <div className="run-console-body">
                <span className="console-prompt">$</span>
                <span>{lastRun.classId} / {lastRun.instanceId}</span>
                <span className="console-ok">✓ {lastRun.output}</span>
                <span className="console-time">{lastRun.elapsedMs}ms</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {instanceEditor && (
        <div className="modal-overlay" onClick={() => setInstanceEditor(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="panel-eyebrow">{instanceEditor.mode === 'edit' ? 'EDIT INSTANCE' : 'NEW INSTANCE'}</div>
                <h2>{instanceEditor.mode === 'edit' ? '编辑' : '新建'} {layer.label}实例</h2>
                <p>类：<code>{selectedClass.id}</code></p>
              </div>
              <button className="icon-btn" onClick={() => setInstanceEditor(null)}><X size={16} /></button>
            </div>
            <div className="modal-form">
              <label>
                实例名称
                <input
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="例如：查找 VS Code"
                  autoFocus
                />
              </label>
              <label>
                说明
                <textarea
                  value={formDescription}
                  onChange={(event) => setFormDescription(event.target.value)}
                  placeholder="这个实例用来做什么？"
                  rows={2}
                />
              </label>
              <div className="form-section-label">实例参数</div>
              <div className="param-form-grid">
                {selectedClass.params.map((param) => (
                  <label key={param.key}>
                    {param.label}
                    <input
                      value={formParams[param.key] ?? ''}
                      onChange={(event) =>
                        setFormParams((current) => ({ ...current, [param.key]: event.target.value }))
                      }
                      placeholder={param.defaultValue || param.description}
                    />
                    <span className="param-key">{param.key}{param.required ? ' · required' : ''}</span>
                  </label>
                ))}
              </div>
              <div className="modal-preview">
                <Layers3 size={14} />
                <span>实例 ID</span>
                <code>{instanceEditor.mode === 'edit' ? instanceEditor.instance?.id : `${selectedClass.id}.${slug(formName || 'instance')}@r1`}</code>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setInstanceEditor(null)}>取消</button>
              <button className="btn primary" disabled={!formName.trim() || savingInstance} onClick={() => { void submitInstance() }}>
                {savingInstance ? <span className="spinner" /> : instanceEditor.mode === 'edit' ? <Pencil size={14} /> : <Plus size={14} />}
                {savingInstance ? '保存中…' : instanceEditor.mode === 'edit' ? '保存并升 revision' : '创建实例'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
