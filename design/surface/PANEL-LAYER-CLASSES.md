# 面层 · 面板功能类与实例设计（v0.1）

> 范围：Atom 面层里的“面板（Panel）”——检查器、设置、命令、运行历史、AI 产物、Copilot、审批、通知、启动坞、仪表盘、Diff、预览、工具轨迹、控制台。
>
> 先调研可参考的设计：Fluent 2 Drawer、Material 3 Side Sheets、shadcn Sheet/Drawer、SaaS Side Panel、Sidebar 模式、Grafana Dashboard、AX Patterns Side Pane、ArtifactPanel、Microsoft 365 Copilot。
>
> 结论：**PanelClass 是面板外壳契约，PanelInstance 是内容表面 + 位置 + 尺寸 + 状态 + 权限的绑定。** 面板不是页面，也不是业务逻辑层。

---

## 0. 一句话结论

```text
PanelClass
  = regions（header / toolbar / body / footer）
  + modes（docked / bottom / floating / modal / sheet / popover）
  + content slot（SurfaceClass）
  + behaviors（resizable / collapsible / pinnable / focus trap / Esc）
  + states（ready / loading / empty / error / streaming / needsApproval）
  + a11y / permissions

PanelInstance
  = PanelClass@version
  + contentSurfaceRef（SurfaceInstance）
  + data bindings
  + action bindings
  + placement（side / width / height / anchor）
  + behavior overrides
  + state / theme / permissions / revision
```

- **面板壳**：位置、尺寸、开合、层级、焦点、resize、关闭。
- **内容面**：检查器、表格、表单、聊天、Diff、日志等内容交互。
- **不要**把“业务页面”做成 PanelClass。
- **不要**在 PanelClass 里重复 SurfaceClass 的字段/槽位。
- **页面** = 主内容 SurfaceInstance + 一个或多个 PanelInstance 的组合。

---

## 1. 网络调研提炼

| 来源 | 可借鉴 | 对应设计 |
|---|---|---|
| Fluent 2 Drawer | inline vs overlay；header/body/footer；overlay 默认 modal；不要同时开太多；状态消息放内容附近 | docked vs modal；三区 anatomy；最多一个 blocking panel |
| Material 3 Side Sheets | standard side sheet 不阻塞主内容；modal side sheet 用于需要注意的内容；medium/expanded 断点 | standard = docked；modal = 审批/命令；响应式断点 |
| shadcn Sheet / Drawer | Sheet 适合桌面侧面板；Drawer 适合触摸/滑动/底部；focus management、Esc、backdrop | 桌面右侧用 Sheet；移动端用 bottom sheet；焦点归还 |
| SaaS Side Panel 指南 | 面板是“beside the current page”的聚焦工作区；保持上下文；校验放面板内；明确背景是否可交互 | inspector/settings/run 用 docked；approval 才 modal |
| Sidebar 模式 | expanded 240–280px；rail 56–72px；collapsible；resizable；移动端 off-canvas | 面板宽度档位；rail/collapse；记住宽度 |
| Grafana Dashboard | 最重要信号放顶部；重复行；logs/traces 放底部；变量减少面板爆炸 | dashboard panel 的层次；run-history + trace + console 的关系 |
| AX Patterns Side Pane | 桌面在聊天旁约半宽；移动端 modal sheet；关闭按钮在 header；内容可编辑 | chat + artifact 并排；移动端 sheet |
| ArtifactPanel | 非模态可 resize；preview/source 切换；versions；copy/download；stream-fed | artifact panel 的 toolbar/footer；版本与导出 |
| Microsoft 365 Copilot | 侧边栏直接对文档工作；建议/修改有清晰信号；不是单纯聊天 | chat panel 与主内容共存；状态可见 |
| AI UX / HAX / PAIR | 上下文、引用、工具透明、置信度、审批、停止/重试、可纠正 | chat/approval/trace/artifact 的 states 与 footer actions |

### 调研结论

