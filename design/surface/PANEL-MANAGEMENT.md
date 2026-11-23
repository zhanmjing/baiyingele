# 面板管理页设计（Panel Management v0.1）

> 参考：`panel-layer-visual.html` 的面板工作台与 anatomy；`surface-instance-visual.html` 的实例预览；`surface-catalog.html` 的面层目录；`gesture-binding-surface.html` / `launch-dock-surface.html` 的实例管理上下文。
>
> 目标：面板管理页不仅看图，还要能 **增删改查 + 可视化**。

---

## 0. 一句话结论

```text
panel-management.html
  = PanelClass / PanelInstance 列表
  + Panel 工作台可视化
  + 6 种 placement
  + width / anatomy / state
  + 新建 / 编辑 / 复制 / 删除
```

面板管理页是**可编辑的管理页**，不是只读 anatomy。

---

## 1. 数据

```text
PanelClass       14
PanelInstance    37
modes             6
groups            5
```

Groups：

```text
inspect / edit / ai / data / system
```

Modes：

```text
right / left / bottom / floating / modal / sheet
```

示例：

```text
panel.inspector
  point · right · 380px
  flow-slot · right · 400px
  body-manifest · right · 440px
```

---

## 2. 三栏结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Panel Management  14 PanelClass 37 PanelInstance 5 groups  [←面层管理] [设置] │
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ PanelClass       │ Inspector Panel                             │ Inspector    │
│ 搜索             │ [编辑类] [＋实例] [删除类]                   │ 契约          │
│ ▸ Inspector      │ [right][left][bottom][floating][modal][sheet]│ 实例          │
│ ▸ Settings       │ width 380px · instance · anatomy · state    │ 操作          │
│ ▸ Command        │ ┌────────────────────────────────────────┐ │              │
│ ...              │ │ 工作台 + Panel shell 实时预览            │ │              │
│ PanelInstance    │ └────────────────────────────────────────┘ │              │
│ ▸ point          │ Panel Contract                              │              │
│ ▸ flow-slot      │                                            │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

---

## 3. 左栏：PanelClass / PanelInstance

### 3.1 搜索

```text
panel / content / instance
```

过滤：

- class id / name / desc / group / content
- instance label / content

### 3.2 PanelClass

每项：

```text
icon / name
id
group
modes
instance count
```

操作：

```text
＋ 新建 PanelClass
```

点击：

- 选中类。
- 自动选第一个实例。
- 工作台 + Inspector 更新。

### 3.3 PanelInstance

每项：

```text
label / rev
content
mode · width
```

操作：

```text
＋ 新建 PanelInstance
```

点击：

- 选中实例。
- mode/width 同步到工作台。
- Inspector 更新。

### 3.4 重置

```text
↺ 重置示例数据
```

恢复 14 类 / 37 实例。

---

## 4. 中栏：可视化工作台

### 4.1 Hero 动作

```text
[✎ 编辑类]
[＋ 实例]
[⌫ 删除类]
```

### 4.2 工具栏

```text
[right] [left] [bottom] [floating] [modal] [sheet]
width [300 — 720] 380px
instance select
[ ] anatomy
state: ready / loading / empty / error / streaming / needsApproval / blocked
[reset view]
```

### 4.3 工作台

