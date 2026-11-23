import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDot,
  Clock3,
  Inbox,
  PanelsTopLeft,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  Timer
} from 'lucide-react'
import type { RunHistoryItem } from '../../../shared/runHistory'

interface Props {
  items: RunHistoryItem[]
  loading: boolean
  onRefresh: () => void
  onNavigate: (section: 'point' | 'line' | 'surface' | 'body' | 'field') => void
}

function formatTime(createdAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return new Date(createdAt).toLocaleDateString('zh-CN')
}

function fullTime(createdAt: number): string {
  return new Date(createdAt).toLocaleString('zh-CN', { hour12: false })
}

export function RunHistoryPage({ items, loading, onRefresh, onNavigate }: Props) {
  const [layerFilter, setLayerFilter] = useState<'all' | 'point' | 'line' | 'surface' | 'body' | 'field'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'warn'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (layerFilter !== 'all' && item.layer !== layerFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!q) return true
      return [item.id, item.classId, item.instanceId, item.output, item.layer]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [items, layerFilter, statusFilter, query])

  useEffect(() => {
    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? '')
    }
  }, [filtered, selectedId])

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null
  const succeeded = items.filter((item) => item.status === 'ok').length
  const warned = items.filter((item) => item.status === 'warn').length
  const successRate = items.length ? Math.round((succeeded / items.length) * 100) : 0
  const avgLatency = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.elapsedMs, 0) / items.length)
    : 0

  return (
    <div className="page runs-page">
      <header className="page-head">
        <div className="page-head-main">
          <div className="eyebrow">OBSERVABILITY / RUNS</div>
          <div className="page-title-row">
            <div className="page-title-icon neutral">
              <Activity size={22} />
            </div>
            <div>
              <h1>运行历史</h1>
              <p>点线面体场共用一条运行观测链。每次运行都有实例、revision、输出、耗时与状态。</p>
            </div>
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn ghost" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> 刷新
          </button>
        </div>
      </header>

      <div className="run-stat-grid">
        <div className="run-stat">
          <Activity size={16} />
          <div><span>总运行</span><strong>{items.length}</strong></div>
        </div>
        <div className="run-stat">
          <CheckCircle2 size={16} />
          <div><span>成功率</span><strong>{successRate}%</strong></div>
        </div>
        <div className="run-stat">
          <Timer size={16} />
          <div><span>平均耗时</span><strong>{avgLatency}ms</strong></div>
        </div>
        <div className="run-stat warn">
          <ShieldAlert size={16} />
          <div><span>需注意</span><strong>{warned}</strong></div>
        </div>
      </div>

      <div className="run-layout">
        <section className="panel run-table-panel">
          <div className="run-toolbar">
            <div className="segmented">
              <button className={layerFilter === 'all' ? 'active' : ''} onClick={() => setLayerFilter('all')}>全部</button>
              <button className={layerFilter === 'point' ? 'active' : ''} onClick={() => setLayerFilter('point')}>点层</button>
              <button className={layerFilter === 'line' ? 'active' : ''} onClick={() => setLayerFilter('line')}>线层</button>
              <button className={layerFilter === 'surface' ? 'active' : ''} onClick={() => setLayerFilter('surface')}>面层</button>
              <button className={layerFilter === 'body' ? 'active' : ''} onClick={() => setLayerFilter('body')}>体层</button>
              <button className={layerFilter === 'field' ? 'active' : ''} onClick={() => setLayerFilter('field')}>场层</button>
            </div>
            <div className="segmented">
              <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>全部状态</button>
              <button className={statusFilter === 'ok' ? 'active' : ''} onClick={() => setStatusFilter('ok')}>成功</button>
              <button className={statusFilter === 'warn' ? 'active' : ''} onClick={() => setStatusFilter('warn')}>需注意</button>
            </div>
            <div className="run-search">
              <Search size={13} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 run / 类 / 实例 / 输出…" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="run-empty">
              <div className="run-empty-icon"><Inbox size={22} /></div>
              <strong>{items.length ? '没有匹配的运行' : '还没有运行记录'}</strong>
              <p>{items.length ? '换一个筛选条件试试。' : '去任意层运行一个实例，记录会自动出现在这里。'}</p>
              {!items.length && (
                <div className="run-empty-actions">
                  <button className="btn ghost" onClick={() => onNavigate('point')}><CircleDot size={13} /> 去点层</button>
                  <button className="btn ghost" onClick={() => onNavigate('line')}><Route size={13} /> 去线层</button>
                </div>
              )}
            </div>
          ) : (
            <div className="run-table-scroll">
              <table className="run-table">
                <thead>
                  <tr>
                    <th>状态</th>
                    <th>Run</th>
                    <th>层</th>
                    <th>类 / 实例</th>
                    <th>输出</th>
                    <th>耗时</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className={selected?.id === item.id ? 'active' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <span className={`run-state ${item.status}`}>
                          {item.status === 'ok' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                          {item.status === 'ok' ? '成功' : '需注意'}
                        </span>
                      </td>
                      <td className="run-id-cell">{item.id}</td>
                      <td>
                        <span className={`layer-tag ${item.layer}`}>
                          {item.layer === 'point' ? <CircleDot size={11} /> : item.layer === 'line' ? <Route size={11} /> : item.layer === 'surface' ? <PanelsTopLeft size={11} /> : item.layer === 'body' ? <Boxes size={11} /> : <Sparkles size={11} />}
                          {item.layer === 'point' ? '点' : item.layer === 'line' ? '线' : item.layer === 'surface' ? '面' : item.layer === 'body' ? '体' : '场'}
                        </span>
                      </td>
                      <td>
                        <div className="run-class">{item.classId}</div>
                        <div className="run-instance">{item.instanceId}</div>
                      </td>
                      <td className="run-output-cell">{item.output}</td>
                      <td className="run-latency">{item.elapsedMs}ms</td>
                      <td className="run-time">{formatTime(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="panel run-detail-panel">
          {selected ? (
            <>
              <div className="run-detail-head">
                <div className={`run-detail-orb ${selected.status}`}>
                  {selected.status === 'ok' ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}
                </div>
                <div>
                  <div className="panel-eyebrow">RUN DETAIL</div>
                  <h2>{selected.id}</h2>
                  <span className={`run-state ${selected.status}`}>
                    {selected.status === 'ok' ? '成功' : '需注意'} · {selected.elapsedMs}ms
                  </span>
                </div>
              </div>
              <div className="run-detail-body">
                <div className="run-detail-block">
                  <span>层 / 类</span>
                  <strong>{selected.layer === 'point' ? '点层' : selected.layer === 'line' ? '线层' : selected.layer === 'surface' ? '面层' : selected.layer === 'body' ? '体层' : '场层'} · {selected.classId}</strong>
                </div>
                <div className="run-detail-block">
                  <span>实例</span>
                  <code>{selected.instanceId}</code>
                </div>
                <div className="run-detail-block">
                  <span>输出</span>
                  <div className="run-detail-output">{selected.output}</div>
                </div>
                <div className="run-detail-block">
                  <span>时间</span>
                  <strong>{fullTime(selected.createdAt)}</strong>
                </div>
                <div className="run-detail-block">
                  <span>状态</span>
                  <strong className={selected.status === 'ok' ? 'status-active' : 'status-warn'}>
                    {selected.status === 'ok' ? 'ok' : 'warn'}
                  </strong>
                </div>
              </div>
              <div className="run-detail-footer">
                <button className="text-btn" onClick={() => onNavigate(selected.layer)}>
                  打开对应层 <ArrowUpRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <div className="run-detail-empty">
              <Activity size={20} />
              <span>选择一条运行查看详情</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
