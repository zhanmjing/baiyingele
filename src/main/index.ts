import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { BodyStore, type CreateBodyInstanceInput, type UpdateBodyInstanceInput } from './bodyStore'
import { FieldStore, type CreateFieldInstanceInput, type UpdateFieldInstanceInput } from './fieldStore'
import { LineStore, type CreateLineInstanceInput, type UpdateLineInstanceInput } from './lineStore'
import type { RunHistoryItem } from '../shared/runHistory'
import { PointStore, type CreatePointInstanceInput, type UpdatePointInstanceInput } from './pointStore'
import { SurfaceStore, type CreateSurfaceInstanceInput, type UpdateSurfaceInstanceInput } from './surfaceStore'

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

let mainWindow: BrowserWindow | null = null
let pointStore: PointStore | null = null
let lineStore: LineStore | null = null
let surfaceStore: SurfaceStore | null = null
let bodyStore: BodyStore | null = null
let fieldStore: FieldStore | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    transparent: false,
    backgroundColor: '#0a0f18',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'none' as const } : {}),
    title: '百应 · 五层工作台',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 15 } }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#0a0f18',
            symbolColor: '#94a3b8',
            height: 48
          }
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const dataDir = app.getPath('userData')
  pointStore = new PointStore(join(dataDir, 'point-state.json'))
  lineStore = new LineStore(join(dataDir, 'line-state.json'))
  surfaceStore = new SurfaceStore(join(dataDir, 'surface-state.json'))
  bodyStore = new BodyStore(join(dataDir, 'body-state.json'))
  fieldStore = new FieldStore(join(dataDir, 'field-state.json'))

  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    dev: isDev,
    dataDir
  }))

  ipcMain.handle('app:open-data-dir', async () => {
    const result = await shell.openPath(dataDir)
    if (result) throw new Error(result)
    return true
  })

  ipcMain.handle('point:catalog', () => pointStore!.catalog())
  ipcMain.handle('point:runs', (_event, limit?: number) => pointStore!.runs(limit))

  ipcMain.handle('point:instance:create', (_event, input: CreatePointInstanceInput) =>
    pointStore!.create(input)
  )
  ipcMain.handle(
    'point:instance:update',
    (_event, payload: { instanceId: string; patch: UpdatePointInstanceInput }) =>
      pointStore!.update(payload.instanceId, payload.patch)
  )
  ipcMain.handle('point:instance:archive', (_event, instanceId: string) =>
    pointStore!.archive(instanceId)
  )
  ipcMain.handle('point:instance:restore', (_event, instanceId: string) =>
    pointStore!.restore(instanceId)
  )
  ipcMain.handle('point:instance:duplicate', (_event, instanceId: string) =>
    pointStore!.duplicate(instanceId)
  )

  ipcMain.handle('point:run', (_event, payload: { instanceId: string }) => {
    const record = pointStore!.run(payload.instanceId)
    return {
      ok: true,
      runId: record.id,
      classId: record.classId,
      instanceId: record.instanceId,
      output: record.output,
      elapsedMs: record.elapsedMs,
      at: new Date(record.createdAt).toISOString()
    }
  })


  ipcMain.handle('line:catalog', () => lineStore!.catalog())
  ipcMain.handle('line:runs', (_event, limit?: number) => lineStore!.runs(limit))
  ipcMain.handle('line:instance:create', (_event, input: CreateLineInstanceInput) =>
    lineStore!.create(input)
  )
  ipcMain.handle(
    'line:instance:update',
    (_event, payload: { instanceId: string; patch: UpdateLineInstanceInput }) =>
      lineStore!.update(payload.instanceId, payload.patch)
  )
  ipcMain.handle('line:instance:archive', (_event, instanceId: string) =>
    lineStore!.archive(instanceId)
  )
  ipcMain.handle('line:instance:restore', (_event, instanceId: string) =>
    lineStore!.restore(instanceId)
  )
  ipcMain.handle('line:instance:duplicate', (_event, instanceId: string) =>
    lineStore!.duplicate(instanceId)
  )
  ipcMain.handle('line:run', (_event, payload: { instanceId: string }) => {
    const record = lineStore!.run(payload.instanceId)
    return {
      ok: true,
      runId: record.id,
      classId: record.classId,
      instanceId: record.instanceId,
      output: record.output,
      elapsedMs: record.elapsedMs,
      at: new Date(record.createdAt).toISOString()
    }
  })

  ipcMain.handle('runs:history', (_event, limit = 100) => {
    const count = Math.max(1, Math.min(limit, 200))
    const items: RunHistoryItem[] = [
      ...pointStore!.runs(count).map((run) => ({ ...run, layer: 'point' as const })),
      ...lineStore!.runs(count).map((run) => ({ ...run, layer: 'line' as const })),
      ...surfaceStore!.runs(count).map((run) => ({ ...run, layer: 'surface' as const })),
      ...bodyStore!.runs(count).map((run) => ({ ...run, layer: 'body' as const })),
      ...fieldStore!.runs(count).map((run) => ({ ...run, layer: 'field' as const }))
    ]
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, count)
  })

  ipcMain.handle('surface:catalog', () => surfaceStore!.catalog())
  ipcMain.handle('surface:runs', (_event, limit?: number) => surfaceStore!.runs(limit))
  ipcMain.handle('surface:instance:create', (_event, input: CreateSurfaceInstanceInput) => surfaceStore!.create(input))
  ipcMain.handle(
    'surface:instance:update',
    (_event, payload: { instanceId: string; patch: UpdateSurfaceInstanceInput }) =>
      surfaceStore!.update(payload.instanceId, payload.patch)
  )
  ipcMain.handle('surface:instance:archive', (_event, instanceId: string) => surfaceStore!.archive(instanceId))
  ipcMain.handle('surface:instance:restore', (_event, instanceId: string) => surfaceStore!.restore(instanceId))
  ipcMain.handle('surface:instance:duplicate', (_event, instanceId: string) => surfaceStore!.duplicate(instanceId))
  ipcMain.handle('surface:run', (_event, payload: { instanceId: string }) => {
    const record = surfaceStore!.run(payload.instanceId)
    return {
      ok: true,
      runId: record.id,
      classId: record.classId,
      instanceId: record.instanceId,
      output: record.output,
      elapsedMs: record.elapsedMs,
      at: new Date(record.createdAt).toISOString()
    }
  })

  ipcMain.handle('body:catalog', () => bodyStore!.catalog())
  ipcMain.handle('body:runs', (_event, limit?: number) => bodyStore!.runs(limit))
  ipcMain.handle('body:instance:create', (_event, input: CreateBodyInstanceInput) => bodyStore!.create(input))
  ipcMain.handle(
    'body:instance:update',
    (_event, payload: { instanceId: string; patch: UpdateBodyInstanceInput }) =>
      bodyStore!.update(payload.instanceId, payload.patch)
  )
  ipcMain.handle('body:instance:archive', (_event, instanceId: string) => bodyStore!.archive(instanceId))
  ipcMain.handle('body:instance:restore', (_event, instanceId: string) => bodyStore!.restore(instanceId))
  ipcMain.handle('body:instance:duplicate', (_event, instanceId: string) => bodyStore!.duplicate(instanceId))
  ipcMain.handle('body:run', (_event, payload: { instanceId: string }) => {
    const record = bodyStore!.run(payload.instanceId)
    return {
      ok: true,
      runId: record.id,
      classId: record.classId,
      instanceId: record.instanceId,
      output: record.output,
      elapsedMs: record.elapsedMs,
      at: new Date(record.createdAt).toISOString()
    }
  })

  ipcMain.handle('field:catalog', () => fieldStore!.catalog())
  ipcMain.handle('field:runs', (_event, limit?: number) => fieldStore!.runs(limit))
  ipcMain.handle('field:instance:create', (_event, input: CreateFieldInstanceInput) => fieldStore!.create(input))
  ipcMain.handle(
    'field:instance:update',
    (_event, payload: { instanceId: string; patch: UpdateFieldInstanceInput }) =>
      fieldStore!.update(payload.instanceId, payload.patch)
  )
  ipcMain.handle('field:instance:archive', (_event, instanceId: string) => fieldStore!.archive(instanceId))
  ipcMain.handle('field:instance:restore', (_event, instanceId: string) => fieldStore!.restore(instanceId))
  ipcMain.handle('field:instance:duplicate', (_event, instanceId: string) => fieldStore!.duplicate(instanceId))
  ipcMain.handle('field:run', (_event, payload: { instanceId: string }) => {
    const record = fieldStore!.run(payload.instanceId)
    return {
      ok: true,
      runId: record.id,
      classId: record.classId,
      instanceId: record.instanceId,
      output: record.output,
      elapsedMs: record.elapsedMs,
      at: new Date(record.createdAt).toISOString()
    }
  })

  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
