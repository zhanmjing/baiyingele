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
| `field.classify` | 场层第一个真能力：按实例自带候选标签做模型分类，输出 `confidence` + `reason` 并写入运行证据 |
| `notify.toast` | Electron `Notification` |
| `win.http.request` | `fetch` + 10s 超时，返回状态码与字节数 |
| `win.screen.capture` | `desktopCapturer` 枚举屏幕源 |
| `win.ocr.read` | 视觉模型 OCR：`$screenshot` / 本地图片 / 图片 URL 三路输入，复用 provider 降级链 |

其余 87 个类跑的是 `layerStore` 的模拟 runner，管理页会明确标为「模拟」。

场层与点层共用同一套能力分发器（按 classId 唯一命中）；`field.classify` 的运行结果会带
`evidence: { tier, labels, confidence, reason, attempts }`，场层「证据」视图直接读它，不再有硬编码的 0.84。
已打通 **3 条全真流程**（每个节点都绑定到真实能力，各产生一条真实 `PointRun` 再聚合成 `FlowRun`）：

| 流程 | 链路 |
|---|---|
| `flow.clipboard-to-file` | 读剪贴板 → 套模板 → 写文件 → 系统通知 |
| `flow.open-external-site` | HTTP 可达性检查 → 打开 URL → 通知 |
| `flow.screenshot-translate` | 抓屏 → OCR（视觉模型）→ 翻译 → 通知 |

`npm run smoke` 会验证第一条的完整链路。

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
