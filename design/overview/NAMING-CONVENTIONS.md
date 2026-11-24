# 命名规范与不统一清单

> 状态：**调研，未实施**
> 触发：维护者提出「(point, runPoint, line, runFlow, surface, openPanel, body, assemble,
> field, runField) 可以统一为 `run_层名`，全体查一下这种不统一的情况」
> 所有数字均为实测

---

## 0. 结论先行

**`run_层名` 已经在代码里了，而且比设计文档更统一。**

`src/preload/index.ts` 用循环自动生成，新增一层不用改这个文件：

```ts
for (const key of LAYER_KEYS) {
  const suffix = layerMethodSuffix(key)
  layerApi[`run${suffix}`] = (payload) => ipcRenderer.invoke(`${key}:run`, payload)
}
```

产出：`runPoint` / `runLine` / `runSurface` / `runBody` / `runField`
IPC 通道：`point:run` / `line:run` / `surface:run` / `body:run` / `field:run`

**所以你举的那组不统一名字，来源是我写的设计文档，不是代码。**
`runFlow` / `openPanel` / `assemble` 是我在分组设计里随手写的，
和代码里已有的 `runLine` / `runSurface` / `runBody` 冲突 —— 这是我的错，应改回代码的写法。

**但顺着查下去，真的有六类不统一，其中两类会直接影响自动化。**

---

## 1. 已经统一的部分（别动）

| 项 | 现状 | 位置 |
|---|---|---|
| 层键 | `point` / `line` / `surface` / `body` / `field` | `src/shared/layerKeys.ts` |
| 中文名 | 点层 / 线层 / 面层 / 体层 / 场层 | `src/renderer/src/data.ts` |
| API 方法 | `run<Layer>` + `get<Layer>Catalog` + `<op><Layer>Instance` | 循环生成 |
| IPC 通道 | `<layer>:<op>` | `src/preload/index.ts` |
| 存储类 | `LayerStore` 一个泛型类管五层 | `src/main/layerStore.ts` |
| 执行契约 | `RunContext` / `RunOutcome` 与层无关 | `src/main/capabilities/_shared.ts` |

这六项是**真正的统一**，而且是**结构性统一**（一个循环、一个泛型类），
不是「大家都记得这么写」。

---

## 2. 六类不统一（按危害排序）

### 2.1 【高】类型层是 point 中心，五层共用一套 Point 类型

`src/shared/layerApi.ts`：

```ts
export interface LayerCatalogSnapshot {
  classes: PointClassSeed[]        // ← surface/body/field 也用它
  instances: PointInstanceRecord[] // ← 同上
}

// 五个 get<Layer>Runs 全部返回 PointRunRecord[]
[K in LayerKey as `get${Capitalize<K>}Runs`]: (limit?: number) => Promise<PointRunRecord[]>

// 五个 create/update/archive/restore/duplicate 全部返回 PointInstanceRecord
```

**后果**：类型检查能过，但语义是错的 —— 看到 `surface:runs` 返回 `PointRunRecord[]`
会以为拿错了层。而且想给某一层加专属字段时无处可加（加了会污染其他四层）。

**修法**：泛型化

```ts
export interface LayerCatalogSnapshot<C = LayerClassSeed, I = LayerInstanceRecord> {
  classes: C[]
  instances: I[]
}
type PointCatalog = LayerCatalogSnapshot<PointClassSeed, PointInstanceRecord>
type SurfaceCatalog = LayerCatalogSnapshot<SurfaceClassSeed, SurfaceInstanceRecord>
```

### 2.2 【高】line 层用 `flow` 当同义词，四套名字并存

同一层有四种叫法：

| 位置 | 用的是 | 应该是 |
|---|---|---|
| 层键 | `line` | ✅ |
| 中文名 | 线层 | ✅ |
| **`classLabel`（UI 显示）** | **`FlowClass`** | `LineClass` |
| 类型名 | `Line*` 7 个 **+ `Flow*` 2 个**（`FlowDeps`、`FlowNodeResult`） | 统一 `Line*` |
| 运行时文件 | **`flowRuntime.ts`** | `lineRuntime.ts`（对比 `fieldRuntime.ts`） |
| 内部函数 | **`runFlow`** | `runLineInstance` / `executeLine` |
| 数据文件 | `generatedLineProfiles.json` ✅ | ✅ |
| **数据文件里的键** | **`flow.screenshot-translate`** | 随类 id 统一后自动修 |
| **实例 id** | **`inst.ensure-vpn-ask@r2`**（五层里唯一不用类前缀的） | `line.ensure_vpn.ensure_vpn_ask@r2` |

