# 面层功能类与实例：网络调研与设计 v0.2

> 调研对象：Material Design 3、Microsoft Fluent 2、IBM Carbon、Ant Design、shadcn/ui、GOV.UK Design System、Apple HIG、Microsoft HAX、Google PAIR，以及 2026 年 AI UX 模式文章。
>
> 结论：面层功能类不是“页面”，也不是“组件库里的 Button”。面层类是可复用的**交互模式契约**；面层实例是把契约绑定到具体数据、动作、位置、主题和权限的结果。

---

## 0. 一句话结论

```text
SurfaceClass
  = 区域 regions
  + 槽位 slots
  + 数据契约 data
  + 动作契约 actions
  + 状态 states
  + 布局 layout
  + 可访问性 a11y
  + 权限 permissions

SurfaceInstance
  = SurfaceClass@version
  + data bindings
  + action bindings
  + placement
  + theme / locale
  + permissions
  + revision
```

- **类**：form / table / dialog / command-palette / run-history / prompt-input……
- **实例**：`surface.settings.vpn@r2`、`surface.table.point-catalog@r3`、`surface.dialog.vpn-approval@r2`……
- **页面**：多个 SurfaceInstance 的组合，不是类。
- **主题**：design tokens，不是类。
- **业务逻辑**：线层/点层，不在面层。

---

## 1. 网络调研提炼

### 1.1 设计系统

| 来源 | 可借鉴 | 对应到面层 |
|---|---|---|
| Material Design 3 | 组件按 Action / Containment / Communication / Navigation / Selection / Text input 分类；强调自适应布局 | 面层 family 分类；同一模式跨尺寸 |
| Microsoft Fluent 2 | 跨产品设计语言、tokens、可访问性、性能 | 主题/tokens 放实例；a11y 写进类契约 |
| IBM Carbon | DataTable、UI Shell、Patterns、数据可视化 | table/tree/dashboard/run-history 的密度与键盘操作 |
| Ant Design | 企业级表单、表格、反馈、导航 | form/table/notification 的完整状态 |
| shadcn/ui | 可组合原语、Radix/Base UI 可访问性、代码所有权 | 类只定义行为契约，实现可替换 |
| GOV.UK Design System | 面向任务、one thing per page、error summary、渐进披露 | wizard/form/error-state 的强约束 |
| Apple HIG | 平台惯例：sheet、popover、sidebar、tab bar | placement 语义；不要把所有东西做成 modal |
| DesignSystems.one | 50 个系统里同一组件换名字 | 统一 SurfaceClass 命名，别按实现命名 |

### 1.2 AI 交互

| 来源 | 可借鉴 | 对应到面层 |
|---|---|---|
| Microsoft HAX | 18 条 Human-AI 指南：明确能力、上下文相关、可纠正、可 dismiss、解释、置信度、全局控制、反馈、优雅失败 | prompt-input / suggestion-card / confidence-badge / approval-card / error state |
| Google PAIR | 心智模型、可解释性、反馈与控制、错误与优雅失败、信任校准 | citation-list / streaming-response / artifact-panel / feedback |
| AI UX Patterns 2026 | prompt inputs、streaming、human approval、explainability、uncertainty、error handling、iterative refinement、context controls | 8 个 AI SurfaceClass |

### 1.3 调研结论

1. **组件不是类**：Button/Input 是 primitive；Form/Table/Dialog 才是面层交互模式。
2. **同一个组件在不同系统叫法不同**：DataTable / IndexTable / DataGrid 本质同类；应统一类名。
3. **类的差异在契约**：区域、槽位、状态、动作、a11y；不是颜色/圆角/字体。
4. **实例的差异在绑定**：数据源、动作目标、位置、主题、权限、revision。
5. **AI 面需要额外状态**：streaming / toolCalling / lowConfidence / needsApproval / blocked。
6. **GOV.UK / HAX 都强调错误与恢复**：错误状态不是装饰，是面层契约的一部分。

---

## 2. 面层边界

