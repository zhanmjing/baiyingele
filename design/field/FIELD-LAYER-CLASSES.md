# 场层功能类与实例：搜索调研分析（v0.1）

> 问题：场层（Field）应该有哪些功能类？每个类对应哪些实例？它和点/线/面/体、core-ai、core-forge 是什么关系？
>
> 结论：场不是“第五个页面”，也不是“一个聊天框”。场是**穿透点/线/面/体的智能介质**。建议拆成：
>
> **FieldClass（智能契约） → FieldInstance（作用域+模型+策略+参数） → FieldRun（一次建议/草稿/补丁/排序的运行记录）**
>
> 场的输出必须落到点/线/面/体的具体位置，否则它就只是个聊天框。

---

## 0. 一句话结论

```text
FieldClass
  = 输入契约 + 输出类型 + 落点 + 自主度上限 + 模型策略 + 校验/护栏

FieldInstance
  = FieldClass + 作用域 + 模型配置 + 上下文策略 + 参数 + 输出绑定 + revision

FieldRun
  = execute(FieldInstance, ContextSnapshot)
  = FieldResult + evidence + confidence + modelTrace + decision + undoToken?
```

- **类**：`field.prefill`、`field.rank`、`field.generate`、`field.diagnose`……
- **实例**：`field.prefill.ocr-language`、`field.rank.launch-dock`、`field.generate.flow`……
- **运行**：一次参数建议、一次排序、一次 DSL 草稿、一次失败诊断、一次 patch。

---

## 1. 场的定性

前四层的共同前提是“用户做决定，系统执行”；场打破这个前提：

```text
点：用户选动作
线：用户排步骤
面：用户找按钮
体：用户搭结构
场：系统提出建议 → 用户批准 → 系统执行
```

因此场最大的风险不是“不够聪明”，而是**决策权转移过头**。

### 场的三条铁律

1. **可解释**：每个建议必须有 `reason` + `evidence`。
2. **可撤销**：A2 自动应用必须能回滚；A1 草稿默认不执行。
3. **可退场**：AI 必须能一键关闭；关闭后点/线/面/体仍可用。

### 场不是什么

- 不是聊天框：聊天只是输入/解释的一种面。
- 不是 FlowClass：场可以生成/诊断/修复流程，但场本身不是流程。
- 不是 SurfaceClass：场住在面里，不拥有主界面。
- 不是模型：模型只是 FieldClass 的一个执行器；场是契约 + 策略 + 校验。
- 不是全局自动执行器：A3 全自动禁止。

---

## 2. 当前项目盘点

### 2.1 `core-ai`：场的确定性部分

`crates/core-ai/src/lib.rs` 已经有三块：

```rust
pub struct ContextSnapshot {
    pub process: String,
    pub class: String,
    pub title: String,
    pub selected_text: Option<String>,
    pub clipboard: Option<String>,
    pub files: Vec<String>,
    pub url: Option<String>,
    pub hour: u8,
    pub recent_actions: Vec<String>,
}
```

- `never_upload_fields()`：`screenshot / password / token` 永不上传。
- `prefill(ctx)`：从选中文本/文件/剪贴板/URL/进程/标题推断参数。
- `rank(ctx, candidates, freq)`：频次 × 关键词 × 最近使用，带 `reason`。
- `Usage { count, last_ms }` + `bump/freq_of/recent_of`。

### 2.2 `core-forge`：生成五道闸门

- 检索：模块 manifest + 胶水模块。
- 生成：`DraftGenerator` trait，只能产出 DSL。
- 校验：模块存在 / 必填参数 / 变量引用 / 循环依赖。
- 试跑：≤L1 才真跑；≥L2 跳过，交人确认。
- 预览：人话 + 步骤 + 权限 + 副作用。

### 2.3 当前缺口

