# 线层功能类与实例调研 · 分组讨论（v0.1）

> 状态：调研 + 设计评审稿，**尚未改代码**。
>
> 调研对象：`core-dsl` 的 `Action` / `Step` / `Subprogram` / `Pack`，`core-engine` 的控制流与执行预算，`shell-tauri/src/commands.rs` 的动作类型编译层，`examples/actions/*.json` 的真实动作实例，以及 `examples/scenes.json` 的场景绑定。
>
> 结论先行：**当前项目只有“线层实例（Action）”和“线层节点（Step）”，没有正式的“线层功能类（FlowTemplate）”。** 最接近线层类的是 `Subprogram` 和 `commands::CommandKind`，但前者没有类型化参数/输出，后者是硬编码的动作类型目录。线层重构应把 `FlowTemplate` 立为一等公民，`Action` 降为实例，`CommandKind` 降为模板/预设适配层。

---

## 0. 先厘清：线层到底有什么

### 0.1 五层里的线层

| 层 | 回答的问题 | 当前载体 |
|---|---|---|
| 点层 | 一个原子能力做什么 | `ModuleManifest` + `mod-*` |
| **线层** | **多个点如何按顺序/条件/循环组合** | **`Action` + `Step` + `core-engine`** |
| 门层 | 条件、循环、错误、审批等控制 | `Step.if` / `while` / `on_error` / `call` |
| 面层 | 用户在哪里触发、怎么看见 | `Scene` / 4×6 槽位 / 面板 |
| 体层 | 打包成可安装的整体 | `Pack` / `Subprogram` / `Body` |
| 场层 | AI 如何理解意图并生成线 | `core-ai` / `core-forge` |

线层不是“一个功能一个 Action”，而是**可复用的流程模板 + 具体流程实例**。当前项目把这两件事混在了 `Action` 里。

### 0.2 当前线层的真实结构

```text
Action
├── id / name / params: Vec<String>
└── steps: Vec<Step>
    ├── module step   → { id, module, inputs, output, for_each, append, on_error, enabled_if }
    ├── call step     → { id, call, inputs, output, ... }
    ├── if container  → { id, if, then: [Step], else: [Step] }
    └── while container → { id, while, do: [Step] }
```

- `Action` 是**一条具体的线**，不是类。
- `Step` 是线层节点：模块步骤是“点实例的内联形态”，`call` 是子程序调用，`if`/`while` 是控制容器。
- `Subprogram` 是可复用子程序：有 `inputs: Vec<String>`、`outputs: Vec<String>`、`permissions`、`steps`，最接近“线层类”。
- `Pack` 把 actions / subprograms / scenes 打成一个包，是体层/分发层，不是线层类。
- `Scene` 的槽位引用 `action_id`，是面层绑定；触发层（热键/手势/定时器）再触发 Action。

### 0.3 线层“类”和“实例”的五个候选

| 对象 | 现在是什么 | 应归层 | 说明 |
|---|---|---|---|
| `ModuleManifest` | 点层类 | 点层 | 不是线层类 |
| `Subprogram` | 可复用子程序 | **线层类（雏形）** | 有 inputs/outputs/permissions，但没有 ParamSpec |
| `CommandKind` | 用户动作类型 | **线层模板/预设** | 11 个硬编码动作类型，编译成 Action |
| `Action` | 具体动作 JSON | **线层实例** | 33 个示例动作 |
| `Stored { kind, params }` | 手势命令 sidecar | **线层实例（绑定侧）** | 按 action id 存，只服务手势页 |
| `RunRecord` / `RunStepRecord` | 运行历史 | **运行实例** | 不是流程定义 |

一句话：**`Action` 是实例，`Subprogram` 是最接近的类，`CommandKind` 是用户侧模板，`Step` 是节点。**

---

## 1. 现状调研：数据与使用

### 1.1 规模

