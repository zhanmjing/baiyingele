# 整个软件的设置界面设计（v0.1）

> 范围：点层、线层、面层、体层、场层、通用设置、信息。
>
> 结论：设置不是一个“七页 Tab”，而是一个 **Settings Workspace**：
>
> **左侧分层导航 + 中间 spec-driven 设置页 + 右侧变更/影响面板 + 顶部搜索/作用域/应用。**
>
> 每一层只放“这一层真正拥有的设置”；跨层通用项放 General；只读状态放 Info。

---

## 0. 一句话结论

```text
Settings Workspace
  = SettingsNav
  + SettingsSection（按层/主题）
  + SettingsRow（SettingSpec 驱动）
  + ChangesPanel（draft / apply / restart）
  + Search
  + Scope（User / Workspace / Machine / Policy）
```

- **General**：外观、语言、启动、通知、隐私、网络/更新、可访问性、高级。
- **Point**：点运行时、效果/权限、registry、secrets。
- **Line**：执行、重试、审批闸门、trace/retention、scheduler。
- **Surface**：布局、面板、交互、动效、可访问性、locale。
- **Body**：已安装体、更新、信任/签名、权限、数据保留、隔离。
- **Field**：provider/model、context/memory、routing、autonomy、safety、cost、evaluation。
- **Info**：版本、运行时、数据目录、日志/诊断、许可证、更新历史、支持包/重置。

**设置项不是手写表单，而是 `SettingSpec` + `SettingValue` + `SettingsDraft`。**

---

## 1. 信息架构

```text
Settings
├─ General
│  ├─ Appearance
│  ├─ Language & Region
│  ├─ Startup
│  ├─ Notifications
│  ├─ Privacy & Telemetry
│  ├─ Network & Updates
│  ├─ Accessibility
│  └─ Advanced
├─ Point
│  ├─ Runtime
│  ├─ Effects & Permissions
│  ├─ Registry & Sources
│  └─ Secrets
├─ Line
│  ├─ Execution
│  ├─ Retry & Error Policy
│  ├─ Gates & Approvals
│  ├─ Tracing & Retention
│  └─ Scheduler
├─ Surface
│  ├─ Layout & Panels
│  ├─ Interaction
│  ├─ Motion
│  ├─ Accessibility
│  └─ Locale & Format
├─ Body
│  ├─ Installed Bodies
│  ├─ Updates & Channels
│  ├─ Trust & Signatures
│  ├─ Permissions
│  ├─ Data & Retention
│  └─ Isolation
├─ Field
│  ├─ Providers & Models
│  ├─ Context & Memory
│  ├─ Routing
│  ├─ Autonomy
│  ├─ Safety & Citations
│  ├─ Cost & Limits
│  └─ Evaluation
└─ Info
   ├─ About
   ├─ Runtime & Platform
   ├─ Data Locations
   ├─ Diagnostics & Logs
   ├─ Licenses & Credits
   ├─ Update History
   └─ Support Bundle / Reset
```

### 1.1 分层原则

| 层 | 只放什么 | 不放什么 |
|---|---|---|
| General | 应用级行为、外观、语言、启动、通知、隐私、网络、更新、可访问性 | 某层运行参数 |
| Point | 点运行时、效果、registry、secrets | flow 重试/审批 |
| Line | flow 执行、重试、闸门、trace、scheduler | point 参数默认值 |
| Surface | 布局、面板、交互、动效、locale | 业务权限/模型 key |
| Body | 已安装体、更新、信任、权限、保留、隔离 | 全局主题 |
| Field | provider/model、context、autonomy、safety、cost | UI 布局 |
| Info | 只读状态 + 诊断动作 | 可编辑设置 |

**去重规则**：

- 主题/强调色 → General。
- 面板默认位置/宽度 → Surface。
- 点超时/并发 → Point。
- flow 超时/重试/审批 → Line。
- 体更新/签名 → Body。
- 模型 key/autonomy → Field。
- 应用版本/数据目录 → Info。

---