```text
┌────────────────────────────────────────────────────────────┐
│ fake sidebar │ fake main workspace                         │
│              │  ┌───────────────────────────────────────┐  │
│              │  │ Panel shell                           │  │
│              │  │ header / toolbar / body / footer       │  │
│              │  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

Panel shell 随 mode 改变位置：

| mode | 位置 |
|---|---|
| right | 右侧 docked，全高 |
| left | 左侧 docked，全高 |
| bottom | 底部 docked，245px |
| floating | 右下浮动，宽 `--pw` |
| modal | 居中 modal + backdrop |
| sheet | 底部 sheet + backdrop |

width 滑杆：

- 300 – 720 px。
- 实时更新 `--pw`。
- footer 显示 `380px · r3`。

### 4.4 Anatomy

打开 `anatomy`：

- header / toolbar / body / footer 显示虚线 outline + 标签。
- 用 `data-region` 标注。

### 4.5 State 预览

| state | 内容 |
|---|---|
| ready | 正常内容 |
| loading | skeleton |
| empty | empty state + Run upstream |
| error | error + Retry |
| streaming | 流式消息 |
| needsApproval | Risk + diff + Approve/Deny |
| blocked | error/blocked |

### 4.6 内容渲染器

按 `PanelClass` 的 id 渲染不同 wireframe：

```text
inspector     → selection / params / bindings / save
settings      → General / Advanced / save
command       → search + command list
run-history   → filter chips + run rows
artifact      → preview/source/versions + code
chat          → messages + prompt
approval      → risk + diff + approve/deny
notifications → notification rows
launcher      → tile grid
dashboard     → KPI cards + trend
diff          → split diff + accept/revert
preview       → preview area
trace         → tool call rows
console       → log/terminal
```

---

## 5. 右栏 Inspector

### 5.1 PanelClass

```text
id / name / version
group / status
modes / regions / content
instances
states
behaviors
a11y
[✎编辑] [＋实例] [⌫删除]
```

### 5.2 PanelInstance

```text
label / rev
mode / width / state
content
[✎编辑] [⧉复制] [⌫删除]
```

---

## 6. 增删改查

### 6.1 PanelClass

| 操作 | 行为 |
|---|---|
| 新建 | modal：id/name/icon/group/version/status/desc/modes/regions/states/behaviors/a11y/content |
| 编辑 | 同一 modal，id 只读；保存后更新 |
| 删除 | confirm；级联删除该类全部实例 |
| 查询 | 左栏搜索 + 类/实例列表 |
| 重置 | 恢复示例数据 |

### 6.2 PanelInstance

| 操作 | 行为 |
|---|---|
| 新建 | modal：label/mode/width/state/content/data/actions |
| 编辑 | 同一 modal；保存后 rev +1 |
| 复制 | 深拷贝，新 label，rev=1，status=draft |
| 删除 | confirm；从类实例列表移除 |
| 查询 | 左栏列表 / instance select |

### 6.3 持久化

```text
localStorage: baiying.panelManager.v1
```

保存：

```json
{
  "classes": [...],
  "savedAt": "..."
}
```

重置后覆盖本地修改。

> 原型持久化只在当前浏览器；正式版接 registry / body manager。

---

## 7. 与面层管理页的关系

`surface-management.html` 的 **面板** tab 是总览：

- PanelClass / PanelInstance 列表概览。
- Panel anatomy 预览。
- 「◧ 打开面板管理页 ↗」按钮。

`panel-management.html` 是完整面板管理页：

- 增删改查。
- 6 modes + width + anatomy + state 可视化。
- 工作台实时预览。

```text
Surface Management
  └─ 面板 tab → panel-management.html
```

---

## 8. 文件

| 文件 | 作用 |
|---|---|
| `panel-management.html` | 面板管理页（本设计） |
| `panel-management-v2.html` | 稳定快照 |
| `panel-layer-visual.html` | 面板工作台 / anatomy 参考 |
| `surface-management.html` | 面层管理页，面板 tab 链接到本页 |
| `surface-instance-visual.html` | SurfaceInstance 预览参考 |
| `PANEL-MANAGEMENT.md` | 本文档 |

---

## 9. 已做校验

- PanelClass 14 / PanelInstance 37
- 5 groups / 6 modes
- 初始：`panel.inspector / point / right / 380`
- 6 modes 渲染通过：
  - right / left / bottom / floating / modal / sheet
- state 渲染通过：
  - ready / loading / empty / error / streaming / needsApproval / blocked
- anatomy 开关通过
- 新建 PanelClass 通过（14 → 15）
- 编辑 PanelClass 名称通过
- 新建 PanelInstance 通过（mode/width 同步）
- 编辑 PanelInstance 通过（rev +1）
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 10. 优先级

### P0

- PanelClass / PanelInstance 列表
- 工作台可视化
- 6 modes + width + anatomy + state
- 新建 / 编辑 / 复制 / 删除
- 搜索
- Inspector

### P1

- localStorage 持久化
- 重置示例数据
- 实例复制
- instance select 同步
- 内容 wireframe 分类

### P2

- 真实 React/HTML 渲染器
- 拖拽 resize
- 多实例对比
- 版本 diff
- 面板依赖图
- registry 同步

---

## 11. 一句话总结

**面板管理页 = 可编辑的 PanelClass / PanelInstance 管理 + 可切换 placement 的工作台可视化。**

```text
左：类/实例
中：可视化工作台 + 6 modes + width + anatomy + state
右：契约 + 实例 + 增删改查
```

不是只读 anatomy；增删改查和可视化都在同一页完成。
