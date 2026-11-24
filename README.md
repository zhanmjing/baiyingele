# 百应 · Electron 五层工作台

从零重建的 Electron 桌面前端。目标不是复刻旧 Rust 工程，而是先做一个**能快速迭代的五层工作台**：

```text
点 Point      原子能力
线 Line       流程编排
面 Surface    界面承载
体 Body       产品蓝图
场 Field      智能介质
```

## 技术栈

- Electron 45
- React 19
- Vite 8
- electron-vite 6
- TypeScript 7
- lucide-react

## 参考资源

旧项目的原型与构建资料已经复制进本仓库，便于自包含查阅：

```text
design/       旧设计文档（40 个 Markdown，按 point/line/surface/body/field/overview 分类）
prototypes/   旧 HTML 交互原型（38 个文件）
build/        旧构建中间产物与完整 JSON 数据（95 个文件）
```

它们只作参考与数据来源，不参与 Electron 运行时打包：

- `design/` 只读参考，不参与构建
- `prototypes/` 不直接嵌入产品页面
- `build/` 不被 `src` import
- 完整目录数据已生成到 `src/shared/generated*.json`
- 旧 `build/data/` 保留为可追溯来源

## 快速开始

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm start
```

类型检查：

```bash
npm run typecheck
```

Windows 打包：

```bash
npm run package
```

> 如果终端里存在 `ELECTRON_RUN_AS_NODE=1`，`npm run dev` / `npm start` 会通过
> `scripts/run-electron-vite.mjs` 和 `scripts/start.mjs` 清掉它，避免 Electron 被当成 Node 运行。

## 开发命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发环境（HMR） |
| `npm run typecheck` | 主进程 + 渲染层类型检查（约 0.5s） |
| `npm run validate` | 目录结构 + 跨层引用校验（软问题只报告） |
| `npm run validate:strict` | 跨层引用未解析也计为失败 |
| `npm run impl:gen` | 从 `src/main/capabilities/` 生成能力索引与渲染层清单 |
| `npm run impl:check` | 校验能力清单与目录一致（`check` 已包含） |
| `npm run new:point -- <id> …` | 新建点能力脚手架（目录 + 索引 + 可选能力骨架） |
| `npm run refs` | 跨层引用五态解析（只读） |
| `npm run refs:apply` | 按 `aliases.json` 自动改写命名漂移的引用 |
| `npm run refs:write` | 生成 `requirements.generated.json` |
| `npm run data:gen` | 用 `build/data/catalog` 重新生成五层目录 |
| `npm run smoke` | 无 GUI 的端到端运行时冒烟测试 |
| `npm run check` | typecheck + validate + build（提交前跑这个） |
| `npm run build` / `npm start` | 生产构建 / 运行构建产物 |
| `npm run package` | Windows 打包 |

### 数据管线

```text
build/data/catalog/<layer>/<class-id>.json   一类一文件（唯一可编辑源）
build/data/catalog/<layer>/_index.json       该类层的顺序
build/data/aliases.json                      命名漂移别名表
build/data/legacy/                           旧整包数据（只作追溯，不再被读取）
        │
        ├─ npm run data:gen    → src/shared/generatedFullCatalogs.json（派生产物）
        ├─ npm run refs        → 五态解析 + 缺口报告
        └─ npm run refs:write  → src/shared/requirements.generated.json
