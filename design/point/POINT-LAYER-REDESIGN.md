# 点层重构设计：功能类与实例统一（v0.2 评审稿）

> 状态：设计评审稿，**尚未改代码**。
>
> 目标：把当前“模块注册表 + 动作步骤 + WGestures 动作类型”三套东西，收敛成一套可管理、可复用、可版本化、可选加载的**点层功能类 / 实例模型**。
>
> 依据：`POINT-LAYER-CLASSES.md`、`docs/MODULES.md`、`crates/core-dsl`、`crates/core-modules`、`crates/core-engine`、`crates/shell-tauri/src/commands.rs`、`crates/shell-tauri/ui/index.html`、`atom-catalog.html`。
>
> 结论先行：**采用“方案 B 做 MVP、方案 A 做目标架构”的折中路线**——类元数据进 `ModuleManifest`，实例作为独立数据对象，`Step` 保留内联兼容并新增可选 `instance` 引用；`commands` 拆成“类预设”和“流程模板”；可选加载先做 registry profile，重包/三方包后做进程 Host。

---

## 0. 现状诊断

### 0.1 已经有的资产

- `core-modules`：`ModuleManifest`、`ParamSpec`、`EffectLevel`、`Registry`、dry-run。
- `core-engine`：`Engine`、`ModuleInfo`、`module_catalog()`、权限聚合、执行/预演。
- `core-dsl`：`Action` / `Step`，步骤里是 `module + inputs`。
- `shell-tauri::commands`：WGestures 式 `CommandKind` + `FieldDef` + `compile()`，把“动作类型 + 参数”编译成 DSL 动作。
- `shell-tauri/ui/index.html`：已有“原子点”页，按 domain 列出模块、看参数、预演、L0 直跑。
- `examples/actions/*.json`：真实动作实例；`act.focus-notepad`、`act.export-clipboard`、`act.screenshot-pipeline` 可作迁移样板。
- `atom-catalog.html`：类/实例/加载管理的 UX 原型（13 类/32 实例）。

### 0.2 四个结构性问题

**问题 1：两套目录，字段会漂移。**

- 点层目录是 `ModuleManifest`（id/name/version/effect/idempotent/inputs/outputs/permissions）。
- 手势页目录是 `commands::CommandKind`（id/name/summary/fields），`FieldDef` 自己维护 `kind/options/default`。
- `hotkey`、`open_file`、`open_url`、`window`、`volume`、`cmd` 等与模块语义高度重叠，但枚举候选、默认值、必填规则各写一份。点层改一个参数，手势页不会自动变，最终必然漂移。

**问题 2：类与实例没有一等公民。**

- 类目前只有“运行时 manifest”，没有 family、描述、P0、资源画像、加载策略等管理元数据。
- 实例只是 `Step { module, inputs }` 的内联 JSON；没有稳定实例 id、revision、状态、标签、引用计数。
- `commands::Stored { kind, params }` 其实已经是一个“实例 sidecar”，但它按 action id 存、只服务手势页，不能跨动作复用。

**问题 3：没有复用、版本锁定和影响分析。**

- 同一个“复制 Ctrl+C”在多个动作里各写一份 `inputs`；改一次要全仓库找。
- 动作没有锁定实例 revision；改一个共享实例可能悄悄改变所有引用它的流程。
- 删除/归档类或实例前，无法回答“哪些动作/手势/场景在用”。

**问题 4：可选加载只有概念，没有运行时边界。**

- 当前 `list_modules` / `run_step` 每次都 `registry_with_builtins()` + `mod_win::register()`，**所有模块一次性注册**。
- `Registry` 被 `Engine` 以 `&Registry` 借用；没有“启用/禁用/加载/卸载”的状态，也没有资源画像。
- 内置模块是编译进二进制的，所谓“卸载”不能等同于释放 DLL；重包必须走子进程 Host，不能假装进程内 native 能卸干净。

---

## 1. 目标模型

### 1.1 三层职责

| 层 | 对象 | 职责 | 是否可执行 |
|---|---|---|---|
| 类 | `AtomClass` / `ModuleManifest` | 能力契约、参数 Schema、权限、副作用、资源画像 | 不直接执行 |
| 实例 | `AtomInstance` | 一组命名参数 + revision + 状态 + 加载策略 | 解析后交给类执行 |
| 模板 | `AtomPreset` / `FlowTemplate` | 面向用户的表单预设，或由多个实例组成的线模板 | 编译成 Action 后执行 |