## 2. Settings Workspace 布局

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Settings    [User ▾]   搜索设置…                  [Import] [Apply] × │
├──────────────┬───────────────────────────────────────┬───────────────┤
│ General      │ General                               │ Changes       │
│  Appearance  │                                       │ 3 unsaved     │
│  Language    │  Appearance                           │               │
│  Startup     │  Theme        [Dark ▾]     [user]     │ theme         │
│  ...         │  Accent       [Cyan ▾]     [user]     │  density      │
│              │  Font scale   [100%]       [default]  │  ...          │
│ Point        │                                       │               │
│ Line         │  Language & Region                    │ [Apply]       │
│ Surface      │  Language     [zh-CN ▾]    [user]     │ [Discard]     │
│ Body         │  Date format  [YYYY-MM-DD] [default]  │               │
│ Field        │                                       │ Restart: app  │
│ Info         │  [Show advanced]                      │               │
└──────────────┴───────────────────────────────────────┴───────────────┘
```

### 2.1 左侧导航

- 两级：层 → 组。
- 每层显示 dirty dot / restart badge / policy lock 数。
- 搜索时过滤导航，并显示匹配数。
- 当前 section 高亮；键盘 `↑/↓` 移动，`Enter` 打开。
- 窄屏折叠为 section select 或抽屉。

### 2.2 中间设置页

- 顶部：层图标、标题、描述、scope badge、section actions。
- 分组卡片：每组一个标题 + 说明 + 设置行。
- 设置行按 `SettingSpec` 渲染。
- 底部：`Show advanced`、`Reset section`。
- 搜索时：显示跨层结果，按层分组；点击跳到对应 section 并高亮。

### 2.3 右侧 Changes

- 当前 draft 的变更列表：old → new、scope、impact、restart。
- `Apply` / `Discard`。
- `Restart required` 列表。
- 校验错误/警告。
- 没有变更时显示“无未保存变更”。
- 窄屏隐藏；Apply 仍在 header。

### 2.4 顶部

- `Scope`：User / Workspace / Machine / Policy。
- `Search`：全局设置搜索。
- `Import` / `Export`。
- `Apply`：有 dirty 时启用。
- `Close`：有 dirty 时确认。
- `Cmd/Ctrl+K`：聚焦搜索。

---

## 3. 对象模型

### 3.1 SettingSpec

```ts
type SettingType =
  | "bool" | "enum" | "string" | "number" | "duration" | "path"
  | "list" | "keyValue" | "secretRef" | "readonly";

type SettingScope = "user" | "workspace" | "machine" | "policy";

type SettingSpec = {
  key: string;                    // surface.layout.panelWidth
  layer: "general" | "point" | "line" | "surface" | "body" | "field" | "info";
  group: string;                  // layout / runtime / trust
  label: string;
  description: string;
  type: SettingType;
  default: Json;
  enum?: string[];
  min?: number;
  max?: number;
  unit?: string;                  // ms / % / MB / days
  scope: SettingScope;
  effect: "L0" | "L1" | "L2" | "L3";
  restart?: "none" | "app" | "body" | "field";
  secret?: boolean;
  policyLocked?: boolean;
  advanced?: boolean;
  requires?: string[];            // other setting keys
  aliases?: string[];             // search aliases
  impact?: ("size" | "security" | "performance" | "privacy" | "compatibility")[];
  validate?: string;              // validator id
};
```

### 3.2 SettingValue

```ts
type SettingValue = {
  key: string;
  value: Json;
  source: "default" | "workspace" | "user" | "machine" | "policy";
  updatedAt?: string;
  updatedBy?: string;
};
```

### 3.3 SettingsDraft

```ts
type SettingsDraft = {
  scope: SettingScope;
  changes: Record<string, { from: Json; to: Json; source: SettingScope }>;
  dirty: boolean;
  errors: Record<string, string>;
  restartRequired: ("app" | "body" | "field")[];
};
```

### 3.4 有效值优先级

```text
built-in default
  < workspace
  < user
  < machine
  < policy (locked)
