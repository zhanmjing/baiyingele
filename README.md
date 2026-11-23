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

## 目录

```text
baiyingELE/
├─ design/            旧设计文档（40 个）
├─ prototypes/        旧 HTML 原型（38 个）
├─ build/             旧构建资料与完整 JSON 数据（95 个）
├─ src/
│  ├─ shared/
│  │  ├─ pointCatalog.ts     点层共享契约与完整目录
│  │  ├─ lineCatalog.ts      线层共享契约 + 数据流图
│  │  ├─ generatedFullCatalogs.json 五层完整目录（从 build/data 生成）
│  │  ├─ generatedLineProfiles.json 线层数据流图
│  │  └─ generatedBodyProfiles.json 体层组合/Manifest/生命周期
│  ├─ main/
│  │  ├─ index.ts            Electron 主进程、窗口、IPC
│  │  ├─ pointStore.ts       PointInstance / PointRun 持久化
│  │  ├─ lineStore.ts        FlowInstance / FlowRun 持久化
│  │  ├─ surfaceStore.ts     SurfaceInstance / SurfaceRun 持久化
│  │  ├─ bodyStore.ts        BodyInstance / BodyRun 持久化
│  │  └─ fieldStore.ts       FieldInstance / FieldRun 持久化
│  ├─ preload/index.ts       contextBridge 安全桥
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ App.tsx          壳、导航、命令面板、toast
│        ├─ data.ts          五层 mock 数据
│        ├─ settingsData.ts  旧设置原型的类型化适配层
│        ├─ generatedSettings.json  98 项设置 / 7 个 section（先改这里）
│        ├─ pages/
│        │  ├─ Dashboard.tsx
│        │  ├─ LayerWorkspace.tsx
│        │  ├─ LayerManagementPage.tsx
│        │  ├─ LineManagementPage.tsx
│        │  ├─ SurfaceManagementPage.tsx
│        │  ├─ surfaceResourceStore.ts
│        │  ├─ RunHistoryPage.tsx
│        │  └─ SettingsPage.tsx
│        ├─ components/
│        │  ├─ Sidebar.tsx
│        │  └─ Topbar.tsx
│        └─ styles.css       全部 UI 样式
├─ electron.vite.config.ts
├─ package.json
└─ scripts/
   ├─ run-electron-vite.mjs
   └─ start.mjs
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
| 点 | 13 | 32 |
| 线 | 13 | 32 |
| 面 | 16 | 46 |
| 体 | 29 | 82 |
| 场 | 23 | 78 |
| **合计** | **94** | **270** |

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

主进程已注册：

```text
app:info    返回 Electron / Chrome / Node / 平台 / 版本
point:run   模拟执行一个点实例
```

渲染层只能通过 preload 暴露的 `window.baiying` 调用，不直接拿 Node。

## 设计约定

- 类 = 契约；实例 = 配置 + revision。
- 设置页只回答“允许什么”；管理页回答“有什么、是否健康、是否加载”。
- 点层先跑通一条链路：类 → 实例 → 参数 → 运行 → 结果 → 历史。
- 优先保持可运行、可替换、可演示，不先堆真实后台。
