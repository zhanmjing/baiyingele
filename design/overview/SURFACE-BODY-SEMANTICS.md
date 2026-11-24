# 面层 / 体层执行语义提案

> 状态：**部分实施**
>
> 已落地：§8 Panel 收编（`surface.panel` 类 + 14 实例 + 37 应用记录）
> 未落地：§4.1 `runSurface` 的 render 语义、§4.2 `runBody` 的 assemble 语义、
>         §4.3 `RunResult.kind` 判别、§6 落地路径阶段 2-4
> 范围：`surface` / `body` 两层的「运行」到底意味着什么
> 依据：对当前仓库代码与生成数据的实测，不引用未验证的假设
> 修订：v2 —— 按维护者裁决「页面也是一种可复用模式」修正了 v1 的判断

---

## 0. 结论先行

| 层 | 现在的做法 | 问题 | 提议 |
|---|---|---|---|
| 面层 | `runSurface` 走 `mockRunner`，返回「执行完成」 | **范畴错误**：面是渲染与发意图，不是执行 | `runSurface` 保留，`kind: render` —— 产出渲染树 + 可用意图 |
| 体层 | `runBody` 走 `mockRunner`，返回「执行完成」 | 体自己没有执行逻辑，只有零件清单 | `runBody` 保留，`kind: assemble` —— 齐备度检查 + 装配 |
| 面层模型 | 只有「交互模式」一种类 | 缺了「页面」这一类可复用元素 | `SurfaceClass.kind = 'pattern' \| 'page' \| 'panel'` |
| Panel | 14 个平行定义的「类」 | 字段集完全相同，是同一个类被写了 14 遍 | `surface.panel` 一个类 + 14 个实例，见 §9 |
| Panel | `content` 是单值字符串 | 承载不了多个页面 | `content: string[]` |

一句话：**点层和线层是「执行」，面层是「呈现」，体层是「装配」。
把 `run` 这套语义套到面和体上是模型错位。**

---

## 1. 维护者裁决带来的修正（v1 → v2）

v1 的判断是：`surface.settings-page`、`surface.preview-window` 这类名字看起来像「具体页面」，
所以它们应该是**某个交互模式的实例**，而不是新的类。

维护者的裁决推翻了这个判断：

> **页面也是一种可复用模式（不同的实例可以用相同的页面，甚至多个页面）**

这句话有三层含义，v1 全漏了：

1. **页面是类，不是实例** —— `surface.settings-page` 可以被多个 SurfaceInstance 复用，
   所以它必须是 `SurfaceClass`，带自己的 revision。
2. **页面可以组合** —— 一个实例可以同时用多个页面（比如左边预览、右边属性）。
   所以引用关系是**多对多**，不是一对一。
3. **`"surface.prompt-input + surface.streaming-response"` 不是笔误** ——
   那是有人在用 `+` 表达「这个面板同时承载两个页面」，
   因为数据模型当时只有单值字段，只能这么凑。**是模型缺字段，不是数据脏。**

修正后的结论：**28 条面层需求全部是真实缺失的类，不是命名写错。**

---

## 2. 修正后的面层模型：可复用元素分 kind

```ts
type SurfaceClass = {
  id: string
  version: string
  kind: 'pattern' | 'page' | 'panel'   // panel 见 §8
  name: string
  family: 'input' | 'browse' | 'visualize' | 'communicate'
  // pattern 才有：直接渲染的区域与槽位
  regions?: RegionSpec[]
  slots?: SurfaceSlot[]
  // page 才有：它由哪些 pattern 实例组成
  composition?: { patternInstance: string; slot: string }[]
}
```

| kind | 是什么 | 例子 | 现状 |
|---|---|---|---|
| `pattern` | 原子交互模式，直接读数据渲染 | `form` / `table` / `canvas` / `dialog` / `hud` | **16 个已有** |
| `page` | 由 pattern 组成的页面，可被多个实例复用 | `settings-page` / `preview-window` / `ocr-result` / `rename-dialog` | **35 个待建** |

两层都是「可复用元素」，区别只在**粒度**：pattern 直接对着数据，page 对着 pattern。

### 2.1 这样整个栈就一致了