一句话：**类是能力，实例是配置，模板是给用户看的“动作类型”。**

### 1.2 类：在 `ModuleManifest` 上扩展，不另建平行目录

建议在 `core-modules::ModuleManifest` 增加可选字段（全部带默认值，旧模块不改也能编译）：

```rust
pub struct ModuleManifest {
    // 现有字段不变
    pub id: String,
    pub name: String,
    pub version: String,
    pub effect: EffectLevel,
    pub idempotent: bool,
    pub inputs: Vec<ParamSpec>,
    pub outputs: Vec<ParamSpec>,
    pub permissions: Vec<Permission>,

    // 新增：管理元数据（默认值保证兼容）
    #[serde(default)] pub family: String,        // input/window/file/system...
    #[serde(default)] pub description: String,
    #[serde(default)] pub p0: bool,
    #[serde(default)] pub tags: Vec<String>,
    #[serde(default)] pub tier: ClassTier,       // Core / Optional / Heavy
    #[serde(default)] pub resource: ResourceProfile,
    #[serde(default)] pub pack: Option<String>,
    #[serde(default)] pub load_policy: LoadPolicy,
}
```

`ResourceProfile`：

```rust
pub struct ResourceProfile {
    pub memory_mb: f32,
    pub disk_mb: f32,
    pub gpu_mb: f32,
    pub handles: u32,
    pub threads: u32,
    pub model: String,
    pub deps: Vec<String>,
}
```

`ClassTier`：`Core`（随内核注册）、`Optional`（启用才注册）、`Heavy`（重包/三方，后续走 Host）。

**原则：类元数据的唯一真源是代码里的 manifest；SQLite 里的 `atom_class` 只是读模型/缓存，不允许手改。** 这样不会出现“数据库说 3 个参数、代码说 4 个参数”的双源问题。

### 1.3 实例：独立数据对象

建议在 `core-dsl` 增加纯数据类型：

```rust
pub struct AtomInstance {
    pub id: String,              // ins.copy
    pub class_id: String,        // input.simulate
    pub class_version: String,   // 0.1.0（锁定）
    pub name: String,            // 复制
    pub inputs: Value,           // 默认参数
    pub revision: u32,           // 每次保存 +1
    pub status: InstanceStatus,  // active / draft / archived
    pub tags: Vec<String>,
    pub load_policy: LoadPolicy, // on-demand / preload / pinned
    pub created_at: i64,
    pub updated_at: i64,
}
```

实例只存“默认参数”，不存实现、不存权限；权限/副作用始终从类 manifest 推导。

### 1.4 步骤：可选引用实例，保留内联兼容

`Step` 当前只有 `module + inputs`。建议新增两个可选字段，**不破坏现有 JSON**：

```rust
pub struct Step {
    // 现有字段不变
    pub module: String,
    pub inputs: Value,

    // 新增：命名实例引用（与 module 二选一；inline 仍合法）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instance_revision: Option<u32>,
}
```

解析顺序：

1. 有 `instance`：按实例 id 取 `AtomInstance` → 校验 `class_version` → 取类 manifest；
2. 无 `instance`：沿用 `module` + `inputs` 的内联模式（兼容旧动作）；
3. 合并参数：**类默认值 < 实例 `inputs` < 步骤 `inputs`**，先做浅合并（按 key 覆盖），嵌套深合并以后再说；
4. 保存新动作时，如果用了实例，**必须写 `instance_revision`**；旧动作/内联不强制。

校验时 `used_modules` 要能通过实例反查类；权限/副作用也从类聚合，而不是从步骤 JSON 猜。

### 1.5 触发层不混进点层

热键、剪贴板监听、文件监听、定时器属于 `trig-win`/触发层。触发绑定的是 **Action**（线），不是点类；Action 里再引用实例。

不要新增 `input.key.trigger`、`file.watch.trigger` 这类点模块，否则点层会变成“既能执行又能监听”的四不像。

---

## 2. 统一命令目录：`commands` 不是第二套点层

### 2.1 现状映射

当前 `commands::catalog()` 的 11 个动作类型，实际关系如下：

