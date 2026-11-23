# 手势识别实例化与点/线实例匹配（v0.1）

> 问题：手势识别如何实例化？识别出的手势如何匹配到点层实例或线层实例？
>
> 结论：手势识别应拆成 **GestureRecognizerInstance（采样/识别）** 与 **GestureBindingInstance（手势 → AtomRef）** 两层。识别器只产出 `GestureEvent`；绑定层把 `pattern + button + modifier + appScope` 解析成 `PointInstanceRef` 或 `FlowInstanceRef`，再由运行时执行 `PointRun` / `FlowRun`。

---

## 0. 一句话结论

```text
鼠标样本
  → GestureRecognizerInstance（方向量化 / 合并 / 回退 / 防拖拽）
  → GestureEvent { gesture:"LDR", button:"right", phase:"done", ... }
  → GestureBindingInstance（app/button/modifier/pattern）
  → GestureTarget
       ├── PointInstanceRef → runPoint → PointRun
       └── FlowInstanceRef  → runFlow  → FlowRun + slotRuns
```

- **识别** 是触发器层/传感器能力，不是线层组合。
- **绑定** 是“手势 → 点/线实例”的派发层，当前项目已有雏形，但只指向 `action_id`。
- 点层目标执行一次原子能力；线层目标执行组合流程。
- 绑定必须带 revision、app scope、button、modifier、priority。

---

## 1. 当前项目盘点

### 1.1 已实现：识别器

`crates/trig-win/src/gesture.rs`：

```rust
pub struct GestureConfig {
    pub button: MouseButton,
    pub min_segment_px: f32,
    pub min_segments: usize,
    pub timeout_ms: u64,
    pub drag_suppress_px: f32,
    pub dir_confirm_steps: u8,
    pub min_total_px: f32,
    pub dirs8: bool,
}
```

- 8 方向：`U/D/L/R/NE/NW/SE/SW`；4 方向可关 `dirs8`。
- 同方向合并、反向回退、相邻方向去抖（`dir_confirm_steps`）。
- 单段且超过 `drag_suppress_px` → 判为拖拽，丢弃。
- 用 `path_len` 而不是起终点直线距离，圆圈手势不会被误杀。
- 超时取消、最小段数、最小总位移。
- `Gesture { directions, start, end, duration_ms, path_len, suppressed_as_drag }`。
- `MatchQuality::Exact / Fuzzy(1)`；精确优先，模糊是可选。

### 1.2 已实现：事件与绑定

`crates/core-ipc/src/lib.rs`：

```rust
pub struct TriggerEvent {
    pub kind: TriggerKind,
    pub source: EventSource,
    pub ts: u64,
    pub payload: Value,
}
```

手势事件 payload 里带：

```json
{ "phase": "move|done|modifier", "gesture": "LDR", "button": "right", "modifier": null }
```

`crates/shell-tauri/src/bindings.rs`：

```rust
pub struct Binding {
    pub id: String,
    pub kind: String,          // hotkey | pattern | gesture | corner
    pub spec: String,          // "LDR"
    pub action_id: String,     // ← 当前只指向 Action / 线层实例
    pub enabled: bool,
    pub button: Option<String>,
    pub app: Option<String>,
    pub modifier: Option<String>,
    pub execute_on_modifier: bool,
}
```

- `gesture_candidates`：本应用手势优先，按 `inherit` 回落全局；应用单独关闭则一条都不给。
- `matches`：手势只在 `phase=done`（或 `modifier`）时匹配；`button`/`modifier` 必须一致。
- `find_match_ex`：先精确，再可选 `edit_distance <= 1` 的模糊。
- `panel/mod.rs`：命中绑定后把 `Binding` 推入 `pending_bindings`，再用 `action_id` 在 `store.items` 里找 Action 执行。

### 1.3 当前缺口

