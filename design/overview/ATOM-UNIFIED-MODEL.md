# Atom 点层 / 线层功能类与实例统一模型（v0.1）

> 目标：把点层与线层的“类 / 实例”统一到同一套组合模型里。
>
> 核心句：**线层的类与实例，都是对点层实例的组合。**
>
> 更精确地说：**FlowClass 是“点实例槽位 + 默认点实例”的组合蓝图；FlowInstance 是“槽位绑定到具体点实例”的组合结果。**

---

## 0. 结论

统一后只有四个核心对象：

| 对象 | 角色 | 一句话 |
|---|---|---|
| **PointClass** | 叶子类型 | 一种原子能力契约 |
| **PointInstance** | 叶子值 | 点类 + 参数 + revision，可直接执行 |
| **FlowClass** | 组合类型 | 点实例槽位 + 默认绑定 + 门 + 类型化边 + 版本 |
| **FlowInstance** | 组合值 | 把每个槽位绑定到具体 PointInstance 的一段可执行组合 |

再加两个运行对象：

| 对象 | 角色 |
|---|---|
| **FlowRun** | 一次 FlowInstance 的运行记录 |
| **PointRun** | 一次 PointInstance 的运行记录 |

统一公式：

```text
PointInstance  = PointClass + params + revision
FlowClass      = compose(slots -> PointInstanceSlot(default?), gates, edges) + version
FlowInstance   = FlowClass.bind(slots -> PointInstanceRef, args) + revision
FlowRun        = execute(FlowInstance) = compose(slotRuns -> PointRun)
```

**点层提供“能做什么”，线层提供“把哪些点实例按什么关系组合起来解决问题”。**

---

## 1. 关键修正：线层节点不再直接指向 PointClass

旧模型容易写成：

```text
FlowClass node -> PointClass
FlowInstance node -> PointInstance
```

这会把“类”和“实例”拆成两套不连续的东西，线层类看起来像“点类图”，不像“点实例的组合”。

统一模型改成：

```text
FlowClass node -> PointInstanceSlot
PointInstanceSlot:
  - accepts: PointClass        // 这个槽位接受哪类点能力
  - default: PointInstanceRef? // 默认用哪个点实例
FlowInstance node -> PointInstanceRef
```

这样：

- **FlowClass** 是“点实例槽位”的组合；槽位自带类型约束和可选默认点实例。
- **FlowInstance** 是“具体点实例”的组合；每个槽位都绑定到一个 PointInstance revision。
- PointClass 只作为槽位的类型约束存在，不是线层节点的直接实现。

这就是“线层的类与实例是对点层的实例的组合”的严格落地。

---

## 2. 统一对象模型

### 2.1 公共引用 `AtomRef`

点层/线层都用同一个引用形状：

```ts
type AtomRef =
  | {
      kind: "point";
      pointClassId: string;
      pointClassVersion: string;
      pointInstanceId: string;
      pointInstanceRevision: number;
    }
  | {
      kind: "flow";
      flowClassId: string;
      flowClassVersion: string;
      flowInstanceId: string;
      flowInstanceRevision: number;
    };
```

- 点实例引用必须带 `pointInstanceRevision`。
- 子流程引用必须带 `flowInstanceRevision`。
- 不允许只写 id 不带版本；否则运行会漂移。

### 2.2 `PointInstanceSlot`

```ts
type PointInstanceSlot = {
  slotId: string;                 // capture / ocr / translate / overlay
  accepts: string;                // 接受的 PointClass id
  default?: AtomRef;              // 默认点实例（可选）
  required: boolean;              // 实例化时是否必须绑定
  inputPorts: PortSpec[];         // 槽位输入
  outputPorts: PortSpec[];        // 槽位输出
  paramMapping?: MappingExpr;     // flow args -> point params
};
```

槽位是**角色**，不是实例。比如 `slot.ocr` 表示“这里需要一个 OCR 能力”，默认可以填 `ocr.zh.screen@r3`，也可以被实例换成 `ocr.en.screen@r2`。

### 2.3 `FlowClass`

```ts
type FlowClass = {
  kind: "flow";
  id: string;                     // flow.screenshot-translate
  version: string;                // semver，发布后不可变
  name: string;
  description: string;
  family: string;

  params: ParamSpec[];            // 线层自己的输入
  outputs: ParamSpec[];           // 线层自己的输出

  slots: PointInstanceSlot[];     // 组合的“点实例槽位”
  gates: GateNode[];              // if / foreach / parallel / ...
  edges: FlowEdge[];              // 类型化数据流

  permissions: Permission[];      // 所有槽位/门聚合
  effect: EffectLevel;            // 取最大
  limits: FlowLimits;
  tests: FlowTest[];
};
```