| 层 | 关注 | 例子 |
|---|---|---|
| 点 | 原子能力 | `vpn.status`、`browser.open`、`ocr.text` |
| 线 | 组合流程 | `flow.ensure-vpn`、`flow.preview-file` |
| **面** | **交互与呈现** | VPN 设置表单、站点卡片墙、审批对话框、运行历史 |
| 体 | 打包产品 | “外网访问助手” = 面 + 线 + 点 + 权限 + 资产 |
| 场 | AI 理解/生成/修复 | 建议、排序、草稿、诊断、补丁 |
| 技能 | 可复用能力包 | 纯指令 → 场；脚本 → 点；多步 → 线；可安装 → 体 |

面层不是什么：

- 不是业务逻辑层。
- 不是点层（`notify.toast` 是发送通知的点，`surface.notification` 是显示通知的面）。
- 不是体层（体是产品，面是交互单元）。
- 不是页面集合。
- 不是组件库。
- 不是主题系统。

---

## 3. 对象模型

### 3.1 SurfaceClass

```ts
type SurfaceClass = {
  id: string;                    // surface.table
  version: string;               // 1.0.0
  name: string;
  family: "input" | "browse" | "overlay" | "layout" | "data" | "ambient" | "ai";

  regions: RegionSpec[];         // header / body / footer / toolbar / sidebar
  slots: SurfaceSlot[];          // fields / columns / cards / nodes / actions
  data: PortSpec[];              // typed data inputs
  actions: ActionSpec[];         // user intent outputs
  states: SurfaceState[];        // idle / loading / ready / empty / error / ...
  layout: LayoutSpec;            // stack / grid / split / canvas
  responsive: BreakpointSpec[];
  a11y: A11ySpec;                // keyboard / focus / screen reader / contrast
  permissions: PermissionSpec[];
};
```

### 3.2 SurfaceInstance

```ts
type SurfaceInstance = {
  id: string;                    // surface.settings.vpn
  surfaceClassId: string;
  surfaceClassVersion: string;
  name: string;

  bindings: {
    data: Record<string, DataBinding>;
    actions: Record<string, ActionBinding>;
  };

  placement: Placement;
  theme: ThemeRef;
  locale?: string;
  permissions: PermissionSet;
  revision: number;
  status: "draft" | "active" | "archived";
};
```

### 3.3 绑定类型

```ts
type DataBinding =
  | { kind: "flowOutput"; flowInstanceId: string; revision: number; output: string }
  | { kind: "pointOutput"; pointInstanceId: string; revision: number; output: string }
  | { kind: "fieldOutput"; fieldInstanceId: string; revision: number; output: string }
  | { kind: "store"; store: string; selector: string }
  | { kind: "query"; queryId: string; args?: Json }
  | { kind: "stream"; source: string; channel: string }
  | { kind: "static"; value: Json };

type ActionBinding =
  | { kind: "runFlow"; flowInstanceId: string; revision: number }
  | { kind: "runPoint"; pointInstanceId: string; revision: number }
  | { kind: "command"; commandId: string }
  | { kind: "navigate"; route: string }
  | { kind: "approval"; gateId: string; decision: "approve" | "reject" }
  | { kind: "setState"; key: string; value: Json }
  | { kind: "openExternal"; url: string }
  | { kind: "copy"; value: string };

type Placement =
  | "main" | "sidebar" | "settings" | "modal" | "sheet" | "popover"
  | "tray" | "hud" | "dock" | "inline" | "overlay";
```

### 3.4 状态

```ts
type SurfaceState =
  | "idle" | "loading" | "ready" | "empty" | "error" | "disabled"
  | "streaming" | "toolCalling" | "lowConfidence" | "needsApproval" | "blocked" | "success";
```

AI 面必须能表达：

- 正在生成（streaming）
- 正在调工具（toolCalling）
- 低置信度（lowConfidence）
- 等待人批准（needsApproval）
- 被策略拦截（blocked）
- 可撤销（success + undo）

---

## 4. 面层功能类目录（34 个）