```

补一个能力的完整动作（**一条命令**）：

```bash
npm run new:point -- file.scan --name 扫描目录 --effect L0 --params root,pattern,depth,limit --impl
```

它会生成 `build/data/catalog/point/file.scan.json`、登记 `_index.json`、可选生成
`src/main/capabilities/file.scan.ts` 骨架，并自动跑 `data:gen`（+ `impl:gen`）。

然后只需要：改目录里的参数默认值 → 写实现 → `npm run refs && npm run validate`。

> 新增能力模块 = 在 `src/main/capabilities/` 放一个导出 `id` / `summary` / `run` 的文件 + `npm run impl:gen`。
> 忘了跑 `impl:gen` 会被 `npm run validate` 拦住（能力清单与目录不一致）。

**跨层引用的五种状态**（`npm run refs`）：

| 状态 | 含义 | 处置 |
|---|---|---|
| `ok` | 目标存在 | — |
| `aliased` | 名字漂移，别名表能映射 | `npm run refs:apply` 自动改写 |
| `kind-mismatch` | 引用了实例，但这里需要类 | 硬错误，自动建议正确的类 |
| `layer-mismatch` | 引用放错了层（如点层写 `surface.show`） | 硬错误，需人工判断 |
| `missing` | 真的还没实现 | **合法状态**，计入 `requirements.generated.json` |

`missing` 不是错误：体是蓝图，依赖可以暂时不满足。体层组合视图会把未满足的引用画成虚线，
并按「补哪个能力能解锁最多组合」排序展示缺口。

## 真实能力 vs 模拟能力

只有 `src/shared/implRegistry.ts` 登记、并在 `src/main/capabilities.ts` 实现的类才真正执行：

| 类 | 实现 |
|---|---|
| `win.clipboard.get` | Electron `clipboard.readText()` / `read()`（Electron 45 的 W3C 异步 API） |
| `text.template` | 纯函数：`{{input}}` 替换为上游输出 |
| `file.write` | `node:fs` 写入 / 追加，`~` 展开为主目录 |
| `file.read` | `node:fs` 读取，超过 `maxBytes` 截断；目录/缺失按 warn 处理 |
| `file.move` | `node:fs` rename（`EXDEV` 回落 copy+unlink），`overwrite=false` 时不覆盖 |
| `file.scan` | `node:fs` 递归扫描，`limit` 封顶，不可读目录跳过并计入说明 |
| `clipboard.write` | `clipboard.writeText` + 回读校验；空文本拒绝，不清空用户剪贴板 |
| `translate.text` | provider 链 **本地 → 网络 → API** 降级（免费优先），key 只读环境变量 |
| `win.open` | `shell.openExternal` / `openPath`，带 app 时 `spawn`；`%VAR%` 自动展开 |
| `field.classify` | 场层分类：按实例自带候选标签做模型分类，输出 `confidence` + `reason` 并写入运行证据 |
| `field.prefill` | 参数预填：按实例配置的 `target`/`param` 从剪贴板取值，产出落点建议 |
| `notify.toast` | Electron `Notification` |
| `win.http.request` | `fetch` + 10s 超时，返回状态码与字节数 |
| `win.screen.capture` | `desktopCapturer` 枚举屏幕源 |
| `win.ocr.read` | 视觉模型 OCR：`$screenshot` / 本地图片 / 图片 URL 三路输入，复用 provider 降级链 |
| `win.window.query` | **koffi 直调 user32** 枚举窗口（~0.35ms/次），koffi 不可用时自动回退 PowerShell |
| `win.window.control` | koffi 控制窗口：focus / move / topmost / close；支持按 `hwnd` 精确指定 |
| `win.key.send` | koffi **SendInput** 真实发送组合键（走系统输入队列，目标程序分辨不出真假） |
| `win.audio.volume` | koffi 调 **CoreAudio COM**（`IAudioEndpointVolume`）精确控音量/静音，写完读回校验 |
| `win.display.brightness` | **WMI**（`WmiSetBrightness`）控制内屏亮度，写完读回校验 |
| `ui.form` | 向界面要用户输入并等待；取消/超时/顶替都返回明确状态 |
| `win.key.trigger` | **uiohook-napi** 全局热键监听（常驻钩子，不是一次性执行） |
| `win.theme.mode` | 读写 `HKCU\...\Themes\Personalize` 注册表，读回校验（L1 可逆） |

其余 80 个类跑的是 `layerStore` 的模拟 runner，管理页会明确标为「模拟」。

场层与点层共用同一套能力分发器（按 classId 唯一命中）；`field.classify` 的运行结果会带
`evidence: { tier, labels, confidence, reason, attempts }`，场层「证据」视图直接读它，不再有硬编码的 0.84。
已打通 **3 条全真流程**（每个节点都绑定到真实能力，各产生一条真实 `PointRun` 再聚合成 `FlowRun`）：

| 流程 | 链路 |
|---|---|
| `flow.clipboard-to-file` | 读剪贴板 → 套模板 → 写文件 → 系统通知 |
| `flow.open-external-site` | HTTP 可达性检查 → 打开 URL → 通知 |
| `flow.screenshot-translate` | 抓屏 → OCR（视觉模型）→ 翻译 → 通知 |

`npm run smoke` 会验证第一条的完整链路。

### 系统能力怎么接：koffi + 回退

窗口枚举、主题切换这类系统能力**没有引入 ffi-napi / win32-api / Rust sidecar**，而是走
[koffi](https://koffi.dev/) —— 一个运行时 dlopen 的 FFI，**零编译、零 native 构建**。

已验证的事实（`node scripts/probe-koffi.cjs`）：

| 运行时 | NODE_MODULE_VERSION | 结果 |
|---|---|---|
| 纯 Node 24.22.0 | 137 | ✅ 枚举 259 个窗口 |
| **Electron 45.4.1 自带 Node** | **150** | ✅ 枚举 304 个窗口 |

两套 ABI 都能直接加载 → **Node-API 稳定 ABI 生效，不需要为 Electron 重新编译**。

**性能对比（窗口查询，20 次平均）：**

| 实现 | 每次耗时 |
|---|---|
| PowerShell 子进程 | 300–600ms |
| **koffi 直调 user32** | **0.35ms** |

三条铁律（写在 `src/main/capabilities/_win32.ts` 顶部）：

1. **所有 C 签名只写在那一个文件里** —— koffi 签名写错不是抛异常，是**整个主进程崩溃**
2. **懒加载**：`require('koffi')` 失败时返回 `null`，能力自动回退 PowerShell 并在输出里说明原因
3. **每个句柄都要 `CloseHandle`**，用 `try/finally` 保证

打包注意：koffi 是运行时依赖，`electron-builder` 里必须同时配 `files` 和 `asarUnpack`（原生 `.node` 不能留在 asar 内）。

仍为模拟、需要进一步能力的：`win.key.trigger`（全局键盘钩子，候选 `uiohook-napi`）、
`win.window.control`、`win.audio.volume`、`win.display.brightness`、`win.key.send`、`ui.form`。

### 音量为什么要走 COM

调音量没有对应的 Win32 导出函数。三条路里：

| 方案 | 能做什么 | 问题 |
|---|---|---|
| `SendInput` 发多媒体键 `VK_VOLUME_UP` | 只能步进/静音 | **设不了指定的 30%** |
| `waveOutSetVolume` | 看起来能设 | Win7 之后基本不作用于主音量 |
| **CoreAudio `IAudioEndpointVolume`（COM）** | 精确读写 + 静音 | 要自己调 COM |

选了 COM，因为 `i-vol-30` 这个实例就是要「设成 30%」，步进做不到。

**koffi 调 COM 的关键语义**（都是实测出来的，不是查文档猜的）：

```js
// 接口指针 → vtable：读该地址处存的指针
const vtable = koffi.decode(对象地址, 'void *')
// vtable 槽位 → 函数地址
const fn = koffi.decode(vtable, 序号 * 8, 'void *')
// 调函数指针（this 作为第一个参数自动补上）
koffi.call(fn, 原型, 对象地址, ...真实参数)
```

`_com.ts` 把这套收敛成 `guid()` / `coInitialize()` / `createInstance()` / `callMethod()` 四个函数，
**所有 C 签名只写在这一个文件里** —— 和 `_win32.ts` 同一条规矩。

**验证结果（真机）：**

```
只读音量: 11% · 未静音
set 42% → 音量 11% → 42%
set 77% → 音量 30% → 77%
+5/-5   → 77% → 82% → 77%   （连跑 3 轮都一致）
mute / unmute / toggle×2 → 全部 ok
还原     → 10.8% → 11%      RESTORE_OK
```

### `ui.form`：人机在环能力

前 20 个点能力都是「调系统 API 拿结果」。`ui.form` 不是——它要**问用户**，然后等。

```text
点实例运行
  → 主进程 requestForm(spec, timeoutMs)      ← 挂起，返回 Promise
  → webContents.send('ui:form:request')      → 渲染层弹出模态
  → 用户填写 → ipcRenderer.invoke('ui:form:resolve')
  → 主进程二次校验 → Promise 兑现 → 点实例拿到结果
