# 面层 / 体层执行语义提案

> 状态：**提案，未实现**
> 范围：`surface` / `body` 两层的「运行」到底意味着什么
> 依据：对当前仓库代码与生成数据的实测，不引用未验证的假设

---

## 0. 结论先行

| 层 | 现在的做法 | 问题 | 提议 |
|---|---|---|---|
| 面层 | `run()` 走 `mockRunner`，返回「执行完成」 | **范畴错误**：面是渲染与发意图，不是执行 | `render()` —— 产出渲染树 + 可用意图 |
| 体层 | `run()` 走 `mockRunner`，返回「执行完成」 | 体自己没有执行逻辑，只有零件清单 | `assemble()` —— 零件齐备度检查 + 装配启动 |
| 面层的容器 | `panelClasses` 与 `surfaceClasses` 两套模型 | 没人写清两者关系，靠一个 `content` 字段隐式连接 | 明确 **Dock → Panel → Surface → 意图** 四段结构 |

一句话：**点层和线层是"执行"，面层是"呈现"，体层是"装配"。把 `run` 这套语义套到面和体上是模型错位。**

---

## 1. 现状实测

### 1.1 五层规模与真实度

| 层 | 类 | 实例 | 真实实现 |
|---|---:|---:|---:|
| 点层 | 21 | 48 | **21 / 21** |
| 线层 | 13 | 32 | 13 / 13 有数据流图，引擎完备 |
| **面层** | 16 | 46 | **0**（`mockRunner`） |
| **体层** | 29 | 82 | **0**（`mockRunner`） |
| 场层 | 23 | 79 | 5 / 23 |

面层和体层的 runner 在 `src/main/index.ts` 里是 `undefined`，于是 `LayerStore` 落到默认的 `mockRunner`：

```ts
export const mockRunner: InstanceRunner = ({ def, instance }) => ({
  status: 'ok',
  output: def.outputs[instance.classId] ?? `执行完成 · ${instance.name}`,
  elapsedMs: 38 + Math.floor(Math.random() * 240)
})
```

它**永远返回 ok**，耗时是随机数。这就是「面/体 0 真实」的全部真相：不是没写完，是压根没有实现。

### 1.2 面层其实是四段结构，但文档只写了其中一段

代码里已经存在下面这条链，只是没被写下来：

```text
DockTile (48 个, 入口)
  └─→ PanelClass (14 个, 容器: chrome / mode / regions / states)
        └─ content 字段指向 → SurfaceClass (16 类) 或 SurfaceInstance (46 实例)
              └─→ 意图向上: runFlow / runPoint / saveSettings / approvalResult / navigate
```

`panelClasses[0]` 的 `content` 就是 `"surface.inspector"`，它的实例是 `"surface.inspector.point"`。
**所以 `panel.*` 不是和 `surface.*` 并列的第二套模型，而是 `surface.*` 的容器。**

### 1.3 连接质量：大部分指向不存在的零件

| 连接 | 有效 | 总数 | 有效率 |
|---|---:|---:|---:|
| Panel → SurfaceClass | 6 | 14 | 43% |
| Panel → SurfaceInstance | 7 | 37 | **19%** |
| 16 个 SurfaceClass 被 Panel 使用 | 6 | 16 | 38% |

闲置的 10 个 SurfaceClass：`canvas`、`card-grid`、`dialog`、`form`、`hud`、`metric-card`、`table`、`tray-menu`、`tree`、`wizard`。
这些恰恰是**最容易做**的交互模式（表格/表单/卡片墙/画布），却没有被任何面板接上。

### 1.4 体层的 composition 是「期望清单」，不是「引用」

体层 29 个类各有一份 `composition`，共 **154 条**引用：

| 判定方式 | 匹配数 | 匹配率 |
|---|---:|---:|
| 按「类」匹配 | 45 | 29% |
| 按「实例」匹配 | 0 | 0% |
| **悬空** | **109** | **70%** |

悬空的例子（被引用但在任何层的目录里都不存在）：

```
flow.preview-file        surface.preview-window    render.text
render.image             image.preprocess          flow.resize-image
surface.rename-dialog    file.list                 ...
```

**这不是 bug，这是需求。** 它们已经被 `requirements.generated.json` 记录了：

