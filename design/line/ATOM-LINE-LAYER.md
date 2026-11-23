# Atom 线层功能类与实例设计（v0.1）

> 定位：不依赖当前项目实现，只讨论 Atom 的点/线/面/体/场模型中，**线层**如何定义“功能类”和“实例”。
>
> 一句话：**线层功能类是可复用的类型化数据流契约；线层实例是绑定参数、锁定版本、可执行的那一份配置。**
>
> 核心原则：**类管形状，实例管参数；形状变了就是新类或新版本，不是新实例。**

---

## 0. 结论

线层不要做成“动作库”，也不要做成“脚本文件集合”。建议采用：

- **FlowClass（线层功能类）**：一张可复用的数据流图，带类型化输入/输出、参数、节点、边、权限、副作用、版本、测试。
- **FlowInstance（线层实例）**：绑定某个 FlowClass 版本 + 参数 + 点实例 revision + 触发器/绑定，可执行、可回放、可审计。
- **FlowRun（运行实例）**：一次执行记录，锁定 FlowClass 版本、FlowInstance revision、PointInstance revision。
- **Gate（门）**：线层节点类型，不是点类；`if/switch/foreach/parallel/join/retry/timeout/fallback/approval` 都属于线层语言。
- **Trigger/Binding（触发/绑定）**：热键、定时器、文件监听、面板槽位，属于触发层/面层，不写进 FlowClass。

这样线层才有三个可复用的东西：**模板可复用、参数可复用、点实例可复用**。

---

## 1. 四个对象，不要混

| 对象 | 回答的问题 | 例子 | 是否可执行 |
|---|---|---|---|
| **PointClass** | 一个原子能力做什么 | `ocr.read`、`file.write`、`window.focus` | 否，实例化后执行 |
| **PointInstance** | 这个原子用哪组参数 | `ocr.read(lang=zh)`、`file.write(path=out.txt)` | 是，单点执行 |
| **FlowClass** | 多个点/门如何组成一条可复用线 | `flow.screenshot-translate` | 否，实例化后执行 |
| **FlowInstance** | 这条线用哪组参数、绑哪个触发 | `截图翻译（英→中）` | 是 |
| **FlowRun** | 这一次执行发生了什么 | 2026-11-23 10:32 的那次运行 | 记录 |

线层功能类不是“一个业务场景一个类”。业务场景是**实例**；只有当数据流形状/节点组成不同，才需要新类或新版本。

---

## 2. 线层功能类的家族

线层类可以按“数据流形状”分家族，而不是按行业分。行业场景是实例。

| 家族 | 典型形状 | 典型参数 | 实例例子 |
|---|---|---|---|
| **采集 → 转换 → 输出** | capture → OCR/LLM → render → save | 源、语言、输出格式 | 截图翻译；图片转文字；录音转纪要 |
| **输入 → 处理 → 保存** | clipboard/selection → regex/template → file | 输入源、模板、目标路径 | 剪贴板存文件；选中文字归档 |
| **窗口/工作区编排** | open apps → layout → focus → notify | 应用列表、布局、显示器 | 写代码工作区；会议工作区 |
| **批量/文件处理** | list → filter → foreach → archive/report | 目录、规则、并发、目标 | 发票归档；日志清理；批量重命名 |
| **网络/API** | request → parse → validate → write/notify | URL、方法、字段映射 | 拉取订单；Webhook 通知；健康检查 |
| **人机协同** | form/approval → apply → notify | 表单 schema、审批人、超时 | 发布确认；高危操作审批 |
| **定时/维护** | schedule → check → cleanup → report | 周期、阈值、保留策略 | 每日清理；磁盘巡检 |
| **监控/告警** | watch → condition → notify → action | 监听源、条件、通知渠道 | 文件变更告警；服务宕机重启 |
| **AI 辅助** | context → LLM → validate → apply | 模型、提示词、校验规则 | 选中文字改写；邮件草稿 |
| **系统设置** | get → set → readback → notify | 目标、值、回读策略 | 音量/亮度/主题批量设置 |

**判断标准**：如果两个场景只是参数不同，归同一个 FlowClass；如果节点/边/门的结构不同，才拆新类。

---

## 3. FlowClass 契约

