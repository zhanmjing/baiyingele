# 面层功能类与实例调研（v0.1）

> 范围：Atom 的“面”层——可视化、设置、编辑器、面板、对话框、通知、调试界面。
>
> 目标：像点层/线层一样，把面层拆成 **SurfaceClass（面层功能类）** 与 **SurfaceInstance（面层实例）**，并明确它们如何绑定点实例/线实例的数据与动作。
>
> 关联：`ATOM-UNIFIED-MODEL.md`、`ATOM-LINE-CATALOG.md`、`ATOM-LINE-LAYER-BENCHMARK.md`、`SURFACE-LAYER-RESEARCH`（本文）。

---

## 0. 结论

1. **面层功能类不是“页面”，而是可复用的交互模式**：表单、表格、卡片墙、画布、检查器、对话框、向导、运行历史等。
2. **面层实例不是“另一套 UI 代码”，而是把交互模式绑定到具体数据源、动作、位置、主题和权限的结果。**
3. 面层只负责 **展示 + 收集意图**，不负责业务逻辑；业务逻辑在线层/点层。
4. 面层不能直接依赖 `PointClass`；它绑定的是 **FlowInstance / PointInstance 的类型化输出**，以及 **FlowInstance / command 的动作**。
5. 同一个面层类可以服务多个业务：`surface.form` 既做 VPN 设置，也做点实例参数；`surface.dialog` 既做 VPN 审批，也做删除确认。
6. 面层最大的反模式是“每个页面一个类”和“把 `FieldDef` 当第二套参数 Schema”。

---

## 1. 面层边界

### 1.1 面 vs 体 vs 点/线/场

| 层 | 关注 | 例子 |
|---|---|---|
| 点 | 原子能力 | `vpn.status`、`app.launch`、`sys.open` |
| 线 | 组合与流程 | `flow.ensure-vpn`、`flow.open-external-site` |
| **面** | **交互与呈现** | VPN 设置表单、VPN 审批对话框、站点启动卡片墙、流程画布 |
| 体 | 打包成产品 | “外网访问助手” = 面 + 线 + 权限 + 资产 |
| 场 | AI 理解/生成/修复 | “帮我做一个打开 GitHub 前检查 VPN 的按钮” |

### 1.2 面层不是什么

- 不是业务逻辑层：不要在这里检测 VPN、启动 VPN、移动文件。
- 不是点层：`notify.toast` 是“发送通知”的点能力；`surface.notification` 是“显示通知”的面。
- 不是体层：体是打包后的产品；面是可复用的交互单元。
- 不是页面集合：页面是多个 SurfaceInstance 的组合，不是类。

### 1.3 面层与点/线的关系

```text
PointInstance / FlowInstance
        │ typed outputs
        ▼
   SurfaceInstance
        │ user intent
        ▼
FlowInstance / PointInstance / command
```

- **数据向下**：面读取 `FlowRun` / `PointRun` / `GuardResult` / registry 查询结果。
- **意图向上**：面发出 `runFlow`、`runPoint`、`saveSettings`、`approvalResult`、`navigate` 等意图。
- 面不直接修改业务状态；它调用线层/点层，由运行时决定结果。

---

## 2. 对象模型

### 2.1 SurfaceClass

```ts
type SurfaceClass = {
  id: string;
  version: string;
  name: string;
  family: "input" | "browse" | "visualize" | "communicate" | "debug";
  regions: RegionSpec[];       // header / body / footer / sidebar / toolbar
  slots: SurfaceSlot[];        // fields / columns / cards / nodes / actions
  data: PortSpec[];            // 需要的数据输入
  actions: ActionSpec[];       // 可以发出的意图
  states: SurfaceState[];      // idle / loading / empty / error / ready
  layout: LayoutSpec;          // stack / grid / split / canvas
  responsive: BreakpointSpec[];
  a11y: A11ySpec;              // 键盘 / 焦点 / 读屏 / 对比度
  permissions: PermissionSpec[];
};
```