```

- `user`：默认编辑层。
- `workspace`：团队/项目共享。
- `machine`：设备特定（路径、硬件、代理）。
- `policy`：组织策略，只读。
- UI 必须显示 effective value 和 source badge。
- `Show inherited` 可看每一层的值。
- policy locked 时 control 禁用，显示原因。

---

## 4. 设置行 UI

```text
┌────────────────────────────────────────────────────────────────────┐
│ Label                                          [control]  [source] │
│ Description · impact badge · restart badge                          │
│ [Reset to inherited]  [Why locked?]                                 │
└────────────────────────────────────────────────────────────────────┘
```

### 4.1 控件类型

| 类型 | 控件 | 注意 |
|---|---|---|
| bool | Switch | 变更即时显示 dirty |
| enum | Select | 选项必须有 label/description |
| string | Text input | 校验/长度/pattern |
| number | Number + stepper | min/max/unit |
| duration | Number + unit | ms/s/min |
| path | Path input + Browse + Open | 不存在时警告 |
| list | Chips / multi-select | 可添加/删除/排序 |
| keyValue | Key-value rows | 重复 key 校验 |
| secretRef | “已配置” + Replace/Clear | 不回显明文 |
| readonly | 文本/代码 | Info 使用 |

### 4.2 状态

- `default`：默认值。
- `inherited`：来自上层。
- `overridden`：当前 scope 覆盖。
- `policy`：锁定。
- `dirty`：draft 有改动。
- `invalid`：校验错误。
- `restart`：需要重启 app/body/field。
- `secret`：已配置/未配置。

### 4.3 Secret 设计

- 不显示明文；只显示 `Configured` / `Not configured`。
- `Replace` 打开凭据输入；保存到 OS credential vault。
- `Clear` 需要确认。
- 导出设置时永不包含 secret 值，只导出 `secretRef` 名称。
- 日志/诊断自动 redact。

---

## 5. 通用设置（General）

| 组 | 设置 | 说明 |
|---|---|---|
| Appearance | theme、accent、fontScale、density | 应用级视觉 |
| Language & Region | language、dateFormat、numberFormat、firstDayOfWeek | 本地化 |
| Startup | launchAtLogin、startMinimized、restoreLastWorkspace | 启动行为 |
| Notifications | toastDuration、doNotDisturb、sound、criticalOnly | 通知 |
| Privacy & Telemetry | telemetry、crashReports、usageData | 隐私 |
| Network & Updates | proxy、updateChannel、autoCheckUpdates | 网络/更新 |
| Accessibility | highContrast、reduceMotion、keyboardHints、screenReaderHints | 可访问性 |
| Advanced | developerMode、experimentalFeatures、logLevel | 高级 |

### 关键规则

- theme/accent 影响全局；Surface 只放布局/交互。
- updateChannel 是应用更新，不是 Body 更新。
- telemetry 默认 `off` 或 `basic`，必须可关闭。
- developerMode 打开后才显示实验项。

---

## 6. 点层设置（Point）

| 组 | 设置 | 说明 |
|---|---|---|
| Runtime | defaultTimeoutMs、maxConcurrency、sandbox | 点执行默认 |
| Effects & Permissions | maxEffect、requireApprovalForL2、logInputs | 效果/权限 |
| Registry & Sources | registryUrl、allowUnsignedPoints、cacheTtl | 点来源 |
| Secrets | secretStore、revealPolicy | 凭据 |

### 关键规则

- `maxEffect` 是策略上限；单点不能超过。
- `requireApprovalForL2` 与 Line 的审批闸门联动，但这里是默认策略。
- `allowUnsignedPoints` 默认 false；打开需要 L2 确认。
- `logInputs` 默认 false；可能含敏感数据。
- 点超时/并发是 **点运行时**；flow 超时/并发在 Line。

---

## 7. 线层设置（Line）

| 组 | 设置 | 说明 |
|---|---|---|
| Execution | defaultTimeoutMs、maxParallelFlows、retryPolicy、maxRetries | flow 执行 |
| Retry & Error Policy | backoff、jitter、failFast、errorBudget | 重试/错误 |
| Gates & Approvals | requireApprovalForL2、approvalTimeoutS、autoDenyOnTimeout | 审批 |
| Tracing & Retention | traceSampling、runRetentionDays、logLevel | 可观测性 |
| Scheduler | missedRunPolicy、timezone、maxScheduledRuns | 调度 |

### 关键规则

- retry 不是 Point 的参数；Point 只声明可重试性/效果。
- `autoDenyOnTimeout` 默认 true，安全优先。
- `traceSampling` 影响性能；高采样要提示。
- `runRetentionDays` 影响磁盘；显示估算。

---

## 8. 面层设置（Surface）

| 组 | 设置 | 说明 |
|---|---|---|
| Layout & Panels | defaultPanelSide、panelWidth、rememberPanelSize、tableDensity | 布局 |
| Interaction | doubleClickAction、middleClickAction、wheelBehavior | 交互 |
| Motion | reduceMotion、animationSpeed | 动效 |
| Accessibility | focusRing、screenReaderHints、keyboardHints | 可访问性 |
| Locale & Format | locale、timeFormat、firstDayOfWeek | 显示格式 |

### 关键规则

- Surface 设置只影响“呈现/交互”，不影响业务效果。
- `reduceMotion` 必须尊重系统设置；应用设置只能更严格。
- `panelWidth` 是默认值，PanelInstance 可覆盖；用户调整后 remember。
- `tableDensity` 只影响 table/tree/list，不影响信息密度语义。

---

## 9. 体层设置（Body）

| 组 | 设置 | 说明 |
|---|---|---|
| Installed Bodies | 已安装列表、启用/禁用、版本、健康 | 体管理 |
| Updates & Channels | autoUpdate、updateChannel、allowPrerelease | 更新 |
| Trust & Signatures | requireSignature、allowUnknownPublisher、verifyOnLaunch | 信任 |
| Permissions | permissionReview、revoke、requestLog | 权限 |
| Data & Retention | retentionDays、backupBeforeUpdate、rollbackKeepVersions | 数据 |
| Isolation | sandbox、networkAccess、filesystemScope | 隔离 |

### 关键规则

- `requireSignature` 默认 true；关闭需要 L3 确认。
- 更新前备份；保留至少 2 个版本用于回滚。
- 权限审查默认 `always`；可改 `firstRun`，但不建议 `never`。
- 数据保留与 Body 数据目录绑定；删除前显示影响。
- Body 设置不是 BodyInstance 的参数；它是宿主对体的策略。

---

## 10. 场层设置（Field）

| 组 | 设置 | 说明 |
|---|---|---|
| Providers & Models | provider、baseUrl、apiKeyRef、defaultModel | 模型接入 |
| Context & Memory | contextBudget、memoryScope、citationPolicy | 上下文 |
| Routing | routingMode、fallbackModel、latencyBudget | 路由 |
| Autonomy | autonomyLevel、requireApprovalForL2、maxCostPerRun | 自主性 |
| Safety & Citations | contentFilter、redactSecrets、logPrompts | 安全 |
| Cost & Limits | monthlyBudget、perRunCap、alertThreshold | 成本 |
| Evaluation | evalOnSave、regressionSuite、sampleRate | 评估 |

### 关键规则

- API key 只存 secretRef；不回显。
- `autonomyLevel` 默认 A0/A1；A2 需要明确开启；A3 禁止。
- `requireApprovalForL2` 默认 true；不可被单次 run 绕过。
- `logPrompts` 默认 false；打开需隐私提示。
- `contextBudget` 与模型上下文窗口联动；超出给 warning。
- `citationPolicy` 默认 `whenAvailable`；高风险场景强制 `always`。
- `maxCostPerRun` / `monthlyBudget` 必须显示币种与估算。

---

## 11. 信息（Info）

只读页，不是设置页。

| 卡片 | 内容 | 动作 |
|---|---|---|
| About | 版本、build、channel、commit | Copy version |
| Runtime & Platform | OS、arch、runtime、WebView、GPU | Copy diagnostics |
| Data Locations | config/data/cache/logs/backup | Open folder |
| Diagnostics & Logs | log level、最近错误、trace | Export support bundle |
| Licenses & Credits | OSS licenses、第三方资产 | View licenses |
| Update History | 版本、日期、channel、result | View release notes |
| Support / Reset | 支持包、重置设置、重置应用 | 危险动作需确认 |

### 关键规则

- Info 不提供编辑控件。
- “Reset settings” 与 “Reset app” 分开；前者保留数据，后者删除数据。
- 导出支持包前 redact secrets / 路径 / 用户名。
- 版本号可复制；build/commit 可复制。
- 更新历史只读；回滚在 Body/Update 里，不在 Info。

---

## 12. 搜索

索引字段：

```text
key + label + description + aliases + enum labels + layer + group
```

行为：

- `Cmd/Ctrl+K` 聚焦。
- 输入即搜；结果按层分组。
- 高亮匹配词。
- 点击结果 → 跳到 section → 高亮该行 1.5s。
- 支持 `settings://surface/layout/panelWidth` 深链。
- 无结果时给“清除筛选/查看全部”。

