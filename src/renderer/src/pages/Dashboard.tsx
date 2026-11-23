import type { CSSProperties } from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Cpu,
  Layers3,
  Play,
  ShieldCheck,
  Terminal,
  Zap
} from 'lucide-react'
import { layers, layerOrder, totalCatalog, type LayerKey, type RunRecord } from '../data'

interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  dev: boolean
}

interface Props {
  appInfo: AppInfo | null
  runs: RunRecord[]
  onNavigate: (section: 'dashboard' | LayerKey | 'runs' | 'settings') => void
}

const stats = [
  { label: '功能类', value: totalCatalog.classes, hint: 'Point / Line / Surface / Body / Field', icon: Layers3, tone: 'cyan' },
  { label: '实例', value: totalCatalog.instances, hint: '可配置、可归档、可绑定', icon: Zap, tone: 'violet' },
  { label: 'AI 基座', value: totalCatalog.aiClasses, hint: `${totalCatalog.aiInstances} 个 AI 实例`, icon: Cpu, tone: 'pink' },
  { label: '今日运行', value: 128, hint: '成功率 97.6%', icon: Activity, tone: 'green' }
]

const runLayerLabel: Record<LayerKey, string> = {
  point: '点',
  line: '线',
  surface: '面',
  body: '体',
  field: '场'
}

export function Dashboard({ appInfo, runs, onNavigate }: Props) {
  return (
    <div className="page dashboard">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">LOCAL-FIRST · FIVE LAYERS</div>
          <h1>
            五层协同，
            <br />
            <span>从触发到智能。</span>
          </h1>
          <p>
            点负责执行，线负责编排，面负责承载，体负责组合，场负责建议。
            每一层都可以独立开发、独立测试、独立替换。
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => onNavigate('point')}>
              <Play size={15} fill="currentColor" />
              打开点层
            </button>
            <button className="btn ghost" onClick={() => onNavigate('settings')}>
              系统设置
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <span className="status-dot" /> Electron 运行中
            </span>
            <span className="dot-sep" />
            <span>IPC 已连接</span>
            <span className="dot-sep" />
            <span>HMR 热更新</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-core">
            <div className="core-ring" />
            <div className="core-letter">百</div>
            <div className="core-caption">BAIYING CORE</div>
          </div>
          <div className="orbit-label orbit-label-top">场 · Field</div>
          <div className="orbit-label orbit-label-right">体 · Body</div>
          <div className="orbit-label orbit-label-bottom">面 · Surface</div>
          <div className="orbit-label orbit-label-left">线 · Line</div>
          <div className="orbit-label orbit-label-point">点 · Point</div>
        </div>
      </section>

      <section className="stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div className={`stat-card ${stat.tone}`} key={stat.label}>
              <div className="stat-icon">
                <Icon size={17} />
              </div>
              <div className="stat-body">
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-hint">{stat.hint}</div>
              </div>
              <div className="stat-spark">
                {[38, 52, 44, 68, 58, 78, 72, 92].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <div className="dashboard-grid">
        <section className="panel architecture-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">ARCHITECTURE</div>
              <h2>五层能力栈</h2>
            </div>
            <button className="text-btn" onClick={() => onNavigate('point')}>
              查看点层 <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="layer-stack">
            {[...layerOrder].reverse().map((key, index) => {
              const layer = layers[key]
              const Icon = layer.icon
              return (
                <button
                  className="layer-row"
                  key={key}
                  onClick={() => onNavigate(key)}
                  style={{ '--layer-accent': layer.accent } as CSSProperties}
                >
                  <div className="layer-index">0{layerOrder.length - index}</div>
                  <div className="layer-icon">
                    <Icon size={17} />
                  </div>
                  <div className="layer-name">
                    <strong>{layer.label}</strong>
                    <span>{layer.en}</span>
                  </div>
                  <div className="layer-desc">{layer.tagline}</div>
                  <div className="layer-bar">
                    <i style={{ width: `${40 + index * 11}%` }} />
                  </div>
                  <div className="layer-count">
                    {layer.totalClasses}
                    <span>类</span>
                  </div>
                  <ArrowUpRight size={13} className="layer-arrow" />
                </button>
              )
            })}
          </div>
          <div className="stack-note">
            <span>越往上越智能</span>
            <span className="stack-note-line" />
            <span>越往下越原子</span>
          </div>
        </section>

        <section className="panel runs-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">ACTIVITY</div>
              <h2>最近运行</h2>
            </div>
            <div className="live-badge">
              <span className="status-dot" /> live
            </div>
          </div>
          <div className="run-list">
            {runs.slice(0, 6).map((run) => {
              const layer = layers[run.layer]
              return (
                <button
                  className="run-item"
                  key={run.id}
                  onClick={() => onNavigate(run.layer)}
                >
                  <div className={`run-status ${run.status}`}>
                    {run.status === 'ok' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                  </div>
                  <div className="run-main">
                    <div className="run-title">
                      <span>{run.classId}</span>
                      <span className="run-id">{run.id}</span>
                    </div>
                    <div className="run-output">{run.output}</div>
                  </div>
                  <div className="run-meta">
                    <span className="run-layer" style={{ color: layer.accent }}>{runLayerLabel[run.layer]}</span>
                    <span>{run.elapsedMs}ms</span>
                    <span>{run.at}</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="panel-footer">
            <button className="text-btn" onClick={() => onNavigate('runs')}>
              查看全部运行 <ArrowUpRight size={13} />
            </button>
          </div>
        </section>

        <section className="panel system-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">RUNTIME</div>
              <h2>开发环境</h2>
            </div>
            <div className="runtime-badge">
              <span className="status-dot" /> ready
            </div>
          </div>
          <div className="runtime-grid">
            <div className="runtime-item">
              <Cpu size={15} />
              <span>Electron</span>
              <strong>{appInfo?.electron ?? '—'}</strong>
            </div>
            <div className="runtime-item">
              <Terminal size={15} />
              <span>Node</span>
              <strong>{appInfo?.node ?? '—'}</strong>
            </div>
            <div className="runtime-item">
              <ShieldCheck size={15} />
              <span>Platform</span>
              <strong>{appInfo?.platform ?? '—'} / {appInfo?.arch ?? '—'}</strong>
            </div>
            <div className="runtime-item">
              <Activity size={15} />
              <span>Mode</span>
              <strong>{appInfo?.dev ? 'development' : 'production'}</strong>
            </div>
          </div>
          <div className="runtime-code">
            <span className="code-comment"># 启动开发环境</span>
            <br />
            <span className="code-prompt">$</span> pnpm dev
          </div>
          <div className="quick-grid">
            <button className="quick-action" onClick={() => onNavigate('point')}>
              <Zap size={15} /> 点层目录
            </button>
            <button className="quick-action" onClick={() => onNavigate('field')}>
              <Cpu size={15} /> 场层策略
            </button>
            <button className="quick-action" onClick={() => onNavigate('settings')}>
              <ShieldCheck size={15} /> 安全设置
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