1. **docked 是默认，modal 是例外**：持续工作用 docked/floating；只有阻塞决策用 modal。
2. **面板是容器，不是内容**：面板壳管 chrome，内容面管 fields/rows/messages。
3. **三区 anatomy 是共识**：header / body / footer；复杂面板增加 toolbar。
4. **宽度要可调、可记忆**：320/360/420/520/620 档位；resizable；collapse/rail。
5. **焦点与关闭是契约**：Esc、backdrop、close、restore focus、focus trap（仅 modal）。
6. **AI 面板必须并排工作**：chat + artifact 不互相替代；移动端才收成 sheet。
7. **面板不能嵌套滚动陷阱**：一个 panel 一个主 scroll owner；body 内滚动，header/footer 固定。
8. **面板不承载业务逻辑**：动作通过 binding 调 FlowInstance/PointInstance。

---

## 2. PanelClass vs SurfaceClass

| 概念 | 职责 | 例子 |
|---|---|---|
| `SurfaceClass` | 内容交互模式 | `surface.inspector`、`surface.form`、`surface.command-palette`、`surface.streaming-response` |
| `PanelClass` | 容器外壳 + 位置 + 尺寸 + 开合 + 焦点 | `panel.inspector`、`panel.settings`、`panel.chat`、`panel.approval` |
| `SurfaceInstance` | 内容绑定到数据/动作 | `surface.inspector.point@r2` |
| `PanelInstance` | 外壳绑定到内容 SurfaceInstance + placement | `panel.inspector.point@r3` |

```text
panel.inspector.point@r3
  panelClass = panel.inspector@1.0.0
  contentSurface = surface.inspector.point@r2
  placement = docked right / 380px
  state = ready
```

**判定**：

- 换内容交互（检查器 → 表单）→ 换 `contentSurfaceRef`，不是换 PanelClass。
- 换位置/宽度/状态/权限 → 换 PanelInstance。
- 换面板壳的区域/模式/焦点契约 → 新 PanelClass 版本。
- 页面 → 主内容 SurfaceInstance + PanelInstance 组合。

---

## 3. 对象模型

### 3.1 PanelClass

```ts
type PanelMode = "docked-right" | "docked-left" | "bottom" | "floating" | "modal" | "sheet" | "popover";

type PanelClass = {
  id: string;                    // panel.inspector
  version: string;               // 1.0.0
  name: string;
  group: "inspect" | "edit" | "ai" | "data" | "system";

  regions: ("header" | "toolbar" | "body" | "footer")[];
  modes: PanelMode[];
  content: SurfaceClassRef;      // 内容槽位：surface.inspector

  behaviors: (
    | "resizable" | "collapsible" | "pinnable" | "autoHide"
    | "modal" | "focusTrap" | "escClose" | "backdropClose"
    | "rememberSize" | "rememberPosition"
  )[];

  size: {
    minWidth: number;
    maxWidth: number;
    defaultWidth: number;
    defaultHeight?: number;
    resizable: boolean;
  };

  states: PanelState[];
  a11y: PanelA11y;
  permissions: PermissionSpec[];
};
```

### 3.2 PanelInstance

```ts
type PanelInstance = {
  id: string;                    // panel.inspector.point@r3
  panelClassId: string;
  panelClassVersion: string;

  contentSurfaceRef: string;     // surface.inspector.point@r2
  dataBindings: Record<string, DataBinding>;
  actionBindings: Record<string, ActionBinding>;

  placement: {
    mode: PanelMode;
    side?: "left" | "right";
    width?: number;
    height?: number;
    anchor?: "top" | "bottom" | "selection";
  };

  behaviorOverrides?: Partial<PanelClass["behaviors"]>;
  state: PanelState;
  theme: ThemeRef;
  permissions: PermissionSet;
  revision: number;
  status: "active" | "draft" | "archived";
};
```

### 3.3 PanelState

```ts
type PanelState =
  | "ready" | "loading" | "empty" | "error"
  | "streaming" | "needsApproval" | "blocked";
```

### 3.4 PanelA11y