```text
Body（产品，可复用）
  └ composition → SurfacePage（页面，可复用）      ← 35 个待建
                    └ composition → SurfacePattern（交互模式，可复用）  ← 16 个已有
                                      └ slots 读 Flow/Point/Field 数据
                                        └ 用户意图向上
```

**每一层都是「可复用元素 + 组合关系」**，和点 → 线 → 体的模式完全一致。
v1 把它看成「只有 pattern 一种」，所以才会把 page 误判成实例。

面层实际有**三种** kind，第三种（`panel`）见 §9。

---

## 3. 现状实测

### 3.1 五层规模与真实度

| 层 | 类 | 实例 | 真实实现 |
|---|---:|---:|---:|
| 点层 | 21 | 48 | **21 / 21** |
| 线层 | 13 | 32 | 13 / 13 有图，引擎完备 |
| **面层** | 16 | 46 | **0**（`mockRunner`） |
| **体层** | 29 | 82 | **0**（`mockRunner`） |
| 场层 | 23 | 79 | 5 / 23 |

面/体的 runner 在 `src/main/index.ts` 里是 `undefined`，落到默认 `mockRunner`：

```ts
export const mockRunner: InstanceRunner = ({ def, instance }) => ({
  status: 'ok',
  output: def.outputs[instance.classId] ?? `执行完成 · ${instance.name}`,
  elapsedMs: 38 + Math.floor(Math.random() * 240)
})
```

它**永远返回 ok**，耗时是随机数。所以「0 真实」不是没写完，是压根没有实现。

### 3.2 面层其实是四段结构

```text
DockTile (48, 入口)
  └─→ PanelClass (14, 容器: chrome / mode / regions / states)
        └─ content 指向 → SurfacePage (页面)
              └─ composition → SurfacePattern (交互模式)
                    └─→ 意图向上: runLine / runPoint / saveSettings / approvalResult
```

`panelClasses[0].content` 就是 `"surface.inspector"` ——
**`panel.*` 不是和 `surface.*` 并列的第二套模型，而是 `surface.*` 的容器。**

### 3.3 连接质量

| 连接 | 有效 | 总数 | 有效率 |
|---|---:|---:|---:|
| Panel → SurfaceClass | 6 | 14 | 43% |
| Panel → SurfaceInstance | 7 | 37 | 19% |
| 16 个 pattern 被 Panel 使用 | 6 | 16 | 38% |

闲置的 10 个 pattern：`canvas`、`card-grid`、`dialog`、`form`、`hud`、`metric-card`、
`table`、`tray-menu`、`tree`、`wizard` —— 恰好是**最容易做**的那批。

### 3.4 面层真实缺多少类

| 来源 | 数量 |
|---|---:|
| 体层 composition 要求（已记为需求） | 28 |
| Panel `content` 指向但没被记为需求 | +7 |
| **合计需要新建** | **35** |

那 7 个漏记的：`approval-card`、`artifact-panel`、`log-viewer`、`prompt-input`、
`settings-page`、`streaming-response`、`tool-call-trace`。

**原因**：需求生成器只扫体层 `composition`，没扫 Panel 的 `content`。

### 3.5 体层的 composition 是「期望清单」

体层 29 个类各有 `composition`，共 **154 条**引用：

| 判定方式 | 匹配数 | 匹配率 |
|---|---:|---:|
| 按「类」匹配 | 45 | 29% |
| 按「实例」匹配 | 0 | 0% |
| **悬空** | **109** | **70%** |

按修正后的模型，这些悬空引用绝大多数是**还没造的 page 和 point**，不是错误引用。

而且它们**已经被记为需求**了：

| 层 | 类级 | 实例级 | 合计 |
|---|---:|---:|---:|
| 点层 | 57 | 31 | 88 |
| 线层 | 24 | – | 24 |
| 面层 | 28 | – | 28 |
| 合计 | | | **140** |

### 3.6 29 个体没有一个能装配

| | 缺失零件数 |
|---|---:|
| 最多 | 6（`body.quick-launch`、`body.meeting-notes`） |
| 最少 | 1（`body.external-access` 6/7、`body.screenshot-translate` 5/6） |
| 中位 | 4 |
| **完全齐备** | **0 个** |