```

**四种答复，三种是失败：**

| 答复 | 能力状态 | 输出 |
|---|---|---|
| `submitted` | `ok` | `表单「确认发布」已提交：备注=紧急 · 版本号=1.2.0` |
| `cancelled` | `warn` | `表单「确认发布」已取消` |
| `timeout` | `warn` | `表单「确认发布」超时未答复（120000ms）` |
| `unavailable` | `warn` | `表单「…」无法显示：没有可用界面` |

取消和超时**绝不能算成功** —— 否则上层流程会在用户什么都没确认的情况下继续跑。

设计上的三个决定：

1. **校验规则只写一份**（`src/shared/formSpec.ts`），渲染层提交前校验一次，主进程收到再校验一次。
   不信任 IPC 传进来的值。
2. **同时只允许一个表单**。新请求来了先把旧的判为 `superseded` 并结束，
   避免弹窗排队把整条流程卡死。
3. **能力模块不直接摸 BrowserWindow**，通过 `setFormSink()` 注入通道 —— 和触发器服务同样的解耦方式。

### 亮度为什么只用 WMI

亮度有两条硬件路径，本机实测结果决定了实现范围：

| 路径 | 适用 | 本机实测 |
|---|---|---|
| **WMI** `WmiMonitorBrightnessMethods` | 笔记本内屏 | ✅ `CurrentBrightness = 76`，能读写 |
| **DDC/CI** `dxva2!GetMonitorBrightness` | 外接显示器 | ❌ 主显示器返回 `false` |

所以内屏走 WMI（已验证），**外接屏如实说明未实现**，而不是塞一段跑不通的代码：

```
win.display.brightness  action=set  value=50  monitor=external
→ warn: 暂不支持外接屏亮度：外接屏需要 DDC/CI（dxva2 的 GetMonitorBrightness）。
        本机主显示器实测返回 false，这条路径没有可验证的硬件，所以没有实现。
```

**一个必须绕开的假成功**：`Invoke-CimMethod` 的 `ReturnValue` 在本机是**空的**（不是 0），
所以「调用没报错」不等于「亮度变了」。实现里一律**写完等 250ms 再读回**，比对真实值。

**真机结果：**

```
读取     → 76%
set 55  → 76% → 55%
+10     → 55% → 65%
-20     → 65% → 45%
还原     → 76%    RESTORE_OK
```

### 真机跑出来的两个坑

1. **`action: 'set'` 不能当"读数"用** —— 它真的会改音量。第一版验证脚本用 `set level=50` 想探当前值，
   直接把用户音量从 10.8% 设成了 50%。所以补了一个**只读的 `get`** 动作（L0 语义，两个字段都是 null）。
2. **Windows 会把音量对齐到硬件台阶（实测 2%）** —— `+5%` 从 42% 出发得到的是 46% 而不是 47%。
   第一版用「读回值必须等于目标值」来校验，会误报失败。改成**按动作语义判定**：
   `set` 要求误差 ≤1%，`up`/`down` 只要求方向对（到顶/到底则不要求变化），静音要求精确相等。

### 窗口控制踩到的三个坑

1. **`SetForegroundWindow` 会被系统拒绝**：后台进程调用时 Windows 只让任务栏闪一下。正规做法是
   `AttachThreadInput` 把当前线程的输入队列临时挂到目标线程和前台线程上，调完立刻摘掉 —— 见 `focusWindow()`。
2. **同名窗口会选错**：`Clash Verge` 这类应用可能有多个标题相同的窗口，按标题选会在两次调用间选到不同的那个。
   所以 `selector` 支持 `{ "hwnd": "..." }` 精确定位（`win.window.query` 的返回值里带 `hwnd`），
   匹配到多个时输出里也会明确提示。

### 发送按键为什么用 SendInput

`win.key.send` 只有一条路：`SendInput`。另一条常见路 `PostMessage(hwnd, WM_KEYDOWN, …)` 看着更"精准"
（能直接指定窗口），但**对现代应用基本无效** —— UWP、Electron、Qt、游戏大多不处理合成的 WM_KEYDOWN。

`SendInput` 把事件塞进系统输入队列，走的是和真实键盘完全相同的一条路，所以兼容性最好。
代价是它**只能发给当前前台窗口**，要指定窗口得先聚焦：

```bash
win.key.send  keys="Ctrl+C"  mode=press  repeat=1
win.key.send  keys="Ctrl+C"  target='{"process":"notepad"}'   # 先聚焦再发
```

**三个实现细节：**

1. **INPUT 结构体手工算内存布局**，不用 `koffi.struct`（struct 出参已经证明不可靠）：
   x64 上 `INPUT` 是 40 字节，union 从偏移 8 开始，`wVk` 在 8、`dwFlags` 在 12。
2. **修饰键用左键变体**（`VK_LCONTROL` 0xA2 而非 `VK_CONTROL` 0x11），SendInput 对具体左右键的处理更确定。
3. **不碰用户正按着的键**：发送前用 `GetAsyncKeyState` 查一遍，用户已经按住的修饰键
   既不会被我们按下、也不会被我们松开 —— 否则自动化跑完用户的 Shift 就"粘住"了。

**闭环验证**（`SendInput → 系统输入队列 → 全局钩子`）：
发一个 F24（所有正常应用都没绑定），uiohook 全局钩子能收到 `keycode 107` —— 证明按键真的进了系统。
真机运行记录：

```json
{ "output": "已发送 Ctrl+C（4 个事件）", "elapsedMs": 8,
  "evidence": { "backend": "sendinput", "events": 4, "sent": 4, "preHeldModifiers": [] } }