| 缺口 | 现状 | 影响 |
|---|---|---|
| 目标只有 `action_id` | 只能指向旧 Action / 线层动作 | 不能直接指向 PointInstance |
| 无 target kind | 无法区分 point / flow | 不能选择 `runPoint` 或 `runFlow` |
| 无 revision | `action_id` 是字符串 | 绑定不锁版本，实例升级会漂移 |
| 无 priority | `find_match` 返回第一个命中 | 多绑定冲突时结果依赖列表顺序 |
| 无 confidence | 事件只有 fuzzy 结果，无置信度 | 无法做“模糊命中提示/二次确认” |
| 无歧义处理 | 多条同分命中只取第一条 | 用户不知道为什么执行了另一个 |
| 无 target preview | 手势 overlay 只显示方向 | 用户不知道会启动哪个点/线实例 |

---

## 2. 目标模型

### 2.1 GestureRecognizerClass / Instance

```ts
type GestureRecognizerClass = {
  id: "gesture.recognizer";
  version: "1.0.0";
  inputs: ["pointer.samples"];
  outputs: ["GestureEvent"];
  params: {
    button: "right" | "middle" | "x1" | "x2";
    dirs8: boolean;
    minSegmentPx: number;
    minSegments: number;
    minTotalPx: number;
    timeoutMs: number;
    dragSuppressPx: number;
    dirConfirmSteps: number;
    fuzzy: boolean;
  };
};

type GestureRecognizerInstance = {
  id: string;                    // gesture.recognizer.right
  classId: "gesture.recognizer";
  classVersion: "1.0.0";
  params: GestureRecognizerClass["params"];
  revision: number;
};
```

实例：

| 实例 | button | dirs8 | 典型用途 |
|---|---|---|---|
| `gesture.recognizer.right@r1` | right | true | 主手势键 |
| `gesture.recognizer.x1@r1` | x1 | true | 侧键手势 |
| `gesture.recognizer.middle@r1` | middle | false | 4 方向极简 |

### 2.2 GestureEvent

```ts
type GestureEvent = {
  kind: "gesture";
  phase: "down" | "move" | "done" | "modifier" | "cancel";
  gesture?: string;              // "LDR" / "U" / "NE SW"
  button: "right" | "middle" | "x1" | "x2";
  modifier?: "wheel_up" | "wheel_down" | "left" | "middle" | "right" | "x1" | "x2";
  app?: string;                  // foreground exe
  path: Array<{ x: number; y: number; t: number }>;
  durationMs?: number;
  pathLen?: number;
  confidence?: number;           // 0..1
  fuzzy?: boolean;
  ts: number;
};
```

### 2.3 GestureBindingClass / Instance

```ts
type GestureTarget =
  | { kind: "point"; pointInstanceId: string; pointInstanceRevision: number; args?: Json }
  | { kind: "flow";  flowInstanceId: string;  flowInstanceRevision: number;  args?: Json }
  | { kind: "command"; commandId: string; args?: Json };

type GestureBindingInstance = {
  id: string;                    // gesture.binding.github-ldr
  classId: "gesture.binding";
  classVersion: "1.0.0";
  pattern: string;               // "LDR"
  button?: string;               // None = 跟随全局
  modifier?: string;
  executeOnModifier?: boolean;
  app?: string;                  // None = 全局
  inherit?: boolean;             // 本应用未命中时是否回落全局
  target: GestureTarget;
  priority: number;              // 数值越大越优先
  enabled: boolean;
  revision: number;
};
```

**关键**：

- `target` 是 `AtomRef` 的扩展，必须带 revision。
- `pattern` 规范化后存储（大写、空格分隔）。
- `priority` 解决多绑定同分；没有 priority 就按 specificity（app > global，exact > fuzzy，button+modifier > 无）。
- `inherit=false` 时本应用只用自己手势，不回落全局。

### 2.4 GestureMatch

```ts
type GestureMatch = {
  binding: GestureBindingInstance;
  quality: "exact" | "fuzzy";
  confidence: number;
  target: GestureTarget;
  needsConfirmation: boolean;    // L2/L3 或 fuzzy
};
```

---

## 3. 识别流水线

```text
WH_MOUSE_LL 采样
  → 活跃 Recognizer（按 button 路由）
  → 位移 ≥ minSegmentPx 才量化方向
  → 同方向合并 / 反向回退 / 相邻去抖
  → 单段长距离 → suppressed_as_drag
  → 抬起：minSegments / minTotalPx / timeout 检查
  → GestureEvent(phase=done, gesture="LDR")
  → GestureBinding 匹配
  → GestureTarget
  → runPoint / runFlow
```