---

## 4. 三个语义判断

### 4.1 面层：`runSurface`，但 `kind` 永远是 `render`

设计文档 `SURFACE-LAYER-CLASSES.md` §1.3 已经写清楚：

> - **数据向下**：面读取 `FlowRun` / `PointRun` / `GuardResult` / registry 查询结果。
> - **意图向上**：面发出 `runFlow`、`runPoint`、`saveSettings`、`approvalResult`、`navigate`。
> - 面不直接修改业务状态。

按这个定义，**面没有「执行」这个动作**。它只做两件事：读数据渲染、把用户操作变成意图。

⚠️ 动词仍然叫 `runSurface` —— 因为 `src/preload/index.ts` 是**按层名循环生成**的
（`run<Layer>`），新增一层不用改 preload。**统一的入口形状 + 分层的语义**，
靠返回值里的 `kind: 'render'` 区分，而不是另起一个新动词。

```ts
interface RenderResult {
  tree: RenderNode
  dataUsed: { kind: 'flowRun' | 'pointRun' | 'guardResult' | 'registry'; ref: string }[]
  intents: SurfaceIntent[]
  /** 渲染不了的部分：槽位缺数据、需要的 pattern 不存在 */
  gaps: { slot: string; reason: string }[]
}
```

- **`status` 不再是 ok/warn**，而是「渲染成功 / 部分缺口 / 无法渲染」。`gaps` 非空就不能报成功。
- **意图是输出的一部分**，不是副作用。「点了运行」本身是 `intent`，真正执行发生在主进程收到之后。
- **`dataUsed` 必须记录**，否则「这个面为什么显示成这样」无法回答。

page 和 pattern 的 render 是递归关系：

```text
render(page) = 对每个 composition 项 render(pattern) → 按 slot 拼装
render(pattern) = 读 slots 声明的数据源 → 产出 RenderNode
```

### 4.2 体层：`runBody`，但 `kind` 永远是 `assemble`

体层没有自己的执行逻辑，只有 `composition`（要哪些零件）、`manifest`（版本/权限/资源）、
`lifecycle`（装没装/要不要更新）。

```ts
// runBody 的返回值，kind = 'assemble'
interface AssembleResult {
  readiness: { total: number; satisfied: number; missing: MissingPart[] }
  assembly?: { surfaces: string[]; flows: string[]; points: string[] }
  /** 不齐时给出需求 id，直接指向 requirements.generated.json */
  blockedBy?: string[]
}
```

判定顺序：

```text
1. 读 body 的 composition
2. 逐条查：类存在？实例存在？实现是真的？
3. 全齐 → 返回 assembly，交给面层承载
4. 有缺 → 返回 readiness + blockedBy，明确「零件不齐，不能启动」
```

**这个能力今天就能做**，`requirements.generated.json` 已经把缺件算好了，不需要新原语。

### 4.3 Panel：不是一层，是容器

`panel.*` 不该有独立的 `run`。它只有一个动作：**打开**。

```ts
interface OpenPanelResult {
  panelId: string
  mode: 'docked-left' | 'docked-right' | 'floating' | 'modal'
  /** 里面承载的 page —— 可以是多个（左预览 + 右属性） */
  content: string[]
  gap?: string
}
```

`content` 从单值改成**数组**，这正好容纳维护者说的「甚至多个页面」。

---

## 5. 数据模型修正

### 5.1 `content` 改成数组

```diff
- "content": "surface.prompt-input + surface.streaming-response"
+ "content": ["surface.prompt-input", "surface.streaming-response"]
```

注意：**这不是在修一个笔误**，是给一个已经被表达出来的需求补上字段。
`+` 是当时唯一能表达「多个页面」的办法。

### 5.2 `SurfaceClass` 加 `kind`

```diff
  type SurfaceClass = {
    id: string
+   kind: 'pattern' | 'page' | 'panel'   // panel 见 §8
    ...
  }
```

已存在的 16 个标 `pattern`，待建的 35 个标 `page`（少数可能是 pattern，按 §6 阶段 3 逐个定）。

