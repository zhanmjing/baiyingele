# 面层如何设计点层界面：点可视化 + 编译设置（v0.1）

> 问题：面层如何设计“点层界面可视化”，以及“编译设置等界面”？
>
> 结论：面层不直接画点层，也不拥有编译逻辑。面层提供一组 **Point Studio SurfaceClass**：
>
> **Point Explorer → Point Matrix / Point Graph → Point Inspector → Param/Port/Binding Editor → Point Run Console**
>
> 编译设置则是另一组 **Build SurfaceClass**：
>
> **Build Settings → Build Pipeline → Build Diagnostics → Build Artifact → Build Profile Diff**
>
> 点层提供 registry / view model / compile plan；面层只负责展示、编辑意图、触发动作。

---

## 0. 一句话结论

```text
点层（Point Layer）
  PointClass / PointInstance / PointPort / PointBinding / PointRun

面层（Surface Layer）
  surface.point-explorer
  surface.point-matrix
  surface.point-graph
  surface.point-inspector
  surface.point-param-editor
  surface.point-port-editor
  surface.point-binding-editor
  surface.point-run-console
  surface.point-version-diff

编译（Build）
  BuildProfileClass / BuildProfileInstance / BuildOptionSpec / BuildRun
  surface.build-settings
  surface.build-pipeline
  surface.build-diagnostics
  surface.build-artifact
  surface.build-profile-diff
```

**面层不计算点图布局，不执行编译，不判断依赖。面层绑定 `PointView` / `BuildProfile` / `BuildRun`，发出 `runPoint` / `saveProfile` / `build` 等意图。**

---

## 1. 先划边界：点层不是流程图

### 1.1 点层有什么

| 对象 | 含义 |
|---|---|
| `PointClass` | 原子能力契约：id、version、params、inputs、outputs、effects、permissions、tests |
| `PointInstance` | `PointClass + params + bindings + revision` |
| `PointPort` | 输入/输出端口：name、type、required、schema |
| `PointBinding` | 点实例到 Flow/Surface/Body 的绑定，不是流程边 |
| `PointRun` | 一次执行：input、output、error、latency、effect、evidence |

### 1.2 点层可视化不是什么

- **不是流程图**：流程边属于线层 `FlowClass`；点层没有“点与点之间的流程边”。
- **不是 3D 装饰**：3D 可以做探索视图，但默认应是可读的矩阵/表格/检查器。
- **不是参数表单集合**：点层还要看 ports、bindings、effects、runs、versions。
- **不是编译设置**：编译设置是 BuildProfile 的编辑面，不是 PointClass 的参数。

### 1.3 点层视图里允许的边

```text
PointClass --hasInstance--> PointInstance
PointClass --hasPort--> PointPort
PointInstance --boundTo--> FlowInstance / SurfaceInstance / BodyInstance
PointInstance --dependsOn--> PointClass
PointInstance --ranAs--> PointRun
```

这些边是 **registry / binding / dependency** 边，不是 flow edge。

---

## 2. 点层界面可视化：Point Studio

### 2.1 推荐布局

```text
┌────────────────────────────────────────────────────────────────────┐
│ Point Studio   [图谱] [实例] [编译设置] [构建]      搜索   Build ▸ │
├──────────────┬─────────────────────────────────────┬───────────────┤
│ Point        │  Matrix / Graph / Table             │ Point         │
│ Explorer     │                                     │ Inspector     │
│              │  点类 × 点实例                       │  Contract     │
│ 域名树        │  端口 / 绑定                         │  Params       │
│ 搜索/筛选     │                                     │  Ports        │
│              │                                     │  Bindings     │
│              │                                     │  Runs         │
├──────────────┴─────────────────────────────────────┴───────────────┤
│ Run Console / Diagnostics / Build Log                              │
└────────────────────────────────────────────────────────────────────┘
```

参考：

- Streemlined Visual Editor：Canvas + Node Palette + Properties Panel + Toolbar + Console。
- nodes.io：Graph Editor + Inspector + Scene。
- Pipeline Editor：Flow / Overview / Parameters / Runs / Usage / Versions 多 tab；Node Details 可放底部 dock。
- Linkurious：节点/边属性面板。
- Grafana Node Graph：图可视化 + panel editor。