| 指标 | 数值 | 来源 |
|---|---|---|
| 示例动作（Action） | 33 | `examples/actions/*.json` 顶层文件 |
| 步骤节点（Step） | 79 | 含容器与 call |
| 模块步骤 | 76 | `module` 非空 |
| 子程序调用 | 1 | `act.call-for-each-order` |
| if 容器 | 1 | `act.branch-greeting` |
| while 容器 | 1 | `act.count-to-three` |
| for_each | 2 | `act.call-for-each-order` / `act.list-action-names` |
| append | 2 | 同上 |
| on_error 示例 | 0 | 引擎支持，但示例没用 |
| enabled_if 示例 | 0 | 引擎支持，但示例没用 |
| 声明了 `params` 的动作 | 3 | `branch-greeting` / `call-for-each-order` / `sub-order-line` |
| 用户动作类型（CommandKind） | 11 | `commands::catalog()` |
| 场景（Scene） | 3 | `examples/scenes.json`：excel / browser / generic |

### 1.2 线层目前几乎是“线性管道”

33 条动作里，绝大多数是 1–3 步的直线：

- `act.pause`：1 步 `sys.pause`
- `act.web-search`：1 步 `web.search`
- `act.volume-up`：1 步 `sys.volume`
- `act.focus-notepad`：`window.activate` → `text.template`
- `act.export-clipboard`：`file.exists` → `file.write` → `text.template`
- `act.http-get`：`http.request` → `text.template`
- `act.screenshot-pipeline`：`screen.capture` → `image.info` → `image.crop` → `image.resize` → `image.convert` → `text.template`

真正用到控制流的只有：

- `act.branch-greeting`：`if notEmpty($who)` → then/else 两个模板；
- `act.count-to-three`：`while $i != 3` + `math.add`；
- `act.call-for-each-order`：`text.regex` → `for_each` 调 `act.sub-order-line` → `list.length`；
- `act.list-action-names`：`file.list` → `for_each` 模板。

**判断**：当前线层能力已经够跑通，但控制流覆盖率极低；大多数“功能”其实是“点 + 模板文案”的线性组合。

### 1.3 `CommandKind`：最接近用户理解的“线层功能类”

`commands::catalog()` 当前 11 个动作类型：

| CommandKind | 编译到 | 参数 | 用户看到的实例 |
|---|---|---|---|
| `hotkey` | `input.simulate` | `mods + key` → `key` | Ctrl+Shift+S |
| `text` | `input.simulate` | `text` | 输入一段文字 |
| `open_file` | `sys.open` | `path` → `target`，`kind=file` | 打开 `notepad.exe` |
| `open_url` | `sys.open` | `url` → `target`，`kind=url` | 打开 `example.com` |
| `web_search` | `web.search` | `engine / query` | Google 搜选中文字 |
| `window` | `window.control` | `op / target` | 当前窗口左半屏 |
| `task_switch` | `input.simulate` | 固定 `alt+tab` | 任务切换 |
| `cmd` | `sys.run` | `code / show_window` | `ipconfig` |
| `volume` | `sys.volume` | `op / steps` | 音量 +2 |
| `pause` | `sys.pause` | 无 | 暂停手势 |
| `nothing` | 零步骤 | 无 | 占位 |

**问题**：`CommandKind` 的 `FieldDef` 自己维护 `kind/options/default/required`，与 `ModuleManifest.inputs` 重复；它本质是**线层模板/预设**，不应再叫“点层动作类型”，也不应维护第二套参数 schema。

### 1.4 `Subprogram`：最接近线层类，但契约不完整

```rust
pub struct Subprogram {
    pub id: String,
    pub version: String,
    pub inputs: Vec<String>,   // 只有名字，没有类型/必填/默认值
    pub outputs: Vec<String>,  // 只有名字，没有类型
    pub steps: Vec<Step>,
    pub permissions: Vec<String>,
}
```

- 有 `version`，但 `call` 没有锁 `version`；改子程序会影响所有调用方。
- `inputs/outputs` 只是字符串列表，无法表单化、无法校验、无法 diff。
- 没有 `effect` / `timeout` / `tests` / `tags` / `description`。
- `Subprogram` 只被 `call` 使用，没有独立目录/实例/引用表。

### 1.5 控制流现状