### 5.3 需求生成器补扫 Panel content

`scripts/gen-catalogs.mjs` 目前只从体层 `composition` 生成需求。应再加一条来源：
**Panel 的 `content` 指向不存在的 surface → 也是一条需求**，
`requiredBy[].where = "panel.content"`。这样 §3.4 里那 7 条就不会漏。

### 5.4 面/体不再有 `outputs` 兜底

`LAYER_DEFS.surface.outputs` / `.body.outputs` 是给 `mockRunner` 用的假输出。
有了真实现之后要删掉 —— 留着会让人以为有真输出。

---

## 6. 落地路径

### 阶段 1：体层装配检查（不依赖任何新零件）

- 实现 `body.assemble`：读 composition + requirements，算齐备度
- 输出 `readiness` + `blockedBy`
- 完成后体层不再是 `mockRunner`，至少能诚实回答「我这个体现在还缺什么」

预期结果：29 个体全部报缺件，齐备 0 个（§3.6 已算好）。**这是诚实的 0。**

### 阶段 2：面层 render（先做已被 Panel 接上的 6 个 pattern）

- 实现 `surface.render`，先支持 `inspector` / `dashboard` / `diff` / `run-history` /
  `notification` / `command-palette`
- `gaps` 如实报「这个槽位没有数据源」

### 阶段 3：给 35 个待建类做分类并挑最被需要的先造

- 先按 `requiredBy` 被多少个体需要排序
- 每个待建类判定 `kind`：是 page（组合 pattern）还是 pattern（直接渲染）
- 优先造**被引用次数最多**的，而不是按字母序

`body.external-access`（6/7，只差 1 个）和 `body.screenshot-translate`（5/6，只差 1 个）
应该是第一批能变成「可装配」的体 —— 它们只差临门一脚。

### 阶段 4：把 Panel 的 `content` 接到真实 page 上

14 个 Panel 里现在 6 个有效。剩下的接到阶段 3 造出来的 page 上。

---

## 7. 明确不做的事

| 不做 | 理由 |
|---|---|
| 给 `panel.*` 加独立 run | Panel 是容器，打开即全部语义 |
| 用 mock 让体层显示 ok | 0/29 是事实（70% 零件不存在），改数据是造假 |
| 把 109 个悬空引用「修复」成现有类 | **它们是 35 个待建类 + 88 条点层需求**，是真实的产品需求 |
| 造一个万能 `surface.generic` 兜底所有引用 | 会让 28 条需求假性满足，等于把缺口藏起来 |
| 面层留 `run` 兼容层 | 范畴错误就该直接改，两套语义并存只会更乱 |
| 把 page 当成 pattern 的实例 | 维护者已裁决：页面是可复用模式，必须是类 |

---

## 8. Panel：面层的第三个功能类

维护者提案：

> panel 作为面层一个功能类，不同的 panels 作为实例可以被应用

### 8.1 为什么这个方案对：14 份一模一样的字段表

实测 14 个 `panelClass` 的字段集：

```
{'id','name','icon','group','desc','modes','regions','content',
 'states','behaviors','a11y','instances','version'}   ← 14 个类，13 个字段，一个不差
```

**差异全在取值，不在结构**。`modes` 都是 `{right, floating, modal, bottom, sheet}` 的子集，
`states` 都是 `{ready, empty, error, loading, streaming, needsApproval, blocked}` 的子集。
字段集完全一致 = 「同一个类被重复定义了 14 次」的指纹。

所以：**`surface.panel` 是类，那 14 个是实例。** 这和 `surface.form` 带 4 个实例是同一个结构。

### 8.2 三种 kind，区别在「有没有状态」

| kind | 有状态？ | 动词 | 产物 |
|---|---|---|---|
| `pattern` | 无 | `render` | RenderNode |
| `page` | 无 | `render` | RenderNode（递归组合 pattern） |
| **`panel`** | **有** | **`apply`** | 挂载到 app shell 的一个区域 |
| `body` | 有 | `assemble` | 齐备度 + 装配结果 |

**这就是为什么只有 panel 需要 `apply` 这个动词**：