### 2.2 五个核心视图

| 视图 | SurfaceClass | 作用 | 默认？ |
|---|---|---|---|
| 点浏览器 | `surface.point-explorer` | 按域名/能力/效果浏览 PointClass | 左栏常驻 |
| 点矩阵 | `surface.point-matrix` | 类 × 实例矩阵，快速看覆盖/状态 | ✅ 默认 |
| 点图 | `surface.point-graph` | 端口/绑定/依赖关系，不是流程图 | 可选 |
| 点检查器 | `surface.point-inspector` | Contract / Params / Ports / Bindings / Runs / Versions | 右栏常驻 |
| 点运行台 | `surface.point-run-console` | 试运行、输入样本、输出、错误、延迟 | 底部 dock |

### 2.3 点矩阵（默认视图）

```text
                 inst-1   inst-2   inst-3   +2
point.vpn.status   ●        ●        ○
point.vpn.connect  ●        ●
point.browser.open ●        ●        ●
point.ocr.text     ●        ○
point.fs.hash      ●        ●
```

编码：

| 视觉 | 含义 |
|---|---|
| 空心方块 | PointClass（类） |
| 实心圆点 | PointInstance（实例） |
| 圆环 | 有 dirty / warning / error |
| 右上角小数字 | revision |
| 颜色 | effect level：L0 绿 / L1 青 / L2 琥珀 / L3 红 |
| 灰点 | disabled / archived |
| `+N` | 该类的更多实例 |

规则：

- 行列必须有标签，不能只靠颜色。
- 颜色表示 effect/status，不表示“重要性”。
- 3D 距离/角度不编码业务重要性；要表达就用标签、图例、inspector。
- 矩阵点击单元格 → 选中 PointInstance → 右栏更新。

### 2.4 点图（关系视图）

```text
PointClass
  ├─ port: input.profile : string
  ├─ port: output.status : VpnStatus
  └─ instance: vpn.default.status@r1
        ├─ boundTo: flow.ensure-vpn@r3 (slot: vpn.status)
        ├─ boundTo: surface.settings.vpn@r2
        └─ ranAs: run_01H... (ok, 842ms)
```

- 节点：PointClass / PointInstance / PointPort / FlowInstance / SurfaceInstance。
- 边：hasPort / hasInstance / boundTo / dependsOn / ranAs。
- **不要**画 flow 的 step 顺序；那是线层画布。
- 布局：从左到右 `Class → Port → Instance → Binding`；或分组泳道。
- 边可临时高亮，但不要用粗细表示“业务重要性”。

### 2.5 点检查器

右栏 tabs：

```text
Contract   id / version / domain / effects / permissions / capabilities
Params     typed schema + current values + defaults + constraints
Ports      inputs / outputs / required / schema / examples
Bindings   flow slots / surface bindings / body refs
Runs       recent PointRun / latency / errors / evidence
Versions   class revision / instance revision / diff
```

检查器不是表单堆叠：每个 tab 只回答一个问题。

### 2.6 参数编辑

参数编辑器应由 `ParamSpec` 驱动，而不是手写表单：

```ts
type ParamSpec = {
  key: string;
  type: "string" | "number" | "boolean" | "enum" | "json" | "secret";
  label: string;
  description?: string;
  default?: Json;
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  advanced?: boolean;
  effect?: "L0" | "L1" | "L2" | "L3";
  secretRef?: boolean;
};
```

规则：

- 默认值可见；不要用 placeholder 代替 default。
- advanced 参数折叠，不删除。
- secret 只显示引用，不回显明文。
- 修改后显示 dirty；保存后生成新 PointInstance revision。
- 参数校验错误就地显示，不跳页。

### 2.7 端口与绑定

- 端口是类型化契约：`name: type`、required、schema、example。
- 绑定是引用：`PointInstanceRef` → `FlowSlotRef` / `SurfaceSlotRef` / `BodySlotRef`。
- 绑定必须锁 revision；不能只写 id。
- 绑定视图显示：
  - 目标类型/实例/revision
  - slot 名称
  - 兼容性检查
  - 解除绑定 / 替换绑定
