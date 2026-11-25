import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { RunHistoryItem } from '../shared/runHistory'
import { LAYER_KEYS, type LayerKey } from '../shared/layerKeys'
import { LAYER_DEFS } from './layerRegistry'
import { IMPLEMENTED_CLASS_IDS } from '../shared/implemented.generated'
import { createBodyRunner } from './bodyRuntime'
import { createSurfaceRunner } from './surfaceRuntime'
import { RUN_KIND_OF } from '../shared/layerApi'
import { runCapability } from './capabilities'
import { createLineRunner } from './lineRuntime'
import { applyLanding } from './fieldRuntime'
import { UndoJournal } from './undoJournal'
import { decideLanding } from '../shared/fieldLanding'
import { registeredCombos } from './classes/point/key_trigger'
import { resolveForm, setFormSink } from './classes/point/ui_form'
import { setRunHistorySource } from './classes/field/observe'
import { TriggerStore } from './triggerStore'
import { TriggerService } from './triggerService'
import { startSampling } from './classes/point/gesture_sample'
import { foregroundProcess } from './capabilities/_win32'
import { onResume as onGestureResume } from './classes/point/gesture_pause'
import { createGestureOverlayWindow, sendToOverlay, resizeOverlayToPrimary, setOverlayVisible } from './gestureOverlayWindow'
import { computeTrail } from './classes/surface/gesture_trail'
import { computeHint } from './classes/surface/gesture_hint'
import { lineProfiles } from '../shared/lineCatalog'
import { bodyProfiles } from '../shared/bodyCatalog'
import {
  LayerStore,
  type CreateInstanceInput,
  type InstanceRunner,
  type RunOutcome,
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

    // 损坏状态必须能被界面读到 —— 只留档不告诉人，等于还是静默
    ipcMain.handle(`${key}:corruption`, () => store(key).corruption())

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
        // 入口统一是 run<Layer>，语义靠这两个字段区分：
        // surface 是 render、body 是 assemble，都不是 execute
        layer: key,
        kind: RUN_KIND_OF[key],
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

  /**
   * 没有实现单元时的统一回答。
   *
   * 以前这里是 `?? mockRunner(context)` —— mockRunner 返回 ok + 随机耗时，
   * 于是 field.generate 这类**根本没写的类在界面上显示「执行成功」**。
   * 一个撒谎的零件比没有零件更糟：用户会以为功能在，实际什么都没做。
   */
  /**
   * 安全发送 IPC 事件。
   *
   * 直接写 mainWindow?.webContents.send(...) 不够：
   * `?.` 只挡住 null，挡不住「窗口已销毁」—— 开发态 HMR 重载、用户关窗、
   * 应用退出时都会命中，抛 `TypeError: Object has been destroyed`，
   * 而它发生在事件回调里，会变成主进程未捕获异常弹窗。
   */
  const safeSend = (channel: string, payload: unknown): void => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.webContents.isDestroyed()) return
      mainWindow.webContents.send(channel, payload)
    } catch {
      /* 发送失败不影响业务 */
    }
  }

  const notImplemented = (context: Parameters<InstanceRunner>[0]): RunOutcome => ({
    status: 'warn',
    output: `${context.instance.classId} 还没有实现单元（${context.instance.name ?? context.instance.id}）`,
    elapsedMs: 0,
    evidence: { kind: 'not-implemented', classId: context.instance.classId }
  })

  /** 点层 / 场层：有实现单元就跑，没有就如实报未实现 */
  const pointRunner: InstanceRunner = async (context) =>
    (await runCapability(context)) ?? notImplemented(context)
  const undoJournal = new UndoJournal(join(dataDir, 'field-undo.json'))

  /** 触发器绑定的存储；onFired 里要用它查绑定名来推提示 */
  const triggerBindingStore = new TriggerStore(join(dataDir, 'trigger-bindings.json'))

  /** 提示推送器：startGestureHook 里注入，onFired 里调用 */
  let hintSink: ((name: string, modifier?: string) => void) | null = null

  /** 触发器服务：钩子命中 → 查绑定 → 跑点/线实例 */
  const triggerService = new TriggerService({
    store: triggerBindingStore,
    pointStore: () => store('point'),
    lineStore: () => store('line'),
    onFired: (record) => {
      safeSend('trigger:fired', record)
      // 手势命中 → **当场**推提示。
      // 之前挂在 onPathGrow 里消费，但派发发生在抬手/滚轮之后，
      // 所以提示要等下一个手势才出现（这个 bug 很隐蔽）。
      if (record?.source === 'gesture' && record?.bindingId && hintSink) {
        const binding = triggerBindingStore.list().find((b) => b.id === record.bindingId)
        if (binding?.name) hintSink(binding.name, binding.gesture?.modifier)
      }
    }
  })

  /**
   * 全局鼠标采样 —— 手势链路的入口。
   *
   * point.gesture_sample 建好了但没人起钩子，所以手势只能靠 IPC 传点测试。
   * 这里接上：采样 → 识别派发 → 会话接管滚轮。
   *
   *   1. 一次采样结束 → dispatchGesturePoints
   *   2. 采样之外的滚轮 → feedSessionEvent
   *   3. 暂停时钩子停，恢复时重起
   */
  const startGestureHook = () => {
    // 采样过程中的实时方向串，第一颗滚轮派发时要用
    let currentDirections = ''
    // 触发按钮决定笔色（照原码按 Button 选 _mainPen/_middleBtnPen/_xBtnPen）
    let currentButton = 'right'
    // 画手势那一刻的前台进程；应用作用域靠它匹配（原码 GetExeAppByContext）
    let currentExePath = ''
    let lastTrailSent = 0

    /**
     * 轨迹走逐点流式：开始一次、每点一次、结束一次。
     * WGestures 在进程内直接 _gPath.AddLine，没有 IPC。
     * 跨进程只能把「每帧发整个数组」换成「每点发一个点」——
     * 单点约 20 字节，整数组 500 点时约 8KB/帧，差两个数量级。
     */
    const trailLayers = (button: string, recognized: boolean) => {
      const dpi = screen.getPrimaryDisplay().scaleFactor || 1
      return computeTrail({
        points: [], button, recognized, dpiFactor: dpi,
        instanceId: 'surface.gesture_trail.default@r1', params: {},
        deps: { hasClass: () => true, declaredRegionKeys: () => [] }
      }).layers
    }

    const pushTrailStart = (button: string) => {
      setOverlayVisible(true)
      const payload = { layers: trailLayers(button, false) }
      if (!sendToOverlay('gesture:trail-start', payload)) safeSend('gesture:trail-start', payload)
    }
    const pushTrailPoint = (point: { x: number; y: number }) => {
      if (!sendToOverlay('gesture:trail-point', point)) safeSend('gesture:trail-point', point)
    }
    const pushTrailPen = (button: string) => {
      const payload = { layers: trailLayers(button, true) }
      if (!sendToOverlay('gesture:trail-pen', payload)) safeSend('gesture:trail-pen', payload)
    }
    const pushTrailEnd = () => {
      if (!sendToOverlay('gesture:trail-end', null)) safeSend('gesture:trail-end', null)
      setOverlayVisible(false)
    }

    /** 把提示推给渲染层（surface.gesture_hint） */
    const pushHint = (name: string, modifier?: string, status = '', mode: 'recognized' | 'status' = 'recognized') => {
      const display = screen.getPrimaryDisplay()
      const hint = computeHint({
        name, modifier, status, mode,
        screen: { width: display.bounds.width, height: display.bounds.height },
        dpiFactor: display.scaleFactor || 1,
        instanceId: 'surface.gesture_hint.default@r1', params: {},
        deps: { hasClass: () => true, declaredRegionKeys: () => [] }
      })
      if (!sendToOverlay('gesture:hint', hint)) safeSend('gesture:hint', hint)
    }

    const start = () =>
      startSampling({
        onPathStart: (start) => {
          currentButton = start.button
          // 在**手势开始那一刻**取前台进程：抬手时焦点可能已经变了
          currentExePath = foregroundProcess()?.exePath ?? ''
          pushTrailStart(start.button)
        },
        onPathPoint: (point) => {
          pushTrailPoint(point)
        },
        onSample: (sample) => {
          currentDirections = ''
          // 抬手：清画布、收起浮层；提示由 hint 自己超时
          pushTrailEnd()
          // 抬手先结束会话（对应 PathTrackerOnPathEnd 里的 GestureEnded）。
          // 原码注释：「如果是一个允许修饰符执行的手势，显然它必然已经被执行过了，
          // 所以不执行而直接结束」——抬手不再派发。
          if (triggerService.endSessionOnPathEnd()) return
          if (sample.reason) return
          void triggerService
            .dispatchGesturePoints(sample.points, currentExePath || undefined)
            .catch((error) => console.warn('[gesture] 派发失败', error))
        },
        onWheel: (event) => {
          triggerService.feedSessionEvent(event)
        },
        // 采样中滚轮：有会话直接送；没有会话就用实时方向串派发（照原码在滚轮那刻执行）
        onWheelDuringSampling: (event) => {
          void triggerService
            .feedWheelDuringSampling(event, currentDirections)
            .catch((error) => console.warn('[gesture] 滚轮会话失败', error))
        },
        // 实时方向串（对应 EffectivePathGrow）—— 第一颗滚轮要靠它找绑定
        onPathGrow: (grow) => {
          currentDirections = grow.directions
          // 按钮要在这里设：抬手时才设的话，整个手势过程中用的都是上一个手势的按钮
          if (grow.button) currentButton = grow.button
          // 识别成功 → 只换笔，不重发点
          if (grow.directions) pushTrailPen(grow.button || currentButton)

        }
      })

    const result = start()
    if (!result.ok) {
      console.warn('[gesture] 全局钩子未启动：', result.message)
      return result
    }
    // 注入提示推送器：onFired 里要用它，而 onFired 定义在服务构造时
    hintSink = pushHint

    onGestureResume(() => {
      start()
    })
    return result
  }

  /**
   * 钩子失败绝不能阻塞启动。
   *
   * 这里踩过一次真实的坑：startGestureHook 在 whenReady 里、**IPC 注册之前**，
   * 它一抛异常，后面所有 ipcMain.handle 都不会执行 ——
   * 界面能打开，但每个 IPC 都失败，点层/线层页面直接空白。
   *
   * 所以这里必须 try/catch：手势子系统坏了，应用其它部分照常可用。
   */
  let hookStatus: { ok: boolean; message: string } = { ok: false, message: '未尝试启动' }
  try {
    hookStatus = startGestureHook()
  } catch (error) {
    hookStatus = { ok: false, message: error instanceof Error ? error.message : String(error) }
    console.warn('[gesture] 钩子启动抛异常，已降级：', hookStatus.message)
  }

  // 独立透明浮层窗口：这样在别的程序里画手势也能看见
  // 开发态用 devServerUrl，打包后用 loadFile
  try {
    createGestureOverlayWindow(process.env['ELECTRON_RENDERER_URL'])
    app.on('browser-window-created', () => resizeOverlayToPrimary())
  } catch (error) {
    console.warn('[gesture] 浮层窗口创建失败，已降级：', error instanceof Error ? error.message : String(error))
  }

  /** 场层：先出建议，再按自主度决定要不要真的落到目标位置（A2 才写，且必留撤销令牌） */
  const fieldRunner: InstanceRunner = async (context) => {
    const outcome = (await runCapability(context)) ?? notImplemented(context)
    if (!outcome.landing) return outcome

    // 必须用 autonomy，不能用 effect：
      // effect 是副作用等级（L0-L2），autonomy 才是自主度（A0-A2）。
      // 之前传 effect 能跑，纯粹因为场层类的 effect 里恰好存着 A 码。
      const decision = decideLanding(context.pointClass.autonomy ?? 'A0', outcome.landing)
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
  const lineRunner = createLineRunner({
    profiles: lineProfiles,
    pointStore: () => store('point'),
    lineStore: () => store('line')
  })

  /**
   * 体层：装配检查。体层没有自己的执行逻辑，只有零件清单（composition），
   * 所以 runBody 回答的是「零件齐不齐、缺哪几个」，不启动任何子功能。
   */
  const bodyRunner = createBodyRunner({
    profiles: bodyProfiles,
    hasClass: (layer, name) => {
      const def = LAYER_DEFS[layer as keyof typeof LAYER_DEFS]
      return !!def?.classes.some((cls) => cls.id === `${layer}.${name}`)
    },
    implementedClassIds: new Set<string>(IMPLEMENTED_CLASS_IDS)
  })

  /**
   * 面层：渲染。面层不执行、不产生副作用，runSurface 的产物是
   * 「本该渲染成什么」的描述（kind: 'render'），不是执行结果。
   */
  /**
   * 面层取数器。只处理需要外部访问的两种 source：
   *   run       → 该层的运行记录
   *   registry  → 目录里的类声明
   * static / params 由 resolveSlots 本地解析，不走这里。
   *
   * 「没有」和「坏了」必须分开：查不到是 empty/missing，store 抛异常才是 error。
   */
  const readSlotSource = async (source: { kind: string; layer?: string; classId?: string; limit?: number }) => {
    if (source.kind === 'run') {
      const layer = source.layer as keyof typeof LAYER_DEFS
      if (!LAYER_DEFS[layer]) return { status: 'error' as const, reason: `未知的层 ${String(source.layer)}` }
      try {
        const runs = store(layer).runs(source.limit ?? 20)
        return runs.length
          ? { status: 'ready' as const, value: runs }
          : { status: 'empty' as const, reason: `${String(source.layer)} 层还没有运行记录` }
      } catch (error) {
        return { status: 'error' as const, reason: `读取 ${String(source.layer)} 运行记录失败：${String(error)}` }
      }
    }
    if (source.kind === 'registry') {
      if (source.classId) {
        const cls = Object.values(LAYER_DEFS)
          .flatMap((def) => def.classes)
          .find((item) => item.id === source.classId)
        return cls
          ? { status: 'ready' as const, value: cls }
          : { status: 'missing' as const, reason: `目录里没有 ${source.classId}` }
      }
      const layer = source.layer as keyof typeof LAYER_DEFS
      if (!LAYER_DEFS[layer]) return { status: 'error' as const, reason: `未知的层 ${String(source.layer)}` }
      const classes = LAYER_DEFS[layer].classes
      return classes.length
        ? { status: 'ready' as const, value: classes }
        : { status: 'empty' as const, reason: `${String(source.layer)} 层目录是空的` }
    }
    return { status: 'error' as const, reason: `取数器不处理 ${source.kind}` }
  }

  const surfaceRunner = createSurfaceRunner({
    hasClass: (layer, name) => {
      const def = LAYER_DEFS[layer as keyof typeof LAYER_DEFS]
      return !!def?.classes.some((cls) => cls.id === `${layer}.${name}`)
    },
    read: readSlotSource as never,
    declaredRegionKeys: (classId) => {
      const cls = LAYER_DEFS.surface.classes.find((item) => item.id === classId)
      return (cls?.params ?? []).map((p) => p.key)
    }
  })

  for (const key of LAYER_KEYS) {
    const runner =
      key === 'line'
        ? lineRunner
        : key === 'field'
          ? fieldRunner
          : key === 'body'
            ? bodyRunner
            : key === 'surface'
              ? surfaceRunner
              : pointRunner
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

  /**
   * 在文件管理器里定位一个文件。
   *
   * 只允许定位 dataDir 内的路径 —— 渲染层拿到的路径来自 store，
   * 但 IPC 是公开边界，不能因为「上游可信」就放弃校验。
   */
  ipcMain.handle('app:reveal', (_event, target: string) => {
    const resolved = resolve(String(target ?? ''))
    const root = resolve(dataDir)
    if (!resolved.startsWith(root)) throw new Error('只能定位数据目录内的文件')
    if (!existsSync(resolved)) throw new Error(`文件已不存在：${resolved}`)
    shell.showItemInFolder(resolved)
    return true
  })

  const triggerStatus = triggerService.start()

  ipcMain.handle('ui:form:resolve', (_event, requestId: string, answer) => resolveForm(requestId, answer))

  ipcMain.handle('trigger:list', () => ({
    gestureHook: hookStatus,
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

  // 场层 observe 要读运行历史；能力模块自己不碰各个 store
  setRunHistorySource(() =>
    LAYER_KEYS.flatMap((key) =>
      store(key)
        .runs(200)
        .map((run) => ({
          id: run.id,
          classId: run.classId,
          status: run.status,
          elapsedMs: run.elapsedMs,
          createdAt: run.createdAt
        }))
    ).sort((a, b) => b.createdAt - a.createdAt)
  )

  // 表单能力需要一个「把请求送到界面」的通道；能力模块自己不碰 BrowserWindow
  setFormSink((request) => {
    safeSend('ui:form:request', request)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