- pattern / page 是**无状态渲染** —— 同一份数据永远渲染出同一个结果
- panel 是**有状态挂载** —— 它占位（`mode` + `width`）、有可见性与生命周期、
  能被同一个实例挂到多处（`panel.inspector` 同时挂在 `point` / `flow-slot` / `body-manifest` 三处）

把这个区别抹平，就会重犯「给面层套 run」的错。

### 8.3 模型

```ts
type PanelClass = {
  kind: 'panel'
  modes: PanelMode[]        // right | floating | modal | bottom | sheet
  states: string[]          // ready | empty | error | loading | streaming | needsApproval | blocked
  behaviors: string[]       // resizable | collapsible | pinnable
  a11y: string[]
  defaultPages: string[]    // 默认承载哪些 page
}

type PanelInstance = {
  classId: 'surface.panel'
  id: string                // surface.panel.inspector
  rev: number
  config: { modes: PanelMode[]; regions: string[]; states: string[]; behaviors: string[] }
  /** 这个 panel 被应用在哪些地方 */
  applications: PanelApplication[]
}

type PanelApplication = {
  label: string             // point / flow-slot / body-manifest
  pages: string[]           // 承载哪些 page 实例（可多个）
  mode: PanelMode
  width: number
  state: string
  data: unknown
  actions: unknown
}
```

迁移：**14 个 `panelClass` → 14 个 `surface.panel` 实例；37 个 sub-entry → 37 条 `applications`。**

### 8.4 为什么「应用」放在实例上，而不是加第三层

如果每条 application 都是独立实体，就变成 `class → instance → application` 三层，
而点/线/体都只有两层。**把 `applications` 作为实例上的数组字段**，
既表达了「同一个 panel 可被应用多次」，又不引入第三层。

维护者说的「甚至多个页面」正好落在 `PanelApplication.pages: string[]` 上：
一条 application 可以同时承载 `prompt-input` + `streaming-response`。

### 8.5 其他层是怎么做的：跨层约定对照

实测五层的实例约定：

| 层 | 实例数 | id 前缀 = 类 id | 带 `@rN` 修订号 | 实例字段 |
|---|---:|---:|---:|---|
| point | 48 | **48（100%）** | 48（100%） | `description / id / name / params / rev / status` |
| body | 82 | **82（100%）** | 82（100%） | 同上 |
| field | 79 | **79（100%）** | 79（100%） | 同上 |
| line | 32 | **0** | 32（100%） | 同上 |
| **surface** | 46 | **21（46%）** | **0** | 同上 |

三条可以确认的跨层事实：

1. **五层实例字段完全相同**，而且**没有一层有 `classId` 字段** ——
   归属靠「嵌套在哪个类下面」隐含，seed 里不需要重复写。
2. **但运行时 `classId` 是一等字段**：`PointInstanceRecord extends PointInstanceSeed`
   并追加了 `classId / params / createdAt / updatedAt`，由 store 在载入时按父数组补上。
3. **`createInstance()` 生成 id 的规则是 `classId.slug@rN`**：

```ts
const base = `${pointClass.id}.${slug(name)}`
let id = `${base}@r1`          // 重名则 base-2@r1、base-3@r1 …
```

也就是说**代码自己的约定就是 `classId.语义名@修订号`**。point / body / field 三层 100% 符合，
line 自行改成了 `inst.xxx@rN`，**surface 最偏：一半不带类前缀，而且一个 `@rN` 都没有**。

补充事实：**没有任何一处代码按实例 id 前缀拆归属**（唯一的 `split('.')` 用在 `classId` 上，
取的是层名）。`LayerStore.instance(id)` 是精确 id 扫描。所以前缀不一致**不会造成功能故障**，
但它让「人工编写跨层引用」这件事变得靠猜 —— 而 `body.composition` 和 `panel.content`
恰恰都是人工编写的引用。

### 8.6 线层的双层结构是最该照搬的

```text
LineClass    → lineProfiles[classId]     每类一张图
LineInstance → $args + 节点 mapping       实例差异靠参数，不靠复制图
```

`lineProfiles`（13 个键）和 `bodyProfiles`（29 个键）都是**按 classId 存**，不是按实例存。

