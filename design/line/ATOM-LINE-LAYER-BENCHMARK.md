# 参考 ComfyUI / Dify 的 Atom 线层设计（v0.1）

> 目标：不照搬 ComfyUI 或 Dify，而是提炼它们对“节点类 / 节点实例 / 图执行 / 调试 / 版本 / 发布”的设计思路，补进 Atom 的线层模型。
>
> 结论：Atom 线层应吸收 **ComfyUI 的“节点定义与节点实例分离 + 类型化端口 + 子图 + 缓存/部分执行”**，以及 **Dify 的“变量检查器 + 单节点调试 + 运行历史 + 迭代错误策略 + 版本发布”**；但必须坚持 Atom 自己的边界：**FlowClass 是点实例槽位的组合，FlowInstance 是点实例绑定的组合，门不是点，触发器不是线。**

---

## 0. 一句话结论

ComfyUI 强在“**节点图作为可执行程序**”，Dify 强在“**工作流作为可调试、可发布的产品**”。

Atom 线层要把两者合起来：

```text
ComfyUI 的图执行 + Dify 的产品化调试/版本
        ↓
FlowClass（点实例槽位图）
        ↓ bind
FlowInstance（点实例绑定图）
        ↓ execute
FlowRun（含 PointRun / 变量快照 / 缓存 / 部分执行）
```

---

## 1. ComfyUI 值得借鉴的七个点

### 1.1 节点定义与节点实例分离

ComfyUI 的节点是“Python 类定义 + 输入/输出类型 + widgets”，画布上的节点是“该类的一个实例 + widget 值 + 连线”。

Atom 对应：

- `PointClass` ≈ ComfyUI 节点类定义；
- `PointInstance` ≈ 画布节点实例（widget 值 + revision）；
- `FlowClass` ≈ 一张节点图模板；
- `FlowInstance` ≈ 绑定具体节点实例的图。

**借鉴点**：类只定义“有哪些输入/输出/参数”，实例只存“这次用什么值”。不要把 widget 值写进类定义。

### 1.2 类型化端口 + widget 双形态

ComfyUI 的输入既可以是连线（socket），也可以是 widget；widget 可以转成 input。

Atom 对应：

```ts
type InputSpec = {
  key: string;
  type: PortType;          // Image / Text / File / Json / ...
  widget?: WidgetSpec;     // 不连线时直接填值
  required: boolean;
  default?: Value;
};
```

- `PointClass.inputs` 同时声明端口类型和可选的 widget 表单。
- `FlowClass` 的边连接到端口；未连接的端口用 widget 值/默认值。
- **不要把所有参数都做成端口**：常用参数用 widget，跨节点数据才用端口。

### 1.3 节点包 / 自定义节点 / 缺失节点提示

ComfyUI 通过 node packs 扩展节点，缺节点时画布会提示并支持安装/补齐；节点有分类、搜索、图标。

Atom 对应：

- `PointPack` / `FlowPack`：带 manifest、版本、签名、权限、资源、依赖。
- 线层画布加载 `PointClass` 目录时，按 family/category 分组；缺失 pack 的槽位显示“未安装/可下载”，而不是静默失败。
- 槽位保留 `accepts`，缺失时仍然能保存 FlowClass，但不能激活 FlowInstance。

### 1.4 子图 / Group / Reroute / Primitive

ComfyUI 有 subgraph、group、reroute、primitive 等图工具。

Atom 对应：

- **Subgraph → SubflowSlot**：FlowClass 里嵌套一个 FlowInstance，必须锁 revision。
- **Group → FlowClass.groups**：纯 UI 分组，不改变语义。
- **Reroute → 不需要核心语义**：线层边可以直接连；UI 可做视觉 reroute。
- **Primitive → `var.const` / 字面量节点**：用于常量、环境变量、密钥引用。
- **Bypass/Mute → 调试状态**：属于 FlowInstance/编辑器状态，不是 FlowClass 语义；运行记录要标记 bypassed/muted。

