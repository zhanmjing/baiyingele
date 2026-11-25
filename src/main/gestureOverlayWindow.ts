import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/**
 * 手势浮层窗口 —— 独立的全屏透明置顶窗口。
 *
 * 为什么必须是独立窗口：WGestures 的 CanvasWindowGestureView 就是一个
 * 独立的透明 canvas 窗口，所以在**任何程序里**画手势都能看见。
 * 如果画在主窗口里，用户必须先盯着百应窗口，那这个功能等于没用。
 *
 * 关键参数（少一个就不是真浮层）：
 *   transparent   → 背景透明
 *   frame: false  → 无边框无标题栏
 *   alwaysOnTop + level 'screen-saver' → 盖在所有普通窗口上
 *   skipTaskbar   → 不出现在任务栏
 *   focusable:false + setIgnoreMouseEvents(true) → 不抢焦点、不挡点击
 *   hasShadow:false → 没有窗口阴影（否则透明窗口边缘会有一圈灰）
 */

let overlay: BrowserWindow | null = null
let overlayReady = false
let overlayShown = false

export function createGestureOverlayWindow(devServerUrl?: string): BrowserWindow | null {
  if (overlay && !overlay.isDestroyed()) return overlay

  // 覆盖整个虚拟桌面（多显示器），而不是只覆盖主屏
  const primary = screen.getPrimaryDisplay()
  const bounds = primary.bounds

  overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    // 必须显式给全透明背景色：不给的话 Windows 上 Chromium 合成时
    // 可能画成黑底。WGestures 用 UpdateLayeredWindow + DIB 走 per-pixel alpha，
    // Electron 没这个 API，只能靠 backgroundColor 兜。
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 盖住全屏应用（screen-saver 层高于普通 alwaysOnTop）
  overlay.setAlwaysOnTop(true, 'screen-saver')
  // 完全穿透鼠标：点在浮层上等于点在下面的窗口
  overlay.setIgnoreMouseEvents(true, { forward: true })
  // 不进任务栏、不参与 Alt+Tab
  overlay.setSkipTaskbar(true)
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 不调 show()：照 WGestures 的 Visible = false，画手势时才显示。
  // 一直挂着的全屏置顶窗口会一直占合成资源，也更容易被别的程序误判。
  overlay.once('ready-to-show', () => { overlayReady = true })
  overlay.on('closed', () => {
    overlay = null
  })

  // 用同一个渲染入口，加 ?overlay=1，渲染层据此只画浮层
  if (devServerUrl) {
    void overlay.loadURL(`${devServerUrl}?overlay=1`)
  } else {
    void overlay.loadFile(join(__dirname, '../renderer/index.html'), { search: 'overlay=1' })
  }

  return overlay
}

export function getGestureOverlayWindow(): BrowserWindow | null {
  return overlay && !overlay.isDestroyed() ? overlay : null
}

/**
 * 有手势时显示浮层，没有就藏起来（对应 WGestures 的 Visible 开关）。
 * 只在状态真的变化时调 show/hide，避免每帧都发窗口消息。
 */
export function setOverlayVisible(visible: boolean): void {
  const win = getGestureOverlayWindow()
  if (!win || !overlayReady) return
  if (visible === overlayShown) return
  overlayShown = visible
  if (visible) {
    win.showInactive()
    win.setAlwaysOnTop(true, 'screen-saver')
  } else {
    win.hide()
  }
}

/** 推给浮层窗口；浮层没起来就安静返回 false，不抛错 */
export function sendToOverlay(channel: string, payload: unknown): boolean {
  const win = getGestureOverlayWindow()
  if (!win || win.webContents.isDestroyed()) return false
  win.webContents.send(channel, payload)
  return true
}

export function destroyGestureOverlayWindow(): void {
  if (overlay && !overlay.isDestroyed()) overlay.destroy()
  overlay = null
}

/** 显示器变化时重设尺寸（拔插显示器、改分辨率都要跟） */
export function resizeOverlayToPrimary(): void {
  const win = getGestureOverlayWindow()
  if (!win) return
  const b = screen.getPrimaryDisplay().bounds
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height })
}