| 当前 CommandKind | 应归类 | 目标类 | 说明 |
|---|---|---|---|
| `hotkey` | 类预设 | `input.simulate` | `mods + key` 组合成 `kind=key, key=ctrl+s` |
| `text` | 类预设 | `input.simulate` | 固定 `kind=text` |
| `open_file` | 类预设 | `sys.open` | 固定 `kind=file`，`path → target` |
| `open_url` | 类预设 | `sys.open` | 固定 `kind=url`，补 `https://` |
| `web_search` | 类预设 | `web.search` | `engine/query` 直接映射 |
| `window` | 类预设 | `window.control` | `op/target` 直接映射 |
| `task_switch` | 类预设（固定参数） | `input.simulate` | 固定 `kind=key, key=alt+tab` |
| `cmd` | 类预设 | `sys.run` | `code/show_window` 直接映射 |
| `volume` | 类预设 | `sys.volume` | `op/steps` 直接映射 |
| `pause` | 类预设 | `sys.pause` | 无参数 |
| `nothing` | 流程模板/占位 | — | 零步骤，不是类 |

结论：**除 `nothing` 外，其余都是“一个类 + 一组预设字段”**，不应再维护独立的 `FieldDef` 枚举/默认值。

### 2.2 类预设 `AtomPreset`

```rust
pub struct AtomPreset {
    pub id: String,              // hotkey / open_file / ...
    pub class_id: String,        // input.simulate / sys.open / ...
    pub name: String,
    pub summary: String,
    pub visible_fields: Vec<String>, // 从类 schema 里选哪些字段露出来
    pub field_aliases: BTreeMap<String, String>, // UI 字段名 → 类参数名
    pub fixed: Value,            // 固定参数，如 kind=key
    pub compose: Option<PresetCompose>, // mods+key 这种组合规则
}
```

规则：

- 字段类型、枚举候选、必填、默认值**全部从 `ModuleManifest.inputs` 读取**；
- `AtomPreset` 只允许改“显示名/顺序/别名/固定值/组合规则”，不允许另写一套枚举；
- `compile(preset, params)` 先产出 `AtomInstance`，再产出 `Action`；不直接绕过类校验；
- 权限、副作用、dry-run 仍由类决定。

### 2.3 流程模板 `FlowTemplate`

多步组合（例如“选中文字 → 搜索 → 打开结果”）不是类，而是 `FlowTemplate`：

```rust
pub struct FlowTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub params: Vec<ParamSpec>, // 模板自己的入参
    pub steps: Vec<Step>,       // 内部引用实例或内联类
}
```

`nothing` 就是零步骤的流程模板/占位，不占点层类目录。

### 2.4 迁移策略

- 第一阶段保留 `commands::CommandKind` API 作为适配层，内部改为从 `AtomPreset` 生成；
- `Stored { kind, params }` 双读到 `AtomInstance`；
- 手势页仍显示“动作类型”，但数据源不再是硬编码 `FieldDef`；
- 等所有调用方迁移完成后，删除 `commands.rs` 里的重复 `FieldDef` 目录。

---

## 3. 可选加载与资源

### 3.1 三个概念分开

| 概念 | 含义 | 当前现实 |
|---|---|---|
| installed | 包在磁盘上 | 内置模块编译进二进制；暂无外部包 |
| registered | 已注册进 `Registry`，可被 Engine 找到 | 当前全部注册 |
| loaded/active | 实现已进内存/正在运行 | 内置模块无独立生命周期；重包需要 Host |

**不要承诺“卸载内置 Rust 模块能释放代码段”**。MVP 的可选加载是**注册裁剪**，不是动态卸载。

### 3.2 `RegistryProfile`

```rust
pub struct RegistryProfile {
    pub enabled_classes: BTreeSet<String>,
    pub preload: BTreeSet<String>,
    pub pinned: BTreeSet<String>,
}
```

启动流程：

1. 读 profile；
2. 只注册 `Core` + `enabled_classes`；
3. 未启用类不出现在 `module_catalog`，动作校验时报 `E_CLASS_DISABLED`；
4. `preload` 在 UI 空闲时注册；`pinned` 不自动取消；
5. 运行中的动作如果引用了未注册类，在校验阶段就挡住，不要等到执行到一半才炸。

### 3.3 状态机

`available`（未安装）→ `installed`（已安装）→ `registered`（已注册/可执行）→ `active`（运行中）→ `idle`（空闲）→ `disabled`（被禁用）/ `error`。

对内置模块：`installed` 和 `registered` 基本同时发生，状态主要用于 UI 与权限提示。

### 3.4 资源画像

每个类显示：内存峰值、磁盘、GPU、句柄、线程、模型、依赖。数值先来自 manifest 估算，后续用真实计量替换：