| 缺口 | 现状 | 影响 |
|---|---|---|
| 没有 FieldClass | `prefill`/`rank` 是函数，不是契约 | 无法按场景组合/复用/评估 |
| 没有 FieldInstance | 没有作用域/模型/阈值/输出绑定 | 不能为不同 body/surface 配不同策略 |
| 没有 FieldRun | 建议没有运行记录 | 无法审计、回滚、评估采纳率 |
| 没有模型路由对象 | 只有 FakeGenerator/未来真模型 | 本地/云端/降级链不可配置 |
| 没有 evidence | `Suggestion.reason` 有，但没有证据 | 无法解释“为什么推荐这个” |
| 没有统一自主度 | 设计有 A0–A2，代码未对象化 | 无法按实例限制权限 |
| 没有反馈闭环 | Usage 只记次数 | 不能学采纳/拒绝/撤销 |

---

## 3. 对象模型

### 3.1 FieldClass

```ts
type FieldClass = {
  id: string;                    // field.prefill
  version: string;               // 1.0.0
  name: string;
  family: "perceive" | "understand" | "generate" | "evolve" | "govern";
  purpose: string;

  inputs: FieldInputSpec[];      // ContextSnapshot / Selection / RunRecord / DSL
  output: FieldOutputKind;       // suggestion/rank/classification/draft/patch/diagnosis/question/explanation
  landing: FieldLanding;         // 落到点/线/面/体的哪个位置

  autonomyMax: "A0" | "A1" | "A2";
  modelPolicy: ModelPolicy;
  validators: ValidatorRef[];
  guards: GuardRef[];
  metrics: MetricRef[];
};
```

### 3.2 FieldLanding

场的输出必须落到一个具体位置：

```ts
type FieldLanding =
  | { layer: "point"; target: "param" | "default" | "visibility" }
  | { layer: "line"; target: "draft" | "patch" | "slotBinding" | "errorPolicy" }
  | { layer: "surface"; target: "order" | "layout" | "filter" | "emptyState" }
  | { layer: "body"; target: "manifest" | "composition" | "settings" | "migration" };
```

没有 `landing` 的 FieldClass 不允许发布。

### 3.3 FieldInstance

```ts
type FieldInstance = {
  id: string;                    // field.prefill.ocr-language
  fieldClassId: string;
  fieldClassVersion: string;

  scope: {
    global?: boolean;
    app?: string;
    bodyInstanceId?: string;
    surfaceInstanceId?: string;
    flowInstanceId?: string;
    pointInstanceId?: string;
  };

  model: {
    profile: "local" | "cloud" | "hybrid";
    modelId?: string;
    fallback: "local" | "rules" | "none";
    maxLatencyMs: number;
    maxContextTokens?: number;
  };

  context: {
    sources: ContextSource[];
    redact: string[];
    maxItems: number;
  };

  params: Record<string, unknown>;
  autonomy: "A0" | "A1" | "A2";
  confidenceThreshold: number;
  outputBinding: OutputBinding;
  feedback: { accept?: boolean; undo?: boolean };
  revision: number;
  enabled: boolean;
};
```

### 3.4 FieldRun

```ts
type FieldRun = {
  id: string;
  fieldInstanceId: string;
  fieldInstanceRevision: number;
  contextHash: string;
  model: string;
  latencyMs: number;
  result: FieldResult;
  evidence: Evidence[];
  confidence: number;
  decision: "pending" | "accepted" | "rejected" | "applied" | "undone";
  appliedTo?: string;
  undoToken?: string;
  createdAt: string;
};
```

---

## 4. 输出类型

```ts
type FieldResult =
  | { kind: "param_suggestion"; key: string; value: Json; confidence: number; reason: string }
  | { kind: "ranking"; items: RankedItem[]; reason: string }
  | { kind: "classification"; label: string; confidence: number; reason: string }
  | { kind: "draft"; dslKind: "point" | "flow" | "surface" | "body"; dsl: Json; human: string; risks: string[] }
  | { kind: "patch"; target: string; diff: string; reason: string; risks: string[] }
  | { kind: "diagnosis"; cause: string; evidence: Evidence[]; fix?: Patch }
  | { kind: "question"; question: string; options?: string[] }
  | { kind: "explanation"; text: string; evidence: Evidence[] };
```