```ts
type PanelA11y = {
  role: "complementary" | "dialog" | "alertdialog" | "region" | "log";
  ariaLabel: string;
  ariaControls: string;
  focusTrap: boolean;            // 仅 modal/sheet
  initialFocus: string;
  returnFocus: string;           // 关闭后回到触发元素
  escapeClose: boolean;
  keyboardResize: boolean;
  liveRegion?: "polite" | "assertive";
};
```

---

## 4. Placement 语义

| 模式 | 适用 | 主内容 | 背景 | 焦点 | 例子 |
|---|---|---|---|---|---|
| `docked-right` | 持续检查/编辑，保持上下文 | 让出宽度 | 可交互 | 不 trap | inspector、settings、run-history、artifact、chat |
| `docked-left` | 导航/结构/大纲 | 让出宽度 | 可交互 | 不 trap | outline、tree、nav |
| `bottom` | 日志/控制台/轨迹 | 让出高度 | 可交互 | 不 trap | console、trace、dashboard |
| `floating` | 非模态工作区，可移动 | 覆盖部分 | 可交互 | 不 trap | artifact、chat、preview |
| `modal` | 阻塞决策/命令 | 覆盖/变暗 | 不可交互 | trap | approval、command、settings（危险） |
| `sheet` | 小屏/移动端 | 覆盖底部 | 不可交互 | trap | approval、filters、settings |
| `popover` | 轻量、短暂 | 覆盖局部 | 可交互 | 不 trap | notifications、trace、quick actions |

### 宽度档位

```text
320  紧凑通知 / trace
360  通知中心 / 窄聊天
380  inspector 默认
420  settings / chat
460  run-history / dashboard
520  artifact / preview
620  command / modal form
```

### 位置惯例

- 导航/大纲 → 左。
- 检查器/设置/通知 → 右。
- 控制台/日志 → 下。
- 审批/命令 → 居中 modal。
- 移动端 → bottom sheet。

---

## 5. 面板 anatomy

```text
┌──────────────────────────────────────┐
│ header   icon · title · subtitle · × │  44px
├──────────────────────────────────────┤
│ toolbar  tabs · filters · search      │  34px
├──────────────────────────────────────┤
│ body     content SurfaceInstance      │  flex / scroll
│          （一个主 scroll owner）        │
├──────────────────────────────────────┤
│ footer   status · revision · actions  │  32px
└──────────────────────────────────────┘
```

### 各区职责

| 区域 | 放什么 | 不放什么 |
|---|---|---|
| header | 标题、副标题、pin、close、overflow | 大段说明、表单 |
| toolbar | tabs、过滤、搜索、视图切换 | 主操作（放 footer） |
| body | 内容 SurfaceInstance | 固定 footer/header |
| footer | 状态、revision、主操作、取消 | 滚动内容 |
| resizer | 宽度/高度拖拽、键盘 resize | 业务动作 |

---

## 6. PanelClass 目录（14 类）

| PanelClass | 模式 | 内容 Surface | 实例数 | 实例示例 |
|---|---|---|---|---|
| `panel.inspector` | right / floating | `surface.inspector` | 3 | point、flow-slot、body-manifest |
| `panel.settings` | right / modal | `surface.settings-page` | 3 | app、body、vpn |
| `panel.command` | modal | `surface.command-palette` | 3 | global、flow-editor、body-launcher |
| `panel.run-history` | right / bottom | `surface.run-history` | 3 | flow、vpn、body |
| `panel.artifact` | right / floating | `surface.artifact-panel` | 3 | code、document、diagram |
| `panel.chat` | right / floating | `surface.prompt-input + surface.streaming-response` | 3 | support、copilot、inline-edit |
| `panel.approval` | modal / sheet | `surface.approval-card` | 3 | tool-call、payment、publish |
| `panel.notifications` | right / popover | `surface.notification` | 3 | center、vpn、update |
| `panel.launcher` | modal | `surface.launch-dock` | 2 | desktop、dev |
| `panel.dashboard` | right / bottom | `surface.dashboard` | 3 | system、vpn、body-health |
| `panel.diff` | right / floating | `surface.diff` | 2 | flow-version、body-manifest |
| `panel.preview` | right / floating | `surface.preview-window` | 2 | file、image |
| `panel.trace` | right / floating | `surface.tool-call-trace` | 2 | agent、mcp |
| `panel.console` | bottom / floating | `surface.log-viewer` | 2 | logs、terminal |