**类管什么**：交互模式、区域、槽位、状态、动作契约、布局规则、可访问性。

**类不管什么**：具体数据、具体业务、具体文案、具体位置、具体主题。

### 2.2 SurfaceInstance

```ts
type SurfaceInstance = {
  id: string;
  surfaceClassId: string;
  surfaceClassVersion: string;
  name: string;

  bindings: {
    data: Record<string, DataBinding>;
    actions: Record<string, ActionBinding>;
  };

  placement: Placement;        // main / sidebar / settings / tray / overlay / modal
  theme: ThemeRef;
  locale?: string;
  permissions: PermissionSet;

  revision: number;
  status: "draft" | "active" | "archived";
};
```

**实例管什么**：绑定哪个数据源、动作指向哪个 FlowInstance、放在哪里、用什么主题、什么权限、哪个 revision。

**实例不管什么**：不新增区域/槽位/状态；要改这些 → 新 SurfaceClass 版本。

### 2.3 绑定类型

```ts
type DataBinding =
  | { kind: "flowOutput"; flowInstanceId: string; flowInstanceRevision: number; output: string }
  | { kind: "pointOutput"; pointInstanceId: string; pointInstanceRevision: number; output: string }
  | { kind: "store"; store: string; selector: string }
  | { kind: "query"; queryId: string; args?: Json }
  | { kind: "static"; value: Json };

type ActionBinding =
  | { kind: "runFlow"; flowInstanceId: string; flowInstanceRevision: number; args?: Json }
  | { kind: "runPoint"; pointInstanceId: string; pointInstanceRevision: number; args?: Json }
  | { kind: "command"; command: string; args?: Json }
  | { kind: "navigate"; surfaceInstanceId: string }
  | { kind: "approval"; gateId: string; result: "approve" | "reject" | "cancel" }
  | { kind: "setState"; key: string; value: Json };
```

### 2.4 SurfaceSession

```ts
type SurfaceSession = {
  surfaceInstanceId: string;
  surfaceInstanceRevision: number;
  startedAt: string;
  state: "idle" | "loading" | "ready" | "error";
  renderErrors: string[];
  actionInvocations: Array<{ actionId: string; at: string; result: string }>;
};
```

`SurfaceSession` 可选，用于调试“面层动作有没有正确触发线层”。

---

## 3. 面层功能类分类

| 家族 | 作用 | 类 |
|---|---|---|
| **Input / Edit** | 收集/修改数据 | `surface.form`、`surface.wizard`、`surface.inspector` |
| **Browse / Select** | 浏览/筛选/选择 | `surface.table`、`surface.card-grid`、`surface.tree`、`surface.command-palette` |
| **Visualize / Edit** | 图、指标、追踪、差异 | `surface.canvas`、`surface.dashboard`、`surface.run-history`、`surface.diff` |
| **Communicate** | 确认、提示、快捷入口 | `surface.dialog`、`surface.notification`、`surface.tray-menu`、`surface.hud` |

---

## 4. 面层功能类目录

### 4.1 Input / Edit

#### `surface.form`

```text
用途：schema 驱动的表单；设置、参数、创建/编辑。
区域：header / body / footer
槽位：fields[]、sections[]、actions[]
状态：idle / validating / error / success
动作：submit / cancel / reset / test
数据：ParamSpec[] / settings schema
实例：surface.settings.vpn、surface.settings.general、surface.point-params
```

#### `surface.wizard`

```text
用途：多步引导；新建流程、绑定槽位、首次配置。
区域：stepper / body / footer
槽位：steps[]、summary、actions[]
状态：editing / validating / review / done
动作：next / back / finish / cancel
实例：surface.wizard.new-flow、surface.wizard.vpn-setup
```

#### `surface.inspector`