### 1.5 输出目标驱动的部分执行

ComfyUI 可以只执行选中的输出节点/部分图，而不是整张图。

Atom 对应：

- 编辑器支持“运行到此节点/运行选中节点/运行到输出”。
- FlowRun 记录 `targetNodeIds` 和实际执行的 `PointRun`。
- 未执行分支标记 `skipped`，不是失败。
- 对副作用节点（L2/L3）要额外确认，不能因为“部分执行”绕过权限。

### 1.6 节点输出缓存

ComfyUI 对节点输出做缓存，重复运行只算变化部分。

Atom 对应：

- `PointClass.cacheable`：只有 L0 纯计算/只读且输入确定的点类可缓存。
- 缓存 key：`pointClassVersion + pointInstanceRevision + inputsHash + envHash`。
- L1/L2/L3 默认不缓存；剪贴板、窗口、文件、网络等副作用节点必须禁用缓存。
- 缓存命中在 PointRun 里标记 `cached: true`；FlowRun 仍记录完整 trace。
- 缓存失效：点实例 revision 变化、输入变化、显式清缓存、环境变化。

### 1.7 App Mode / API 导出

ComfyUI 有 App Mode（隐藏图，只暴露表单）和 API 格式 JSON。

Atom 对应：

- **Body/App 模式**：FlowInstance + 表单输入 + 输出展示，不暴露图。
- **FlowClass DSL**：JSON/YAML 导出，带版本、依赖、权限、测试。
- **API 模式**：外部调用只传 args，不传图；返回 FlowRun 结果。
- 图模式/表单模式/API 模式共用同一个 FlowInstance，不维护三套逻辑。

---

## 2. Dify 值得借鉴的八个点

### 2.1 显式 Start / End 与变量契约

Dify 工作流有 Start 节点定义输入、End/Output 节点定义输出。

Atom 对应：

- FlowClass 的 `inputs/outputs` 就是 Start/End 契约；不需要额外的 Start 节点。
- 每个 input/output 有类型、必填、默认值、展示名。
- FlowInstance 的 args 必须满足 inputs schema。

### 2.2 变量检查器 / 变量作用域

Dify 有 Variable Inspector、环境变量、会话变量、节点输出变量。

Atom 对应：

- 变量作用域：`flow / loop / branch / env / secret`。
- FlowClass 显式声明 variables，不允许节点偷偷写全局。
- 运行 trace 记录每个节点的输入/输出变量快照（可脱敏）。
- 编辑器有 Variable Inspector，可改上游变量做下游单步测试。

### 2.3 单节点调试 / 单步运行

Dify 支持单节点运行、查看节点输出、编辑上游变量。

Atom 对应：

- PointNode 可以“只运行此槽位”，用 mock 上游输入。
- FlowRun 记录 `debug: true`、`targetNode`、`mockInputs`。
- 单节点运行不写生产历史，或单独标记 `debug`。
- 对 L2/L3 节点，单节点运行仍走确认/审批。

### 2.4 运行历史 / 节点级日志

Dify 的 Run History 有应用级和节点级输入/输出/错误/耗时。

Atom 对应：

- FlowRun + PointRun 双层；PointRun 记录 `inputsHash/outputs/status/elapsedMs/errorCode/cached`。
- 可按 FlowClass/FlowInstance/版本/状态/trigger 过滤。
- 支持回放：同版本 + 同输入 + 同 mock。
- 失败定位到 slot + PointInstance revision。

### 2.5 节点级错误策略

Dify 的 LLM/HTTP/Code/Tool 节点支持错误策略；Iteration 有 `terminated / continue-on-error / remove-abnormal-output` 等模式。

Atom 对应：

- PointSlot/FlowNode 级：`fail / default / retry / fallback / continue`。
- Gate 级：`foreach` 的 item 错误策略：`terminate / continue / drop`。
- Flow 级：`stop / continue / fallback`。
- 错误策略是 FlowClass/FlowInstance 的显式配置，不是隐式全局行为。

