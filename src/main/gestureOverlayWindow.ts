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

  overlay.once('ready-to-show', () => overlay?.showInactive())
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