**合计：14 个 PanelClass / 37 个 PanelInstance。**

---

## 7. 关键实例

| PanelInstance | contentSurfaceRef | placement | data / actions |
|---|---|---|---|
| `panel.inspector.point@r3` | `surface.inspector.point@r2` | right 380 | selectedPoint.params / save·reset |
| `panel.settings.vpn@r2` | `surface.form.settings.vpn@r2` | right 440 | settingsStore.vpn / save·test |
| `panel.command.global@r5` | `surface.palette.global@r5` | modal 620 | commandIndex / command·navigate |
| `panel.run-history.vpn@r2` | `surface.run-history.vpn@r2` | right 460 | flowRuns + pointRuns / replay·filter |
| `panel.artifact.code@r2` | `surface.artifact.code@r2` | right 520 | artifact.code / edit·export·version |
| `panel.chat.copilot@r3` | `surface.prompt.chat + surface.stream.chat` | right 420 | session.copilot / send·stop·regenerate |
| `panel.approval.tool-call@r1` | `surface.approval.tool-call@r1` | modal 520 | toolCall + risk / approve·deny·reason |
| `panel.notifications.center@r1` | `surface.notification.center@r1` | right 360 | notifications / dismiss·markRead |
| `panel.launcher.desktop@r1` | `surface.dock.desktop@r1` | modal 720 | launchItems / runFlow·reorder |
| `panel.dashboard.system@r2` | `surface.dashboard.system@r2` | right 520 | metricStream / refresh·settings |
| `panel.diff.flow-version@r1` | `surface.diff.flow-version@r1` | right 560 | flowVersionA+B / accept·revert |
| `panel.trace.agent@r1` | `surface.trace.agent@r1` | right 420 | run.toolCalls / retry·openDetail |
| `panel.console.terminal@r1` | `surface.log-viewer.terminal@r1` | bottom 320 | terminalSession / run·clear |

---

## 8. 状态机

```text
closed
  → opening
  → ready
      → loading
      → empty
      → error
      → streaming
          → needsApproval
              → approve → streaming
              → deny → blocked
      → ready
  → closing
  → closed
```

### 每条状态要有

- **loading**：skeleton，不改变面板宽度。
- **empty**：原因 + 上游动作 + 清除筛选。
- **error**：可读错误 + retry + 打开设置/权限。
- **streaming**：stop / regenerate / 保留已编辑内容。
- **needsApproval**：风险摘要 + diff + approve/deny/reason。
- **blocked**：策略原因 + 替代路径 + dismiss。
- **ready**：内容 + footer 状态 + revision。

---

## 9. 设计规则（调研 + 面板约束）

1. **面板是容器，不是页面**：页面是主内容 + 面板的组合。
2. **docked 默认，modal 例外**：只有阻塞决策才 modal。
3. **保持上下文**：docked/floating 不遮住主内容；modal 才变暗。
4. **一个面板一个主 scroll owner**：body 滚动，header/footer 固定。
5. **宽度可调、可记忆**：resizable + rememberSize；提供 320–620 档位。
6. **关闭要归还焦点**：close/Esc/backdrop 后回到触发元素。
7. **modal 才 trap focus**：docked/floating 不 trap。
8. **校验放面板内**：错误摘要 + 字段错误 + 焦点定位；不要跳到另一个页面。
9. **底部动作栏**：主操作在 footer，随状态启用/禁用；不要藏在滚动底部。
10. **AI 面板并排工作**：chat + artifact 不互相替代；移动端收 sheet。
11. **AI 状态可见**：context chips、citations、tool-call trace、confidence、approval、stop/regenerate。
12. **仪表盘层次**：重要信号顶部，重复行中间，日志/轨迹底部。
13. **不要嵌套滚动陷阱**：避免 panel 内再套 drawer/sheet。
14. **不要同时开多个 blocking panel**：modal 叠 modal 是反模式。
15. **位置惯例**：导航左、检查器/通知右、控制台下、审批/命令居中。

