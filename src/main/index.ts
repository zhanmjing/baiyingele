import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { RunHistoryItem } from '../shared/runHistory'
import { LAYER_KEYS, type LayerKey } from '../shared/layerKeys'
import { LAYER_DEFS } from './layerRegistry'
import { runCapability } from './capabilities'
import { createLineRunner } from './flowRuntime'
import { applyLanding } from './fieldRuntime'
import { UndoJournal } from './undoJournal'
import { decideLanding } from '../shared/fieldLanding'
import { registeredCombos } from './capabilities/win.key.trigger'
import { resolveForm, setFormSink } from './capabilities/ui.form'
import { TriggerStore } from './triggerStore'
import { TriggerService } from './triggerService'
import { lineProfiles } from '../shared/lineCatalog'
import {
  LayerStore,
  mockRunner,
  type CreateInstanceInput,
  type InstanceRunner,
  type UpdateInstanceInput
} from './layerStore'

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

let mainWindow: BrowserWindow | null = null
const stores = new Map<LayerKey, LayerStore>()

function store(key: LayerKey): LayerStore {
  const found = stores.get(key)
  if (!found) throw new Error(`layer 未初始化: ${key}`)
  return found
}

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

/** 五层 IPC：改一层的行为只需改 layerRegistry / layerStore / capabilities */
function registerLayerIpc(): void {
  for (const key of LAYER_KEYS) {
    ipcMain.handle(`${key}:catalog`, () => store(key).catalog())
    ipcMain.handle(`${key}:runs`, (_event, limit?: number) => store(key).runs(limit))

    ipcMain.handle(`${key}:instance:create`, (_event, input: CreateInstanceInput) =>
      store(key).create(input)
    )
    ipcMain.handle(
      `${key}:instance:update`,
      (_event, payload: { instanceId: string; patch: UpdateInstanceInput }) =>
        store(key).update(payload.instanceId, payload.patch)
    )
    ipcMain.handle(`${key}:instance:archive`, (_event, instanceId: string) =>
      store(key).archive(instanceId)
    )
    ipcMain.handle(`${key}:instance:restore`, (_event, instanceId: string) =>
      store(key).restore(instanceId)
    )
    ipcMain.handle(`${key}:instance:duplicate`, (_event, instanceId: string) =>
      store(key).duplicate(instanceId)
    )

    ipcMain.handle(`${key}:run`, async (_event, payload: { instanceId: string }) => {
      const record = await store(key).run(payload.instanceId)
      return {
        ok: record.status === 'ok',
        runId: record.id,
        classId: record.classId,
        instanceId: record.instanceId,
        output: record.output,
        elapsedMs: record.elapsedMs,
        at: new Date(record.createdAt).toISOString(),
        ...(record.evidence ? { evidence: record.evidence } : {})
      }
    })
  }
}

/**
 * 单实例锁。
 * 两个实例会共享同一个 userData 目录，同时写 points/flows/surfaces/bodies/runs/trigger-bindings
 * 这几份 json —— 后写的覆盖先写的，会造成绑定丢失、运行记录串味。
 * 第二个实例直接退出，把已有窗口拉到前台。
 */
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return
  // Windows 上 Electron Notification 需要 AppUserModelId 才会显示
  app.setAppUserModelId('com.baiying.desktop')

  const dataDir = app.getPath('userData')

  /** 点层 / 场层：有真实实现的类走 capabilities，其余回落到模拟 */
  const capabilityRunner: InstanceRunner = async (context) =>
    (await runCapability(context)) ?? mockRunner(context)
  const undoJournal = new UndoJournal(join(dataDir, 'field-undo.json'))

  /** 触发器服务：钩子命中 → 查绑定 → 跑点/线实例 */
  const triggerService = new TriggerService({
    store: new TriggerStore(join(dataDir, 'trigger-bindings.json')),
    pointStore: () => store('point'),
    lineStore: () => store('line'),
    onFired: (record) => {
      mainWindow?.webContents.send('trigger:fired', record)
    }
  })

  /** 场层：先出建议，再按自主度决定要不要真的落到目标位置（A2 才写，且必留撤销令牌） */
  const fieldRunner: InstanceRunner = async (context) => {
    const outcome = (await runCapability(context)) ?? (await mockRunner(context))
    if (!outcome.landing) return outcome

    const decision = decideLanding(context.pointClass.effect, outcome.landing)
    const landed = await applyLanding({
      decision,
      landing: outcome.landing,
      pointStore: store('point'),
      journal: undoJournal
    })

    return {
      ...outcome,
      output: `${outcome.output}｜${landed.note}`,
      evidence: {
        ...(outcome.evidence ?? {}),
        landing: outcome.landing,
        landingAction: decision.action,
        landingNote: landed.note,
        ...(landed.undoToken ? { undoToken: landed.undoToken } : {})
      }
    }
  }

  /** 线层：解析数据流图，逐个节点调用点层，并把结果串起来 */
  const lineRunner = createLineRunner({ profiles: lineProfiles, pointStore: () => store('point') })

  for (const key of LAYER_KEYS) {
    const runner =
      key === 'line'
        ? lineRunner
        : key === 'field'
          ? fieldRunner
          : key === 'surface' || key === 'body'
            ? undefined
            : capabilityRunner
    stores.set(key, new LayerStore(join(dataDir, `${key}-state.json`), LAYER_DEFS[key], runner))
  }

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

  const triggerStatus = triggerService.start()

  ipcMain.handle('ui:form:resolve', (_event, requestId: string, answer) => resolveForm(requestId, answer))

  ipcMain.handle('trigger:list', () => ({
    bindings: triggerService.list(),
    firings: triggerService.recent(30),
    combos: registeredCombos(),
    failures: triggerStatus.failures
  }))
  ipcMain.handle('trigger:add', (_event, input) => triggerService.add(input))
  ipcMain.handle('trigger:remove', (_event, id: string) => triggerService.remove(id))
  ipcMain.handle('trigger:simulate', (_event, combo: string) => triggerService.dispatchHotkey(combo))
  ipcMain.handle('trigger:gesture', (_event, points: { x: number; y: number; t?: number }[]) =>
    triggerService.dispatchGesturePoints(points)
  )

  ipcMain.handle('field:undo', (_event, token: string) => {
    const entry = undoJournal.take(token)
    if (!entry) return { ok: false, message: '撤销令牌不存在或已使用' }
    const point = store('point')
    if (!point.instance(entry.instanceId)) {
      return { ok: false, message: `目标实例已不存在：${entry.instanceId}` }
    }
    point.update(entry.instanceId, { params: { [entry.param]: entry.previous ?? '' } })
    return { ok: true, message: `已恢复 ${entry.instanceId}.${entry.param} = ${entry.previous ?? '(空)'}` }
  })

  ipcMain.handle('runs:history', (_event, limit = 100) => {
    const count = Math.max(1, Math.min(limit, 200))
    const items: RunHistoryItem[] = LAYER_KEYS.flatMap((key) =>
      store(key)
        .runs(count)
        .map((run) => ({ ...run, layer: key }))
    )
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, count)
  })

  registerLayerIpc()

  mainWindow = createWindow()

  // 表单能力需要一个「把请求送到界面」的通道；能力模块自己不碰 BrowserWindow
  setFormSink((request) => {
    mainWindow?.webContents.send('ui:form:request', request)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