```

对比改造前：`{ "output": "已发送组合键", "evidence": null }` —— 一眼能看出哪个是真的。

### 全局热键为什么是「异类」能力

`win.key.trigger` 和前面 18 个能力**结构上不同**：其它能力都是「调一次 → 返回结果」，
而它是**注册一个常驻监听器**：

```bash
# 开始监听（返回后钩子仍在运行）
win.key.trigger  keys="Ctrl+Alt+Space"  scope=global
# 停止（keys 传空）
win.key.trigger  keys=""                scope=global
```

触发记录进内存环形缓冲（最近 50 条），通过 `window.baiying.getRecentTriggers()` 读取。
**还没接的是「触发之后执行什么」**——那需要一个触发器服务把 `combo → PointInstance/FlowInstance` 连起来，
是下一步的事，现在只到「能听见」为止。

两个已验证的事实：

- uiohook-napi 1.5.5 在 **Node modules=137 与 Electron 45 modules=150 两套 ABI 下都能起停钩子**
- 钩子必须能干净停止：`stopHook()` 会清空注册表并 `uIOhook.stop()`，冒烟测试每次都验证起停

## 线层执行引擎

线层不是「把节点按顺序跑一遍」，而是**信号传播**：节点执行完，只把它自己激活的出边推给下游。

### 修掉的那个真 bug

早期实现按 edges 拓扑排序后把每个节点都跑一次，结果 `if` gate 的 true/false
**两条分支都会执行** —— 一个本该拦住流程的 guard 变成了摆设。
`flow.invoice-archive` 的「校验 → if 命中 → 移动归档 / 未匹配通知」里，
匹配的和未匹配的通知会同时发出去。

现在从入度为 0 的节点开始，只有**被激活的边**才会把下游节点放进队列。

### 节点语义

| 节点 | 行为 | 成功后激活的边 |
|---|---|---|
| `point` | 跑绑定的点实例 | 全部出边 |
| `gate:if` | 判断**输入值**真假 | 只有 `true` 或 `false` 那条 |
| `gate:if-status` | 判断**上游节点状态** | 只有 `ok` 或 `warn` 那条 |
| `gate:foreach` | 按输入列表逐项跑循环体 | 全部跑完后走 `done` 那条 |
| `subflow` | 递归跑另一条线实例 | 全部出边（子流程成功时） |

`if` gate 只接受明确的值（`true/false/1/0/yes/no/ok/fail/空`），
含糊的值（比如 `maybe`）会让流程**停下并报错**，而不是替用户猜"非空即为真"。

### foreach 的图约定

```text
        ┌──────────── each ────────────┐
        ↓                              │
   [循环体入口] …（循环体末端）──────────┘   ← 回边，表示一轮结束
        │
   foreach ── done ──→ 循环之后的续作
```

- `each` 边指向循环体入口，每次迭代把**当前项**作为输入传下去
- 循环体末端的边指回 foreach 本身，引擎识别为「这一轮结束」
- `done` 边在所有项跑完后才激活
- 回边**不计入入度**，否则整张图会「没有入口节点」（`entryNodes()` 专门处理这件事）

迭代上限 100 项、循环体最多 200 步、嵌套最多 3 层 —— 超了**停下报错**，不静默截断。

**输入格式**：优先当 JSON 数组解析（`file.scan` 这类节点返回的就是），
否则按换行切分；都不是就让流程停下，不猜。

实测（真实文件系统）：

```text
扫描目录: 扫描 3 个文件 · alpha.txt, beta.txt, gamma.txt
逐项遍历: 遍历 3/3 项，然后进入 notify
读取一项: 读取 ...\alpha.txt · 30 bytes
读取一项: 读取 ...\beta.txt  · 29 bytes
读取一项: 读取 ...\gamma.txt · 30 bytes
```

### 三条「宁可停下也不假装通过」的规则

1. **未实现的 gate 必须让流程停**。`foreach` 需要 fan-out/fan-in 语义，还没实现，
   遇到就 `halted`。guard 没执行就等于没通过，不能往下走。
2. **任何节点 warn，整条流程就是 warn**。早先版本会把它算进"真实成功"，
   中间节点的警告被整条流程的 `ok` 吞掉。
3. **子流程失败 / 循环引用 / 超过 8 层**，父流程立刻停并记下原因。

### 图谱覆盖

13 个 FlowClass **全部有数据流图**，每个 `point` 节点都绑到**存在且已实现**的点实例
（冒烟里有一条完整性断言守着：`pointClass` 必须和实际绑定的实例一致）。

| 类 | 节点 | 说明 |
|---|---:|---|
| `flow.ensure-vpn` | 4 | 探网络 → 按状态分支 → 分别提示 |
| `flow.ensure-app` | 3 | 列窗口 → 整理 → 通知 |
| `flow.ensure-service` | 4 | 健康检查 → 分支提示 |
| `flow.ensure-download` | 2 | 打开下载目录 → 通知 |
| `flow.open-app` | 2 | 启动应用 → 通知 |
| `flow.open-workspace` | 3 | 编辑器 + 目录 → 通知 |
| `flow.open-external-site` | 4 | **子流程**(ensure-vpn) → 可达性 → 打开 → 通知 |
| `flow.http-extract` | 3 | 请求 → 套模板 → 通知 |
| `flow.ai-rewrite` | 3 | 改写 → 写剪贴板 → 通知 |
| `flow.batch-archive` | 4 | 扫描 → **foreach 逐项读取** → 通知 |
| `flow.approval-action` | 4 | **人工确认**(ui.form) → 分支 → **子流程** |
| `flow.clipboard-to-file` | 4 | 剪贴板 → 模板 → 写文件 → 通知 |
| `flow.screenshot-translate` | 4 | 截屏 → OCR → 翻译 → 通知 |

子流程目标支持 `$args.target`，所以同一个类能按实例参数跑不同子流程：

```text
flow.approval-action  action=publish；target=inst.site-github@r1
  → ui.form 审批
  → if-status 分支
  → subflow: inst.site-github@r1（打开外部站点）