这就是 Panel 该有的形状：

| 线层 | 面层对应 |
|---|---|
| `LineClass` + 一张数据流图 | `surface.panel` + 一套 `regions / states / behaviors` |
| `LineInstance` + `$args` | panel 实例 + `config` |
| 图里 `pointClass`（类型约束）+ `pointInstance`（具体绑定） | panel 里 `pageClass`（约束）+ `pages`（绑定） |
| `FlowInstance` 把槽位绑到 `PointInstanceRef` | `PanelApplication` 把区域绑到 page 实例 |

**维护者说的「panel 作为功能类，不同 panels 作为实例可以被应用」，
正是把 `FlowClass / FlowInstance` 这套双层结构搬到面层。** 不必发明新的层级。

### 8.7 结论：向既有约定收敛

| 项 | 结论 | 依据 |
|---|---|---|
| 归属判定 | 靠父数组 → 运行时 `classId`，**不靠 id 前缀** | 五层都没有 seed 级 `classId`，但运行时都有 |
| 修订号 | 必须带 `@rN` | point/body/field/line 四层 100% 带，只有 surface 没带 |
| id 格式 | **`层.类.实例@版本`（三段定长）**，见 §8.10 | body/field 已 100% 是这个形状，把它推广到全部五层 |

§8.5 原提的三种规则（严格 `class.instance@rN` / 语义名+`classId` / 保持现状）
在 §8.10 的三段定长方案面前都成了次优解 —— 那个方案既保留了语义可读性
（`surface.form.settings_vpn@r1` 一眼读懂），又让解析不需要任何启发式。

### 8.8 面层实例 id 的实际偏差（证据）

不想改 id 的话，至少要知道偏了多少。46 个面层实例里 **25 个前缀与所属类不一致**：

| 所属类 | 实例 id | 偏差类型 |
|---|---|---|
| `surface.form` | `surface.settings.vpn` | 用语义名当爹 |
| `surface.table` | `surface.run-history.table` | 看着像 `run-history` 的实例，实际是 table |
| `surface.notification` | `surface.notify.vpn` | 类名被缩写了 |
| `surface.metric-card` | `metric.cpu` | 连 `surface.` 前缀都没有 |

按 §8.7 的结论（向 `classId.语义名@rN` 收敛），这 25 个要重命名。

**但重命名是有代价的**：`panel.content`、`body.composition`、`requirements.generated.json`
里所有引用这些 id 的地方都得同步改。所以这件事应该和 §8 的 panel 迁移**一次性做完**，
不要分两次动数据。

如果暂时不想动 id，最小可行做法是：**在 seed 里给每个实例显式补 `classId` 字段**
（运行时本来就有，只是 seed 靠嵌套隐含），让工具和人都能确定归属，
id 以后再找机会统一。

### 8.9 迁移后的账

| 项 | 现状 | 迁移后 |
|---|---:|---:|
| 面层类 | 16 | 17（+`surface.panel`） |
| `panel.*` 平行模型 | 14 个「类」 | **消除**，变成 14 个实例 |
| `panel` 应用记录 | 37 个 sub-entry | 37 条 `applications` |
| 待建 page/pattern 类 | 35 | 35（不变） |
| 面层实例 | 46 | 46 + 14 = 60 |

---

### 8.10 统一 id：`层名.类名.实例名@rN`

维护者最终定调：

> 简化命名，只要不重名。整体的功能名可以在代码注释里说明就行。

**id 不承载语义。** 想知道 `field.observe.desktop` 是干什么的，看实例的 `name` /
`description` 字段，不要指望从 id 里读出来。

id 只保证三件事：**唯一、可自动生成、引用稳定**。

#### 格式

```
层名.类名.实例名@rN          ← 3 段定长，全小写，段内不许有点（多词用 _）
```

| 段 | 来源 | 规则 |
|---|---|---|
| 层名 | 固定 5 个 | `point` / `line` / `surface` / `body` / `field` |
| 类名 | 类 id | 剥掉本层自指命名空间（`flow.` / `surface.` / `body.` / `field.`）后扁平化 |
| 实例名 | 实例 id | 剥掉类/层前缀和类型标记（`inst.` / `i-`）后扁平化 |
| 版本 | 实例的 `rev` 字段 | `@rN` |