```text
用途：查看/编辑选中对象的属性；点类、点实例、槽位、运行节点。
区域：header / sections / property editors / footer
槽位：properties[]、sections[]、actions[]
状态：empty / ready / dirty / error
动作：edit / bind / unbind / revert
实例：surface.inspector.point、surface.inspector.slot-vpn、surface.inspector.run-node
```

### 4.2 Browse / Select

#### `surface.table`

```text
用途：表格浏览、排序、筛选、批量操作。
区域：toolbar / header / rows / pagination / bulk bar
槽位：columns[]、filters[]、rowActions[]、bulkActions[]
状态：loading / empty / error / ready
动作：sort / filter / select / bulkRun / open
实例：surface.point-catalog、surface.flow-instances、surface.run-history.table
```

#### `surface.card-grid`

```text
用途：卡片墙；站点启动、模板市场、Body 市场。
区域：toolbar / filters / grid / empty
槽位：cards[]、filters[]、cardActions[]
状态：loading / empty / error / ready
动作：open / run / preview / install
实例：surface.site-launcher、surface.body-market、surface.flow-gallery
```

#### `surface.tree`

```text
用途：层级导航；Domain → PointClass、FlowClass → 节点。
区域：search / tree / selection
槽位：nodes[]、filters[]
状态：loading / empty / ready
动作：expand / collapse / select / drag
实例：surface.point-domains、surface.flow-outline
```

#### `surface.command-palette`

```text
用途：全局搜索与动作启动；键盘优先。
区域：query / results / groups / footer
槽位：groups[]、results[]、shortcuts[]
状态：idle / searching / empty / error
动作：run / navigate / preview
实例：surface.command-palette.global、surface.command-palette.points
```

### 4.3 Visualize / Edit

#### `surface.canvas`

```text
用途：节点图编辑；线层编辑器、Body 组合器。
区域：toolbar / palette / canvas / minimap / inspector
槽位：nodes[]、edges[]、groups[]、notes[]
状态：empty / editing / validating / running / error
动作：addNode / connect / move / delete / run / save
实例：surface.canvas.flow-editor、surface.canvas.body-composer
```

#### `surface.dashboard`

```text
用途：指标、状态、健康度；系统总览、VPN 状态。
区域：header / metric cards / charts / alerts
槽位：metrics[]、charts[]、alerts[]、actions[]
状态：loading / empty / degraded / error / ready
动作：drilldown / refresh / openRun
实例：surface.dashboard.system、surface.dashboard.vpn
```

#### `surface.run-history`

```text
用途：运行历史、节点 trace、变量快照、回放。
区域：filters / run list / trace / detail / actions
槽位：runs[]、nodes[]、variables[]、errors[]
状态：loading / empty / failed / ready
动作：filter / inspect / replay / export
实例：surface.run-history.flow、surface.run-history.vpn
```

#### `surface.diff`

```text
用途：版本/实例差异；FlowClass 版本、SurfaceInstance revision。
区域：summary / change list / side-by-side / actions
槽位：changes[]、left[]、right[]
状态：loading / empty / conflict / ready
动作：accept / reject / revert / open
实例：surface.diff.flow-version、surface.diff.instance-revision
```

### 4.4 Communicate

#### `surface.dialog`

```text
用途：确认、审批、危险操作；模态。
区域：header / body / actions
槽位：title、message、fields[]、actions[]
状态：idle / waiting / approved / rejected / error
动作：approve / reject / cancel / open
实例：surface.dialog.vpn-approval、surface.dialog.delete-confirm、surface.dialog.deploy-approval
```

#### `surface.notification`

```text
用途：Toast / Tray / Banner；显示结果与下一步。
区域：icon / title / message / actions / close
槽位：level、actions[]
状态：queued / visible / dismissed / actioned
动作：open / retry / dismiss / openSettings
实例：surface.notify.vpn、surface.notify.run、surface.notify.download
```

#### `surface.tray-menu`