```ts
type FlowClass = {
  id: string;                 // flow.screenshot-translate
  version: string;            // semver，发布后不可变
  name: string;
  description: string;
  family: string;             // capture-transform / orchestration / batch...
  params: ParamSpec[];        // 类型化输入（JSON Schema + UI 元数据）
  outputs: ParamSpec[];       // 类型化输出
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: VarDef[];
  permissions: Permission[];  // 节点聚合后的最小权限集
  effect: EffectLevel;        // L0–L3，取节点最大值
  resource: ResourceProfile;  // 聚合内存/磁盘/GPU/模型/依赖
  limits: FlowLimits;        // timeout、maxNodes、maxParallel、maxLoop
  tests: FlowTest[];         // 固定输入/模拟点/期望输出
  ui: FlowUiMeta;            // 图标、分组、说明、示例
};
```

### 3.1 参数和输出

- `params` 复用点层的 `ParamSpec`：`text/number/bool/enum/file/folder/json/any`，带 `required/default/options`。
- `outputs` 也要类型化；不要只返回“一个 JSON 大对象”。
- 参数可以有 `secret: true`（凭据/Token），UI 不明文显示。
- 参数可以有 `runtime: true`（运行时变量），但 FlowClass 的默认值必须是可静态校验的。

### 3.2 节点

```ts
type FlowNode =
  | PointNode
  | GateNode
  | SubflowNode;

type PointNode = {
  kind: "point";
  id: string;
  pointClassId: string;
  pointInstanceId?: string;   // 可选：引用已命名的点实例
  pointInstanceRevision?: number;
  inputs: Record<string, ValueExpr>;  // 端口/参数映射
  outputs?: Record<string, string>;
  retry?: RetryPolicy;
  timeoutMs?: number;
};

type GateNode = {
  kind: "gate";
  id: string;
  gate: "if" | "switch" | "foreach" | "parallel" | "join"
      | "retry" | "timeout" | "fallback" | "approval"
      | "cache" | "rate_limit";
  params: Record<string, Value>;
};

type SubflowNode = {
  kind: "subflow";
  id: string;
  flowClassId: string;
  flowClassVersion: string;  // 必须锁版本
  args: Record<string, ValueExpr>;
};
```

**规则**：

- 点节点只放点类/点实例；门节点只放门语义；不要把 `if` 做成点类。
- 子流程必须锁版本，否则父流程会被子流程升级悄悄改变。
- 节点 id 稳定；实例/运行记录用它做引用。
- 每个节点最多一个主输出端口；错误走 `error` 端口，不混在正常输出里。

### 3.3 边和端口

```ts
type FlowEdge = {
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
  type: string;               // 必须与两端端口类型兼容
  mapping?: MappingExpr;      // 可选：字段映射/重命名
  optional?: boolean;
};
```

- 端口有 `name/type/schema/required`；边必须类型兼容。
- 扇出允许；扇入必须经过 `join`/`merge` 门，不能隐式覆盖。
- 环只允许通过显式 `loop` 门；普通图必须是 DAG。
- 错误边：`from.port = "error"` 指向 `fallback`/`notify`/`approval`。

### 3.4 变量

- 局部变量显式声明：`name/type/initial/scope`。
- 不允许“某个节点偷偷写全局变量”。
- 变量作用域：flow / loop / branch；跨节点只能通过端口或显式变量。
- 运行记录要能快照变量，便于回放。

### 3.5 权限与副作用

- FlowClass 的权限 = 所有节点权限并集，只能“至少”，不能少报。
- FlowClass 的 effect = 所有节点 effect 的最大值；L2/L3 节点必须显式确认/审批。
- 子流程权限递归聚合；不能通过子流程绕过父流程权限。
- 运行前做权限校验；运行中不弹“临时授权”。

### 3.6 测试

每个 FlowClass 至少四类测试：

1. 正常路径：固定输入 → 期望输出。
2. 边界：空值/超大/缺字段/枚举外。
3. 失败路径：每个错误端口至少一次。
4. 契约：参数/输出/权限/版本与图一致。

测试用 mock point 替换外部副作用；没有 mock 的 FlowClass 不允许发布到市场。

---