- 内存：`WorkingSet` / `PrivateBytes` / `GC.GetGCMemoryInfo`
- 显存：DXGI `QueryVideoMemoryInfo` 或厂商计数器
- 句柄/线程：`GetProcessHandleCount` / `Process.Threads`
- 模型：OCR/LLM 的 session 生命周期

### 3.5 真实卸载边界

- 托管包：collectible `AssemblyLoadContext`，要求无静态引用/后台线程/未释放句柄。
- Native DLL：通常不能可靠卸载；三方/原生/重模型必须**子进程 Host**，卸载 = 终止进程。
- WASM：丢弃线性内存。
- 模型：`Dispose` session，不能只置 null。

---

## 4. 数据与接口

### 4.1 SQLite 表

```sql
-- 类的读模型（从 manifest 生成，不手改）
atom_class(
  id TEXT, version TEXT, family TEXT, name TEXT, description TEXT,
  effect TEXT, p0 INTEGER, tier TEXT, manifest_json TEXT,
  resource_json TEXT, pack_id TEXT, updated_at INTEGER,
  PRIMARY KEY(id, version)
);

-- 实例（真源）
atom_instance(
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  class_version TEXT NOT NULL,
  name TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  load_policy TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 引用（保存动作时重算）
atom_instance_ref(
  instance_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  instance_revision INTEGER NOT NULL,
  PRIMARY KEY(instance_id, action_id, step_id)
);

-- 可选包/加载事件
atom_pack(id TEXT, version TEXT, path TEXT, hash TEXT, signature TEXT,
          state TEXT, resource_json TEXT, last_used INTEGER,
          PRIMARY KEY(id, version));
atom_load_event(id INTEGER PRIMARY KEY, pack_id TEXT, action TEXT,
                reason TEXT, duration_ms INTEGER, memory_mb REAL, error TEXT);
```

### 4.2 Tauri 命令

```text
list_atom_classes() -> Vec<AtomClassInfo>
get_atom_class(id, version?) -> AtomClassDetail
list_atom_instances(filter?) -> Vec<AtomInstanceView>
create_atom_instance(class_id, name, inputs) -> AtomInstanceView
update_atom_instance(id, name, inputs, expected_revision) -> AtomInstanceView
archive_atom_instance(id) -> ()
duplicate_atom_instance(id, new_name) -> AtomInstanceView
list_instance_refs(id) -> Vec<InstanceRef>
set_class_enabled(class_id, enabled) -> ()
list_load_state() -> Vec<ClassLoadView>
```

兼容策略：`list_modules` 保留，内部转调 `list_atom_classes`；`save_action` 增加实例/版本校验；旧动作继续按内联执行。

### 4.3 实例 JSON 示例

```json
{
  "id": "ins.copy",
  "classId": "input.simulate",
  "classVersion": "0.1.0",
  "name": "复制",
  "inputs": { "kind": "key", "key": "ctrl+c" },
  "revision": 3,
  "status": "active",
  "tags": ["编辑", "常用"],
  "loadPolicy": "pinned"
}
```

动作步骤：

```json
{
  "id": "copy",
  "instance": "ins.copy",
  "instanceRevision": 3,
  "output": "r"
}
```

旧写法仍然合法：

```json
{
  "id": "copy",
  "module": "input.simulate",
  "inputs": { "kind": "key", "key": "ctrl+c" },
  "output": "r"
}
```

---

## 5. UI 重设计

### 5.1 原子点页 → 三个 tab

当前“原子点”页只有模块目录。建议改为：

- **类**：所有 `AtomClass`，按 family 分组；显示版本、effect、权限、P0、实例数、引用数、资源、加载状态。
- **实例**：所有 `AtomInstance`，按类分组；显示参数摘要、revision、状态、引用、最近运行；支持新建/编辑/复制/归档/恢复。
- **加载**：类/包的加载状态、资源画像、策略、内存预算、启用/禁用。

### 5.2 类表列

`类 / 家族 / 版本 / 副作用 / 权限 / P0 / 实例数 / 引用 / 资源 / 加载状态 / 操作`

### 5.3 实例表列

`实例 / 所属类 / 参数摘要 / revision / 状态 / 引用 / 最近运行 / 操作`

### 5.4 Inspector

- 类：契约、参数 Schema、输出、权限、副作用、资源、依赖、引用它的实例/动作。
- 实例：参数表单（由类 schema 生成）、revision、引用、加载策略、运行测试、归档。
- 动作：步骤可以选“命名实例”或“内联类”；命名实例显示 pin 的 revision，类升级时提示迁移。