```

实测嵌套两层（审批 → 外部站点 → 确保 VPN）可以正常跑完并逐层回报。

## 触发器服务（输入 → 实例）

`TriggerService` 是输入层的统一出口：**热键和手势共用同一条 dispatch**。

```text
hotkey   物理按键 → uiohook 钩子 ─┐
gesture  手绘轨迹 → 识别成方向串 ─┴→ dispatch → 查启用绑定 → 跑实例 → FiringRecord
```

| source | 匹配方式 | 说明 |
|---|---|---|
| `hotkey` | 组合键**精确**匹配 | `Ctrl+Alt+Space`，由主进程钩子触发 |
| `gesture` | 方向串**模糊**匹配（编辑距离 ≥ 0.75） | `LDR`，由渲染层送轨迹进来，主进程识别 |

> 手势绑定按 **pattern 唯一**（`gesture:LDR`）：一个手势只能有一个含义，改绑即覆盖。
> 热键按 `pattern + 目标` 唯一，同一个组合可以绑多个目标。

绑定存在 `%APPDATA%\baiying-electron\trigger-bindings.json`：

```ts
{ id: 'gesture:LDR→inst.xxx', source: 'gesture', pattern: 'LDR',
  targetKind: 'line', targetId: 'inst.xxx', enabled: true, fireCount: 3 }
```

> v1 的 `combo` 字段会在加载时自动迁移成 `{ source: 'hotkey', pattern }`。

**IPC：**

| 通道 | 作用 |
|---|---|
| `trigger:list` | 绑定 + 最近触发记录 + 当前挂着的热键组合 + 注册失败原因 |
| `trigger:add` | 新增绑定（校验组合键/手势串可解析、目标实例存在） |
| `trigger:remove` | 解绑 |
| `trigger:simulate` | 不按键，直接派发一个热键组合 |
| `trigger:gesture` | 送一段轨迹，识别后派发；返回 `{ directions, valid, records }` |

### 手势识别（`src/shared/gestureRecognizer.ts`）

纯函数，渲染层与主进程共用。算法：**降采样 → 8 方向分桶 → 过滤短噪声段 → 相邻去重 → 方向串**，
匹配用编辑距离给置信度。

相比原来的实现修了四个硬伤：

| 问题 | 原来 | 现在 |
|---|---|---|
| DPI/缩放敏感 | 绝对 14px 降采样 | 按轨迹总长的 **2%** 算步长 |
| 手抖多一个方向 | 零容错，精确字符串比较 | 一个方向至少连续 2 段才算数 |
| 误触 | 点一下也出结果 | 最小长度 30px + 时长 80–3000ms 校验 |
| 无法分级 | 只返回字符串 | 返回相似度 0–1，阈值 0.75 |

**测试覆盖**：5 个轨迹样例（LDR/UD/RL/DR/DLU）+ ±2px 抖动 + 0.5x/2x 缩放 + 4 种无效输入 + 模糊匹配。

### 手势绑定的唯一数据源

以前手势绑定存在渲染层 localStorage（`surfaceResourceStore`），和触发器服务是**两套数据**——
会出现「面层显示有绑定，实际按了没反应」。

现在统一到主进程：`trigger-bindings.json` 是唯一数据源，面层手势视图通过
`trigger:list` / `trigger:add` / `trigger:remove` 读写。

**首次启动会自动迁移**：把 localStorage 里目标可解析的旧手势导入主进程，
跳过悬空目标并提示，然后清空旧数据（`baiying.gestures.migrated.v1` 标记只迁一次）。

种子手势（`generatedSurface.json`）已全部指向真实可执行的实例：

| 手势 | 目标 |
|---|---|
| `LDR` | `win.open.i-open-github@r1` 打开 GitHub |
| `UD` | `win.window.query.i-list-windows@r1` 列出可见窗口 |
| `RL` | `win.window.query.i-foreground@r1` 查前台窗口 |
| `DR` | `win.clipboard.get.i-clip-text@r1` 读剪贴板 |
| `DLU` | `win.window.control.i-topmost@r1` 切换置顶 |

冒烟测试里有一条断言专门守着这件事：**种子手势的目标必须全部能解析**，
防止以后改了目录又把种子数据改漂。

### 界面

面层「手势」页的录制板有两个动作：**录制**（定义 pattern，不触发）和**试触发**（用当前轨迹真跑一次派发）。
两者分开是刻意的——录制定义时不该顺手执行别人的绑定。

### 另一个真机才暴露的问题：多实例抢同一份数据

调试时不小心开了两个实例，立刻出问题：**两者共享同一个 `userData` 目录**，
同时写 `points/flows/surfaces/bodies/runs/trigger-bindings.json`，后写的覆盖先写的——
实测表现为「一个窗口显示 9 条手势 + 热键，另一个显示 6 条手势 + 0 热键」。

已加单实例锁：第二个实例直接退出，并把已有窗口拉到前台（`app.requestSingleInstanceLock()`）。

### 实测踩到的三个坑

这三条都是**真机跑起来才发现的**，光靠单测和类型检查一个都抓不到：

1. **`uiohook-napi` 报的 `ctrlKey` 不可靠。**
   实测按 `Ctrl+Alt+G` 时，钩子收到的事件是
   `{"keycode":34,"ctrl":false,"alt":true}` —— Alt 有，**Ctrl 丢了**。
   结果是所有 `Ctrl+...` 组合永远匹配不上。修法是自己跟踪修饰键的按下/抬起状态，
   匹配时用 `event.ctrlKey || held.has(Ctrl键码)`（`withHeldModifiers`）。
   冒烟测试里有一条专门复现这个形状：不补齐匹配不上，补齐后能匹配。

2. **主内容区是个三元链，末尾分支是无条件兜底。**
   `view === 'surfaces' ? … : view === 'panels' ? … : view === 'gestures' ? … : <DockView/>` ——
   新增的 `'hotkeys'` 直接掉进了 dock 分支，页面显示的是启动坞。
   加分支时必须插在兜底之前。

3. **触发后 UI 不会变。**
   `fireCount` 只在主进程里涨，渲染层只在增删绑定时才重拉数据。
   修法是主进程每次派发后 `webContents.send('trigger:fired')`，页面订阅后重拉。
   实测：按一次热键，触发次数从 2 自动变 3，不用点刷新。

### 热键视图

面层管理页多了一个「热键」tab（`#hotkeys`）：