```text
用途：托盘/右键菜单；快速入口。
区域：menu items / submenus / separators
槽位：items[]、submenus[]、shortcuts[]
状态：closed / open / disabled
动作：run / navigate / toggle
实例：surface.tray.quick-actions、surface.tray.vpn
```

#### `surface.hud`

```text
用途：屏幕浮层；翻译结果、VPN 状态、录屏提示。
区域：anchor / content / actions / auto-hide
槽位：content[]、actions[]、position
状态：hidden / visible / pinned / error
动作：pin / dismiss / open
实例：surface.hud.translate、surface.hud.vpn-status
```

---

## 5. 面层实例目录

| 实例 | SurfaceClass | 数据绑定 | 动作绑定 | 放置 |
|---|---|---|---|---|
| `surface.settings.vpn` | `surface.form` | settings store / default VPN / autoOpen / autoConnect | saveSettings / testVpn | settings |
| `surface.dialog.vpn-approval` | `surface.dialog` | `flow.ensure-vpn` 的 approval gate 上下文 | approve→open VPN / reject→cancel | modal |
| `surface.site-launcher` | `surface.card-grid` | `FlowInstance` registry / 站点列表 | run `inst.site-*` | main |
| `surface.inspector.slot-vpn` | `surface.inspector` | selected slot + bound FlowInstance | replaceBinding / unbind | sidebar |
| `surface.run-history.vpn` | `surface.run-history` | `FlowRun` / `PointRun` / GuardResult | replay / filterErrors / openSettings | main tab |
| `surface.notify.vpn` | `surface.notification` | `GuardResult` | openSettings / retry / dismiss | toast/tray |
| `surface.canvas.flow-editor` | `surface.canvas` | `FlowClass` graph + `FlowInstance` bindings | addNode / connect / bind / run / save | main |
| `surface.command-palette.global` | `surface.command-palette` | search index（flows/points/settings） | run / navigate | overlay |
| `surface.point-catalog` | `surface.table` | `PointRegistry.list` | inspect / createInstance / archive | main |
| `surface.wizard.new-flow` | `surface.wizard` | FlowClass templates + slot contracts | chooseTemplate / bindSlots / test / finish | modal |
| `surface.diff.flow-version` | `surface.diff` | FlowClass v1 vs v2 | accept / reject / open | main tab |
| `surface.tray.quick-actions` | `surface.tray-menu` | favorite FlowInstances | run / open | tray |
| `surface.hud.translate` | `surface.hud` | `flow.screenshot-translate` output | pin / dismiss / copy | overlay |

---

## 6. VPN 场景的面层实例

### 6.1 站点启动卡片墙

```text
surface.site-launcher  (surface.card-grid)
  cards:
    - YouTube  -> run inst.site-youtube@r3
    - GitHub   -> run inst.site-github@r1
    - Google   -> run inst.site-google@r1
    - 内网     -> run inst.site-intranet@r1
```

面层只发 `runFlow` 意图；VPN 检查由 `inst.site-*` 内部的 `slot.vpn` 处理。

### 6.2 VPN 审批对话框

```text
surface.dialog.vpn-approval  (surface.dialog)
  data: flow.ensure-vpn 的 approval gate 上下文
  message: "VPN 软件未运行，是否打开默认 VPN？"
  actions:
    - 打开 VPN     -> approval approve + action=open
    - 我已手动打开 -> approval approve + action=manual
    - 取消         -> approval reject
```

对话框不检测 VPN，只渲染审批上下文并把用户选择写回 gate。

### 6.3 VPN 设置表单

```text
surface.settings.vpn  (surface.form)
  fields:
    - defaultApp      app picker
    - autoOpenApp     bool
    - autoConnect     bool
    - timeoutSec      number
    - rememberChoice  bool
  actions:
    - saveSettings
    - testVpn         -> run flow.ensure-vpn（dry run）
```