| 层 | 类级 | 实例级 | 合计 |
|---|---:|---:|---:|
| 点层 | 57 | 31 | 88 |
| 线层 | 24 | – | 24 |
| **面层** | **28** | – | **28** |
| 合计 | | | **140** |

所以系统其实**已经**把「体层缺零件」建模成「未满足需求」了，只是没人在界面上说清楚这件事。
体层显示 0/29 不是失败，是**零件还没造**。

### 1.5 顺带发现的三个数据缺陷

1. **6 个 Panel `content` 悬空但没被记为需求**
   `surface.approval-card`、`surface.artifact-panel`、`surface.log-viewer`、
   `surface.settings-page`、`surface.tool-call-trace`，以及——
2. **一个畸形的 content 值**：`"surface.prompt-input + surface.streaming-response"`
   一个字段里塞了两个 surface。`content` 应该是数组或单个 id，不能用 `+` 拼。
3. **需求生成器只扫体层 composition，没扫 Panel content**
   所以 1.5.1 里那 6 个漏了。

---

## 2. 三个语义判断

### 2.1 面层：`run` → `render`

设计文档 `SURFACE-LAYER-CLASSES.md` §1.3 已经写清楚了：

> - **数据向下**：面读取 `FlowRun` / `PointRun` / `GuardResult` / registry 查询结果。
> - **意图向上**：面发出 `runFlow`、`runPoint`、`saveSettings`、`approvalResult`、`navigate` 等意图。
> - 面不直接修改业务状态。

按这个定义，**面根本没有「执行」这个动作**。它做两件事：读数据渲染、把用户操作变成意图。

所以把点/线那套 `run() → RunOutcome` 套到面层上是模型错位。提议改成：

```ts
/** 渲染输出，不是执行输出 */
interface RenderResult {
  /** 渲染树：regions + slots 的实际内容 */
  tree: RenderNode
  /** 这次渲染读用了哪些数据（可追溯） */
  dataUsed: { kind: 'flowRun' | 'pointRun' | 'guardResult' | 'registry'; ref: string }[]
  /** 当前可用的意图（按钮/菜单项的启用状态） */
  intents: SurfaceIntent[]
  /** 渲染不了的部分：槽位缺数据、需要的零件不存在 */
  gaps: { slot: string; reason: string }[]
}
```

三个关键点：

- **`status` 不再是 ok/warn**，而是「渲染成功 / 部分缺口 / 无法渲染」。
  只要 `gaps` 非空就不能报「成功」。
- **意图是输出的一部分**，不是副作用。面「点了运行」这件事本身是 `intent`，真正执行发生在主进程收到意图之后。
- **`dataUsed` 必须记录**，否则「这个面为什么显示成这样」无法回答。

### 2.2 体层：`run` → `assemble`

体层没有自己的执行逻辑，只有三件东西：`composition`（要哪些零件）、`manifest`（版本/权限/资源）、`lifecycle`（装没装/要不要更新）。

```ts
interface AssembleResult {
  /** 齐备度 */
  readiness: { total: number; satisfied: number; missing: MissingPart[] }
  /** 齐了才有装配结果 */
  assembly?: {
    surfaces: string[]   // 装载哪些 SurfaceInstance
    flows: string[]      // 绑定哪些 FlowInstance
    points: string[]     // 直接用到哪些 PointInstance
  }
  /** 不齐时明确说缺什么、这些缺口已经记在哪 */
  blockedBy?: string[]   // 需求 id，指向 requirements.generated.json
}
```

**这个能力今天就能做**，因为 `requirements.generated.json` 已经把缺件算好了。不需要新的原语。

装配的判定顺序：

```text
1. 读 body 的 composition
2. 逐条查：类存在？实例存在？实现是真的？
3. 全齐 → 返回 assembly（面/线/点的具体 id），交给面层承载
4. 有缺 → 返回 readiness + 缺口对应的需求 id，明确「零件不齐，不能启动」
```

### 2.3 Panel：不是一层，是容器的属性

`panel.*` 不该有独立的 `run`。它的「运行」只有一个动作：**打开**。

```ts
interface OpenPanelResult {
  panelId: string
  mode: 'docked-left' | 'docked-right' | 'floating' | 'modal'
  /** 里面承载的 surface 实例 */
  content: string[]
  /** 承载失败时说明原因 */
  gap?: string
}
```

`content` 从单值改成**数组**，顺手修掉 §1.5.2 那个用 `+` 拼两个 surface 的畸形值。