**约束**：

- 低级鼠标钩子回调里只入队，不做识别、不分配、不阻塞；`LowLevelHooksTimeout` 默认 300ms，超时会被 Windows 静默摘钩。
- 方向表示法即契约：对角线用 `NE/NW/SE/SW`，不要用 `LD/RU` 这种会与单字母序列歧义的写法。
- 坐标要 DPI-aware；多显示器要统一物理像素坐标。
- 手势 vs 拖拽先用几何启发式（单段 > 400px 判拖拽）；更可靠需要 UIA 判断光标下对象，成本高。

---

## 4. 匹配优先级

```text
1. phase 匹配：普通手势 done；ExecuteOnModifier 只认 modifier
2. button 匹配：绑定 button 必须等于事件 button
3. modifier 匹配：绑定 modifier 必须等于事件 modifier
4. app scope：本应用绑定优先；inherit=true 才回落全局
5. quality：exact > fuzzy(1)
6. priority：数值大者优先
7. specificity：button+modifier 明确 > 跟随全局
8. 仍并列 → 歧义：让用户选择，或忽略并提示
```

**不要**用“列表顺序”决定优先级；这会让用户改一条无关绑定就改变结果。

---

## 5. 点/线目标的执行差异

### 5.1 PointInstance 目标

```json
{
  "kind": "point",
  "pointInstanceId": "vpn.default.status",
  "pointInstanceRevision": 1,
  "args": {}
}
```

- 直接 `runPoint`。
- 产生一个 `PointRun`。
- 适合 L0/L1：检测状态、打开 URL、通知、查询。
- UI：轻量 launch bubble；失败可展开。

### 5.2 FlowInstance 目标

```json
{
  "kind": "flow",
  "flowInstanceId": "inst.site-github",
  "flowInstanceRevision": 1,
  "args": {}
}
```

- `runFlow`。
- 产生 `FlowRun` + `slotRuns`。
- 适合 L1/L2/L3：打开外网、工作区、批量归档。
- UI：节点逐个点亮；L2/L3 启动前确认；失败定位到 slot。
- 手势绑定不能指向 `FlowClass`；必须指向 `FlowInstance`。

---

## 6. 实例目录（示例）

### 6.1 识别器实例

| 实例 | 参数 |
|---|---|
| `gesture.recognizer.right@r1` | `{button:"right", dirs8:true, minSegmentPx:30, minTotalPx:60, timeoutMs:2000, dragSuppressPx:400, dirConfirmSteps:2, fuzzy:false}` |
| `gesture.recognizer.x1@r1` | `{button:"x1", dirs8:true, ...}` |
| `gesture.recognizer.middle@r1` | `{button:"middle", dirs8:false, ...}` |

### 6.2 绑定实例

| 绑定 | pattern | button | target | 类型 | effect |
|---|---|---|---|---|---|
| `gesture.binding.github-ldr@r1` | `LDR` | right | `inst.site-github@r1` | FlowInstance | L2 |
| `gesture.binding.vpn-check-ud@r1` | `UD` | right | `vpn.default.status@r1` | PointInstance | L0 |
| `gesture.binding.workspace-rl@r1` | `RL` | right | `inst.workspace-dev@r3` | FlowInstance | L1 |
| `gesture.binding.terminal-dr@r1` | `DR` | right | `open.terminal@r1` | PointInstance | L1 |
| `gesture.binding.ensure-vpn-dlu@r1` | `DLU` | right | `inst.ensure-vpn-ask@r2` | FlowInstance | L2 |
| `gesture.binding.github-ldr-chrome@r1` | `LDR` | right | `inst.site-github@r1` | FlowInstance | L2 |

最后一个绑定 `app="chrome.exe"`，表示在 Chrome 里 `LDR` 优先；其他应用回落全局 `LDR`。

### 6.3 绑定 JSON