### 6.4 槽位检查器

```text
surface.inspector.slot-vpn  (surface.inspector)
  data: selected slot.vpn + accepts flow.ensure-vpn
  shows: default inst.ensure-vpn-ask@r2
  actions:
    - replaceBinding -> choose inst.ensure-vpn-auto@r1
    - openSubflow   -> surface.canvas.flow-editor (flow.ensure-vpn)
```

### 6.5 运行历史

```text
surface.run-history.vpn  (surface.run-history)
  data: FlowRun(inst.site-github@r1) + child FlowRun(inst.ensure-vpn-ask@r2)
  shows:
    - vpn slot -> childFlowRun
    - status/launch/connect/notify -> PointRun
    - error code / retryable
  actions: replay / filterErrors / openSettings
```

### 6.6 通知

```text
surface.notify.vpn  (surface.notification)
  data: GuardResult { ok:false, code:"VPN_NOT_CONNECTED", reason:"..." }
  actions: openSettings / retry / dismiss
```

---

## 7. 绑定模型

### 7.1 数据绑定

| 绑定 | 用途 | 例子 |
|---|---|---|
| `flowOutput` | 读 FlowInstance 输出 | `surface.run-history.vpn` 读 FlowRun |
| `pointOutput` | 读 PointInstance 输出 | `surface.inspector.point` 读 PointRun |
| `store` | 读设置/本地状态 | `surface.settings.vpn` 读 settings |
| `query` | 查询 registry/catalog | `surface.point-catalog` 查 PointRegistry |
| `static` | 静态展示 | 帮助文本/说明 |

### 7.2 动作绑定

| 绑定 | 用途 | 例子 |
|---|---|---|
| `runFlow` | 运行 FlowInstance | 卡片点击 → `inst.site-github@r1` |
| `runPoint` | 运行 PointInstance | “测试 VPN” → `vpn.default.status@r1` |
| `command` | 调系统命令 | 打开设置/打开文件夹 |
| `navigate` | 切面 | 打开运行历史/画布 |
| `approval` | 回写审批 gate | VPN 对话框 approve/reject |
| `setState` | 改面层局部状态 | 展开/折叠/选中 |

### 7.3 放置

```text
main / sidebar / settings / modal / tray / context-menu / overlay / hotkey
```

同一个 SurfaceInstance 可以放多个位置吗？建议**一个实例一个 placement**；多位置 = 多实例或 PlacementBinding 列表（P1 再考虑）。

---

## 8. 当前项目发现

1. **`CommandKind` + `FieldDef` 把“面层表单 Schema”和“线层模板”混在一起。**  
   `FieldDef` 维护了一套字段/枚举/默认值，容易与 `ParamSpec` 漂移。面层应消费 `ParamSpec`，不维护第二套参数 Schema。

2. **现有 HTML 原型已经隐含面层类。**  
   - `atom-catalog.html`：卡片墙 + 表格 + 图谱 + Inspector → `card-grid` / `table` / `tree` / `inspector`。  
   - `point-layer-current.html`：表格 + 卡片 + Inspector。  
   - `atom-line-visual.html`：画布 + Inspector + 运行轨迹 → `canvas` / `inspector` / `run-history`。

3. **没有显式的 SurfaceClass / SurfaceInstance 模型。**  
   目前页面/组件是具体的，不能复用为“同一交互模式的不同实例”。

4. **面层状态不完整。**  
   原型多为静态 mock，缺少 loading / empty / error / dirty / conflict 等状态契约。

5. **主题与业务耦合。**  
   设计 token 是全局的；面层应把 theme 作为实例/体层绑定，而不是写进类。

---

## 9. 规则与反模式

### 规则

1. **类管交互模式，实例管绑定。**  
   表单类不写“VPN 设置”；VPN 设置是 `surface.form` 的一个实例。
2. **面层不执行业务。**  
   面只发 `runFlow` / `approval` / `saveSettings` 等意图。