## 4. FlowInstance 契约

```ts
type FlowInstance = {
  id: string;                 // inst.screenshot-translate-en-zh
  flowClassId: string;
  flowClassVersion: string;   // 锁定
  name: string;
  args: Record<string, Value>; // 参数值
  nodePins: Record<string, {   // 每个点节点的版本锁
    pointClassId: string;
    pointClassVersion: string;
    pointInstanceId?: string;
    pointInstanceRevision?: number;
  }>;
  revision: number;           // 每次保存 +1
  status: "draft" | "active" | "archived";
  tags: string[];
  bindings: BindingRef[];     // 热键/定时/面板槽位/体
  loadPolicy: "on-demand" | "preload" | "pinned";
  createdAt: number;
  updatedAt: number;
};
```

### 4.1 实例只做四件事

1. **绑参数**：`args` 填 FlowClass 的 `params`。
2. **锁版本**：FlowClass 版本 + 每个点实例 revision。
3. **绑触发**：热键/定时器/面板/文件监听/体入口。
4. **管策略**：启用/归档、按需加载/预加载/常驻、标签。

实例**不能**增删节点、改边、改门类型。那属于类编辑。

### 4.2 实例编辑的两种模式

- **参数模式（默认）**：只改 `args`，生成新 `revision`；图不变。
- **派生模式**：用户在图编辑器里改了结构 → 生成一个 **DerivedFlowDraft**，不再属于原实例；可以：
  - 保存为新的 FlowClassVersion（推荐）；
  - 或保存为独立 FlowClass；
  - 不允许“悄悄改图但还叫原实例”。

这条规则是防止“实例漂移”的关键。

### 4.3 实例的版本锁定

- `FlowInstance.flowClassVersion` 锁定类版本。
- `nodePins` 锁定每个点类/点实例 revision。
- 运行记录 `FlowRun` 再锁定一次，保证回放不漂移。
- 升级是显式动作：预览 diff → 选择版本 → 生成新实例 revision；不自动跟随最新。

---

## 5. 触发、绑定、体：不要塞进 FlowClass

| 对象 | 归属 | 例子 |
|---|---|---|
| Trigger | 触发层 | 热键 `Ctrl+Alt+T`、文件监听、定时器 |
| Binding | 面层 | 面板第 3 个槽位、右键菜单、托盘 |
| Body | 体层 | “截图翻译”安装包，含 UI、权限、FlowInstance、资产 |
| FlowClass | 线层 | 截图 → OCR → 翻译 → 浮层 |
| FlowInstance | 线层 | 英→中、日→中、快捷键版本 |

一个 Body 可以包含多个 FlowInstance；一个 FlowInstance 可以被多个 Trigger/Binding 引用。不要把热键写进 FlowClass 的参数里，否则同一个类无法复用在不同触发上。

---

## 6. 执行语义

### 6.1 运行前

1. 解析 `FlowInstance` → `FlowClass` 版本 + `nodePins`。
2. 校验参数/输出/边类型/权限/effect/环/子流程版本。
3. 聚合资源画像；按 `loadPolicy` 加载所需点包。
4. 高危 effect 走审批/确认门。
5. 生成 `FlowRun` 草稿，记录所有版本。

### 6.2 运行中

- DAG 调度；`parallel/join` 才并发；默认顺序。
- 每个点节点执行一个 `PointInstance`；外部副作用由点层负责。
- 门节点由线层引擎执行：条件、循环、重试、超时、fallback、审批。
- 取消/超时在节点边界检查；单个点调用内部不可中断是已知边界。
- 运行 trace 记录节点 id、点类/实例版本、输入哈希、输出摘要、耗时、错误码。
- 大对象走 blob store，不塞进 JSON 变量。

### 6.3 运行后

- 输出按 `outputs` schema 校验。
- 写 `FlowRun`：成功/失败、耗时、资源峰值、节点 trace、变量快照（可脱敏）。
- 失败可回放：同一组版本 + 输入 + mock/真实点。
- 运行历史按实例/类/版本筛选。

### 6.6 错误模型