---

## 10. 反模式

- ❌ 每个页面一个 PanelClass。
- ❌ 每个业务表单一个 PanelClass。
- ❌ 所有内容都塞进 modal。
- ❌ 非阻塞任务用 modal。
- ❌ 面板里再套 panel/drawer，形成滚动陷阱。
- ❌ 没有 close / Esc / backdrop / 焦点归还。
- ❌ 宽度不可调、不记忆。
- ❌ header/footer 跟着 body 滚。
- ❌ 面板壳里复制 SurfaceClass 的字段/槽位。
- ❌ 没有 loading/empty/error/blocked。
- ❌ AI 面板只有聊天，没有 context/citations/tool trace/approval。
- ❌ dashboard 面板没有层次，所有图一样大。
- ❌ 同时开多个 blocking panel。
- ❌ 关闭后焦点丢失到 body。

---

## 11. 优先级

### P0

- `panel.inspector`
- `panel.settings`
- `panel.command`
- `panel.approval`
- `panel.chat`
- `panel.artifact`
- `panel.notifications`
- anatomy / resizable / Esc / focus return / states

### P1

- `panel.run-history`
- `panel.dashboard`
- `panel.diff`
- `panel.preview`
- `panel.trace`
- `panel.console`
- `panel.launcher`
- 宽度档位 / rememberSize / mobile sheet

### P2

- floating 位置记忆
- 多面板 dock 布局
- 面板布局保存/恢复
- 面板市场 / 用户自定义面板
- 跨窗口 detach
- 多显示器 panel placement

---

## 12. 可视化原型

文件：`panel-layer-visual.html`（约 59KB，单文件，无外部依赖）

- 左侧：14 个 PanelClass 目录，按检查/编辑/AI/数据/系统分组。
- 中间：真实 app shell + panel 预览；可切换 right / left / bottom / floating / modal / sheet。
- 右侧：PanelClass 契约 + PanelInstance 绑定 + region anatomy。
- 交互：
  - 选类 → 选实例
  - 切 placement
  - 调宽度 300–620
  - 切状态 ready/loading/empty/error/streaming/needsApproval
  - anatomy 区域标注
  - open/close
  - 点击 header/toolbar/body/footer 查看 region 规格
  - 复制 PanelInstance JSON
  - `/` 搜索，`Esc` 关闭，`r` 重置

### 已做校验

- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 数据统计：14 PanelClass / 37 PanelInstance

---

## 13. 参考

- Fluent 2 Drawer: https://fluent2.microsoft.design/components/web/react/core/drawer/usage/
- Material 3 Side Sheets: https://m3.material.io/components/side-sheets/guidelines
- shadcn Sheet: https://ui.shadcn.com/docs/components/sheet
- ReUI Drawer: https://reui.io/components/drawer
- SaaS Side Panel: https://www.saasframe.io/patterns/side-panel
- Sidebar navigation patterns: https://www.setproduct.com/blog/sidebar-navigation-ui-design
- Grafana dashboard best practices: https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/
- AX Patterns Side Pane: https://axpatterns.design/patterns/side-pane
- Tessin ArtifactPanel: https://tessinaui.com/docs/components/artifact-panel
- Microsoft 365 Copilot design: https://www.microsoft.com/en-us/copilot/blog/2026/05/28/introducing-a-new-design-for-microsoft-365-copilot

> 外部资料用于设计参考，不代表任何一家设计系统的 API 契约；落地以目标平台组件库和实际版本为准。

---

## 14. 一句话总结

**PanelClass = 外壳契约；PanelInstance = 内容表面 + 位置 + 尺寸 + 状态 + 权限的绑定。**

面板设计的关键不是“做一个侧边栏”，而是决定：

```text
什么时候 docked？
什么时候 floating？
什么时候才 modal？
内容面是谁？
宽度/焦点/关闭/状态怎么变？
```

把这些问题写进 PanelClass，把具体内容与绑定写进 PanelInstance，面板层才不会退化成“每个页面一个侧边栏”。