### 4.1 Input / Edit（6）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.form` | fields / validation / error summary / submit | `surface.form.settings.vpn`、`surface.form.point-params` |
| `surface.wizard` | steps / body / back-next / review | `surface.wizard.vpn-setup`、`surface.wizard.body-install` |
| `surface.inspector` | sections / property rows / actions | `surface.inspector.point`、`surface.inspector.flow-slot` |
| `surface.settings-page` | nav / section / item / save bar | `surface.settings.app`、`surface.settings.body` |
| `surface.code-editor` | editor / gutter / problems / toolbar | `surface.code-editor.flow-json`、`surface.code-editor.hosts` |
| `surface.key-value-editor` | rows / add / validate / import-export | `surface.editor.env-vars`、`surface.editor.headers` |

### 4.2 Browse / Select（5）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.table` | toolbar / columns / rows / bulk / pagination | `surface.table.point-catalog`、`surface.table.invoice` |
| `surface.tree` | nodes / expand / search / context | `surface.tree.domain-points`、`surface.tree.flow-outline` |
| `surface.card-grid` | cards / filters / empty | `surface.grid.site-launcher`、`surface.grid.body-market` |
| `surface.list` | rows / selection / sections | `surface.list.command-results`、`surface.list.notifications` |
| `surface.command-palette` | input / results / preview / shortcuts | `surface.palette.global`、`surface.palette.flow-editor` |

### 4.3 Overlay / Communicate（4）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.dialog` | title / body / actions / danger | `surface.dialog.vpn-approval`、`surface.dialog.delete-confirm` |
| `surface.sheet` | header / body / footer / resize | `surface.sheet.point-detail`、`surface.sheet.run-detail` |
| `surface.notification` | icon / title / body / actions / dismiss | `surface.notify.vpn`、`surface.notify.run-failed` |
| `surface.context-menu` | items / separators / submenu | `surface.menu.tile`、`surface.menu.flow-node` |

### 4.4 Layout / Navigation（4）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.page` | header / content / aside / footer | `surface.page.settings`、`surface.page.body-detail` |
| `surface.sidebar` | nav / sections / collapse | `surface.sidebar.app`、`surface.sidebar.inspector` |
| `surface.tabs` | tablist / panel | `surface.tabs.main`、`surface.tabs.run-detail` |
| `surface.split-view` | master / detail / resizer | `surface.split.master-detail`、`surface.split.diff` |

### 4.5 Data / Feedback（4）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.dashboard` | filters / cards / charts / refresh | `surface.dashboard.system`、`surface.dashboard.vpn` |
| `surface.run-history` | filters / list / detail / replay | `surface.run-history.flow`、`surface.run-history.vpn` |
| `surface.diff` | left / right / unified / accept | `surface.diff.flow-version`、`surface.diff.body-manifest` |
| `surface.empty-state` | illustration / title / reason / actions | `surface.empty.no-results`、`surface.empty.no-install` |

### 4.6 Ambient / System（3）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.tray-menu` | items / submenu / badges | `surface.tray.quick-actions`、`surface.tray.vpn` |
| `surface.hud` | compact / status / actions / auto-hide | `surface.hud.translate`、`surface.hud.system-status` |
| `surface.launch-dock` | tabs / pages / tiles / hotkeys | `surface.dock.desktop`、`surface.dock.dev` |

### 4.7 AI Interaction（8）

| SurfaceClass | 契约 | 实例示例 |
|---|---|---|
| `surface.prompt-input` | textarea / attachments / context chips / send | `surface.prompt.chat`、`surface.prompt.inline-edit` |
| `surface.streaming-response` | stream / stop / regenerate / citations | `surface.stream.chat`、`surface.stream.summary` |
| `surface.suggestion-card` | title / reason / preview / accept-reject | `surface.suggestion.next-action`、`surface.suggestion.repair` |
| `surface.citation-list` | sources / snippets / open | `surface.citations.docs`、`surface.citations.web` |
| `surface.confidence-badge` | level / reason / evidence | `surface.confidence.answer`、`surface.confidence.ocr` |
| `surface.tool-call-trace` | tool / args / result / status / retry | `surface.trace.agent`、`surface.trace.mcp` |
| `surface.approval-card` | risk / diff / approve / deny / reason | `surface.approval.tool-call`、`surface.approval.payment` |
| `surface.artifact-panel` | preview / edit / versions / export | `surface.artifact.code`、`surface.artifact.document` |

---

## 5. 关键实例与绑定