### 2.6 Iteration / Loop

Dify 的 Iteration 是一个子工作流，对数组每项执行，可顺序/并行；Loop 用于条件循环。

Atom 对应：

- `foreach` gate：`over`、`as`、`body`（子图/SubflowSlot）、`concurrency`、`onItemError`、`append`。
- `while` gate：`condition`、`body`、`maxIterations`、`onItemError`。
- 迭代体是子图，不是把节点复制 N 份。
- 并行模式要限制并发和取消语义；P2 再做。

### 2.7 Human Input / 人工节点

Dify 有 Human Input 节点，用于人工输入/确认。

Atom 对应：

- `approval` gate：显示表单/审批信息，等待用户/外部审批。
- 不是 PointInstance；它属于线层门。
- 审批结果作为输出端口，继续后续分支。
- 高风险 effect 可以强制插入 approval gate。

### 2.8 版本控制 / 发布 / DSL

Dify 有草稿/发布、版本控制、DSL 导出导入、Snippets、协作。

Atom 对应：

- FlowClass 草稿/发布版本；FlowInstance revision；Pack 版本锁。
- FlowClass DSL（JSON/YAML）可导出/导入；带 schemaVersion、依赖、权限、测试。
- Snippet ≈ 可复用子流程/FlowClass；不是复制粘贴。
- 发布到 Body/API/MCP 时锁 FlowInstance revision。

---

## 3. 借鉴映射表

| 设计点 | ComfyUI | Dify | Atom 线层落点 | 不照搬 |
|---|---|---|---|---|
| 节点定义/实例 | 节点类 + 画布实例 | 节点类型 + 节点配置 | PointClass / PointInstance / PointInstanceSlot | 不把 widget 值写进类 |
| 类型化端口 | socket 类型 | 变量类型 | InputSpec/OutputSpec + typed edges | 不把所有参数都端口化 |
| 子图 | subgraph | Iteration 子工作流 | SubflowSlot + FlowClass | 不内联复制子图 |
| 迭代 | batch | Iteration/Loop | foreach/while gate | 不把迭代做成独立执行器 |
| 缓存 | node output cache | 变量缓存/调试 | PointRun cache + inputsHash | 副作用节点不缓存 |
| 部分执行 | output-target partial | 单节点调试 | 运行选中/到输出 + debug trace | 不绕过权限 |
| 变量检查 | primitive/reroute | Variable Inspector | 变量作用域 + 快照 | 不允许隐式全局变量 |
| 错误策略 | ExecutionBlocker | 节点级错误策略 | 节点/迭代/流三级策略 | 不静默吞错 |
| 人工节点 | — | Human Input | approval gate | 不做成 PointInstance |
| 版本发布 | workflow JSON/API | 草稿/发布/DSL | FlowClass version + FlowInstance revision + DSL | 不维护多套逻辑 |
| App 模式 | App Mode | Web App/API/MCP | Body/App 绑定 FlowInstance | 图/表单/API 同源 |

---

## 4. 对 Atom 线层模型的增量

### 4.1 FlowClass 增加图元数据

```ts
type FlowClass = {
  // 已有
  id, version, name, family, params, outputs, slots, gates, edges,

  // 参考 ComfyUI / Dify 增加
  variables: VarDef[];
  groups: FlowGroup[];        // 纯 UI
  notes: FlowNote[];          // 纯 UI
  settings: FlowSettings;     // timeout / maxParallel / cachePolicy / errorPolicy
  ui: FlowUiMeta;             // 图标、分类、搜索关键词、示例
};
```

### 4.2 PointClass 增加可执行元数据

