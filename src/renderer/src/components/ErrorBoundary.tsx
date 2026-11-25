import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 页面级错误边界。
 *
 * 之前任何一个页面抛异常，React 会把整棵树卸载掉 —— 窗口直接全黑，
 * 连侧边栏都消失，用户完全不知道发生了什么。
 *
 * 这里做三件事：
 *   1. 接住异常，保住外层布局（导航还能点，可以换页）
 *   2. 把 error + componentStack 打到 console，便于定位
 *   3. 界面上直说哪个组件炸了、错误是什么
 */
interface State {
  error: Error | null
  componentStack: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? '' })
    // 保留完整栈，DevTools 里可直接展开
    console.error('[ErrorBoundary] 渲染失败：', error)
    console.error('[ErrorBoundary] 组件栈：', info.componentStack)
  }

  render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children
    return (
      <div style={{ padding: 24, color: '#e5e7eb', fontFamily: 'Consolas, monospace', fontSize: 13 }}>
        <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 10 }}>这个页面渲染失败了</div>
        <div style={{ marginBottom: 10 }}>{error.message}</div>
        <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.7, fontSize: 11, maxHeight: 240, overflow: 'auto' }}>
          {componentStack.slice(0, 1200)}
        </pre>
        <button
          onClick={() => this.setState({ error: null, componentStack: '' })}
          style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#e5e7eb', cursor: 'pointer' }}
        >
          重试
        </button>
      </div>
    )
  }
}