`FieldResult` 不是最终执行；它必须经过 `guard` + `validator` + `preview` + `decision` 才能落地。

---

## 5. 场层功能类目录（23 个）

| # | FieldClass | 家族 | 输出 | 落点 | 自主度上限 | 实例数 |
|---|---|---|---|---|---|---|
| 1 | `field.observe` | perceive | context snapshot | all | A0 | 3 |
| 2 | `field.classify` | understand | label | point/surface/body | A2 | 4 |
| 3 | `field.prefill` | perceive | param suggestion | point | A2 | 5 |
| 4 | `field.rank` | perceive | ranking | surface | A2 | 4 |
| 5 | `field.recommend` | perceive | suggestion | point/line/body | A1 | 3 |
| 6 | `field.detect` | perceive | signal | line/body | A0 | 3 |
| 7 | `field.generate` | generate | draft | point/line/surface/body | A1 | 4 |
| 8 | `field.compose` | generate | draft | line/body | A1 | 3 |
| 9 | `field.plan` | generate | plan | line/body | A1 | 3 |
| 10 | `field.translate` | generate | text/dsl | point/line | A1 | 3 |
| 11 | `field.summarize` | generate | summary | surface/body | A1 | 3 |
| 12 | `field.diagnose` | evolve | diagnosis | line/body | A1 | 4 |
| 13 | `field.repair` | evolve | patch | line/body | A1 | 4 |
| 14 | `field.mine` | evolve | suggestion | line/body | A1 | 3 |
| 15 | `field.learn` | evolve | weights/thresholds | point/surface | A2 | 3 |
| 16 | `field.personalize` | evolve | defaults/layout | point/surface | A2 | 3 |
| 17 | `field.critique` | evolve | review | line/body | A0 | 3 |
| 18 | `field.route` | govern | route decision | all | A2 | 3 |
| 19 | `field.guard` | govern | risk/decision | all | A0 | 4 |
| 20 | `field.ask` | govern | question | all | A0 | 3 |
| 21 | `field.explain` | govern | explanation | all | A0 | 4 |
| 22 | `field.simulate` | govern | preview/impact | line/body | A0 | 3 |
| 23 | `field.memory` | govern | memory op | all | A1 | 3 |

> 共 23 个 FieldClass；实际落地先选 P0 子集。  
> 实例总数 78 个，见第 6 节。

---

## 6. 实例目录

### 6.1 感知与理解

| FieldInstance | FieldClass | 作用域 | 输出 |
|---|---|---|---|
| `field.observe.desktop@r1` | observe | global | 前台进程/窗口/时间/空闲 |
| `field.observe.selection@r1` | observe | global | 选中文本/剪贴板/文件 |
| `field.observe.run-history@r1` | observe | run history | 最近运行/失败/耗时 |
| `field.classify.intent@r1` | classify | command palette | action/flow/body/question |
| `field.classify.file-type@r1` | classify | body.file-preview | text/image/pdf/video/audio |
| `field.classify.ocr-mode@r1` | classify | body.ocr | text/math/qr/table |
| `field.classify.error-kind@r1` | classify | flow runtime | uia/network/permission/param |
| `field.prefill.point-params@r1` | prefill | point instances | 参数默认值 |
| `field.prefill.vpn-profile@r1` | prefill | body.external-access | vpn.profile |
| `field.prefill.ocr-language@r1` | prefill | body.ocr.text | ocr.language |
| `field.prefill.rename-pattern@r1` | prefill | body.batch-rename.regex | rename.pattern |
| `field.prefill.search-query@r1` | prefill | command palette | query |
| `field.rank.scene-grid@r1` | rank | surface.launch-dock | tile.order |
| `field.rank.command-palette@r1` | rank | surface.command-palette | result.order |
| `field.rank.body-market@r1` | rank | surface.card-grid | body.order |
| `field.rank.ocr-mode@r1` | rank | body.ocr | mode order |
| `field.recommend.next-action@r1` | recommend | point/surface | action suggestion |
| `field.recommend.body@r1` | recommend | body market | body suggestion |
| `field.recommend.template@r1` | recommend | flow editor | template suggestion |
| `field.detect.repetition@r1` | detect | global | repeated manual sequence |
| `field.detect.anomaly@r1` | detect | run history | unusual failure/latency |
| `field.detect.opportunity@r1` | detect | body usage | automation opportunity |