| 能力 | 当前实现 | 限制 |
|---|---|---|
| 顺序 | `steps: Vec<Step>` | 无显式 `sequence` 节点 |
| 条件 | `if` + `then/else` | 条件语法只有 `$x`、`==`、`!=`、`empty`、`notEmpty`、`!`、`true/false` |
| 循环 | `while` + `do` | 最多 1000 次；无 `break/continue` |
| 遍历 | `for_each` + `append` | 只遍历变量数组；无索引/过滤 |
| 子程序 | `call` + `inputs` | 最大深度 8；不锁版本 |
| 错误 | `on_error: stop/continue/retry/goto` | 无 `fallback` / `finally` |
| 超时 | `Budget.timeout` | 只在步骤之间检查；单模块调用不能中断 |
| 条件启用 | `enabled_if` | 示例未使用 |
| 并发 | 无 | 无 `parallel/join` |
| 多分支 | 无 | 无 `switch` |
| 人工审批 | 无 | 无 `approval` |
| 缓存/限流 | 无 | 无 `cache/rate-limit` |

### 1.6 版本与引用现状

- `Action` 没有 `revision`；文件覆盖即新版本。
- `Subprogram` 有 `version`，但 `call` 不引用版本。
- `CommandKind` 的 `Stored` 按 action id 存 kind/params，没有独立实例 id。
- `Scene` 槽位只存 `action_id`；动作改名/删除没有引用检查。
- 运行历史 `run` / `run_step` 记录 action id、trigger、ok、耗时、错误；没有模板/实例版本。

---

## 2. 目标模型：线层功能类与实例

### 2.1 两类“线层功能类”

线层有两类“类”，不能混：

**A. 结构类（控制节点类型）**

`sequence` / `if` / `while` / `for_each` / `call` / `error` / `switch` / `parallel` / `join` / `timeout` / `fallback` / `approval` / `cache` / `rate_limit`。

这些是**语言/运行时构造**，不是业务功能。它们由引擎实现，不应出现在“业务模板市场”里。

**B. 业务模板类（FlowTemplate）**

可复用的业务线，例如：

- `tpl.focus-window`：查找/聚焦窗口 + 提示；
- `tpl.clipboard-to-file`：读剪贴板 + 写文件 + 提示；
- `tpl.screenshot-pipeline`：抓屏 + 图像处理 + 提示；
- `tpl.http-status`：HTTP 请求 + 状态提示；
- `tpl.read-json-field`：读文件 + 取 JSON 字段 + 提示；
- `tpl.count-files`：枚举目录 + 计数 + 提示；
- `tpl.batch-render`：正则提取 + for_each 调子程序 + 汇总；
- `tpl.web-search`：搜索引擎查询；
- `tpl.open-target`：打开文件/文件夹/URL。

这些才是用户/市场/forge 理解的“线层功能类”。

### 2.2 `FlowTemplate` 契约

```rust
pub struct FlowTemplate {
    pub id: String,                 // tpl.focus-window
    pub name: String,
    pub version: String,            // semver
    pub description: String,
    pub params: Vec<ParamSpec>,     // 复用点层 ParamSpec
    pub outputs: Vec<ParamSpec>,
    pub steps: Vec<Step>,
    pub permissions: Vec<Permission>, // 不能少于步骤聚合结果
    pub effect: EffectLevel,        // 由步骤聚合，不能低于实际
    pub timeout_ms: Option<u64>,
    pub tests: Vec<TemplateTest>,
    pub tags: Vec<String>,
}
```

- `params` 复用点层 `ParamSpec`，不再用 `Vec<String>`。
- `permissions/effect` 由步骤聚合；模板只能声明“至少需要什么”，不能降低。
- `steps` 内部仍可引用点实例/点类；模板不直接执行。
- `version` 语义：参数/步骤/权限变化升版本；实例锁版本。

### 2.3 `FlowInstance` / `Action`

```rust
pub struct FlowInstance {
    pub id: String,                 // act.focus-notepad
    pub template_id: Option<String>,// None = 独立内联流程
    pub template_version: Option<String>,
    pub name: String,
    pub args: Value,                // 绑定模板 params
    pub steps: Vec<Step>,           // 编译/展开后的步骤（可回放）
    pub revision: u32,
    pub status: InstanceStatus,
    pub created_at: i64,
    pub updated_at: i64,
}
```