```ts
type PointClass = {
  // 已有
  id, version, inputs, outputs, permissions, effect,

  // 参考 ComfyUI
  category: string;
  icon?: string;
  cacheable: boolean;        // 仅 L0 纯计算/只读可为 true
  widgets: WidgetSpec[];     // 参数表单
  ports: PortSpec[];         // 可连线端口
  dynamicOutputs?: boolean;  // 类似 ComfyUI 动态输出
};
```

### 4.3 FlowRun 增加调试/缓存字段

```ts
type FlowRun = {
  targetNodeIds?: string[];
  debug?: boolean;
  cacheHits: number;
  slotRuns: Array<{
    slotId, atomRef, pointRunId,
    status: "ok" | "failed" | "skipped" | "bypassed" | "muted",
    cached: boolean,
    elapsedMs: number
  }>;
};
```

### 4.4 执行语义

- 从输出目标反推依赖，按需执行；未选中分支 skipped。
- 缓存只对 `cacheable` 点实例生效；副作用节点不复用输出。
- 单节点调试用 mock 输入，不写生产历史。
- 迭代体是子图；错误策略在 item/flow 两级配置。
- 人工审批是 gate，不是 point；审批结果作为端口。
- bypass/mute 是调试状态，运行记录必须如实标记。

---

## 5. 不要照搬的地方

### ComfyUI

- 不要把节点图变成“任意 Python 代码执行”；Atom 的图必须类型化、可校验。
- 不要把所有参数都变成 socket；widget 与 port 要分开。
- 不要给副作用节点做输出缓存；缓存是性能优化，不是语义。
- 不要依赖“重新跑整张图”来做调试；要支持单节点/部分执行。

### Dify

- 不要把每个业务场景做成固定节点类型；Atom 的点/线是通用组合。
- 不要隐藏变量 schema；Dify 的变量检查器很好，但 Atom 要显式声明变量作用域。
- 不要把 Iteration 做成独立执行引擎；它应是 `foreach` gate + 子图。
- 不要让版本控制只停留在“应用级”；Atom 要 FlowClass/FlowInstance/PointInstance 三层锁版本。

### 两者共同

- 不要图、表单、API 三套逻辑；同源 FlowInstance。
- 不要把“发布/应用”与“线层类”混在一起；Body 是体层。
- 不要让图编辑器成为唯一入口；表单/预设/AI 生成都可以创建 FlowInstance。

---

## 6. 路线建议

### P0（图能用）

- PointClass 增加 category/widgets/ports/cacheable。
- FlowClass 增加 variables/groups/notes/settings。
- FlowInstance 绑定 PointInstance revision。
- 单节点调试 + 变量检查器。
- FlowRun + PointRun + 基本缓存。
- 3 个组合原型：截图翻译、剪贴板存文件、窗口工作区。

### P1（产品化）

- 部分执行/运行到输出。
- foreach/while + item 错误策略。
- approval gate。
- 子流程 SubflowSlot + revision 锁。
- FlowClass 版本 diff/影响分析。
- DSL 导入导出。

### P2（生态）

- PointPack/FlowPack 签名、依赖、缺失节点提示。
- 并行 iteration、缓存策略、资源预算。
- App/Body 模式、API/MCP 发布。
- 组合市场与 AI 生成。

---

## 7. 参考

- ComfyUI Workflows: https://docs.comfy.org/basic-concepts/workflow
- ComfyUI Docs（子图/部分执行/节点文档入口）: https://docs.comfy.ac.cn/
- Dify Iteration: https://docs.dify.ai/en/cloud/use-dify/nodes/iteration
- Dify Run History: https://docs.dify.ai/en/self-host/use-dify/debug/history-and-logs
- Dify Handle Errors: https://docs.dify.ai/en/cloud/use-dify/build/predefined-error-handling-logic
- Dify Workflow 介绍: https://dify.ai/blog/dify-ai-workflow

> 说明：ComfyUI/Dify 的产品迭代很快，具体节点名/错误策略以官方文档当前版本为准；本文只提炼设计模式，不作为 API 契约。