- 绑定失败显示原因：类型不匹配、版本不兼容、权限不足、目标缺失。

### 2.8 运行台

```text
Input sample     JSON / form / file
Run              ▶ runPoint
Output           typed result + raw
Error            code / message / stack / hint
Latency          12ms / p95
Effect           L0 / L1 / L2 / L3
Evidence         logs / trace / artifacts
```

- 运行台是底部 dock，不抢主视图。
- 运行结果可 pin 到 inspector。
- 运行失败不要只弹 toast；保留在 run history。

---

## 3. 编译设置界面设计

### 3.1 编译设置不是什么

- 不是 PointClass 的参数表单。
- 不是运行时设置（runtime settings）。
- 不是 feature flags 面板。
- 不是自由 JSON 文本框。
- 不是“点 Build 才告诉你哪里错”。

编译设置是 **BuildProfileInstance** 的编辑面；编译执行是 `flow.build`。

### 3.2 对象模型

```ts
type BuildTarget =
  | "point-pack" | "flow-bundle" | "body-package"
  | "plugin" | "cli" | "wasm";

type BuildProfileClass = {
  id: string;                    // build.profile
  version: string;
  targetKinds: BuildTarget[];
  options: BuildOptionSpec[];
};

type BuildProfileInstance = {
  id: string;                    // build.profile.release
  buildProfileClassId: string;
  target: BuildTarget;
  runtime: string;               // win-x64 / win-arm64 / wasm
  profile: "debug" | "release" | "signed" | "portable" | "custom";
  options: Record<string, Json>;
  overrides: Record<string, Json>;
  output: {
    path: string;
    name: string;
    version: string;
    channel: "dev" | "beta" | "stable";
  };
  signing: {
    enabled: boolean;
    certRef?: string;
    timestamp?: boolean;
  };
  permissions: string[];
  dependenciesLock: string;
  revision: number;
};

type BuildOptionSpec = {
  key: string;
  group: "target" | "codegen" | "optimize" | "validate" | "sign" | "deps" | "permissions" | "output" | "advanced";
  type: "boolean" | "enum" | "string" | "number" | "path" | "secretRef";
  label: string;
  description?: string;
  default: Json;
  enum?: string[];
  min?: number;
  max?: number;
  advanced?: boolean;
  policyLocked?: boolean;
  affects?: ("size" | "speed" | "security" | "reproducibility" | "compatibility")[];
};

type BuildRun = {
  id: string;
  profileRef: string;
  status: "queued" | "running" | "ok" | "failed" | "blocked";
  steps: BuildStep[];
  diagnostics: BuildDiagnostic[];
  artifact?: BuildArtifact;
  startedAt: string;
  durationMs?: number;
  digest?: string;
};
```

### 3.3 有效值优先级

```text
built-in default
  < project
  < target
  < profile
  < user override
  < policy (locked)
```

UI 必须显示：

- 当前 effective value
- 来源 badge：`default` / `project` / `target` / `profile` / `override` / `policy`
- 被覆盖时高亮
- `Reset to inherited`
- policy locked 时禁用编辑并说明原因

参考 Xcode Build Settings 的 levels/precedence 思路：同一设置在不同层级有不同值，界面要能看出“最终生效的是哪一层”。

### 3.4 编译设置布局