**后果**：UI 上写着「FlowClass」，代码里是 `LineClass`，用户和开发者说的是两个词。
这是六类里**最容易让人误解的一类**，因为它直接出现在界面上。

### 2.3 【中】runner 命名：point 层叫 `capabilityRunner`

`src/main/index.ts`：

```ts
const runner =
  key === 'line'    ? lineRunner
  : key === 'field' ? fieldRunner
  : key === 'surface' || key === 'body' ? undefined   // ← 落到 mockRunner
  : capabilityRunner                                   // ← point 层
```

point 层的 runner 叫 `capabilityRunner`，其他层叫 `<layer>Runner`。
而且 surface/body 是 `undefined`（等于用 mock）—— 这个分支本身就是个信号：
**这两层还没有 runner**。

**修法**：改成 `pointRunner`，并让「没有 runner」变成显式配置而不是 `undefined` 兜底。

### 2.4 【中】能力 id 两种风格：21 个主题前缀 vs 5 个层前缀

26 个能力实现：

| 风格 | 数量 | 例子 |
|---|---:|---|
| 主题前缀（无层名） | **21** | `win.key.send`、`file.move`、`clipboard.write`、`notify.toast` |
| 层前缀 | **5** | `field.observe`、`field.guard`、`field.simulate`、`field.classify`、`field.prefill` |

实现文件名同样分裂：`win.key.send.ts` vs `field.observe.ts`。

**这不是错**（点的主题分组有意义），但它和 3 段 id 方案冲突：
新方案下类 id 是 `point.win_key_send`，那实现文件叫什么？

两个选择：

- **A**：文件名跟**类名**走，`win.key.send.ts` 不变，id 由生成器加 `point.` 前缀
- **B**：文件名跟 **id** 走，改成 `point.win_key_send.ts`（21 个文件重命名）

我倾向 **A**：文件名是给人看的，id 是给机器用的，两者不必一致 —— 但要在
`implemented.generated.ts` 里明确记录「文件 → id」的映射，别让人猜。

### 2.5 【低】surface 层的双模型命名

- catalog 里是 `surface.*`（16 个交互模式类）
- 渲染层 `generatedSurface.json` 里装的是 **`panelClasses` / `gestures` / `dockTabs` / `dockTiles`**
- **一个 surface 类都没装**

所以「`generatedSurface.json` 这个名字说 surface，内容是 panel/dock」——
文件名和行为不符。而且 surface 层没有 `surfaceRuntime.ts`（其他层都有 runtime 或 catalog）。

### 2.6 【我的责任】设计文档引入了新的一套名字

| 我写的 | 代码里已有的 | 应改为 |
|---|---|---|
| `runFlow` | `runLine` | `runLine` |
| `openPanel` | `runSurface` | `runSurface` |
| `assemble` | `runBody` | `runBody` |
| `runPoint` ✅ | `runPoint` | 不变 |
| `runField` ✅ | `runField` | 不变 |

**改法**：设计文档里的意图名全部对齐代码的 `run<Layer>`。

---

## 3. 统一规范表（建议作为标准）

| 位置 | 规范 | 例子 |
|---|---|---|
| 层键 | 小写单词 | `point` |
| 中文名 | 层名 + 「层」 | `点层` |
| `classLabel` | `<Layer>Class` | `PointClass` / **`LineClass`** |
| API 方法 | `<verb><Layer>` | `runPoint` / `getSurfaceCatalog` |
| IPC 通道 | `<layer>:<op>` | `point:run` |
| 类型前缀 | `<Layer>` | `LineDeps`（不是 `FlowDeps`） |
| runner 变量 | `<layer>Runner` | `pointRunner`（不是 `capabilityRunner`） |
| 类 id | `<layer>.<class>` | `point.win_key_send` |
| 实例 id | `<layer>.<class>.<instance>@r<rev>` | `point.win_key_send.copy@r1` |
| 数据文件 | `generated<Layer>*.json` | `generatedLineProfiles.json` |
| 数据文件的键 | 与类 id 一致 | `line.ensure_vpn`（不是 `flow.ensure-vpn`） |
| 实现文件 | 跟类名，不跟 id | `win.key.send.ts` |