---

## 3. 数据模型修正

### 3.1 `content` 改成数组

```diff
- "content": "surface.prompt-input + surface.streaming-response"
+ "content": ["surface.prompt-input", "surface.streaming-response"]
```

### 3.2 需求生成器补扫 Panel content

`scripts/gen-catalogs.mjs` 目前只从体层 composition 生成需求。应该再加一条来源：
**Panel 的 `content` 指向不存在的 surface → 也是一条需求**，`requiredBy[].where = "panel.content"`。

这样 §1.5.1 那 6 条就不会漏。

### 3.3 面层不再有 `outputs` 兜底

`LAYER_DEFS.surface.outputs` / `.body.outputs` 是给 `mockRunner` 用的假输出。
面/体一旦有了真实现，这两个 `outputs` 表应该删掉——留着会让人以为有真输出。

---

## 4. 落地路径

按「先做能立刻验证的、后做需要新零件的」排序。

### 阶段 1：体层装配检查（不依赖任何新零件）

- 实现 `body.assemble`：读 composition + requirements，算齐备度
- 输出：`readiness` + `blockedBy`（指向需求 id）
- **不需要造任何新零件就能做完并验证**
- 完成后体层不再是 `mockRunner`，至少能诚实回答「我这个体现在还缺什么」

已经算好的实测分布（按 `composition` 逐条查类/实例是否存在）：

| | 缺失零件数 |
|---|---:|
| 最多 | 6（`body.quick-launch`、`body.meeting-notes`） |
| 最少 | 1（`body.external-access` 6/7、`body.screenshot-translate` 5/6） |
| 中位 | 4 |
| **完全齐备的体** | **0 个** |

也就是说：**29 个体没有一个能装配起来**，最好的也只差 1 个零件。
这个结论现在是藏在数据里的，阶段 1 做完之后它会变成界面上看得见的一句话。

### 阶段 2：面层 render（用现有 16 个类里已被使用的 6 个）

- 实现 `surface.render`：按 `regions` + `slots` 产渲染树
- 先只支持已被 Panel 接上的 6 个：`inspector` / `dashboard` / `diff` / `run-history` / `notification` / `command-palette`
- `gaps` 如实报「这个槽位没有数据源」
- 完成后这 6 个面能说出「我渲染了什么、用了哪些数据」

### 阶段 3：补齐 `/src/renderer/src/generatedSurface.json` 的悬空 content

把 8 个悬空值里能在 16 个现有类中找到对应的 6 个修掉（比如 `surface.settings-page` → `surface.form`，
`surface.preview-window` → 需要新建，`surface.log-viewer` → 需要新建）。

先修「本来就有对应类只是写错名字」的那部分，不新增类。

### 阶段 4：真正缺的零件按需求优先级造

28 条面层需求 + 24 条线层需求 + 88 条点层需求。
按 `requiredBy` 被多少个体需要来排优先级——被 3 个体需要的零件先造。

---

## 5. 明确不做的事

| 不做 | 理由 |
|---|---|
| 给 `panel.*` 加独立 run | Panel 是容器，打开就是全部语义，加 run 只会再造一个假动作 |
| 用 mock 让体层显示 ok | 体层现在 0/29 是**事实**（70% 零件不存在），改数据让它好看是造假 |
| 把 109 个悬空引用「修复」成现有类 | 它们代表真实的产品需求（PDF 工具、图片缩放、会议纪要…），不是笔误 |
| 造一个万能的 `surface.generic` 兜底所有引用 | 会让 28 条需求全部假性满足，等于把缺口藏起来 |
| 面层加 `run` 的兼容层 | 范畴错误就该直接改掉，留兼容层只会让两套语义并存 |

---

## 6. 这个提案能带来什么

**不做这件事的现状**：面层 16 个类、体层 29 个类，各自有一个"运行"按钮，点了返回「执行完成」+ 随机耗时。用户看不出它们在干什么，因为**它们确实什么都没干**。

**做完阶段 1 + 阶段 2 之后**：

- 体层能回答「我这个体还缺哪几个零件，这些缺口记在哪条需求上」
- 面层能回答「我渲染了哪些区域、用了哪些数据、哪些槽位没数据」
- 两者都从「假装成功」变成「如实报缺口」

这比把 45 个类标成"真实"有意义得多——因为**诚实本身就是这个项目最贵的资产**。