---

## 13. 作用域与继承

```text
Policy (locked)
  ↑
Machine
  ↑
User
  ↑
Workspace
  ↑
Default
```

UI：

- Scope selector：User / Workspace / Machine / Policy。
- `Show inherited`：展开每层值。
- 每行 source badge。
- `Reset to inherited`。
- Policy 层只读，显示 lock 原因。
- Import 时选择目标 scope；先 diff 再 apply。

---

## 14. Import / Export

### Export

- 只导出非 secret 设置。
- 包含 schema version、scope、values、source。
- 可选“仅导出偏离默认值的项”。
- 文件：`settings-export-2026-11-23.json`。

### Import

- 先校验 schema/类型/范围。
- 显示 diff：新增/修改/删除/冲突。
- 冲突策略：keep current / use imported / merge。
- secret 只导入 ref 名称，不导入值。
- policy locked 项不可导入覆盖。

---

## 15. 状态与校验

```ts
type SettingsState =
  | "clean" | "dirty" | "validating" | "invalid"
  | "applying" | "applied" | "restart-required" | "blocked";
```

- `dirty`：有未保存变更。
- `validating`：依赖/范围/策略检查。
- `invalid`：字段错误；Apply 禁用。
- `restart-required`：App/Body/Field 重启。
- `blocked`：policy 或权限阻止。