```text
┌────────────────────────────────────────────────────────────────────┐
│ Build Settings   Profile [Release ▾]   Target [body-package ▾]     │
│                                              [Compare] [Dry run]   │
├──────────────┬─────────────────────────────────────┬───────────────┤
│ Profiles     │ Search settings…        [Advanced]  │ Build Summary │
│              │                                     │               │
│ Debug        │ Target & Runtime                    │ target        │
│ Release  ●   │  runtime      win-x64    [project]  │ profile       │
│ Signed       │  arch         x64        [profile]  │ est. size     │
│ Portable     │                                     │ warnings      │
│ Custom       │ Codegen                             │ permissions   │
│              │  manifest      on        [default]  │ signature     │
│ + New        │  typed stubs   on        [project]  │ digest        │
│              │                                     │               │
│              │ Optimization                        │ [Build ▸]     │
│              │  level         balanced  [profile]  │ [Dry run]     │
│              │  tree-shake    on        [default]  │               │
│              │                                     │               │
│              │ Validation                          │               │
│              │  contract tests on       [policy]   │               │
│              │  effect audit  on        [policy]   │               │
│              │                                     │               │
│              │ Signing & Trust                     │               │
│              │  sign          on        [profile]  │               │
│              │  timestamp     on        [default]  │               │
│              │                                     │               │
│              │ Dependencies                        │               │
│              │  lockfile      body.lock [project]  │               │
│              │                                     │               │
│              │ Output                              │               │
│              │  path          dist/     [project]  │               │
│              │  channel       stable    [profile]  │               │
└──────────────┴─────────────────────────────────────┴───────────────┘
```

### 3.5 设置分组

| Group | 选项 | 说明 |
|---|---|---|
| Target & Runtime | target、runtime、arch、sdk | 编译到什么平台/产物 |
| Codegen | manifest、typed stubs、docs、source maps | 生成什么 |
| Optimization | level、tree-shake、strip、minify、AOT | 体积/速度 |
| Validation | schema、contract tests、effect audit、permission audit、deterministic | 编译前闸门 |
| Signing & Trust | sign、certRef、timestamp、notarize、digest | 签名/信任 |
| Dependencies | lockfile、point versions、flow versions、body SDK | 依赖锁 |
| Permissions & Effects | requested permissions、max effect、policy | 安全边界 |
| Output & Publish | path、name、version、channel、format | 产物 |
| Advanced | env vars、feature flags、concurrency、cache | 高级 |

### 3.6 每行设置的 UI 契约

```text
Label                     [control]
Description / help
Effective: value          [source badge]
[Reset to inherited]      [Why locked?]
```

- `source badge` 不能隐藏。
- `Reset` 只在 override 时出现。
- `policy` locked 时 control 禁用，显示原因。
- 影响体积/安全/可复现性的选项显示 impact badge。
- 修改后 header 显示 dirty；离开时提示保存/丢弃。

### 3.7 Build Summary

右栏固定摘要：

```text
Target        body-package
Profile       Release
Runtime       win-x64
Est. size     18.4 MB
Warnings      2
Errors        0
Permissions   6
Max effect    L2
Signature     pending
Digest        sha256:…
Reproducible  yes
```

- `Build` 在 errors > 0 时禁用；warnings 可继续但需确认。
- `Dry run` 显示 resolve/validate/plan，不实际编译。
- Build 结果进入 `surface.build-pipeline` / `surface.build-diagnostics` / `surface.build-artifact`。

### 3.8 构建流水线

```text
Resolve → Validate → Plan → Compile → Sign → Package → Verify → Publish
```

每步：

- status：pending / running / ok / failed / skipped / blocked
- duration
- log link
- diagnostics count
- artifact link

### 3.9 诊断

```ts
type BuildDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;                  // E_POINT_VERSION_MISMATCH
  message: string;
  optionPath?: string;           // optimize.level
  pointRef?: string;             // point.vpn.status@r2
  file?: string;
  line?: number;
  hint?: string;
  fix?: { label: string; action: CommandRef };
};
```

UI：

- 按 severity/group 过滤。
- 点击诊断 → 跳到对应 option/point/file。
- error 必须可操作；不要只显示一段红字。
- 诊断列表在底部 dock，不遮住设置。

### 3.10 产物

```text
Artifact
  name        external-access.body.pkg
  version     1.4.2
  target      body-package
  size        18.4 MB
  digest      sha256:…
  signature   valid / invalid / unsigned
  channel     stable
  files       manifest.json / payload / blockmap / signature
  actions     Open folder / Copy digest / Verify / Publish
```

---

## 4. SurfaceClass 目录（点 UI + 编译 UI）

### 4.1 点层 UI