- 点错误：`E_INPUT_INVALID` / `E_TARGET_NOT_FOUND` / `E_PERMISSION_DENIED` / `E_TIMEOUT` / `E_EXTERNAL` / `E_CANCELED` / `E_INTERNAL`。
- 线错误：`E_FLOW_INVALID`（图/端口/版本）、`E_FLOW_CYCLE`、`E_FLOW_LIMIT`、`E_FLOW_APPROVAL_REQUIRED`、`E_FLOW_VERSION_CONFLICT`。
- 错误端口：节点可以声明 `error` 输出，连到 fallback/notify；没有 error 边则按实例策略 stop/continue/retry。

---

## 7. 版本、引用、影响分析

### 7.1 版本规则

- FlowClass 发布后不可变；改图/参数/权限/输出 → 新 semver。
- FlowInstance 每次保存 → 新 revision；旧 revision 保留。
- PointClass/PointInstance 版本被 FlowInstance pin 住。
- 子流程 `flowClassVersion` 必须显式；不能“跟随最新”。

### 7.2 引用关系

- FlowClass ← FlowInstance（使用）
- FlowClass ← SubflowNode（被其他类引用）
- FlowInstance ← Trigger/Binding/Body（绑定）
- PointInstance ← FlowClass/FlowInstance（节点 pin）
- FlowRun → 所有版本

删除/归档前必须查引用；有引用时只能“标记弃用”，不能硬删。

### 7.3 升级

- 升级向导：旧版本 → 新版本 diff（参数/节点/边/权限/输出）。
- 兼容性检查：必填参数新增、端口类型变化、权限增加、输出删除 → 阻断。
- 可批量升级实例；每个实例生成新 revision；可回滚。
- 灰度：按实例/绑定逐步升级，不强制全量。

---

## 8. 可选加载与资源

- FlowClass 元数据常驻；点包实现按需加载。
- FlowInstance 只存参数/pin，不占运行时资源。
- FlowClass 的资源画像 = 节点资源的最大/并行组合；重包（OCR/LLM/浏览器）单独标注。
- `on-demand`：首次运行加载；`preload`：启动后预加载；`pinned`：常驻。
- 运行结束释放点实例会话；重包/三方/原生走子进程 Host。
- 运行前检查资源预算；不足时拒绝或降级，不要静默 OOM。

---

## 9. UI 设计

### 9.1 三个主视图

- **类库**：FlowClass 列表；按 family/标签/版本；显示参数、节点数、权限、effect、资源、被多少实例使用。
- **实例库**：FlowInstance 列表；显示类/版本、参数摘要、revision、绑定、最近运行、状态。
- **运行历史**：FlowRun 列表；按类/实例/状态/触发筛选；点开看节点 trace 和变量快照。

### 9.2 类编辑器

- 画布：点节点/门节点/子流程节点；类型化端口；连线校验。
- 侧栏：参数、输出、变量、权限、资源、测试。
- 试跑：mock 点 + 固定输入；显示每节点输入/输出。
- 发布：版本号、变更说明、兼容性检查。

### 9.3 实例向导

1. 选 FlowClass 版本。
2. 填参数（由 schema 生成表单）。
3. 检查点实例 pin（可替换为本地点实例）。
4. 绑 Trigger/Binding。
5. 试跑 → 激活。

### 9.4 图编辑器不要做的东西

- 不让实例改图。
- 不让门节点伪装成点。
- 不让用户手写 JSON 作为唯一编辑方式（表单/画布优先）。
- 不在画布上显示所有权限/资源细节；渐进披露。

---

## 10. 设计取舍

### 10.1 图优先 vs 脚本优先

推荐**类型化数据流图**：可校验、可可视化、可 diff、可 AI 生成。脚本（JS/Lua）只能作为点层内部实现或高级 escape hatch，不能作为线层主模型。

### 10.2 模板实例 vs 可编辑实例

推荐**图锁定、参数可编辑**。用户要改图 → 派生草稿 → 发布新类版本。否则“实例”会变成第二套类，版本/影响分析全乱。

### 10.3 门作为节点 vs 门作为独立层

推荐**门是线层节点类型**，不是点类，也不是完全独立的层。它由线层引擎执行，享受同一套 trace/取消/超时/权限。

### 10.4 触发器在类内 vs 类外