### 6.2 生成与编排

| FieldInstance | FieldClass | 作用域 | 输出 |
|---|---|---|---|
| `field.generate.point-action@r1` | generate | point editor | Action DSL draft |
| `field.generate.flow@r1` | generate | line editor | FlowClass/FlowInstance draft |
| `field.generate.surface-layout@r1` | generate | surface editor | SurfaceClass/Instance draft |
| `field.generate.body-manifest@r1` | generate | body editor | BodyManifest draft |
| `field.compose.flow-from-points@r1` | compose | line editor | flow composition draft |
| `field.compose.surface-from-data@r1` | compose | surface editor | surface binding draft |
| `field.compose.body-from-flows@r1` | compose | body editor | body composition draft |
| `field.plan.single-app@r1` | plan | task | app-specific plan |
| `field.plan.cross-app@r1` | plan | task | multi-app plan |
| `field.plan.batch@r1` | plan | batch | batch plan |
| `field.translate.nl-to-dsl@r1` | translate | editor | NL → DSL |
| `field.translate.dsl-to-nl@r1` | translate | inspector | DSL → 人话 |
| `field.translate.error-to-human@r1` | translate | run history | error → 解释 |
| `field.summarize.run-history@r1` | summarize | surface.run-history | 运行摘要 |
| `field.summarize.context@r1` | summarize | command palette | 上下文摘要 |
| `field.summarize.document@r1` | summarize | body | 文档摘要 |

### 6.3 演化与修复

| FieldInstance | FieldClass | 作用域 | 输出 |
|---|---|---|---|
| `field.diagnose.flow-failure@r1` | diagnose | flow run | cause + fix |
| `field.diagnose.uia-timeout@r1` | diagnose | UIA step | selector/timing fix |
| `field.diagnose.vpn-unreachable@r1` | diagnose | external access | network/VPN cause |
| `field.diagnose.ocr-low-confidence@r1` | diagnose | body.ocr | preprocess/mode fix |
| `field.repair.flow-patch@r1` | repair | flow | patch |
| `field.repair.selector-patch@r1` | repair | UIA step | selector patch |
| `field.repair.settings-patch@r1` | repair | body/flow | settings patch |
| `field.repair.permission-fix@r1` | repair | permission error | grant/scope fix |
| `field.mine.action-sequence@r1` | mine | global | action sequence suggestion |
| `field.mine.flow-template@r1` | mine | line | flow template |
| `field.mine.body-candidate@r1` | mine | body | body candidate |
| `field.learn.ranking@r1` | learn | surface rank | weight update |
| `field.learn.prefill@r1` | learn | point prefill | default update |
| `field.learn.threshold@r1` | learn | field policy | confidence threshold |
| `field.personalize.shortcut@r1` | personalize | global | shortcut suggestion |
| `field.personalize.layout@r1` | personalize | surface | layout suggestion |
| `field.personalize.defaults@r1` | personalize | point/body | defaults |
| `field.critique.flow@r1` | critique | flow | review findings |
| `field.critique.body@r1` | critique | body | review findings |
| `field.critique.permission@r1` | critique | permission | over-broad permission warning |

### 6.4 治理与运行