| SurfaceClass | 作用 | 关键绑定 | 实例示例 |
|---|---|---|---|
| `surface.point-explorer` | 按域名/能力/效果浏览 | pointRegistry query | `surface.point-explorer.all`、`surface.point-explorer.vpn` |
| `surface.point-matrix` | 类 × 实例矩阵 | PointView | `surface.point-matrix.by-domain` |
| `surface.point-graph` | 端口/绑定/依赖图 | PointView + BindingView | `surface.point-graph.vpn` |
| `surface.point-inspector` | 点契约/参数/端口/绑定/运行 | PointInstance + PointClass | `surface.point-inspector.vpn-status` |
| `surface.point-param-editor` | ParamSpec 驱动表单 | ParamSpec + values | `surface.point-params.vpn` |
| `surface.point-port-editor` | 输入/输出端口 | PortSpec | `surface.point-ports.vpn` |
| `surface.point-binding-editor` | 绑定 Flow/Surface/Body | BindingRefs | `surface.point-bindings.vpn` |
| `surface.point-run-console` | 试运行/输出/错误/延迟 | PointRun | `surface.point-run.vpn` |
| `surface.point-version-diff` | 类/实例版本差异 | PointClass versions | `surface.point-diff.vpn` |

### 4.2 编译 UI

| SurfaceClass | 作用 | 关键绑定 | 实例示例 |
|---|---|---|---|
| `surface.build-settings` | BuildProfile 编辑 | BuildProfile + OptionSpec + Policy | `surface.build-settings.release` |
| `surface.build-pipeline` | 构建步骤 | BuildRun.steps | `surface.build-pipeline.body` |
| `surface.build-diagnostics` | 错误/警告/修复 | BuildRun.diagnostics | `surface.build-diagnostics.body` |
| `surface.build-artifact` | 产物摘要/验证/发布 | BuildArtifact | `surface.build-artifact.body` |
| `surface.build-profile-diff` | 两个 profile 差异 | BuildProfile A/B | `surface.build-profile-diff.release` |

---

## 5. 面板组合

沿用上一轮 `PanelClass`：

```text
Point Studio
  main: surface.point-matrix / surface.point-graph
  left: panel? 不使用 panel；用固定 Explorer
  right: panel.inspector  ← surface.point-inspector
  bottom: panel.console   ← surface.point-run-console

Build Workspace
  main: surface.build-settings
  right: panel.inspector  ← build summary
  bottom: panel.trace     ← surface.build-diagnostics
  auxiliary: panel.artifact ← surface.build-artifact
  auxiliary: panel.diff   ← surface.build-profile-diff
```

关键：

- `panel.inspector` 是外壳；`surface.point-inspector` 是内容。
- `panel.console` 是外壳；`surface.point-run-console` 是内容。
- `panel.settings` 是外壳；`surface.build-settings` 是内容。
- 不要把 Point Studio 做成一个巨型 SurfaceClass；它应该是多个 SurfaceInstance 的组合。

---

## 6. 状态

```ts
type PointViewState =
  | "ready" | "loading" | "empty" | "filtered-empty" | "error" | "stale";
```

- `stale`：registry 有更新，视图需要刷新。
- `filtered-empty`：有数据但被筛选掉；提供清除筛选。
- `error`：保留上一次快照 + 重试。

```ts
type BuildState =
  | "dirty" | "validating" | "ready" | "building" | "failed" | "blocked" | "done";
```

- `dirty`：有未保存修改。
- `validating`：跑 schema/contract/effect audit。
- `blocked`：policy 或权限阻止。
- `failed`：有 diagnostics；保留 build log。
- `done`：artifact 可用。

---

## 7. 可访问性

- 矩阵：`role=grid`，行列头可读，方向键移动，Enter 选中。
- 图：提供表格替代视图；节点/边可键盘聚焦；不要只靠颜色。
- 设置：每个 control 有 label/description/effective value；错误关联到字段。
- 构建：日志 `aria-live=polite`；错误用 alert；不要每次日志都打断读屏。
- 诊断：severity 文本 + 图标 + 颜色三重编码。
- 对比度：L0–L3 颜色不能单独承载语义。

---

## 8. 反模式