| SurfaceInstance | Class | Data binding | Action bindings | Placement |
|---|---|---|---|---|
| `surface.settings.vpn@r2` | form | `settingsStore.vpn` | saveSettings · testVpn | settings |
| `surface.table.point-catalog@r3` | table | `query:pointRegistry` | runPoint · openDetail | main |
| `surface.palette.global@r5` | command-palette | `query:commandIndex` | command · navigate | overlay |
| `surface.dialog.vpn-approval@r2` | dialog | `flow.ensureVpn.guard` | approval · openSettings · cancel | modal |
| `surface.run-history.vpn@r2` | run-history | `query:flowRuns` + `query:pointRuns` | replay · filterErrors | main |
| `surface.hud.translate@r4` | hud | `flow.translate.stream` | copy · close | overlay |
| `surface.dock.desktop@r1` | launch-dock | `store:launchItems` | runFlow · reorder | dock |
| `surface.split.master-detail@r1` | split-view | master list + detail query | select · open | main |
| `surface.prompt.chat@r1` | prompt-input | `session:chat` | send · attach | inline |
| `surface.stream.chat@r1` | streaming-response | `flow.chat.stream` | stop · regenerate | inline |
| `surface.suggestion.next-action@r1` | suggestion-card | `fieldOutput:suggestions` | accept · reject | inline |
| `surface.citations.docs@r1` | citation-list | `retriever.docs.citations` | open · copy | sidebar |
| `surface.confidence.answer@r1` | confidence-badge | `fieldOutput:confidence` | showEvidence | inline |
| `surface.trace.agent@r1` | tool-call-trace | `run.toolCalls` | retry · openDetail | sidebar |
| `surface.approval.tool-call@r1` | approval-card | `toolCall + risk` | approve · deny · reason | modal |
| `surface.artifact.code@r1` | artifact-panel | `artifact:code` | edit · export · version | sidebar |
| `surface.empty.no-results@r1` | empty-state | static | clearFilters | inline |
| `surface.diff.flow-version@r1` | diff | `flowVersionA + flowVersionB` | accept · revert | main |

---

## 6. AI 面状态机

```text
idle
  → submitting
  → streaming
      → toolCalling
          → needsApproval
              → approve → streaming
              → deny → blocked
      → lowConfidence
          → showEvidence / ask
      → ready
          → editing → accepted / rejected / undone
      → error
          → retry / fallback / dismiss
```

### 设计规则

1. **明确能力**：prompt-input 要显示能做什么/不能做什么。
2. **上下文可见**：context chips 显示选中文本、文件、页面、记忆。
3. **不确定性可见**：confidence-badge 只在用户能行动时显示，并给 reason/evidence。
4. **引用可查**：citation-list 不能只是装饰，必须能打开来源。
5. **工具透明**：tool-call-trace 显示参数、结果、状态、重试。
6. **人类控制**：approval-card 放在不可逆动作之前。
7. **可纠正**：suggestion-card 必须 accept/reject/编辑，不要只展示。
8. **可停止**：streaming-response 有 stop/regenerate。
9. **保留工作**：iterative refinement 不覆盖用户已编辑内容。
10. **优雅失败**：error state 有 retry/fallback/dismiss，焦点可预测。

---

## 7. 类与实例的判定

| 变化 | 改哪一层 | 例子 |
|---|---|---|
| 换数据源/查询 | SurfaceInstance data binding | point registry → invoice table |
| 换动作目标 | SurfaceInstance action binding | saveSettings → runFlow |
| 换位置 | SurfaceInstance placement | main → settings / modal |
| 换主题/语言 | SurfaceInstance theme/locale | dark / light / zh-CN |
| 换权限 | SurfaceInstance permissions | read-only / admin |
| 换列/字段/槽位 | SurfaceClass 版本 | table 新增列 slot |
| 换状态机 | SurfaceClass 版本 | AI 面新增 needsApproval |
| 换交互模式 | 新 SurfaceClass | form → wizard |
| 换页面 | 组合多个 SurfaceInstance | settings page = page + sidebar + form + tabs |
| 换视觉皮肤 | theme tokens | 不是类，也不是实例 |

**不要**：