---

## 4. 一个必须保留的例外：动词统一，契约分层

维护者要的是 `run_层名` 统一。这完全可以做，但**不能让五层的返回值假装是同一件事**：

| 层 | 动词（统一） | 实际语义 |
|---|---|---|
| point | `runPoint` | 执行一个原子能力 |
| line | `runLine` | 执行一张数据流图，内部逐个调用点层 |
| surface | `runSurface` | **渲染**并产出可用意图（不产生副作用） |
| body | `runBody` | **装配检查**：零件齐不齐、缺什么 |
| field | `runField` | 产出建议 / 落地项 |

**统一的是「入口形状」，不是「内部语义」。**

理由：自动化需要「所有层都能被同一个循环调起来」，
但用户需要知道「点这个 surface 不会真的跑起来」。
两者可以同时满足 —— 用同一个 `run<Layer>` 入口，返回**按层区分的 `kind` 字段**：

```ts
interface RunResult {
  ok: boolean
  layer: LayerKey
  kind: 'execute' | 'render' | 'assemble' | 'advise'   // ← 语义靠这个区分
  ...
}
```

这样 `runSurface` 的 `kind` 永远是 `'render'`，不会有人误以为它执行了。

---

## 5. 改动清单（按收益/风险排序）

| 优先级 | 改动 | 涉及 | 风险 |
|---|---|---|---|
| **P0** | 设计文档里的意图名对齐代码（去掉 `runFlow`/`openPanel`/`assemble`） | 3 份 md | 无 |
| **P0** | `classLabel: 'FlowClass'` → `'LineClass'` | 1 行 | 无（UI 文案） |
| **P1** | `Flow*` 类型 → `Line*`（`FlowDeps`、`FlowNodeResult`） | 2 个类型 + 引用 | 低 |
| **P1** | `flowRuntime.ts` → `lineRuntime.ts`；`runFlow` → `runLineInstance` | 1 文件 + 引用 | 低 |
| **P1** | `capabilityRunner` → `pointRunner` | 1 处 | 低 |
| **P2** | `layerApi.ts` 泛型化，去掉 point 中心类型 | 1 文件 + 声明 | **中**（类型面广） |
| **P2** | `RunResult` 加 `layer` + `kind` 字段 | 契约 + 5 层实现 | 中 |
| **P3** | 实例 id 统一（随 3 段 id 迁移一起做） | 287 条 | 高（一次做完） |
| **P3** | 能力文件名是否跟 id 走 | 21 个文件 | 低（但收益也低） |

**P0 + P1 加起来不到 10 处改动，就能消掉「UI 说 FlowClass、代码说 LineClass」
和「设计文档说 runFlow、代码说 runLine」这两个最伤人的不统一。**

---

## 6. 明确不做的事

| 不做 | 理由 |
|---|---|
| 把 `line` 改名叫 `flow`（或反过来） | 层键 `line` 已用在 5 处结构性位置（`LAYER_KEYS`、IPC、文件名），改名成本远超收益；把 `flow` 收敛到 `line` 更划算 |
| 给点层的 `win.` / `file.` 主题加上 `point.` 前缀并改文件名 | 主题分组对人有意义；3 段 id 已经用第一段表达了层 |
| 五层用同一个 `RunResult` 语义 | surface 的 `run` 不产生副作用、body 的 `run` 只是装配检查，混为一谈会误导用户 |
| 一次性重命名 287 个实例 id 之外的任何东西 | id 迁移已经要动 424 处引用，不要再叠加重命名 |
| 保留 `capabilityRunner` 这个名字 | 它是五层里唯一的例外，没有保留价值 |