| FieldInstance | FieldClass | 作用域 | 输出 |
|---|---|---|---|
| `field.route.model@r1` | route | global | local/cloud/fallback |
| `field.route.tool@r1` | route | command palette | point/flow/body |
| `field.route.body@r1` | route | file/trigger | body instance |
| `field.guard.risk@r1` | guard | all drafts | L0–L3 |
| `field.guard.permission@r1` | guard | all drafts | allow/deny/ask |
| `field.guard.confidence@r1` | guard | all suggestions | pass/ask/reject |
| `field.guard.privacy@r1` | guard | context | redact/block |
| `field.ask.clarify@r1` | ask | ambiguous request | question + options |
| `field.ask.confirm@r1` | ask | A1/A2 | confirm dialog |
| `field.ask.choose@r1` | ask | multiple matches | chooser |
| `field.explain.suggestion@r1` | explain | surface | why this suggestion |
| `field.explain.point-run@r1` | explain | point run | what happened |
| `field.explain.flow-run@r1` | explain | flow run | step trace |
| `field.explain.permission@r1` | explain | permission prompt | why needed |
| `field.simulate.dry-run@r1` | simulate | draft/patch | dry-run result |
| `field.simulate.impact@r1` | simulate | body/flow | impact analysis |
| `field.simulate.rollback@r1` | simulate | A2 apply | rollback plan |
| `field.memory.preference@r1` | memory | global | preference read/write |
| `field.memory.episodic@r1` | memory | run history | episode recall |
| `field.memory.knowledge@r1` | memory | body/domain | knowledge recall |

> 目录中含 78 个实例；实际落地时先选 P0 子集。

---

## 7. FieldInstance 示例：OCR 语言预填

```json
{
  "id": "field.prefill.ocr-language",
  "fieldClassId": "field.prefill",
  "fieldClassVersion": "1.0.0",
  "scope": { "bodyInstanceId": "body.ocr.text" },
  "model": {
    "profile": "local",
    "fallback": "rules",
    "maxLatencyMs": 50
  },
  "context": {
    "sources": ["recent_actions", "selected_text", "app"],
    "redact": ["clipboard", "url"],
    "maxItems": 20
  },
  "params": {
    "targetKey": "ocr.language",
    "candidates": ["zh", "en", "ja", "auto"]
  },
  "autonomy": "A2",
  "confidenceThreshold": 0.6,
  "outputBinding": { "kind": "pointParam", "key": "ocr.language" },
  "revision": 1,
  "enabled": true
}
```

行为：

```text
用户打开 OCR 面板
  → FieldRun
  → 上下文：最近 OCR 语言=en、当前 app=Chrome、选中文本含中文
  → 建议 ocr.language=zh，confidence=0.72，reason="选中文本以中文为主"
  → 自动填入（A2），用户可改
  → 用户改回 en → FieldRun 记录 rejected，learn 权重下降
```

---

## 8. FieldInstance 示例：Launch Dock 排序

```json
{
  "id": "field.rank.launch-dock",
  "fieldClassId": "field.rank",
  "fieldClassVersion": "1.0.0",
  "scope": { "surfaceInstanceId": "surface.launch-dock.desktop@r1" },
  "model": { "profile": "local", "fallback": "rules", "maxLatencyMs": 30 },
  "context": { "sources": ["usage", "hour", "recent_actions"], "redact": [], "maxItems": 50 },
  "params": { "manualPinsFixed": true, "maxShift": 6 },
  "autonomy": "A2",
  "confidenceThreshold": 0.5,
  "outputBinding": { "kind": "surfaceOrder", "key": "tile.order" },
  "revision": 1,
  "enabled": true
}
```

约束：

- 手动拖过的格子**永不参与排序**。
- 每次最多移动 6 格，避免布局跳变。
- P95 < 30ms；只本地。

---

## 9. FieldInstance 示例：流程生成

```json
{
  "id": "field.generate.flow",
  "fieldClassId": "field.generate",
  "fieldClassVersion": "1.0.0",
  "scope": { "surfaceInstanceId": "surface.canvas.flow-editor@r1" },
  "model": {
    "profile": "hybrid",
    "modelId": "planner",
    "fallback": "rules",
    "maxLatencyMs": 8000
  },
  "context": {
    "sources": ["selected_text", "point_catalog", "flow_catalog", "body_catalog"],
    "redact": ["clipboard", "screenshot", "secrets"],
    "maxItems": 100
  },
  "params": { "maxSteps": 20, "requireVariables": true },
  "autonomy": "A1",
  "confidenceThreshold": 0.0,
  "outputBinding": { "kind": "flowDraft", "slot": "canvas.draft" },
  "revision": 1,
  "enabled": true
}
```

