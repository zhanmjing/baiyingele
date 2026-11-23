# 面层管理页设计（Surface Management v0.1）

> 参考：
> - `surface-catalog.html`：SurfaceClass / SurfaceInstance 目录与绑定。
> - `surface-instance-visual.html`：SurfaceInstance 预览与 data/action bindings。
> - `panel-layer-visual.html`：PanelClass / PanelInstance anatomy。
> - `gesture-binding-surface.html`：GestureRecognizer × GestureBinding → AtomRef。
> - `launch-dock-surface.html`：CLaunch 式启动坞（tabs / tiles）。
>
> 目标：一个面层管理页统管 Surface / Panel / Gesture / Launch Dock；不只是目录，还能预览、看绑定、跳转目标实例。

---

## 0. 一句话结论

```text
surface-management.html
  = SurfaceClass / SurfaceInstance
  + PanelClass / PanelInstance
  + GestureBinding
  + Launch Dock
  + 预览 / 绑定 / Inspector
```

面层负责“呈现与交互”，不实现业务功能。  
SurfaceInstance 绑定数据/动作；Panel 是面板外壳；Gesture 绑定点/线实例；Launch Dock 是 surface instance 的启动坞形态。

---

## 1. 数据

| 区块 | 类 | 实例 |
|---|---:|---:|
| Surface | 16 SurfaceClass | 46 SurfaceInstance |
| Panel | 14 PanelClass | 37 PanelInstance |
| Gesture | — | 5 GestureBinding |
| Launch Dock | — | 5 tabs / 48 tiles |

Launch Dock：

```text
5 tabs：常用 / 开发 / 系统 / 工具 / 外网
48 tiles：23 flow + 25 point
```

Surface families：

```text
Input / Edit
Browse / Select
Visualize / Edit
Communicate
```

Panel groups：

```text
inspect / edit / ai / data / system
```

Gesture bindings：

```text
LDR → inst.site-github@r1   (flow, L2)
UD  → vpn.default.status@r1 (point, L0)
RL  → inst.workspace-dev@r3 (flow, L1)
DR  → open.terminal@r1      (point, L1)
DLU → inst.ensure-vpn-ask@r2(flow, L2)
```

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Surface Management  16/46 14/37 5 48                                   [设置] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [目录 16/46] [面板 14/37] [手势 5] [启动坞 48]                                │
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ SurfaceClass     │ 表单 · 输入/编辑                            │ Inspector    │
│ ▸ 表单            │ [预览] [复制实例]                            │ 契约/实例     │
│ ▸ 向导            │ ┌────────────────────────────────────────┐ │ data/action  │
│ ▸ 检查器          │ │ wireframe preview                       │ │ bindings     │
│ ...               │ └────────────────────────────────────────┘ │              │
│ SurfaceInstance  │ Bindings 表                                │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

四个视图共用三栏：

- 左：当前视图的类/实例/绑定/分页列表。
- 中：预览 + 绑定/明细表。
- 右：Inspector。

---

## 3. Surface 视图

```text
[目录 16/46]
```

### 3.1 左栏

- SurfaceClass 列表：icon、name、family、instance count、P0 badge。
- SurfaceInstance 列表：name、id、revision、status。
- `＋` 新建 SurfaceInstance。

点击类：

- 切换类。
- 选中该类的第一个实例。
- Inspector 更新。

### 3.2 中栏

Hero：

```text
SurfaceClass · family
name
summary
[▶ 预览] [⧉ 复制实例]
```

Stats：

```text
regions / slots / actions / instances / placement · revision / P0
```

Wireframe preview：

- 根据 `class.regions` 生成 header / body / footer 区域。
- body 中展示 `dataBindings` 的 slot + target。
- footer 中展示 `actionBindings` 的 slot，主按钮 primary。
- 顶部显示 placement、revision、instance name。

Contract grid：

```text
family
class
version
placement
revision
status
```

Bindings 表：