兼容策略：

- 现有 `Action` 文件继续可读；`template_id=None` 视为“独立流程实例”。
- 新动作可以 `template_id` + `args` 创建；保存时展开 `steps` 并锁 `template_version`。
- `Action.params: Vec<String>` 逐步迁移为 `args: Value` + 模板 `ParamSpec`；旧字段保留读取。
- 实例编辑产生 `revision`；Scene/Trigger 绑定锁 `instance_revision`，避免“改一下动作，线上绑定悄悄变”。

### 2.4 子程序 `call` 升级

- `Subprogram` 升级为 `FlowTemplate`（或 `FlowTemplate` 的一种 `kind=sub`）。
- `call` 步骤增加 `template_version`；未写时默认锁当前版本并警告。
- 子程序输入用 `ParamSpec` 校验；输出用 `ParamSpec` 声明。
- 调用图做环检测（现有 `MAX_CALL_DEPTH=8` 保底），并在保存时做静态引用检查。

### 2.5 `CommandKind` 的归位

- `CommandKind` 保留为用户入口，但内部改为 **`FlowTemplate` 预设/适配器**：
  - 1:1 的（hotkey/text/open_file/open_url/window/cmd/volume/pause）→ 生成单步 `FlowTemplate`；
  - 固定参数的（task_switch）→ 生成固定 args 的模板实例；
  - 零步骤的（nothing）→ 占位模板；
  - 多步的（web_search 若未来扩展）→ 真正的 `FlowTemplate`。
- `FieldDef` 只保留“显示名/顺序/别名/固定值/组合规则”，枚举/默认值/必填从 `ParamSpec` 读取。
- `Stored { kind, params }` 迁移为 `FlowInstance` 或 `AtomPreset` 绑定，不再按 action id 存一份孤立 sidecar。

---

## 3. 结构类：门层能力清单

### 3.1 已有

| 结构类 | 载体 | 语义 | 测试/示例 |
|---|---|---|---|
| `sequence` | `steps: Vec<Step>` | 顺序执行 | 全部动作 |
| `if` | `Step.if/then/else` | 条件分支 | `act.branch-greeting` |
| `while` | `Step.while/do` | 条件循环 | `act.count-to-three` |
| `for_each` | `Step.for_each` | 遍历变量 | `act.call-for-each-order` / `list-action-names` |
| `call` | `Step.call` | 子程序 | `act.call-for-each-order` |
| `error` | `Step.on_error` | stop/continue/retry/goto | 引擎测试；示例未用 |
| `enabled_if` | `Step.enabled_if` | 条件跳过 | 引擎测试；示例未用 |
| `timeout` | `Budget.timeout` | 整线超时 | 引擎测试；步骤级缺失 |

### 3.2 建议补齐

| 结构类 | 优先级 | 语义 | 为什么需要 |
|---|---|---|---|
| `switch` | P1 | 多分支匹配 | 现在只能嵌套 if，3 个以上分支很难读 |
| `timeout`（步骤级） | P1 | 单步/子程序超时 | 现在整线预算，无法定位慢步骤 |
| `fallback` | P1 | 主路径失败走备选 | `on_error: goto` 只能跳，不是真正的 fallback |
| `approval` | P1 | 人工确认门 | L2/L3 动作需要审批；现在只能靠 UI 弹窗 |
| `parallel/join` | P2 | 并发 + 汇合 | 多窗口/多 HTTP 并发；需要调度器，不要先做 |
| `cache` | P2 | 记忆化 | 重复 HTTP/OCR 调用 |
| `rate_limit` | P2 | 限流 | 外部 API/批量操作 |
| `break/continue` | P2 | 循环控制 | while 目前只能靠条件退出 |

**建议**：P1 只做 `switch`、步骤级 `timeout`、`fallback`、`approval`；`parallel/join` 等有真实并发需求再做，否则会引入调度器/取消/背压的大坑。

---

## 4. 真实线层实例目录

### 4.1 现有 Action 的分类