校验类型：

- type / range / enum
- path exists / writable
- URL reachable (optional)
- dependency (`requires`)
- policy max effect
- cost/budget
- secret presence
- port/URL conflict

---

## 16. 可访问性

- 每行 label 与 control 关联。
- 错误 `aria-describedby`；错误摘要可聚焦。
- 开关/选择可用键盘。
- Scope/搜索/Apply 有明确焦点顺序。
- 颜色不是唯一状态编码；source badge 有文本。
- 动效遵守 `prefers-reduced-motion`。
- 窄屏不隐藏 Apply；Changes 可抽屉打开。

---

## 17. 反模式

- ❌ 七个互不相干的设置页。
- ❌ 每个业务对象一套设置 UI。
- ❌ 一大张平铺表单。
- ❌ 不显示 effective value / source。
- ❌ 没有 reset to inherited。
- ❌ policy locked 还能编辑。
- ❌ 设置重复：主题同时在 General 和 Surface。
- ❌ 点/线设置混在一起（point timeout vs flow retry）。
- ❌ 体更新与应用更新混在一起。
- ❌ 场层 API key 明文显示/导出。
- ❌ secret 写进日志。
- ❌ 没有 dirty / apply / discard。
- ❌ 没有 restart badge。
- ❌ 没有搜索。
- ❌ Info 页放可编辑设置。
- ❌ Reset all 没有确认/影响说明。

---

## 18. 优先级

### P0

- Settings Workspace（nav + section + changes + search + scope）
- `SettingSpec` / `SettingValue` / `SettingsDraft`
- General：Appearance、Language、Startup、Privacy、Updates
- Point：Runtime、Effects、Secrets
- Line：Execution、Gates、Tracing
- Surface：Layout、Interaction、Accessibility
- Body：Installed、Updates、Trust、Permissions
- Field：Providers、Autonomy、Safety、Cost
- Info：About、Runtime、Data Locations、Diagnostics