流程：

```text
自然语言
  → 检索点/线/体能力
  → 生成 FlowDraft（DSL，不执行）
  → 静态校验（schema/权限/参数/数据流）
  → Dry-run（≤L1）
  → 双视图预览（人话 + 节点）
  → 用户确认
  → 落库为 disabled
```

---

## 10. 自主度与闸门

### 10.1 自主度

| 档位 | 名称 | 权力 | 用户动作 |
|---|---|---|---|
| A0 | 只建议 | 只读 | 看，可选择采纳 |
| A1 | 草稿 | 产出草稿，不执行 | 预览 + 确认 |
| A2 | 自动可撤销 | 直接执行，可回滚 | 事后撤销 |
| A3 | 全自动 | 直接执行、不可撤销 | **禁止** |

铁律：

- 任何触及不可逆副作用（L2）的操作，自主度最高 A1。
- 新用户默认 A0；使用满 30 天可开 A1；A2 必须手动开启。
- A2 必须产生 `undoToken`。

### 10.2 五道闸门 + 场治理

```text
1. 隐私闸门：截图不上传；密码/token 过滤；最小必要
2. 证据闸门：reason + evidence 必填
3. 置信度闸门：低于阈值 → 不问/不填/草稿
4. 风险闸门：L2 强制 A1 + approval
5. 校验闸门：schema / 权限 / 参数 / 数据流
6. Dry-run：不产生副作用地检查目标
7. 预览：人话 + 步骤 + 权限 + 副作用
8. 决策：accept / reject / apply / undo
```

---

## 11. 模型路由

```text
延迟预算 <100ms 或隐私=极高  → 本地（规则/GBDT/小模型）
需要创造性或长上下文          → 云端 LLM（脱敏后）
云端不可用                    → 云 → 本地 → 规则 → 无
```

`field.route.model` 是 FieldClass，不是散落各处的 if：

```json
{
  "id": "field.route.model.default",
  "fieldClassId": "field.route",
  "params": {
    "localBudgetMs": 100,
    "cloudAllowed": true,
    "fallback": ["cloud", "local", "rules", "none"]
  },
  "autonomy": "A2",
  "revision": 1
}
```

---

## 12. 隐私与上下文

`ContextSnapshot` 字段隐私级别：

| 字段 | 级别 | 策略 |
|---|---|---|
| 前台进程/时间空闲 | 低 | 始终采集 |
| 窗口标题/操作历史/文件路径 | 中 | 按需/可脱敏 |
| 选中文本/剪贴板/URL | 高 | 按需；剪贴板过滤密码；URL 单独授权 |
| 屏幕截图 | 极高 | 默认禁止，且永不上传 |

规则：

- 本地优先；可查看、可清除；最小必要。
- FieldInstance 的 `context.sources` 必须显式声明；不能“顺手拿全部”。
- `context.redact` 必须默认包含 `screenshot/password/token`。
- 云端调用记录 provider/model/contextHash，不记录原文。

---

## 13. 与点/线/面/体的落点

| 层 | 场的落点 | 例子 |
|---|---|---|
| 点 | 参数预填/默认值 | OCR 语言、VPN profile、rename pattern |
| 线 | 流程草稿/补丁/错误策略 | 生成流程、修复选择器、建议重试 |
| 面 | 排序/布局/空状态 | Launch Dock 排序、命令面板结果 |
| 体 | manifest/组合/设置/迁移 | 生成 BodyManifest、建议 suite 组合 |

**判断标准**：如果场的输出没有落到上述某个具体位置，它就只是个聊天框。

---

## 14. 评估指标

每个 FieldInstance 至少记录：

- `acceptRate`：建议被采纳比例。
- `applyRate`：草稿被应用比例。
- `undoRate`：A2 应用后被撤销比例。
- `latencyP95`：端到端延迟。
- `falsePositiveRate`：错误建议比例。
- `costPerAccepted`：每次采纳的模型/算力成本。
- `coverage`：有多少场景触发了场。
- `optOutRate`：关闭场的比例。