**FlowClass 的节点不是 PointClass，而是槽位。** 槽位可以带默认点实例；没有默认值的槽位是抽象槽位，必须由 FlowInstance 绑定。

### 2.4 `FlowInstance`

```ts
type FlowInstance = {
  kind: "flow";
  id: string;                     // inst.screenshot-translate-en-zh
  flowClassId: string;
  flowClassVersion: string;

  name: string;
  args: Record<string, Value>;    // 线层参数值

  bindings: Record<string, AtomRef>; // slotId -> 具体 PointInstanceRef
  revision: number;

  status: "draft" | "active" | "archived";
  triggers: TriggerBinding[];     // 热键/定时/面板/体入口
  loadPolicy: "on-demand" | "preload" | "pinned";
};
```

`bindings` 是核心：**FlowInstance 的组合，就是把每个槽位绑定到一个具体的 PointInstance。**

如果某个槽位需要不同参数：

- 不是在这个 FlowInstance 里“内联改点参数”；
- 而是先创建一个新的 PointInstance，再把它绑定到槽位。

这样点层和线层的边界不会糊。

### 2.5 `FlowRun` / `PointRun`

```ts
type FlowRun = {
  id: string;
  flowInstanceId: string;
  flowInstanceRevision: number;
  slotRuns: Array<{
    slotId: string;
    atomRef: AtomRef;             // 本次实际使用的点实例
    pointRunId: string;
    status: "ok" | "failed" | "skipped";
    elapsedMs: number;
  }>;
  status: "ok" | "failed" | "canceled";
};

type PointRun = {
  id: string;
  pointInstanceId: string;
  pointInstanceRevision: number;
  inputsHash: string;
  outputs: Value;
  status: string;
  elapsedMs: number;
};
```

运行记录把“组合关系”再固定一次，保证回放不会因为点实例升级而漂移。

---

## 3. 组合代数

把线层看成一种组合表达式：

```text
PointInstance        ::= p
FlowInstance         ::= compose(slot_1 -> p_1, ..., slot_n -> p_n, gates)
FlowClass            ::= compose(slot_1 -> Slot(pc_1, default_1?), ..., gate)
FlowClass.bind(B)    ::= FlowInstance
```

其中：

- `p` 是叶子（PointInstance）。
- `compose` 是组合子（顺序、分支、循环、并行、审批……）。
- `Slot(pc, default?)` 是带类型约束的占位符。
- `bind(B)` 把每个槽位替换为具体点实例。

**线层类 = 组合模式；线层实例 = 组合结果。**

这和编程语言里的“函数类型 / 函数调用”很像：

```text
FlowClass   ≈ 函数签名 + 函数体模板（含默认实现）
FlowInstance≈ 一次具体调用（参数 + 依赖注入的具体实现）
```

但线层比普通函数多了：

- 外部副作用（点层负责）；
- 门（条件/循环/并发/审批）；
- 运行时绑定（点实例 revision）；
- 可回放 trace。

---

## 4. 用点实例组合解决问题

### 4.1 解题流程

面对一个问题：

1. **拆子问题**：把问题拆成若干可独立描述的子问题。
2. **定槽位**：每个子问题对应一个 `PointInstanceSlot`，声明它接受哪类 PointClass。
3. **选点实例**：为每个槽位选择默认/实际 PointInstance。
4. **连边**：把点实例的输入输出按类型连起来。
5. **加门**：需要条件、循环、并发、审批的地方加 Gate。
6. **存为类或实例**：
   - 想复用组合模式 → 存 FlowClass；
   - 想执行具体组合 → 存 FlowInstance。

### 4.2 例子：截图翻译

**问题**：把屏幕上的英文翻译成中文并浮层显示。

**拆子问题**：

- 取屏幕图像；
- 识别英文文字；
- 翻译成中文；
- 浮层显示。

**槽位**：

```text
slot.capture    accepts screen.capture   default cap.region@r2
slot.ocr        accepts ocr.read         default ocr.zh.screen@r3
slot.translate  accepts translate.text   default trans.en2zh@r1
slot.overlay    accepts render.overlay   default overlay.toast@r2
```

**FlowClass**：把四个槽位按 `capture → ocr → translate → overlay` 连起来。

**FlowInstance A（英→中）**：

```text
capture   -> cap.region@r2
ocr       -> ocr.en.screen@r2
translate -> trans.en2zh@r1
overlay   -> overlay.toast@r2
```

**FlowInstance B（日→中）**：

```text
capture   -> cap.region@r2
ocr       -> ocr.ja.screen@r1
translate -> trans.ja2zh@r2
overlay   -> overlay.toast@r2
```

同一个 FlowClass，不同槽位绑定 = 不同 FlowInstance。**组合模式相同，组合结果不同。**

### 4.3 例子：发票归档