| 类型 | Action 示例 | 可提升为模板 |
|---|---|---|
| 单点动作 | `act.pause` / `act.web-search` / `act.volume-up` / `act.run-echo` | 可作为模板的最简实例 |
| 点 + 提示 | `act.focus-notepad` / `act.close-calculator` / `act.tuck-away-browser` | `tpl.focus-window` / `tpl.close-window` |
| 读 + 处理 + 提示 | `act.count-actions` / `act.count-csv-rows` / `act.read-order-field` / `act.http-get` | 各自模板 |
| 多步管线 | `act.screenshot-pipeline` | `tpl.screenshot-pipeline` |
| 条件 | `act.branch-greeting` | `tpl.greeting` |
| 循环 | `act.count-to-three` | `tpl.count-to` |
| 子程序 + 遍历 | `act.call-for-each-order` + `act.sub-order-line` | `tpl.batch-render` + `tpl.order-line` |
| 场景绑定 | `examples/scenes.json` 的 excel/browser/generic | 不是模板，是面层绑定 |

### 4.2 建议的 9 个 P0 线层模板

| 模板 id | 参数 | 步骤 | 对应实例 |
|---|---|---|---|
| `tpl.focus-window` | `query`, `by` | `window.activate` → `text.template` | `act.focus-notepad` |
| `tpl.close-window` | `query`, `by` | `window.close` → `text.template` | `act.close-calculator` |
| `tpl.clipboard-to-file` | `path` | `file.exists` → `file.write` → `text.template` | `act.export-clipboard` |
| `tpl.http-status` | `url`, `method` | `http.request` → `text.template` | `act.http-get` |
| `tpl.read-json-field` | `path`, `jsonPath` | `file.read` → `json.get` → `text.template` | `act.read-order-field` |
| `tpl.count-files` | `dir`, `pattern` | `file.list` → `list.length` → `text.template` | `act.count-actions` |
| `tpl.screenshot-pipeline` | `path`, `x/y/w/h`, `out` | `screen.capture` → `image.*` → `text.template` | `act.screenshot-pipeline` |
| `tpl.batch-render` | `raw`, `pattern` | `text.regex` → `for_each call` → `list.length` | `act.call-for-each-order` |
| `tpl.greeting` | `who` | `if` → `text.template` | `act.branch-greeting` |

> 这些模板不是“新点”，而是把现有 Action 的可变部分抽成 `ParamSpec`。实现时应先迁移 3 个（focus-window、clipboard-to-file、http-status），验证等价后再批量。

---

## 5. 数据模型与接口

### 5.1 SQLite / 存储

```sql
flow_template(
  id TEXT, version TEXT, name TEXT, description TEXT,
  params_json TEXT, outputs_json TEXT, steps_json TEXT,
  permissions_json TEXT, effect TEXT, timeout_ms INTEGER,
  status TEXT, created_at INTEGER, updated_at INTEGER,
  PRIMARY KEY(id, version)
);

flow_instance(
  id TEXT PRIMARY KEY,
  template_id TEXT, template_version TEXT,
  name TEXT, args_json TEXT,
  steps_json TEXT, revision INTEGER,
  status TEXT, created_at INTEGER, updated_at INTEGER
);

flow_instance_ref(
  instance_id TEXT, scene_id TEXT, slot_index INTEGER,
  instance_revision INTEGER,
  PRIMARY KEY(instance_id, scene_id, slot_index)
);

flow_run(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  instance_revision INTEGER,
  template_id TEXT, template_version TEXT,
  trigger TEXT, started_at INTEGER, ok INTEGER,
  elapsed_ms INTEGER, error TEXT
);
```

- `flow_template` 是模板真源；`flow_instance.steps_json` 是展开快照，保证模板升级不悄悄改变旧实例。
- `Scene` 槽位引用 `instance_id` + `instance_revision`；不再只存 `action_id`。
- `flow_run` 记录实例/模板版本，方便回放和 diff。

### 5.2 接口

```text
list_flow_templates(filter?) -> Vec<FlowTemplateView>
get_flow_template(id, version?) -> FlowTemplateDetail
create_flow_template(...) -> FlowTemplateView
publish_flow_template(id) -> ()
list_flow_instances(template_id?) -> Vec<FlowInstanceView>
create_flow_instance(template_id, name, args) -> FlowInstanceView
update_flow_instance(id, args, expected_revision) -> FlowInstanceView
archive_flow_instance(id) -> ()
list_flow_refs(instance_id) -> Vec<SceneSlotRef>
run_flow_instance(id) -> RunOutcome
```

