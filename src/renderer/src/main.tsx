import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GestureOverlay } from './components/GestureOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

/**
 * 同一个渲染入口跑两种窗口：
 *   主窗口        → 完整 App
 *   手势浮层窗口  → 只有 GestureOverlay（?overlay=1）
 *
 * 用独立透明窗口跑浮层，才能在别的程序里画手势也看见。
 */
const isOverlay = new URLSearchParams(window.location.search).get('overlay') === '1'

if (isOverlay) {
  // 浮层窗口：整页透明，只留浮层
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  document.body.style.overflow = 'hidden'
  document.body.style.margin = '0'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isOverlay ? <GestureOverlay /> : <ErrorBoundary><App /></ErrorBoundary>}</React.StrictMode>
)