```json
{
  "id": "gesture.binding.github-ldr",
  "classId": "gesture.binding",
  "classVersion": "1.0.0",
  "pattern": "LDR",
  "button": "right",
  "modifier": null,
  "executeOnModifier": false,
  "app": null,
  "inherit": true,
  "target": {
    "kind": "flow",
    "flowInstanceId": "inst.site-github",
    "flowInstanceRevision": 1,
    "args": {}
  },
  "priority": 10,
  "enabled": true,
  "revision": 1
}
```

---

## 7. 可视化反馈

手势识别过程中：

- 轨迹覆盖层画方向路径；
- 方向文字（`L → D → R`）；
- 当前 pattern 预览（`LDR`）；
- 命中绑定预览：`LDR → 打开 GitHub (FlowInstance)`；
- 模糊命中标记 `fuzzy`；
- 歧义时显示候选列表，不静默取第一条；
- 抬手后：轻量 bubble / launch console。

**关键**：overlay 不只显示“识别到了 LDR”，还要显示“将启动哪个实例”。否则用户无法建立手势 → 目标的映射。

---

## 8. 迁移当前 `Binding.action_id`

当前：

```rust
Binding { action_id: "act.foo" }
```

建议：

```rust
Binding {
  action_id: "act.foo",              // 兼容旧版
  target: Some(GestureTarget::Flow {
    flow_instance_id: "act.foo",
    flow_instance_revision: 0,       // legacy
    args: json!({}),
  }),
}
```

- 新绑定写 `target`；旧绑定读 `action_id` 并映射成 legacy flow target。
- `action_id` 为空但 target 有值 → 合法。
- 保存时至少一个目标；不能两个都为空。
- 旧 Action 没有 revision 时标记 `legacy`，不参与自动升级。

---

## 9. 风险与开放问题

### 风险

1. **手势 vs 拖拽**：几何启发式会误判；需要 UIA/光标下对象增强。
2. **模糊匹配**：`edit_distance=1` 会把相似手势混在一起；默认关，命中时明确提示 `fuzzy`。
3. **多显示器/DPI**：坐标不统一会导致方向量化错误；必须物理像素 + DPI-aware。
4. **全局钩子稳定性**：Windows 静默摘钩；需要自愈 + 诊断。
5. **L2/L3 误触**：手势是低门槛输入，高风险目标必须确认。
6. **绑定冲突**：同 pattern/button/modifier/app 多目标；需要 priority + 歧义处理。
7. **应用 scope**：前台 exe 路径大小写/路径格式要统一；`inherit` 要明确。

### 开放问题

- 手势绑定应该属于触发层还是面层？建议：绑定属于触发层；面层只负责编辑/预览/选择。
- 一个手势是否允许多目标（宏）？P0 单目标；P1 可加 `targets[]` 顺序执行。
- 手势是否支持“按住修饰键执行不同目标”？当前 `modifier` 已有，可扩展为 modifier-specific binding。
- 触摸板/触屏/笔手势是否复用同一 `gesture.recognizer` 类？建议同一抽象，不同 `source` PointInstance。
- 是否允许用户录制手势？P2；先用预定义方向序列。

---

## 10. 优先级

### P0

- `gesture.recognizer.right` + `gesture.recognizer.x1`
- `GestureBinding` 支持 point / flow 两种 target + revision
- 精确匹配、button/app scope
- 轨迹 overlay + 命中目标预览
- L0/L1 直接启动；L2/L3 确认
- 3 条示例：LDR→GitHub flow、UD→VPN status point、RL→workspace flow

### P1

- fuzzy 开关 + `fuzzy` 标记
- priority + 歧义候选
- modifier / executeOnModifier
- 每应用 profile / inherit
- 绑定编辑器（手势录制 + target picker）
- 运行历史关联 gesture binding id

### P2

- 触摸板/触屏/笔手势
- 自定义手势模板
- 多目标/宏
- 手势市场
- 学习用户手势（AI 建议，运行时校验）

---

## 11. 一句话总结

**手势识别实例 = 一个按鼠标键路由的 Recognizer；手势绑定实例 = `pattern + button + modifier + appScope → PointInstanceRef / FlowInstanceRef`。**

识别器只回答“画了什么”；绑定层回答“这次画的东西要启动哪个点/线实例”；执行层回答“PointRun 还是 FlowRun”。三者不要混在一起。