兼容：`list_actions` / `get_action` / `save_action` 保留，内部映射到 `FlowInstance`；旧 `Action` 文件没有 `template_id` 时按独立实例处理。

### 5.3 模板 JSON 示例

```json
{
  "id": "tpl.focus-window",
  "name": "聚焦窗口并提示",
  "version": "1.0.0",
  "params": [
    { "key": "query", "label": "窗口标题/进程", "type": "text", "required": true },
    { "key": "by", "label": "匹配字段", "type": "enum", "options": ["title", "process", "class"], "default": "title" }
  ],
  "outputs": [
    { "key": "title", "label": "窗口标题", "type": "text" }
  ],
  "steps": [
    { "id": "go", "module": "window.activate", "inputs": { "query": "{$query}", "by": "{$by}" }, "output": "r" },
    { "id": "say", "module": "text.template", "inputs": { "tpl": "已切到「{t}」", "vars": { "t": "{$r.window.title}" } }, "output": "msg" }
  ],
  "permissions": ["UiAutomation"],
  "effect": "L1"
}
```

### 5.4 实例 JSON 示例

```json
{
  "id": "act.focus-notepad",
  "templateId": "tpl.focus-window",
  "templateVersion": "1.0.0",
  "name": "切到记事本",
  "args": { "query": "记事本", "by": "title" },
  "revision": 4,
  "steps": [
    { "id": "go", "module": "window.activate", "inputs": { "query": "记事本", "by": "title" }, "output": "r" },
    { "id": "say", "module": "text.template", "inputs": { "tpl": "已切到「{t}」", "vars": { "t": "{$r.window.title}" } }, "output": "msg" }
  ]
}
```

---

## 6. UI 重设计

### 6.1 线层页三个 tab

- **模板**：`FlowTemplate` 目录；显示 id/name/version/params/steps/permissions/effect/被多少实例使用。
- **实例**：`FlowInstance`（Action）目录；显示模板/版本/args/revision/步骤数/绑定场景/最近运行。
- **运行**：`flow_run` 历史；按实例/模板/状态筛选；点开看 step trace。

### 6.2 模板 Inspector

- 参数表（`ParamSpec`：key/label/type/required/default/options）
- 输出表
- 步骤列表（点步骤/门步骤/子程序调用）
- 权限与副作用聚合
- 引用它的实例列表
- 版本 diff（参数/步骤/权限）

### 6.3 实例 Inspector

- 模板 + 版本 + revision
- args 表单（由模板 `ParamSpec` 生成）
- 展开后的步骤列表
- 绑定场景/槽位
- 最近运行与 trace
- 升级模板 / 回滚 revision

### 6.4 动作编辑器

- 新建时选“空白流程”或“从模板创建”。
- 从模板创建：填 args → 展开 steps → 可另存为独立实例（不再跟模板）或保持模板绑定。
- 编辑步骤时显示“点类/点实例/门”类型；不允许把门当点模块。
- 保存前做模板/实例/引用/权限校验。

### 6.5 手势页

- “动作类型”下拉改为 `FlowTemplate`/`AtomPreset` 列表。
- 参数表单由模板 `ParamSpec` 生成；`FieldDef` 只保留显示覆盖。
- 选择后生成/绑定一个 `FlowInstance`，场景槽位锁 revision。

---

## 7. 迁移路线与工时