**槽位**：

```text
slot.watch     accepts file.watch        default watch.inbox@r1
slot.ocr       accepts ocr.read          default ocr.zh.invoice@r4
slot.extract   accepts extract.invoice   default extract.vendor@r2
slot.validate  accepts validate.invoice  default validate.amount@r1
slot.move      accepts file.move         default move.archive@r2
slot.notify    accepts notify.tray       default notify.unmatched@r1
```

**门**：

- `foreach(file in files)` 包住 OCR → 提取 → 校验；
- `if(ok)` 分支到 move / notify。

**FlowInstance 公司发票**：

```text
ocr      -> ocr.zh.invoice@r4
extract  -> extract.vendor@r2
validate -> validate.amount@r1
move     -> move.archive@r2
```

**FlowInstance 个人发票**：

```text
ocr      -> ocr.en.invoice@r2
extract  -> extract.personal@r1
validate -> validate.personal@r1
move     -> move.personal@r1
```

图相同，槽位绑定不同；如果图也要不同，才是新的 FlowClass 版本。

### 4.4 例子：窗口工作区

**问题**：一键进入“写代码工作区”。

**槽位**：

```text
slot.open_editor   accepts sys.open / app.launch   default open.vscode@r2
slot.open_terminal accepts sys.open / app.launch   default open.terminal@r1
slot.layout        accepts window.layout            default layout.dual-screen@r3
slot.focus         accepts window.focus             default focus.editor@r2
```

**FlowInstance 写代码**：

- 打开 VS Code；
- 打开终端；
- 双屏布局；
- 聚焦编辑器。

**FlowInstance 会议**：

- 打开会议软件；
- 打开笔记；
- 单屏布局；
- 聚焦会议窗口。

同一个组合模式，不同点实例。

---

## 5. 统一后的规则

### 5.1 线层类

1. FlowClass 的每个节点必须是 `PointInstanceSlot`、`Gate` 或 `SubflowSlot`。
2. 槽位必须声明 `accepts`（PointClass 约束）。
3. 槽位可以有默认 PointInstance，也可以没有；没有默认值的槽位是抽象的，必须由实例绑定。
4. FlowClass 不能内联点实现逻辑；点逻辑只在 PointClass/PointInstance。
5. FlowClass 的权限/副作用由槽位和门聚合，不能少报。
6. FlowClass 发布后不可变；改槽位/边/门/参数 → 新版本。

### 5.2 线层实例

1. FlowInstance 必须绑定所有 `required` 槽位。
2. 绑定的值必须是 `PointInstanceRef`（带 revision），不能只写 PointClass。
3. FlowInstance 不能改图结构；要改图 → DerivedFlowDraft → 新 FlowClass 版本。
4. FlowInstance 不能内联覆盖点参数；要不同参数 → 新建 PointInstance。
5. FlowInstance 的 `revision` 每次保存 +1；旧 revision 保留。
6. 绑定 Trigger/Body 时锁 `flowInstanceRevision`。

### 5.3 点层

1. PointClass 是叶子，不包含 FlowNode。
2. PointInstance 是叶子值，带参数 + revision。
3. PointInstance 可以被多个 FlowClass/FlowInstance 引用；改 PointInstance 产生新 revision，不自动影响旧 FlowInstance。
4. 点实例的权限/副作用由点类决定，不能被线层降低。

### 5.4 门

1. 门是组合子，不是 PointInstance，也不是槽位。
2. `if/switch/foreach/parallel/join/retry/timeout/fallback/approval` 由线层引擎执行。
3. 门可以有参数，但没有 PointClass/PointInstance。
4. 门不产生 PointRun；它产生 FlowRun 的控制流 trace。

### 5.5 子流程

1. `SubflowSlot` 是槽位的一种，`accepts` 是 FlowClass/FlowInstance。
2. FlowInstance 绑定子流程时，必须锁 `flowInstanceRevision`。
3. 子流程的权限/副作用递归聚合。
4. 子流程不能形成环；保存时做环检测。

---

## 6. 与旧模型的变化

| 旧模型 | 统一模型 |
|---|---|
| FlowClass 节点直接指向 PointClass | FlowClass 节点指向 PointInstanceSlot；PointClass 只是槽位约束 |
| FlowInstance 节点 pin PointInstance | FlowInstance 节点绑定 `AtomRef`（PointInstanceRef / FlowInstanceRef） |
| 参数覆盖写在 FlowInstance | 不同参数 → 新建 PointInstance，再绑定 |
| 线层类看起来像“点类图” | 线层类看起来像“点实例槽位图” |
| FlowClass 和 FlowInstance 两套 ID | 统一 `AtomRef` + `kind` |
| 运行记录只记 FlowRun | FlowRun + PointRun 双层记录 |