```text
slot
kind (store / command / runFlow)
target
data/action
```

### 3.3 Inspector

```text
SurfaceClass contract
  regions / slots / actions / states
SurfaceInstance
  id / placement / revision / status / data / action
Data Bindings
Action Bindings
[▶ 预览] [⧉ 复制] [⌫ 归档]
```

---

## 4. Panel 视图

```text
[面板 14/37]
```

### 4.1 左栏

- PanelClass 列表：icon/name/group/modes/instance count。
- PanelInstance 列表：label、content、mode、width、rev。

### 4.2 中栏

Hero：

```text
PanelClass · group
name
desc
[◧ 打开面板管理页 ↗] [▶ 预览] [⧉ 复制实例]
```

> 这里的面板 tab 是概览；完整 CRUD + 可视化工作台在 `panel-management.html`。

Panel anatomy：

```text
header
toolbar
body
footer
```

每层显示：

```text
content slot
instance content
class name
```

meta badges：

```text
states
behaviors
a11y
```

PanelInstance 表：

```text
Instance / Mode / Width / Content / State / Rev
```

### 4.3 Inspector

```text
PanelClass
  modes / regions / content / version
PanelInstance
  mode / width / state / rev
States
Behaviors
A11y
[▶ 预览] [⧉ 复制] [⌫ 归档]
```

---

## 5. Gesture 视图

```text
[手势 5]
```

### 5.1 左栏

GestureBinding 列表：

```text
pattern · name
target
kind: FlowInstance / PointInstance
effect
desc
```

### 5.2 中栏

> 这里的手势视图是概览；完整 CRUD、按需录制与点/线目标选择在 `gesture-management.html`。

Hero 的 `G 打开手势管理页 ↗` 进入完整手势管理页。

Gesture Pad：

- 显示当前 pattern 的轨迹（LDR / UD / RL / DR / DLU）。
- 预设按钮切换 pattern。
- 轨迹起点 cyan，终点 amber。
- 识别结果：

```text
KIND badge
name
target
effect
```

GestureBinding 表：

```text
Pattern / Kind / Name / Target / Effect / Action
```

### 5.3 Inspector

```text
pattern
kind
target
effect
desc
```

目标跳转：

- `inst.site-github@r1` → `line-management.html#flow.open-external-site/inst.site-github`
- `inst.site-youtube@r3` → `line-management.html#flow.open-external-site/inst.site-youtube`
- 未接入的 target → 占位。

动作：

```text
[▶ 识别] [⧉ 复制]
```

---

## 6. Launch Dock 视图

```text
[启动坞 48]
```

### 6.1 左栏

- Dock tabs：常用 / 开发 / 系统 / 工具 / 外网，显示每页 tile 数。
- 当前页 Tiles 列表：icon/name/kind/target/effect/hotkey。

### 6.2 中栏

> 这里的启动坞视图是概览；完整 Tab/Tile CRUD、拖拽排序与 Dock 外观设置在 `dock-management.html`。

Hero 的 `⌘ 打开启动坞管理页 ↗` 进入完整启动坞管理页。

CLaunch 式 dock preview：

```text
tabs
tile grid (8 columns)
page dots
```

Tile：

```text
icon
name
kind (flow/point)
```

点击 tile：

- 选中 tile。
- Inspector 更新。

Tiles 表：

```text
Tile / Kind / Target / Hotkey / Effect / Link
```

### 6.3 Inspector

```text
Dock
  tabs / tiles / flow / point
Selected Tile
  id / kind / target / effect / hotkey
```

目标跳转：

- `inst.site-github` / `inst.site-youtube` → line-management 的 open-external-site 实例。
- 其他 target → 占位。

动作：

```text
[▶ 预览] [⧉ 复制 Tile]
```

---

## 7. 与其他层管理页的跳转