3. **面层不直接依赖 PointClass。**  
   绑定 `FlowInstance` 输出或 `PointInstance` 输出，并锁 revision。
4. **一个页面 = 多个 SurfaceInstance 的组合。**  
   页面不是类；页面是布局/体层的编排。
5. **状态必须显式。**  
   loading / empty / error / ready / dirty / conflict 是类契约的一部分。
6. **数据/动作都要类型化。**  
   面层不知道 VPN 细节，只知道 `GuardResult` 和 `runFlow`。

### 反模式

- ❌ `surface.github-button`、`surface.youtube-card` 这种“业务对象即类”。
- ❌ 在对话框里写 VPN 检测/启动逻辑。
- ❌ 面层直接读 `PointClass` 或直接调 `vpn.status`。
- ❌ 每个页面新建一个 SurfaceClass。
- ❌ `FieldDef` 维护第二套参数 Schema。
- ❌ 把主题、权限、文案硬编码进类。
- ❌ 没有 empty/error/loading 状态，只在 happy path 下工作。

---

## 10. 版本与兼容

- **SurfaceClass version**：区域、槽位、动作、状态、布局 schema 变化 → 新版本。
- **SurfaceInstance revision**：数据/动作绑定、placement、theme、locale、权限变化 → 新 revision。
- **绑定 revision**：`flowInstanceRevision` / `pointInstanceRevision` 必须锁；旧面层实例不会自动跟随新版本。
- **迁移**：SurfaceClass v1→v2 提供迁移器；SurfaceInstance 可批量升级或保持旧版。

---

## 11. 优先级

### P0

- `surface.form` + `surface.settings.vpn`
- `surface.dialog` + `surface.dialog.vpn-approval`
- `surface.table` + `surface.point-catalog`
- `surface.inspector` + `surface.inspector.slot-vpn`
- `surface.notification` + `surface.notify.vpn`
- `surface.command-palette.global`

### P1

- `surface.card-grid` + `surface.site-launcher`
- `surface.run-history` + `surface.run-history.vpn`
- `surface.canvas` + `surface.canvas.flow-editor`
- `surface.wizard` + `surface.wizard.new-flow`
- `surface.tray-menu` + `surface.tray.quick-actions`
- `surface.diff.flow-version`

### P2

- `surface.dashboard` + `surface.dashboard.system`
- `surface.hud` + `surface.hud.translate`
- `surface.tree` + `surface.point-domains`
- 多窗口/多显示器面层
- 主题市场 / 面层模板市场
- AI 生成 SurfaceClass/Instance（AI 提议、运行时校验、用户批准）

---

## 12. 开放问题

1. `surface.table` 和 `surface.card-grid` 是否应该合并成 `surface.collection`？  
   建议 P0 分开：表格强调列/批量操作，卡片墙强调视觉选择。
2. `surface.settings` 是独立类还是 `surface.form` 的实例？  
   建议 `surface.form` 的实例；设置页 = form + sections + navigation。
3. `surface.notification` 与点 `notify.toast` 的边界？  
   点负责“发送通知事件”，面负责“渲染通知并处理动作”；两者通过事件/绑定连接。
4. `surface.dialog` 与 `approval` gate 的边界？  
   gate 负责决策语义/阻塞；dialog 负责渲染决策 UI；一个 gate 可以有多种 dialog 实例。
5. 面层能否直接调用 `command`？  
   可以，但命令必须是已注册的、带权限的 command；不能执行任意脚本。
6. 面层实例是否允许一个实例多个 placement？  
   P0 一个实例一个 placement；P1 再支持 placement bindings。

---

## 13. 一句话总结

**面层类 = 交互模式；面层实例 = 交互模式绑定到具体数据/动作/位置/主题/权限。**

和点层/线层一样：**类是少数，实例是多数；页面是实例的组合，不是类。**