- 左侧列出 `source === 'hotkey'` 的绑定与触发次数
- 中间表单：点输入框后**直接按组合键**即可录入（`Ctrl+Alt+Space` 这样拼出来），
  选目标实例、填备注，点「绑定」
- 表格显示每条绑定是否**真的挂到了原生钩子上**（`trigger:list` 返回的 `combos`），
  以及注册失败原因（`failures`）
- 触发次数会**自动刷新**：主进程派发后推 `trigger:fired`，页面收到就重拉，不用手动点

「已挂载 / 未挂载」这个区分是有意做的：写进 `trigger-bindings.json` 不等于钩子真的挂上了，
比如 koffi 或 uiohook 加载失败时，绑定存在但按下去没反应。

## 场层落点（landing）

设计规定：**FieldClass 必须声明落点，否则不允许发布**（`npm run validate` 会拦），
并且自主度决定「建议能不能真的写进去」。

| 自主度 | 行为 | 实现 |
|---|---|---|
| `A0` | 只给建议，不执行 | 产出落点建议，目标实例一个字节都不改 |
| `A1` | 出草稿，等人工确认 | 同上，输出注明「未落地」 |
| `A2` | 自动应用，**必须可撤销** | 写入目标实例参数 + 生成一次性撤销令牌 |
| `A3` | 禁止自主执行 | 直接拒绝 |

当前落点只实现了 `{ layer: 'point', target: 'param' }`（改点实例的一个参数）；
其余落点（线的 `slotBinding`、面的 `order`、体的 `manifest`）会明确返回「暂不支持」，不假装成功。

撤销令牌落在 `%APPDATA%\baiying-electron\field-undo.json`，一次性消费：
场层「证据」视图里带 `undoToken` 的记录会出现「撤销」按钮，点了就把参数恢复回原值。

> 能力本身**不碰目标实例**——`field.prefill` 只负责「建议什么值、落到哪」，
> 真正的写入由 `src/main/fieldRuntime.ts` 按自主度执行，所以 A0/A1 下不可能被顺手写进去。

## 翻译 provider 配置

`translate.text` 走一条降级链，**免费优先**，三档都用 OpenAI 兼容的 `/chat/completions` 协议
（Ollama / LM Studio / vLLM / DeepSeek / OpenAI 通吃）。没配的档位会被跳过：

| 顺序 | 环境变量 | 例子 |
|---|---|---|
| 1 本地 | `BAIYING_TRANSLATE_LOCAL_URL` | `http://127.0.0.1:11434/v1`（Ollama） |
| 2 网络 | `BAIYING_TRANSLATE_NETWORK_URL` | `http://192.168.1.10:8000/v1`（局域网自建） |
| 3 API | `BAIYING_TRANSLATE_API_URL` | `https://api.deepseek.com/v1` |

```bash
# 云端档的 key 只从环境变量读，不落库、不进设置文件
export BAIYING_TRANSLATE_KEY=sk-...
# 各档模型名可选，默认 local/network=qwen2.5:7b，api=gpt-4o-mini
export BAIYING_TRANSLATE_API_MODEL=gpt-4o-mini
```

三档都没配时，运行会直接返回 `warn`「未配置翻译 provider」而**不会发起任何请求**——
不会伪造一个成功结果。本地档 4s 超时、网络档 8s、API 档 20s，失败自动降级并在输出里注明命中了哪档。

## 目录

```text
baiyingELE/
├─ design/            旧设计文档（39 篇）
├─ prototypes/        旧 HTML 原型（38 个）
├─ build/             旧构建资料与完整 JSON 数据（95 个，含 data:gen 的输入）
├─ src/
│  ├─ shared/                        五层共用契约（主进程与渲染层同源）
│  │  ├─ layerKeys.ts                层名唯一清单（不含 JSON，preload 可安全引用）
│  │  ├─ layerApi.ts                 五层 IPC 类型契约（映射类型生成方法名）
│  │  ├─ implRegistry.ts             哪些类是真实实现（读生成物）
│  │  ├─ implemented.generated.ts    【生成】真实能力 id + 摘要
│  │  ├─ pointCatalog.ts / lineCatalog.ts / surfaceCatalog.ts
│  │  ├─ bodyCatalog.ts / fieldCatalog.ts
│  │  ├─ generatedFullCatalogs.json  五层完整目录（由 build/data 生成）
│  │  ├─ generatedLineProfiles.json  线层数据流图
│  │  └─ generatedBodyProfiles.json  体层组合 / Manifest / 生命周期
│  ├─ main/
│  │  ├─ index.ts            Electron 主进程、窗口、循环注册五层 IPC
│  │  ├─ layerRegistry.ts    层表：类目录 + 输出摘要（新增一层改这里）
│  │  ├─ layerStore.ts       泛型实例 / 运行记录存储（五层共用一份）
│  │  ├─ capabilities/       一能力一文件（id / summary / run）
│  │  │  ├─ index.ts         【生成】能力汇总 + runCapability
│  │  │  └─ _shared.ts       能力公共契约与工具
│  │  └─ flowRuntime.ts      线层执行器：按数据流图逐节点执行并聚合 FlowRun
│  ├─ preload/index.ts       contextBridge 安全桥（方法按层名循环生成）
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ App.tsx          壳、导航、命令面板、toast
│        ├─ data.ts          五层元数据（统计从种子派生，不写死）
│        ├─ pages/
│        │  ├─ Dashboard.tsx
│        │  ├─ LayerManagementPage.tsx   点/体/场管理页
│        │  ├─ LineManagementPage.tsx    线层管理页
│        │  ├─ SurfaceManagementPage.tsx 面层管理页（面/面板/手势/启动坞）
│        │  ├─ RunHistoryPage.tsx
│        │  ├─ SettingsPage.tsx
│        │  └─ instanceDraft.ts          实例表单类型
│        ├─ components/Sidebar.tsx · Topbar.tsx
│        └─ styles.css
├─ scripts/
│  ├─ gen-catalogs.mjs      build/data → generatedFullCatalogs.json（可 100% 复原）
│  ├─ validate-catalog.mjs  结构 + 跨层引用校验
│  ├─ smoke-flow.cjs        无 GUI 的端到端运行时冒烟测试
│  ├─ run-electron-vite.mjs
│  └─ start.mjs
├─ electron.vite.config.ts
├─ package.json
└─ tsconfig*.json
```