| 面层对象 | 目标 | 跳转 |
|---|---|---|
| Gesture LDR | `inst.site-github@r1` | `line-management.html#flow.open-external-site/inst.site-github` |
| Gesture RL | `inst.workspace-dev@r3` | 占位（线层未实现） |
| Gesture UD / DR | point targets | 占位（点层未实现） |
| Dock GitHub | `inst.site-github@r1` | line-management open-external-site |
| Dock YouTube | `inst.site-youtube@r3` | line-management open-external-site |
| Dock 其他 | 未接入 target | 占位 |

原则：

```text
已实现 → 深链到对应管理页
未实现 → 占位，不生成死链
```

---

## 8. 管理动作

| 动作 | 对象 | 行为 |
|---|---|---|
| 新建 SurfaceInstance | SurfaceInstance | 复制当前实例为 draft / r1 |
| 复制 SurfaceInstance | SurfaceInstance | 深拷贝，新 id，r1，draft |
| 归档 SurfaceInstance | SurfaceInstance | status=archived |
| 预览 | Surface/Panel/Gesture/Dock | 模拟预览，toast |
| 复制 PanelInstance | PanelInstance | 深拷贝，新 label，r1 |
| 归档 PanelInstance | PanelInstance | status=archived |
| 复制 GestureBinding | GestureBinding | 新 pattern + 副本 |
| 复制 Dock Tile | Dock Tile | 深拷贝，新 id |

> 当前为内存态原型；持久化、版本 diff、真实预览渲染属于下一阶段。

---

## 9. 文件

| 文件 | 作用 |
|---|---|
| `surface-management.html` | 面层管理页（本设计） |
| `surface-management-v2.html` | 稳定快照 |
| `surface-catalog.html` | SurfaceClass / SurfaceInstance 目录参考 |
| `surface-instance-visual.html` | SurfaceInstance 预览参考 |
| `panel-layer-visual.html` | PanelClass / PanelInstance anatomy 参考 |
| `panel-management.html` | 完整面板管理页：CRUD + 工作台可视化 |
| `PANEL-MANAGEMENT.md` | 面板管理页设计文档 |
| `gesture-binding-surface.html` | GestureBinding 参考 |
| `gesture-management.html` | 完整手势管理页：CRUD + 按需录制 + 点/线映射 |
| `GESTURE-MANAGEMENT.md` | 手势管理设计文档 |
| `launch-dock-surface.html` | Launch Dock 参考 |
| `dock-management.html` | 完整启动坞管理页：Tab/Tile CRUD + 拖拽 + 外观 |
| `DOCK-MANAGEMENT.md` | 启动坞管理设计文档 |
| `SURFACE-MANAGEMENT.md` | 本文档 |

---

## 10. 已做校验

- Surface 16 类 / 46 实例
- Panel 14 类 / 37 实例
- Gesture 5 条（3 flow / 2 point）
- Launch Dock 5 tabs / 48 tiles（23 flow / 25 point）
- 四视图 runtime 均渲染通过：
  - surfaces
  - panels
  - gestures
  - dock
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 初始视图：surface.form / surface.settings.vpn

---

## 11. 优先级

### P0

- SurfaceClass / SurfaceInstance 列表
- Wireframe preview
- data/action bindings
- Panel anatomy
- Gesture Pad + GestureBinding
- Launch Dock preview
- Inspector

### P1

- 手势/启动坞目标深链
- 新建/复制/归档实例
- 四视图切换
- PanelInstance 表格选中
- Dock tab 切换

### P2

- 真实 surface 渲染器
- 绑定编辑
- 版本 diff
- 依赖图
- 持久化
- 手势录制
- Dock 拖拽排序

---

## 12. 一句话总结

**面层管理页把 Surface、Panel、Gesture、Launch Dock 放在同一个管理上下文里：**

```text
Surface  → 呈现什么
Panel    → 外壳怎么装
Gesture  → 手势触发什么
Dock     → 启动入口怎么排
```

已实现的目标：深链到对应管理页。  
未实现的目标：占位，不生成死链。