| 阶段 | 交付 | 行为变化 | 粗估 |
|---|---|---|---|
| **L0 盘点** | 33 个 Action 分类：单点/管线/条件/循环/子程序/独立；11 个 CommandKind 标注模板/预设 | 无 | 3–5 天 |
| **L1 模板类型** | `FlowTemplate` 类型 + `ParamSpec` 参数/输出 + 只读目录 | 无（旧 Action 兼容） | 6–10 天 |
| **L2 实例绑定** | `FlowInstance` + `template_id/version/args` + SQLite/CRUD；旧 Action 映射为独立实例 | 旧动作不变 | 6–10 天 |
| **L3 子程序升级** | `Subprogram` → `FlowTemplate`；`call` 锁版本；引用/环检测 | 旧 call 兼容 | 4–6 天 |
| **L4 门补齐** | `switch` / 步骤级 `timeout` / `fallback` / `approval` | 新能力 | 8–12 天 |
| **L5 UI** | 模板/实例/运行三 tab；模板创建实例；引用/版本 diff | 新界面 | 8–12 天 |
| **L6 Pack/市场** | 模板包、签名、依赖、安装/升级 | 后续 | 10–15 天 |

MVP（L0–L3）约 **19–31 人天**；含 L4–L5 约 **35–55 人天**；含 L6 约 **45–70 人天**。

### Go/No-Go 门槛

1. 33 个 Action 100% 分类；11 个 CommandKind 100% 标注模板/预设；无孤儿。
2. `FlowTemplate` 支持 `ParamSpec` 参数/输出；至少 10 个 Action 迁移后输出与旧文件逐字节一致。
3. `call` 锁 `template_version`；递归/环检测有测试；旧 call 不破坏。
4. `switch` / `timeout` / `fallback` / `approval` 各有正/反/边界测试；没有“死门”。
5. UI 模板/实例/运行三 tab 可用；Scene 槽位锁 `instance_revision`；删除/归档有引用影响面。
6. `FlowRun` 记录模板/实例版本；可回放一次失败运行。

---

## 8. 分组讨论

### 8.1 线层建模组（架构/语言）

**主张：Template-first。**

- `FlowTemplate` 是一等公民；`Action` 只是实例。
- `Subprogram` 升级为 `FlowTemplate`，`call` 锁版本。
- `Action.params: Vec<String>` 改为 `ParamSpec`；输出也类型化。
- `CommandKind` 改为模板/预设适配器；不再维护第二套 `FieldDef`。
- 门层补齐 `switch/timeout/fallback/approval`；P2 再做 `parallel/join`。
- 模板/实例/运行三张表 + 引用表；UI 三 tab。

**优点**：模型干净；模板可复用/可版本化/可市场分发；AI/forge 可检索模板；影响分析有地基。
**风险**：`Action` 兼容成本；模板/实例双写；版本锁太死升级痛苦；门语义扩展会碰引擎主循环；容易做成大重构。

### 8.2 运行与交付组（工程/风险）

**主张：Action 兼容优先，模板渐进。**

- 不立刻改 `Action` 文件格式；先加可选 `templateId/templateVersion/args`，旧字段保留。
- 先把 `Subprogram` 升级为 `FlowTemplate`（它已经最像类），而不是从零造。
- `CommandKind` 先做适配层，不一次性删除；`Stored` 双读到 `FlowInstance`。
- 门层只做 `switch/timeout/fallback/approval`；`parallel/join` 等有真实需求再做。
- UI 先做只读模板目录 + 实例绑定；模板编辑/市场后置。
- 复用 `core-store` 的 SQLite/StateStore；不新增 crate，除非证明现有层放不下。

**优点**：2–4 周能出可见结果；不破坏 33 个 Action 和现有 UI；风险可控。
**风险**：模板目录先绑 shell；`Action.params` 类型化会拖；`CommandKind` 适配层可能长期残留；没有统一模板时市场/forge 仍弱。

### 8.3 争议与共识

| 争议 | 建模组 | 交付组 | 共识 |
|---|---|---|---|
| `Action` 是类还是实例 | 实例 | 实例，但先兼容 | **实例；`FlowTemplate` 才是类** |
| `Subprogram` 怎么办 | 升级为 FlowTemplate | 先升级它，风险最低 | **升级；`call` 锁版本** |
| `CommandKind` 怎么办 | 改为模板/预设 | 先适配，后删除 | **适配层；FieldDef 只做显示覆盖** |
| 参数怎么类型化 | 立即 ParamSpec | 先兼容 Vec<String>，逐步迁移 | **新模板必须 ParamSpec；旧 Action 兼容** |
| 门补哪些 | switch/timeout/fallback/approval/parallel | 先四个，parallel 后置 | **P1 四个；P2 parallel** |
| UI 先做什么 | 模板/实例/运行/图谱 | 模板/实例/运行三 tab | **三 tab 先上；图谱后置** |
| 是否新增 crate | 可以，模板服务独立 | 不新增，先放 core-dsl/core-store | **MVP 不新增；需要时再抽** |