- 每个页面建一个 SurfaceClass。
- 每个业务表单建一个 SurfaceClass。
- 把 `FieldDef` 当第二套参数 Schema。
- 把主题/颜色/字体写进类。
- 把业务逻辑写进面。
- 用 modal 做所有交互。
- 忽略 loading/empty/error/disabled 状态。
- AI 面只做“聊天框”，没有引用/置信度/审批/纠正。

---

## 8. 设计原则（调研提炼）

1. **任务优先**：GOV.UK 的 one thing per page；一个面只做一个主任务。
2. **可访问性内建**：shadcn/Radix、Fluent、Carbon 都把键盘/焦点/读屏作为契约。
3. **平台惯例**：Apple HIG 的 sheet/popover/sidebar；不要把所有东西做成 modal。
4. **渐进披露**：表单/检查器/向导先给必要字段，再展开高级设置。
5. **错误总结**：表单错误要有 error summary + 字段级错误 + 焦点定位。
6. **数据密度可调**：table/tree/inspector 支持 compact/comfortable。
7. **状态完整**：idle/loading/ready/empty/error/disabled/streaming/needsApproval。
8. **AI 透明**：能力、上下文、引用、置信度、工具调用、审批。
9. **人类控制**：accept/reject/edit/undo/stop/retry。
10. **主题与行为分离**：tokens 管视觉，SurfaceClass 管行为。

---

## 9. 反模式

- ❌ 页面 = SurfaceClass。
- ❌ 业务表单 = SurfaceClass。
- ❌ 组件库 = 面层类目录。
- ❌ `FieldDef` 当第二套参数 Schema。
- ❌ 主题/颜色/字体写进类。
- ❌ 业务逻辑写进面。
- ❌ 所有交互都做成 modal。
- ❌ 没有 empty/error/loading 状态。
- ❌ 没有键盘/焦点/读屏。
- ❌ AI 面只做聊天框。
- ❌ 引用只是装饰，不能打开。
- ❌ 置信度没有 reason/evidence。
- ❌ 审批放在不可逆动作之后。
- ❌ 生成内容不能编辑/撤销。

---

## 10. 优先级

### P0

- `surface.form`
- `surface.table`
- `surface.dialog`
- `surface.command-palette`
- `surface.settings-page`
- `surface.inspector`
- `surface.notification`
- `surface.empty-state`
- `surface.prompt-input`
- `surface.approval-card`

### P1

- `surface.wizard`
- `surface.card-grid`
- `surface.tree`
- `surface.list`
- `surface.sheet`
- `surface.sidebar`
- `surface.tabs`
- `surface.split-view`
- `surface.run-history`
- `surface.diff`
- `surface.hud`
- `surface.suggestion-card`
- `surface.citation-list`
- `surface.streaming-response`

### P2

- `surface.code-editor`
- `surface.key-value-editor`
- `surface.context-menu`
- `surface.page`
- `surface.dashboard`
- `surface.tray-menu`
- `surface.launch-dock`
- `surface.confidence-badge`
- `surface.tool-call-trace`
- `surface.artifact-panel`

---

## 11. 参考

- Material Design 3 Components: https://m3.material.io/components
- Microsoft Fluent 2: https://fluent2.microsoft.design
- IBM Carbon: https://www.carbondesignsystem.com
- Ant Design: https://ant.design/components/overview
- shadcn/ui: https://ui.shadcn.com/docs/components
- GOV.UK Design System: https://design-system.service.gov.uk/patterns/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Microsoft HAX Guidelines: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Google PAIR People + AI Guidebook: https://pair.withgoogle.com/guidebook-v2/
- DesignSystems.one Components Cross-Reference: https://www.designsystems.one/design-systems/components
- AI UX Patterns 2026: https://figr.design/blog/ai-ux-patterns

> 外部资料用于设计参考，不代表任何一家设计系统的 API 契约；落地时以目标平台组件库和实际版本为准。

---

## 12. 一句话总结

**面层类 = 交互模式契约；面层实例 = 数据/动作/位置/主题/权限的绑定。**

调研设计系统得到的是“模式分类 + 可访问性 + 任务优先”；调研 HAX/PAIR 得到的是“不确定性 + 引用 + 工具透明 + 人类控制”。把两者合起来，才是完整的 SurfaceClass 目录。