### 5.5 手势页

“动作类型”下拉改为 `AtomPreset` 列表；参数表单由 `AtomPreset.visible_fields + class schema` 生成，不再维护 `FieldDef` 枚举副本。多步动作显示为“流程模板”，与单点预设分开。

### 5.6 加载页

沿用 `atom-catalog.html` 的加载管理：状态、策略、内存/磁盘/GPU/句柄/线程/模型/依赖、512 MB 预算条。资源数字先标注“估算”，真实值后续接入。

---

## 6. 迁移路线

| 阶段 | 交付 | 行为变化 | 粗估 |
|---|---|---|---|
| **P0 盘点** | 38 个模块补 family/description/tier/resource 默认值；11 个 CommandKind 标注 preset/template | 无 | 3–5 天 |
| **P1 类目录** | `ModuleManifest` 扩展 + `ModuleInfo` 扩展 + 只读类目录 UI | 无（旧字段兼容） | 4–6 天 |
| **P2 实例存储** | `AtomInstance` + SQLite + CRUD；`commands::Stored` 双读双写 | 手势页不变 | 6–10 天 |
| **P3 实例引用** | `Step.instance` + engine resolver + revision 锁定 + 引用表 | 新动作可选；旧动作不变 | 5–8 天 |
| **P4 预设统一** | `AtomPreset` 替代 `FieldDef` 目录；手势页切换数据源 | 表单不变，数据源变 | 6–10 天 |
| **P5 加载裁剪** | `RegistryProfile` + 启用/禁用 + 加载页 | 可 core-only 启动 | 5–8 天 |
| **P6 重包 Host** | 外部 pack + 子进程 Host + 真实资源计量 | 后续 | 30–50 天 |

MVP（P0–P5）约 **29–47 人天**；含 P6 的生产级约 **60–90 人天**。这是工程粗估，不含模型采购、签名/市场、跨平台。

### Go/No-Go 门槛

1. 38 个模块 100% 有 family/description/tier/resource 默认值；`cargo xt modules --json` 能生成类目录。
2. 11 个 CommandKind 100% 标注为 preset 或 template；没有任何 `FieldDef` 枚举与 `ParamSpec.options` 重复。
3. 选 10 条代表性动作（focus-notepad、export-clipboard、screenshot-pipeline、http-get、close-calculator 等）改用命名实例，输出与旧动作逐字节一致。
4. core-only profile 能启动；引用禁用类的动作在**保存/校验**阶段报 `E_CLASS_DISABLED`，而不是运行到一半失败。
5. UI 类/实例 CRUD + 引用列表可用；删除/归档前能看到影响面；无悬空引用。
6. 至少一个重包在子进程 Host 中完成 load/unload 循环，内存回落到基线，才允许在文案里写“可选加载/卸载”。

---

## 7. 分组讨论

### 7.1 方案组（架构/长期）

**主张：Catalog-first。**

- 建一个 `core-catalog`（或等价服务），统一类、实例、引用、加载状态。
- 类元数据从 manifest 生成，实例作为一等公民；`Step` 只引用实例，内联仅作迁移兼容。
- `commands` 彻底拆成 `AtomPreset` + `FlowTemplate`，不再有第二套 `FieldDef`。
- 可选加载按 pack manifest + 子进程 Host 设计，支持三方/重包/市场。

**优点**：模型干净；AI/forge 可直接查类/实例；影响分析、版本 diff、市场分发都有地基。
**风险**：新 crate/新表/新 API 多；`Step` 语义变化影响所有执行路径；动态卸载在 Rust/Windows 上比想象难；容易做成“大爆炸重构”。

### 7.2 可行性组（交付/风险）

**主张：兼容优先，分阶段落地。**

- 不建新 crate；先把元数据塞进 `ModuleManifest`，`ModuleInfo` 扩展，旧模块零改动。
- 实例存 `core-store` 的 JSON/SQLite sidecar，类型放 `core-dsl`；先服务 shell，不急着做通用 catalog。
- `Step` 保留 `module + inputs`，新增可选 `instance`；旧动作完全不动。
- `commands` 先做适配层：`CommandKind` 内部转 `AtomPreset`，不一次性删。
- 可选加载先做 `RegistryProfile`（启用/禁用/注册裁剪），不承诺内置模块卸载；重包 Host 放 P6。