点层不剥 `win.` / `file.` / `ui.` —— 它们是跨类的真实主题，不是自指。

#### 样例

```
win.key.send.i-copy@r1          → point.win_key_send.copy@r1
inst.ensure-vpn-ask@r2          → line.ensure_vpn.ensure_vpn_ask@r2
surface.settings.vpn            → surface.form.settings_vpn@r3
body.file-preview.text@r1       → body.file_preview.text@r1
field.observe.run-history@r1    → field.observe.run_history@r1
```

平均长度 **29 字符**。

#### 已建的工具

| 文件 | 作用 |
|---|---|
| `src/shared/atomId.ts` | **唯一真相**：`makeAtomId` / `parseAtomId` / `deriveAtomId` / `classSegment` / `instanceSegment` |
| `scripts/plan-atom-ids.mjs` | 迁移预演，**只读不写盘**，产出全量「旧 → 新」对照到 `.tmp/atom-id-plan.json` |

解析零启发式 —— 3 段定长，`split('.')` 就够：

```ts
parseAtomId('surface.form.settings_vpn@r3')
// → { layer:'surface', className:'form', instance:'settings_vpn', rev:3 }
```

#### 实测（`node scripts/plan-atom-ids.mjs`）

| 项 | 结果 |
|---|---:|
| 类要改 | **64 / 102** |
| 实例要改 | **237 / 287** |
| 新 id 冲突 | **0** |
| 其他问题 | **0** |
| 顺手抓出的**版本漂移** | **46** |

按层：

| 层 | 类要改 | 实例要改 | 版本漂移 |
|---|---:|---:|---:|
| point | 21/21 | 48/48 | 0 |
| line | 13/13 | 32/32 | 0 |
| surface | 5/16 | 46/46 | **46** |
| body | 25/29 | 70/82 | 0 |
| field | 0/23 | 41/79 | 0 |

#### 为什么必须自动生成（不是洁癖，是已经发生的 bug）

**46 处版本漂移，全部在 surface，正好是它全部 46 个实例：**

```
surface.settings.vpn      id 里没有 @rN，rev 字段 = 3
surface.inspector.point   id 里没有 @rN，rev 字段 = 4
surface.point-catalog     id 里没有 @rN，rev 字段 = 5
```

同一份数据里 `rev` 说 3、id 说没版本，引用方该信谁？现在的答案是没人知道。

自动生成之后不会发生，因为 id 是 `(层, 类, 实例, 版本)` 的纯函数。

#### 两条硬约束

1. **任何 catalog / seed / manifest 里的 id 都由生成器产出，不接受手写。**
2. **校验闸门**：待加一项 —— 对每个实例重算 id，与存储值不一致就报错。
   手改 id 会在 CI 当场挂掉，而不是在运行时变成「找不到实例」。

#### 迁移面

| 引用源 | 处数 | 类型 |
|---|---:|---|
| `lineProfiles`（`pointClass` + `pointInstance`） | 79 | **手写，必须同步** |
| `bodyProfiles` composition | 154 | **手写，必须同步** |
| `panel.content`（类级 14 + 实例级 37） | 51 | **手写，必须同步** |
| `requirements` | 140 | 生成的，重跑即可 |

**迁移之后这些引用应改成存结构化字段，不再存 id 字符串** —— 否则下次改名还会再烂一遍。

## 9. 这个提案能带来什么

**不做这件事的现状**：面层 16 个类、体层 29 个类，各自有个"运行"按钮，
点了返回「执行完成」+ 随机耗时。用户看不出它们在干什么，因为**它们确实什么都没干**。

**做完阶段 1 + 阶段 2 之后**：

- 体层能回答「我这个体还缺哪几个零件，缺口记在哪条需求上」
- 面层能回答「我渲染了哪些区域、用了哪些数据、哪些槽位没数据」
- 两者都从「假装成功」变成「如实报缺口」

这比把 45 个类标成"真实"有意义得多 —— 因为**诚实本身就是这个项目最贵的资产**。

---