推荐**类外**。同一个 FlowClass 可以被热键、定时器、面板、文件监听、Body 复用；触发器是绑定，不是流程形状。

### 10.5 子流程 vs 复制节点

推荐**子流程**（SubflowNode）用于真正可复用的片段；复制节点用于一次性分支。子流程必须锁版本，避免“改子流程影响所有父流程”。

---

## 11. 反模式

1. **一个业务场景一个类**：截图翻译、截图翻译英中、截图翻译日中三个类 → 应该一个类 + 参数/实例。
2. **实例可改图**：改完图还叫原实例，旧运行无法回放。
3. **万能类**：20 个 boolean 控制图结构；应该拆类或用门。
4. **门当点**：`if`、`retry` 做成点模块，绕过线层 trace/取消。
5. **触发器写进类**：同一个类无法换热键/定时器。
6. **无类型边**：所有端口都是 `any`，图编辑器退化成 JSON 连线。
7. **不锁版本**：子流程/点实例自动跟随最新，旧实例悄悄变。
8. **无 mock 测试**：发布后才发现外部依赖跑不通。
9. **大对象走变量**：截图/音频塞 JSON，内存爆炸。
10. **没有引用表**：删除类/实例时不知道谁在用。

---

## 12. 最小可行设计（MVP）

### P0

- `FlowClass` / `FlowInstance` 类型。
- 类型化 `params` / `outputs`（复用 ParamSpec）。
- 点节点 + `if` + `foreach` + sequence。
- FlowInstance 锁 FlowClass 版本 + 点实例 revision。
- `FlowRun` 记录版本/trace/错误。
- 类库/实例库/运行历史三视图。
- 3 个模板：`flow.screenshot-translate`、`flow.clipboard-to-file`、`flow.window-workspace`。

### P1

- `switch`、`timeout`、`fallback`、`approval`。
- 子流程节点 + 版本锁 + 环检测。
- 版本 diff / 影响分析 / 批量升级。
- 资源画像与按需加载。

### P2

- `parallel/join`、`cache`、`rate_limit`。
- 模板市场、签名、依赖。
- AI 生成 FlowClass（AI 提议、运行时校验、用户批准）。

---

## 13. 三个完整例子

### 13.1 `flow.screenshot-translate`

**FlowClass 参数**：`sourceLang`、`targetLang`、`overlay`、`hotkey?`（hotkey 不放类里，放绑定）。

**节点**：

```text
trigger?（不在这里）
screen.capture → ocr.read → translate.text → render.overlay → notify
```

**实例**：

- `inst.screenshot-translate-en-zh`：`sourceLang=en, targetLang=zh, overlay=true`
- `inst.screenshot-translate-ja-zh`：`sourceLang=ja, targetLang=zh, overlay=false`

同一个类，不同参数；图不变。

### 13.2 `flow.clipboard-to-file`

**参数**：`path`、`append`、`template?`。

**节点**：

```text
input.clipboard(read) → text.template? → file.write → notify
```

**实例**：

- `inst.clipboard-to-inbox`：`path=~/inbox.md, append=true`
- `inst.clipboard-to-daily`：`path=~/daily/2026-11-23.md, append=false`

### 13.3 `flow.invoice-archive`

**参数**：`watchDir`、`vendorRules`、`archiveDir`、`ocrLang`。

**节点**：

```text
file.watch → foreach(file) → ocr.read → extract.invoice → validate
  → if(matched) → file.move → notify
  → else → file.move(unmatched) → notify
```

**实例**：

- `inst.invoice-archive-company`：公司发票规则、中文 OCR。
- `inst.invoice-archive-personal`：个人报销规则、英文 OCR。

同一个图，不同规则/参数；如果某个实例需要完全不同的分支，才拆新类。

---

## 14. 最后一句话

线层功能类的设计难点不是“怎么画图”，而是**边界**：

- 什么该是类：**图形状 + 类型化接口 + 权限/资源/测试**。
- 什么该是实例：**参数 + 版本 pin + 绑定 + 状态**。
- 什么该是门：**控制语义**，不是点。
- 什么该是触发/面/体：**怎么被调用、怎么被看见、怎么被打包**。

把这四件事分开，线层才不会退化成“动作库”或“脚本集合”。