**优点**：2–4 周能出可见结果；不破坏 49 个动作文件；风险可控。
**风险**：实例存储先绑 shell，其他前端可能重复；没有统一 catalog 时影响分析较弱；`FieldDef` 适配层可能长期残留。

### 7.3 争议与共识

| 争议 | 方案组 | 可行性组 | 共识 |
|---|---|---|---|
| 是否新建 `core-catalog` | 要，长期干净 | 不要，MVP 先扩展现有 crate | **MVP 不建；P6 若需要再抽** |
| 类元数据放哪 | 独立 `AtomClass` 表 | 直接扩展 `ModuleManifest` | **manifest 为真源；SQLite 只做读模型** |
| 实例是否一等公民 | 是，Step 只引用实例 | 是，但保留内联兼容 | **是；`Step.instance` 可选，旧 `module+inputs` 继续合法** |
| `commands` 怎么办 | 全部改成 catalog | 先适配，后删除 | **拆成 preset/template；`FieldDef` 只做显示覆盖，不复制枚举** |
| 可选加载现在做吗 | 做 pack + Host | 先做 registry profile | **先 profile；Host 放 P6，不吹牛** |
| UI 先做哪些 | 类/实例/图谱/影响分析 | 类/实例/加载三 tab | **三 tab 先上；图谱/影响分析后置** |

### 7.4 投票

- 方案组：5/5 支持“目标架构 A”，但接受 MVP 走 B。
- 可行性组：5/5 支持“B 为 MVP”，条件是 P1 后必须补实例引用与校验，不能停在只读目录。
- 联合结论：**B 的路径，A 的数据模型；每一步都保留回滚点。**

---

## 8. 风险与不做的事

**风险**

1. **双源漂移**：manifest、SQLite、`CommandKind` 三处都写参数 → 必须规定 manifest 是唯一真源。
2. **`Step` 兼容**：新增 `instance` 后，`used_modules`、权限聚合、dry-run、历史记录都要能反查类；漏一处就会出现“校验通过、执行找不到模块”。
3. **revision 锁定**：不锁 revision，改共享实例会悄悄改变旧动作；锁得太死，升级又很痛苦。建议新动作必须锁，旧动作迁移时显式升级。
4. **可选加载假象**：内置 Rust 模块无法真正“卸载代码段”；重包必须 Host，不能用 UI 的“卸载”按钮骗人。
5. **命令目录迁移**：`commands.rs` 的 `FieldDef` 与手势页耦合深，一次性删会伤 UI；适配层要有测试。
6. **文档/代码漂移**：`sys.run` 文档标 P3、代码已有 manifest；以 registry/capabilities 为准，并加一致性测试。

**不做的事**

- 不为“复制/粘贴/切记事本”各建一个类。
- 不把热键/文件监听/定时器做成点模块。
- 不让 `commands` 继续维护第二套枚举/默认值。
- 不承诺进程内 native 动态卸载。
- 不在 P1 就做图谱/影响分析/市场。
- 不手工编辑 `atom_class` 缓存表。

---

## 9. 下一步

1. **评审本稿**，确认“B 路径 + A 数据模型”的共识。
2. 做 P0 盘点：给 38 个模块补 family/description/tier/resource 默认值；给 11 个 CommandKind 标 preset/template。
3. 做 P1：`ModuleManifest`/`ModuleInfo` 扩展 + 只读类目录 UI；先不动执行路径。
4. 做 P2：`AtomInstance` + SQLite + CRUD；把 `commands::Stored` 双读到实例。
5. 做 P3：`Step.instance` + resolver + revision + 引用表；选 10 条动作做等价迁移。
6. 做 P4/P5：预设统一 + registry profile + 加载页；最后再评估 P6 Host。

---

## 10. 参考

- `POINT-LAYER-CLASSES.md`：点层类/实例总表、38 模块清单、真实动作样例。
- `docs/MODULES.md`：点层开发手册、P1–P7 状态、三条自动化护栏。
- `crates/core-modules/src/types.rs`：`ModuleManifest` / `ParamSpec` / `EffectLevel`。
- `crates/core-engine/src/engine.rs`：`ModuleInfo` / `module_catalog()` / `run_module()`。
- `crates/core-dsl/src/action.rs`：`Action` / `Step` 形状。
- `crates/shell-tauri/src/commands.rs`：`CommandKind` / `FieldDef` / `Stored` / `compile()`。
- `crates/shell-tauri/ui/index.html`：原子点页、手势动作类型与参数表单。
- `atom-catalog.html`：类/实例/加载管理可视化原型。