- ❌ 把点层画成流程图。
- ❌ 点图边不标类型（hasPort / boundTo / dependsOn 混在一起）。
- ❌ 矩阵只靠颜色，没有标签/图例。
- ❌ 3D 距离表示业务重要性。
- ❌ 参数表单手写，不由 ParamSpec 驱动。
- ❌ 绑定只写 id，不锁 revision。
- ❌ 编译设置是一大张平铺表单。
- ❌ 不显示 effective value 来源。
- ❌ 没有 reset to inherited。
- ❌ policy locked 还能编辑。
- ❌ 有 error 还能点 Build。
- ❌ 构建失败只弹 toast，没有 diagnostics。
- ❌ 编译设置和运行时设置混在一起。
- ❌ 用自由 JSON 作为唯一编辑方式。
- ❌ 没有 dry run。
- ❌ 没有 artifact 摘要/签名/摘要校验。

---

## 9. 优先级

### P0

- `surface.point-explorer`
- `surface.point-matrix`
- `surface.point-inspector`
- `surface.point-param-editor`
- `surface.point-binding-editor`
- `surface.point-run-console`
- `surface.build-settings`
- `surface.build-diagnostics`
- `surface.build-artifact`

### P1

- `surface.point-graph`
- `surface.point-port-editor`
- `surface.point-version-diff`
- `surface.build-pipeline`
- `surface.build-profile-diff`

### P2

- 3D point constellation
- 多选/批量绑定
- 图谱布局切换
- 编译缓存可视化
- 多目标矩阵构建
- 构建产物市场/发布流

---

## 10. 可视化原型

文件：`point-studio-visual.html`（约 60KB，单文件，无外部依赖）

- 顶部 tabs：`点矩阵` / `点实例` / `编译设置` / `构建`。
- 左侧：12 个 PointClass，按网络/内容/系统/AI 筛选；effect 色点。
- 点矩阵：Class × Instance；实心点=实例，颜色=effect/status，rN=revision；点击单元格选中实例。
- 矩阵下方：`Ports → PointInstance → Bindings` 关系条。
- 点实例表：Class / Instance / Status / Rev / Activation / Binding / Effect。
- 编译设置：Profile（Debug/Release/Signed/Portable）+ Target + 分组设置；每行显示 effective value、source badge（default/project/profile/override/policy）、reset；policy 锁定。
- 构建：Resolve → Validate → Plan → Compile → Sign → Package → Verify → Publish；Diagnostics；Artifact。
- 底部 dock：build / runs / problems 日志。
- 交互：`Build` 构建模拟、`Dry run`、profile 切换、target 切换、修改设置产生 override、reset to inherited、运行 Point 模拟、复制 PointInstance JSON。

### 已做校验

- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 数据统计：12 PointClass / 26 PointInstance / 27 BuildOption


---

## 11. 参考

- Streemlined Visual Editor: https://docs.streemlined.io/editor
- nodes.io Manual: https://nodes.io/docs/manual
- Pipeline Editor UI Specification: https://datapipelines.co/docs/pipeline-editor
- Linkurious Inspect Data: https://doc.linkurious.com/user-manual/latest/visualization-inspect
- Grafana Node Graph: https://grafana.com/docs/grafana/next/visualizations/node-graph
- Cambridge Intelligence Graph UX: https://cambridge-intelligence.com/a-guide-to-graph-ux-or-how-to-avoid-wrecking-your-graph-visualization
- Xcode Build Settings: https://developer.apple.com/documentation/xcode/configuring-the-build-settings-of-a-target
- Rust Performance Book Build Configuration: https://nnethercote.github.io/perf-book/build-configuration.html
- 上一轮面板设计：`PANEL-LAYER-CLASSES.md`
- 面层调研：`SURFACE-LAYER-RESEARCH-V2.md`

> 外部资料用于设计参考，不代表任何一家设计系统的 API 契约；落地以目标平台组件库和实际版本为准。

---

## 12. 一句话总结

**点层界面不是“把点画出来”，而是让用户看清：类、实例、参数、端口、绑定、运行、版本。**

**编译设置不是“一张大表单”，而是：profile + 有效值来源 + 校验 + 构建流水线 + 诊断 + 产物。**

面层负责把这些变成可复用 SurfaceClass；点层/构建层负责提供 `PointView`、`BuildProfile`、`BuildRun` 和真正的执行。