## 已实现

- 自定义无边框窗口 + Windows 原生窗口控件 overlay
- 深色桌面工作台
- 五层导航：点 / 线 / 面 / 体 / 场
- 总览 Dashboard：能力栈、统计、最近运行、运行环境
- 通用层管理页：
  - 类目录
  - 类详情 / 契约摘要
  - 参数表
  - 实例列表
  - 新建 / 编辑实例（点层 / 线层持久化）
  - 归档 / 恢复 / 复制
  - 运行实例（IPC）
  - 运行 console
- 设置页：外观 / 行为 / 运行默认值 / 环境信息
- 命令面板：`Ctrl/Cmd + K`
- Preload 安全桥：`window.baiying.getAppInfo()` / `window.baiying.runPoint()`

## 完整目录数据

不再使用 3–5 个示例种子。五层目录从旧项目：

```text
build/data/
```

的完整 JSON 生成并导入 Electron：

```text
src/shared/generatedFullCatalogs.json
```

当前完整数据：

| 层 | 功能类 | 实例 |
|---|---:|---:|
| 点 | 16 | 37 |
| 线 | 13 | 32 |
| 面 | 16 | 46 |
| 体 | 29 | 82 |
| 场 | 23 | 78 |
| **合计** | **97** | **275** |

> 这些数字由 `npm run validate` 从目录实算，写死在文档里只是快照。

面层附属数据：

```text
PanelClass    14 / PanelInstance 37
GestureBinding 5
Launch Dock    5 tabs / 48 tiles
```

旧状态文件在启动时会检测类数量；如果仍是旧的小种子，会替换为完整目录，同时保留已有运行记录。

## 点 / 线 / 面 / 体 / 场已经接真实持久化

点 / 线 / 面 / 体 / 场五个管理页跑通了同一条 vertical slice：

```text
PointClass / FlowClass / SurfaceClass / BodyClass / FieldClass（共享契约）
  → 对应 Instance（本地持久化）
  → 参数编辑
  → 归档 / 恢复 / 复制
  → run
  → 对应 Run 运行历史
```

数据文件：

```text
%APPDATA%\baiying-electron\point-state.json
%APPDATA%\baiying-electron\line-state.json
%APPDATA%\baiying-electron\surface-state.json
%APPDATA%\baiying-electron\body-state.json
%APPDATA%\baiying-electron\field-state.json
```

设置页的“打开目录”可以直接打开这个目录。

已实现：

- PointClass / FlowClass / SurfaceClass / BodyClass：来自 `src/shared/*Catalog.ts`
- 四层 Instance：创建 / 编辑参数 / revision +1 / 归档 / 恢复 / 复制
- 四层 Run：运行记录持久化
- 应用重启后实例与运行历史仍在
- `point:*` / `line:*` / `surface:*` / `body:*` 的 catalog、instance CRUD、runs、run IPC
- `runs:history` 统一运行历史：点 / 线 / 面 / 体 / 场合并

## 点 / 线 / 面 / 体 / 场专用管理页

五层不再使用通用 `LayerWorkspace`，而是共用专用管理页：

```text
src/renderer/src/pages/LayerManagementPage.tsx
```

同一个页面按层动态切换：

- PointClass / PointInstance / PointRun
- FlowClass / FlowInstance / FlowRun
- SurfaceClass / SurfaceInstance / SurfaceRun
- BodyClass / BodyInstance / BodyRun
- FieldClass / FieldInstance / FieldRun

参考：

```text
prototypes/atom-catalog-management.html
```

保留/实现的视图：

- 卡片：PointClass 卡片 + 实例表 + 行内运行/编辑/复制/归档
- 表格：类行展开实例
- 图谱：PointClass → PointInstance
- 矩阵：类 × 实例总览
- 管理：类/实例合并表
- 资源：加载状态与资源估算占位
- Inspector：类契约、参数 Schema、实例参数、运行、编辑、复制、归档
- 新建/编辑实例 modal
- 真实 `point:*` / `line:*` / `surface:*` / `body:*` IPC、revision 与持久化

旧 HTML 只作设计参考，不作为 Electron 运行时依赖。

## 设置页：基于旧原型重建

设置页直接参考并移植了：

```text
prototypes/settings-workspace-layers.html
```

保留的结构：

- 7 个 section：通用 / 点 / 线 / 面 / 体 / 场 / 信息
- 98 项设置：类型、默认值、枚举、min/max、unit、effect、restart、policy
- User / Workspace / Machine / Policy 作用域
- 98 项设置搜索
- 未应用变更状态、撤销、应用
- 每层“打开管理页”跳转
- 信息卡：About / Runtime / Data Locations / Diagnostics / Licenses / Updates / Support

数据提取到：

```text
src/renderer/src/generatedSettings.json
src/renderer/src/settingsData.ts
```

当前设置保存到 localStorage；下一步换主进程 settings store。

设置页已修复路由（此前 `section === 'settings'` 未渲染）。`general.fontScale` 已接入全局：