### 8.4 投票

- 线层建模组：5/5 支持“Template-first”目标架构，但接受兼容迁移。
- 运行与交付组：5/5 支持“Action 兼容 + 渐进模板”，条件是 L1 后必须补类型化参数与版本锁。
- 联合结论：**Action 兼容的路径，FlowTemplate 的数据模型；先升级 Subprogram，再做 CommandKind 适配，最后补门。**

---

## 9. 风险与不做的事

**风险**

1. **把 Action 当类**：每条动作都新建模板，会退化成“动作库”，模板没有复用价值。
2. **模板/实例双写漂移**：实例展开的 steps 与模板 steps 不一致；必须明确“实例是快照，模板升级不自动改实例”。
3. **版本锁太死**：所有实例锁旧模板，安全但升级痛苦；需要“批量升级/差异预览/回滚”。
4. **门语义膨胀**：`parallel/join` 会引入调度器、取消、背压；不要在没有真实需求时做。
5. **CommandKind 双源**：`FieldDef` 继续维护枚举/默认值，必然和 `ParamSpec` 漂移。
6. **参数类型化拖延**：`Action.params: Vec<String>` 不升级，模板无法表单化/校验/市场分发。
7. **引用完整性**：Scene 槽位、Trigger、Pack 都可能引用实例；删除/归档前必须查引用。
8. **运行历史缺版本**：没有模板/实例版本，失败无法回放到具体版本。

**不做的事**

- 不把 `Action` 直接改名为 `FlowTemplate`；Action 是实例。
- 不把 `CommandKind` 当点层类；它是线层模板/预设。
- 不在 P1 做 `parallel/join`。
- 不让 `FieldDef` 维护第二套枚举/默认值。
- 不把 Scene/Trigger 塞进线层定义。
- 不在没有引用表时做“删除实例”。
- 不为了模板数量而模板化一次性动作。

---

## 10. 下一步

1. **L0 盘点**：把 33 个 Action 分成“单点 / 管线 / 条件 / 循环 / 子程序 / 独立”；把 11 个 CommandKind 标成模板/预设。
2. **L1 模板类型**：在 `core-dsl` 增加 `FlowTemplate`（复用 `ParamSpec`），先只读；把 `Subprogram` 映射成模板。
3. **L2 实例绑定**：`Action` 增加可选 `templateId/templateVersion/args/revision`；旧文件不变；先迁移 3 条（focus-window、clipboard-to-file、http-status）。
4. **L3 子程序升级**：`call` 锁版本；引用/环检测；旧 call 兼容。
5. **L4 门**：`switch`、步骤级 `timeout`、`fallback`、`approval`；每个门至少 3 条测试。
6. **L5 UI**：模板/实例/运行三 tab；Scene 槽位锁 revision；引用影响面。
7. 最后再评估 `parallel/join`、模板市场、Pack 签名。

---

## 11. 参考

- `crates/core-dsl/src/action.rs`：`Action` / `Step` 形状、分支/循环/call/on_error。
- `crates/core-engine/src/engine.rs`：执行主循环、容器、预算、取消、错误策略。
- `crates/core-engine/src/cond.rs`：条件表达式语法。
- `crates/core-dsl/src/pack.rs`：`Subprogram` / `Pack`。
- `crates/shell-tauri/src/commands.rs`：`CommandKind` / `FieldDef` / `Stored` / `compile()`。
- `crates/shell-tauri/src/ui.rs`：`ActionView` / `StepView` / `detail_of`。
- `examples/actions/*.json`：33 个真实线层实例。
- `examples/scenes.json`：面层槽位绑定。
- `POINT-LAYER-CLASSES.md` / `POINT-LAYER-REDESIGN.md`：点层类/实例与点层重构上下文。