验收门槛：

```text
P0 参数预填：acceptRate ≥ 60%，P95 < 50ms
P0 排序：undoRate < 5%，P95 < 30ms
P1 流程生成：静态校验通过率 100%，可用率 ≥ 70%
P1 失败诊断：Top-1 原因命中率 ≥ 60%
```

---

## 15. 反模式

- ❌ 场做成一个全局聊天框。
- ❌ 把 prompt 当 FieldClass。
- ❌ 每个 prompt 建一个类，而不是一个类 + 多实例。
- ❌ 建议没有 reason/evidence。
- ❌ 生成草稿默认 enabled。
- ❌ A3 全自动。
- ❌ 上传截图/密码/token。
- ❌ 手动拖过的格子被排序覆盖。
- ❌ 场直接写运行时状态，绕过 core-dsl 校验。
- ❌ 模型路由散落在业务代码里。
- ❌ 没有 FieldRun，无法审计/回滚/评估。
- ❌ 场关闭后点/线/面/体不可用。

---

## 16. 优先级

### P0（确定性 + 低风险）

- `field.observe`
- `field.prefill`
- `field.rank`
- `field.classify`
- `field.guard`
- `field.ask`
- `field.explain`

### P1（生成 + 修复）

- `field.generate`
- `field.diagnose`
- `field.repair`
- `field.route`
- `field.simulate`
- `field.detect`
- `field.recommend`

### P2（演化 + 个性化）

- `field.compose`
- `field.plan`
- `field.mine`
- `field.learn`
- `field.personalize`
- `field.critique`
- `field.memory`
- `field.summarize`
- `field.translate`

---

## 17. 开放问题

1. FieldClass 应该按“输出类型”还是“业务场景”分？  
   建议按输出类型分；业务差异放 FieldInstance。
2. FieldInstance 是否允许用户自定义？  
   P1 只允许调阈值/自主度/模型；P2 允许自定义参数。
3. 场是否需要自己的运行历史面？  
   建议复用 `surface.run-history`，增加 `field` 过滤，不做独立主界面。
4. 记忆写在哪里？  
   建议 `field.memory` 只读写 MemorySpace/Documents，不直接写运行时配置。
5. 模型输出如何审计？  
   FieldRun 记录 contextHash + model + evidence + result；原文不落库。
6. 场的 A2 自动应用范围？  
   只允许 L0/L1 且可撤销；L2 永远 A1。
7. 场与 body 的权限关系？  
   FieldInstance 的权限 ⊆ 所属 BodyInstance 的权限；不能借场扩权。

---

## 18. 参考

- 本仓库 `crates/core-ai/src/lib.rs`：上下文快照、参数预填、确定性排序。
- 本仓库 `crates/core-forge`：检索/生成/校验/试跑/预览五道闸门。
- 本仓库 `docs/ARCHITECTURE.md`：场只做确定性部分，模型只产出 DSL。
- 本仓库 `docs/ROADMAP.md`：C1 场接模型、C2 智能排序。
- 项目 Documents：`百应 · 「场」层落地设计与 Windows/macOS 双平台开发策略`（3×4 落点矩阵、A0–A3、七个核心落点）。
- Context engineering：动态上下文包 = 当前任务 + 检索证据 + 持久记忆 + 工具描述 + 新观察；质量取决于选择（Berkeley S2026 Lecture 21）。
- Ambient intelligence：从纯对话到融合设备/应用/基础设施信号的环境智能连续体；隐私与同意是核心设计维度（arXiv 2604.05120）。

> 外部资料只用于设计参考；具体契约以本仓库的 `core-ai` / `core-forge` / `core-dsl` 为准。

---

## 19. 一句话总结

**场 = FieldClass（智能契约）+ FieldInstance（作用域/模型/策略/参数）+ FieldRun（可审计的一次建议）。**

场没有自己的主界面；它的输出必须落到点/线/面/体的具体位置。  
先做确定性、低风险的 `observe/prefill/rank/classify/guard/ask/explain`，再做生成/诊断/修复，最后做演化/个性化。