```text
--font-scale: 0.8 – 1.4
body / 标签 / 表格 / 管理页统一按比例缩放
```

保存设置后会立即应用到整个应用，无需重启。

设置页支持中文 / English 即时切换：

```text
general.language: zh-CN / en-US
```

切换后以下内容同步更新：

- 顶部面包屑、侧边栏、设置页标题与按钮
- 设置 section / group / 设置项标签与描述
- 枚举值显示（如 深色 / Dark、舒适 / Comfortable）
- 信息页卡片、字段、动作
- 中文模式隐藏技术配置键；英文模式显示 key
- 设置页不混排中英文


## 统一运行历史

侧边栏的“运行历史”页面合并点 / 线 / 面 / 体 / 场的真实运行记录：

- 总运行 / 成功率 / 平均耗时 / 需注意数量
- 全部 / 点层 / 线层 / 面层 / 体层 / 场层筛选
- 成功 / 需注意状态筛选
- run / 类 / 实例 / 输出搜索
- 选中 run 查看类、实例、输出、时间、状态
- 空状态可以直接跳去点层或线层运行

## 面层专用管理页

面层参考：

```text
prototypes/surface-management.html
prototypes/panel-management-v2.html
prototypes/gesture-management-v2.html
prototypes/dock-management-v2.html
```

独立页面：

```text
src/renderer/src/pages/SurfaceManagementPage.tsx
```

实现 4 个视图：

- 目录：真实 SurfaceClass / SurfaceInstance CRUD 与运行
- 面板：14 PanelClass / 37 PanelInstance，模式/宽度/状态预览、anatomy、实例列表、Inspector
- 手势：5 GestureBinding，手势录制、方向识别、目标映射、绑定表
- 启动坞：5 Tabs / 48 Tiles，Tile 网格与 Inspector

支持深链：

```text
#panels/panel.inspector
#panel.inspector
#gestures/LDR
#dock/common
```

数据：

```text
src/renderer/src/generatedSurface.json
src/renderer/src/surfaceData.ts
```

当前 Panel / Gesture / Dock 已支持本地 CRUD：

- PanelClass / PanelInstance：新建、编辑、删除、复制实例
- Panel 预览：right / left / bottom / floating / modal / sheet（带工作台背景与真实 placement 布局）、宽度 300–720、7 种状态、anatomy 轮廓
- Panel 内容渲染：Inspector / Settings / Command / Run History / Artifact / Chat / Approval / Notifications / Launcher / Dashboard / Diff / Preview / Trace / Console
- GestureBinding：新建、重录、编辑、删除
- Gesture 录制：鼠标画手势 → 方向序列识别（LDR / UD / RL / DR / DLU）
- Gesture 目标映射：点层 32 个实例 / 线层 32 个实例，搜索选择，mapped / placeholder
- Gesture 目标跳转：Inspector 可直接打开对应点层或线层页面
- Dock Tab / Dock Tile：新建、编辑、删除、左右排序
- 重置参考数据

持久化位置：

```text
localStorage: baiying.surface.resources.v1
```

SurfaceInstance CRUD 与 SurfaceRun 仍走 Electron 主进程真实持久化。

## 线层专用管理页

线层参考：

```text
prototypes/line-management-v2.html
```

独立页面：

```text
src/renderer/src/pages/LineManagementPage.tsx
```

实现：

- 左侧 FlowClass / FlowInstance 双列表
- FlowClass 数据流图：point / gate / subflow 节点与 edges
- 类定义 / 实例绑定模式
- 节点与 PointClass / PointInstance 绑定表；已实现/占位符状态
- 节点 Inspector，可跳转点层
- FlowInstance Inspector：运行 / 编辑 / 复制 / 归档
- 新建 / 编辑 FlowInstance modal
- 真实 `line:*` IPC、revision 与运行历史

数据流图 profile 在：

```text
src/shared/lineCatalog.ts
```

当前图编辑是只读 profile；节点编辑/新建 FlowClass 后续接入。

## 体层专用视图

体层在通用管理视图外增加：

- 组合：BodyClass 的 Point / Line / Surface / Field 引用、required/optional 与 role
- Manifest：version / channel / publisher / signature / digest / permissions / resources
- 生命周期：安装、校验、运行、更新、回滚；实例状态与 revision

体层组合与 Manifest 元数据在：

```text
src/shared/bodyCatalog.ts
```

当前 Composition / Manifest / Lifecycle 是可视化数据，安装/更新/回滚按钮暂为模拟；BodyInstance CRUD 与 BodyRun 是真实持久化。

## 场层专用视图

场层已有真实 FieldClass / FieldInstance / FieldRun 持久化，并在通用管理视图外增加：

- 策略：A0–A3 自主度、审批闸门、允许落点、预算
- 证据：场层运行输出、耗时、置信度与 evidence id
- 成本：模型路由、tokens、调用次数与预算占用

说明：策略和成本面板目前是可视化原型，尚未写入独立 policy/cost store；FieldInstance CRUD 与 FieldRun 是真实持久化。

## IPC

主进程按层名循环注册，每层 8 个通道（新增一层自动获得全套）：

```text
app:info / app:open-data-dir / runs:history
<layer>:catalog          <layer>:runs
<layer>:instance:create  <layer>:instance:update
<layer>:instance:archive <layer>:instance:restore
<layer>:instance:duplicate
<layer>:run
```

渲染层只能通过 preload 暴露的 `window.baiying` 调用，不直接拿 Node。
方法名由 `shared/layerApi.ts` 的映射类型生成，preload 实现与渲染层声明同源，写错名字会在 typecheck 阶段报错。

## 设计约定

- 类 = 契约；实例 = 配置 + revision。
- 设置页只回答“允许什么”；管理页回答“有什么、是否健康、是否加载”。
- 点层先跑通一条链路：类 → 实例 → 参数 → 运行 → 结果 → 历史。
- 优先保持可运行、可替换、可演示，不先堆真实后台。