### P1

- Import/Export + diff
- `Show inherited`
- Restart orchestration
- Body permission review
- Field routing/fallback
- Scheduler
- Support bundle redaction

### P2

- Settings profiles / presets
- Policy simulation
- Settings search deep links
- Per-workspace overrides UI
- Settings change history/audit
- Settings sync across devices
- AI-assisted settings explanation

---

## 19. 可视化原型

文件：`settings-workspace-settings-only.html`（约 179KB，单文件，无外部依赖）

- 原 Settings Workspace：7 sections / 98 settings / 7 Info cards。
- **每个层 section 只有设置；顶部一个“管理页”跳转卡片**。
- 左侧：General / Layers / Info 分组导航；每层显示 class/instance 统计、dirty dot、locked 数。
- 顶部：Scope select、搜索、Apply、更多菜单。
- 中间：设置页；管理页跳转卡片（点层 → atom-catalog，线层 → line-management，面层 → surface-management，体/场 → layer-management）。
- 右侧：设置页显示 Changes。管理页有独立 Inspector。
- 全局搜索覆盖 settings + 100 classes + 316 instances；class/instance 结果跳转到独立管理页。

### 层目录整合

| 层 | 功能类 | 实例 |
|---|---:|---:|
| Point | 13 | 32 |
| Line | 13 | 32 |
| Surface | 16 | 46 |
| Body | 29 | 82 |
| Field | 29 | 124 |
| **合计** | **100** | **316** |

- Point：设置 + 管理页跳转（13 类 · 32 实例）。
- Line：设置 + 管理页跳转（13 类 · 32 实例）。
- Surface：设置 + 管理页跳转（16 类 · 46 实例）。
- Body：设置 + 管理页跳转（29 类 · 82 实例）。
- Field：设置 + 管理页跳转（29 类 · 124 实例）。
- 管理页路由：Point → `atom-catalog-management.html`；Line → `line-management.html`；Surface → `surface-management.html`；Body → `body-management.html`；Field → `field-management.html`。
- 点层深度管理：`atom-catalog-management.html`，支持 `#classId/instanceId` 深链。
- 线层管理：FlowClass / FlowInstance / 数据流图 / Point 绑定表；已实现点实例深链，未实现显示占位符。
- 详细设计：`LAYER-CATALOG-INTEGRATION.md`。

### 已做校验

- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 数据统计：7 sections / 98 settings / 7 info cards；管理页 100 classes / 316 instances；设置页层 tab 数=0


---

## 20. 一句话总结

**设置界面不是“七个页面”，而是一套可继承、可搜索、可校验、可回滚的 Settings Workspace。**

```text
General  → 应用级行为
Point    → 点运行时 / 效果 / registry / secrets
Line     → flow 执行 / 重试 / 闸门 / trace
Surface  → 布局 / 面板 / 交互 / 动效 / locale
Body     → 安装 / 更新 / 信任 / 权限 / 保留 / 隔离
Field    → 模型 / 上下文 / 自主性 / 安全 / 成本
Info     → 只读状态 + 诊断动作
```

每一行设置都必须回答：

```text
当前值是什么？
来自哪一层？
改了会影响什么？
要不要重启？
能不能改？
```

---

## 21. 参考

- Apple Human Interface Guidelines — Settings: https://developer.apple.com/design/human-interface-guidelines/settings
- Microsoft Fluent 2: https://fluent2.microsoft.design
- Visual Studio Code Settings: https://code.visualstudio.com/docs/configure/settings
- Xcode Build Settings（层级/优先级参考）: https://developer.apple.com/documentation/xcode/configuring-the-build-settings-of-a-target
- Material Design 3: https://m3.material.io
- 面层调研：`SURFACE-LAYER-RESEARCH-V2.md`
- 面板设计：`PANEL-LAYER-CLASSES.md`
- 点层/编译 UI：`POINT-UI-SURFACE-DESIGN.md`

> 外部资料用于设计参考，不代表任何一家设计系统的 API 契约；落地以目标平台组件库和实际版本为准。