**最重要的变化**：线层类不再“抽象地指向点类”，而是“显式组合点实例槽位，并带默认点实例”。这样类本身就是对点实例的组合，实例只是把槽位替换为具体点实例。

---

## 7. UI / 可视化

### 7.1 三个缩放层级

```text
FlowInstance（组合结果）
  → Slot（角色）
    → PointInstance（叶子值）
      → PointClass（叶子类型）
```

用户可以逐层下钻：

- 看 FlowInstance：每个槽位绑了哪个点实例；
- 看 Slot：这个角色接受什么点类、有没有默认值；
- 看 PointInstance：参数、revision、资源；
- 看 PointClass：契约、权限、副作用。

### 7.2 图编辑器

- 左侧面板不是“点类列表”，而是“点实例列表”（可按点类过滤）。
- 拖入一个点实例 → 自动创建一个 Slot，并设它为 default。
- 槽位节点显示：`slot.ocr` + `default: ocr.zh.screen@r3`。
- 实例视图显示：`slot.ocr → ocr.en.screen@r2`。
- 切换“类视图 / 实例视图”时，只换绑定标签，不换图形状。

### 7.3 代码视图

伪代码行右侧显示组合解析：

```text
text = ocr.read(shot, lang = sourceLang)
       slot.ocr -> ocr.en.screen@r2
       accepts: ocr.read
```

类视图显示默认绑定；实例视图显示实际绑定；diff 高亮槽位替换。

### 7.4 Inspector

- 默认：FlowInstance 的槽位绑定表。
- 点槽位：`slot.ocr` → accepted class → default/bound point instance。
- 点实例：参数、revision、point class、资源。
- 运行：FlowRun → slotRuns → PointRun。

---

## 8. 版本与引用

统一引用：

```text
FlowInstance
  ├── flowClassVersion
  └── bindings: slotId -> AtomRef
        ├── pointInstanceId + revision
        └── (subflow) flowInstanceId + revision
```

- FlowClass 版本：图/槽位/门/参数变了 → 新版本。
- FlowInstance revision：绑定/args 变了 → 新 revision。
- PointInstance revision：参数变了 → 新 revision。
- 旧 FlowInstance 不自动跟随新 PointInstance；升级是显式动作。
- 删除/归档前查引用：FlowInstance、Trigger、Body、Subflow。

---

## 9. 反模式

1. **FlowClass 节点直接写 PointClass**：线层类又变成“点类图”，不是点实例组合。
2. **FlowInstance 内联改点参数**：点实例边界消失，无法复用/审计。
3. **FlowInstance 改图**：实例漂移，旧运行无法回放。
4. **槽位没有类型约束**：任何点都能塞，组合不可校验。
5. **门当点实例**：绕过线层 trace/取消/权限。
6. **一个业务场景一个 FlowClass**：应该用槽位绑定/参数区分实例。
7. **不锁 revision**：点实例升级悄悄改变旧 FlowInstance。
8. **没有 PointRun**：失败时只知道 FlowRun 失败，不知道哪个点实例失败。
9. **槽位默认值过多**：类失去复用性；默认值应只覆盖最常见组合。
10. **没有引用表**：删除/归档时不知道谁在用。

---

## 10. 最小实现

### P0

- `PointClass / PointInstance` 已有。
- `FlowClass`：`slots: PointInstanceSlot[]` + `gates` + `edges`。
- `FlowInstance`：`bindings: slotId -> PointInstanceRef` + `args` + `revision`。
- `FlowRun`：`slotRuns` + `PointRun`。
- 图编辑器：点实例面板 + 槽位节点 + 类/实例视图。
- 3 个组合：截图翻译、剪贴板存文件、窗口工作区。

### P1

- 子流程槽位 + revision 锁 + 环检测。
- `switch/timeout/fallback/approval` 门。
- 槽位兼容性校验（PointClass 接口）。
- 版本 diff / 影响分析 / 批量升级。
- 资源画像聚合。

### P2

- `parallel/join`、`cache/rate_limit`。
- 组合市场：FlowClass + 默认点实例包。
- AI 生成组合（AI 提议槽位绑定，运行时校验，用户批准）。

---

## 11. 最后一句话

统一后的 Atom 模型可以写成一句很短的公式：

```text
PointInstance 是叶子；
FlowClass 是“叶子槽位 + 默认叶子”的组合模式；
FlowInstance 是“叶子槽位 → 具体叶子”的组合结果；
FlowRun 是“组合结果 → 叶子运行”的执行记录。
```

线层不是“另一套功能类”，而是**点实例的组合层**。线层类/实例的设计，重点不是“节点能做什么”，而是**节点由哪个点实例承担、这些点实例如何通过类型化边和门组合起来解决一个问题**。
