# 面层 / 体层执行语义提案

> 状态：**提案，未实现**
> 范围：`surface` / `body` 两层的「运行」到底意味着什么
> 依据：对当前仓库代码与生成数据的实测，不引用未验证的假设
> 修订：v2 —— 按维护者裁决「页面也是一种可复用模式」修正了 v1 的判断

---

## 0. 结论先行

| 层 | 现在的做法 | 问题 | 提议 |
|---|---|---|---|
| 面层 | `run()` 走 `mockRunner`，返回「执行完成」 | **范畴错误**：面是渲染与发意图，不是执行 | `render()` —— 产出渲染树 + 可用意图 |
| 体层 | `run()` 走 `mockRunner`，返回「执行完成」 | 体自己没有执行逻辑，只有零件清单 | `assemble()` —— 零件齐备度检查 + 装配 |
| 面层模型 | 只有「交互模式」一种类 | 缺了「页面」这一类可复用元素 | `SurfaceClass.kind = 'pattern' | 'page'` |
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

## 2. 修正后的面层模型：两种可复用元素

```ts
type SurfaceClass = {
  id: string
  version: string
  kind: 'pattern' | 'page'
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
                    └─→ 意图向上: runFlow / runPoint / saveSettings / approvalResult
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

### 4.1 面层：`run` → `render`

设计文档 `SURFACE-LAYER-CLASSES.md` §1.3 已经写清楚：

> - **数据向下**：面读取 `FlowRun` / `PointRun` / `GuardResult` / registry 查询结果。
> - **意图向上**：面发出 `runFlow`、`runPoint`、`saveSettings`、`approvalResult`、`navigate`。
> - 面不直接修改业务状态。

按这个定义，**面没有「执行」这个动作**。它只做两件事：读数据渲染、把用户操作变成意图。

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

### 4.2 体层：`run` → `assemble`

体层没有自己的执行逻辑，只有 `composition`（要哪些零件）、`manifest`（版本/权限/资源）、
`lifecycle`（装没装/要不要更新）。

```ts
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
+   kind: 'pattern' | 'page'
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

## 8. 这个提案能带来什么

**不做这件事的现状**：面层 16 个类、体层 29 个类，各自有个"运行"按钮，
点了返回「执行完成」+ 随机耗时。用户看不出它们在干什么，因为**它们确实什么都没干**。

**做完阶段 1 + 阶段 2 之后**：

- 体层能回答「我这个体还缺哪几个零件，缺口记在哪条需求上」
- 面层能回答「我渲染了哪些区域、用了哪些数据、哪些槽位没数据」
- 两者都从「假装成功」变成「如实报缺口」

这比把 45 个类标成"真实"有意义得多 —— 因为**诚实本身就是这个项目最贵的资产**。
