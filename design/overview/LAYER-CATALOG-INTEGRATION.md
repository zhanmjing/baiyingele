# Settings Workspace：设置页只保留设置，管理跳到独立管理页（v0.3）

> 目标：点/线/面/体/场各层设置页只保留“设置”；不再有“管理”tab，也不拆“功能类/实例”tab。
>
> 结论：设置页顶部放一个 **管理页** 跳转卡片，跳到独立管理页：
>
> `layer-management.html#<layer>`
>
> 管理页负责类/实例合并浏览；`atom-catalog.html` 继续做点层深度管理。

---

## 0. 一句话结论

```text
Settings Workspace
├─ General
├─ Point
│  └─ 设置          [管理页 ↗] → atom-catalog-management.html
├─ Line
│  └─ 设置          [管理页 ↗] → line-management.html
├─ Surface
│  └─ 设置          [管理页 ↗] → surface-management.html
├─ Body
│  └─ 设置          [管理页 ↗] → body-management.html
├─ Field
│  └─ 设置          [管理页 ↗] → field-management.html
└─ Info
```

- 设置页：只有设置，没有管理 tab，没有功能类/实例 tab。
- 管理页：独立页面，类 + 实例合并表。
- 点层深度管理：`atom-catalog.html` / `atom-catalog-management.html`。

---

## 1. 各层设置页

| 层 | 设置页 | 管理页跳转 |
|---|---|---|
| Point | 13 类 / 32 实例对应的运行时、效果、registry、secrets 设置 | `atom-catalog-management.html` |
| Line | flow 执行、重试、闸门、trace、scheduler | `line-management.html` |
| Surface | 布局、面板、交互、动效、可访问性、locale | `surface-management.html` |
| Body | 更新、信任、权限、数据保留、隔离 | `body-management.html` |
| Field | provider/model、context、autonomy、safety、cost | `field-management.html` |

每层只有：

```text
设置
```

不再有：

```text
功能类 tab
实例 tab
管理 tab
```

管理入口是一个跳转卡片：

```text
┌────────────────────────────────────────────────────────────┐
│ ↗  管理页                                                   │
│    类与实例的 CRUD、运行、批量操作与资源加载在独立管理页完成。 │
│                                      [打开管理页 ↗]         │
└────────────────────────────────────────────────────────────┘
```

点击行为：

```ts
const MANAGER_ROUTES = {
  point: 'atom-catalog-management.html',
  line: 'line-management.html',
  surface: 'surface-management.html',
  body: 'body-management.html',
  field: 'field-management.html'
};
window.location.href = MANAGER_ROUTES[state.sectionId];
```

- 点层：完整点层管理页。
- 线层：线层管理页（FlowClass / FlowInstance / 数据流图 / 点层实例深链）。
- 面/体/场：通用层管理页。

---

## 2. 各层数据

| 层 | 功能类 | 实例 |
|---|---:|---:|
| Point | 13 | 32 |
| Line | 13 | 32 |
| Surface | 16 | 46 |
| Body | 29 | 82 |
| Field | 29 | 124 |
| **合计** | **100** | **316** |

这些数据不在设置页展开；全部在管理页中展示。

---

## 3. 独立管理页

文件：`layer-management.html`

```text
┌────────────────────────────────────────────────────────────────────┐
│ Layer Management   [点层] [线层] [面层] [体层] [场层]   搜索  [设置] │
├───────────────────────────────────────┬────────────────────────────┤
│ 管理                                  │ Inspector                  │
│ ┌───────────────────────────────────┐ │ win.key.send               │
│ │ ▾ win.key.send · hotkey · 5 inst  │ │ 发送快捷键…                 │
│ │   └ i-copy@r1 · stable · r1       │ │ 13 类 / 32 实例             │
│ │   └ i-paste@r1 · stable · r1      │ │ [打开点层完整管理页 ↗]      │
│ ├───────────────────────────────────┤ │ Instances · 5              │
│ │ ▸ win.window.control · 4 inst     │ │ …                          │
│ └───────────────────────────────────┘ │                            │
└───────────────────────────────────────┴────────────────────────────┘
```

### 3.1 层切换

顶部 tabs：

```text
点层 / 线层 / 面层 / 体层 / 场层
```

每个 tab 显示：

```text
类数 / 实例数
```

切换层：

- 重置选中类/实例。
- 默认展开第一个类。
- 更新 hash：`#point` / `#line` / …。

### 3.2 合并管理表

类行：

```text
class id / name
group
status
effect
instance count
summary
```

实例行（缩进）：

```text
instance id / name
status
revision
detail
```

交互：

- 点击类行：选中类，展开/收起实例。
- 点击实例行：选中实例，右侧 Inspector。
- 展开全部类 / 收起全部。
- 搜索类/实例/group/detail。

### 3.3 右侧 Inspector

```text
class id / name / version
group / status / effect / instances / priority
summary
instance list
selected instance detail
```

点层额外按钮：

```text
打开点层完整管理页 ↗ → atom-catalog-management.html
```

其他层：

```text
CRUD 在 registry / body manager 中完成
```

### 3.4 返回设置

管理页右上角：

```text
⚙ 设置 → settings-workspace-settings-only.html
```

---

## 3S. 面层管理页

文件：`surface-management.html`

```text
Surface Management
├─ SurfaceClass        16
├─ SurfaceInstance     46
├─ PanelClass          14
├─ PanelInstance       37
├─ GestureBinding      5
└─ Launch Dock         5 tabs / 48 tiles
```

四个视图：

```text
[目录 16/46] [面板 14/37] [手势 5] [启动坞 48]
```

- 目录：SurfaceClass / SurfaceInstance 列表 + 线框预览 + data/action bindings。
- 面板：PanelClass / PanelInstance 列表 + anatomy 预览；完整 CRUD + 工作台可视化在 `panel-management.html`。
- 手势：Gesture Pad + GestureBinding 表（5 条）。
- 启动坞：CLaunch 式 Dock 预览 + 5 tabs / 48 tiles。

点/线实例链接：

- 手势/启动坞中的 `inst.site-github`、`inst.site-youtube` → `line-management.html#flow.open-external-site/...`。
- 未接入的 target 显示占位。

详见：`SURFACE-MANAGEMENT.md`。

---

## 3A. 线层管理页

文件：`line-management.html`

```text
Line Management
├─ FlowClass     4
├─ FlowInstance  8
├─ FlowNode      20 / Edge 16
├─ Point slots   17（4 linked / 13 占位符）
├─ Gate          2
└─ Subflow       1
```

三栏：

- 左：FlowClass 列表 + FlowInstance 列表。
- 中：数据流图 + Point 绑定表。
- 右：Inspector。

点层实例：

```text
已实现 → 打开实例设置 ↗ → atom-catalog-management.html#classId/instanceId
未实现 → 占位符 · 待接入（不生成死链）
```

线层深链示例：

```text
atom-catalog-management.html#win.ocr.read/i-ocr-auto
atom-catalog-management.html#win.clipboard.get/i-clip-text
atom-catalog-management.html#win.open/i-open-github
```

详见：`LINE-MANAGEMENT.md`。

---

## 4. 设置页 vs 管理页

| 问题 | 设置页 | 管理页 |
|---|---|---|
| 改 timeout / concurrency | ✅ | — |
| 改 effect / permission policy | ✅ | — |
| 改 secret / build / compile | ✅ | — |
| 看类/实例清单 | — | ✅ |
| 展开类看实例 | — | ✅ |
| 看 revision / detail | — | ✅ |
| 新建/编辑/复制/运行/归档 | — | 点层 → atom-catalog；其他层 → manager |
| 批量操作 / 加载 | — | 点层 → atom-catalog |

```text
设置页回答“允许什么”
管理页回答“有什么类与实例、状态与 revision 如何”
点层深度管理页回答“怎么新建/编辑/运行/归档/加载”
```

---

## 5. 搜索

设置页搜索覆盖：

```text
settings
PointClass / PointInstance
FlowClass / FlowInstance
SurfaceClass / SurfaceInstance
BodyClass / BodyInstance
AIClass / AIInstance
```

跳转规则：

- setting → 当前设置页对应 section，并高亮。
- class/instance → 独立管理页：

```ts
window.location.href = `layer-management.html#${layer}/${classId}/${instanceId?}`;
```

管理页根据 hash 自动选中层、类、实例并展开。

---

## 6. 文件

| 文件 | 作用 |
|---|---|
| `settings-workspace-settings-only.html` | 设置页稳定快照：只有设置 + 管理页跳转 |
| `settings-workspace-layers.html` | 同版本，默认打开点层设置 |
| `settings-workspace.html` | 通用设置版 |
| `surface-management.html` | 面层管理页：Surface/Panel/Gesture/Launch Dock |
| `gesture-management.html` | 手势管理页：CRUD + 按需录制 + 点/线映射 |
| `dock-management.html` | 启动坞管理页：Tab/Tile CRUD + 拖拽 + 外观 |
| `body-management.html` | 体层管理页：BodyClass/Instance + Composition + Lifecycle + Settings |
| `field-management.html` | 场层管理页：FieldClass/Instance + AIClass/Instance + Runs + Policy |
| `panel-management.html` | 完整面板管理页：CRUD + 工作台可视化 |
| `layer-management.html` | 通用层管理页：体/场类实例合并表 |
| `line-management.html` | 线层管理页：FlowClass / FlowInstance / 数据流图 / 点层深链 |
| `atom-catalog.html` | 点层深度管理页 |
| `atom-catalog-management.html` | 点层管理稳定快照 |
| `SETTINGS-INTERFACE-DESIGN.md` | 设置总设计 |
| `ATOM-CATALOG-MANAGEMENT.md` | 点层管理页设计 |

---

## 7. 已做校验

- 设置页 layer tab 数：**0**（只有设置内容）
- 每层设置页出现管理页跳转卡片：✅
- 管理页层 tabs：5
- 管理页合并表：类行 + 实例行
- 通用管理页 hash 路由：`#point/class/instance`
- 面层管理页 16 SurfaceClass / 46 SurfaceInstance / 14 PanelClass / 37 PanelInstance / 5 GestureBinding / 48 Dock tiles
- 体层管理页 29 BodyClass / 82 BodyInstance / 9 P0 / 7 categories / 5 tabs
- 场层管理页 23 FieldClass / 78 FieldInstance / 29 AIClass / 124 AIInstance / 4 tabs
- 线层管理页 4 FlowClass / 8 FlowInstance / 17 point slots / 4 linked / 13 占位符
- 点层深链测试：`#win.ocr.read/i-ocr-auto` 选中实例
- 设置页搜索 class/instance → 管理页 hash
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 数据：100 classes / 316 instances

---

## 8. 优先级

### P0

- 设置页移除管理/功能类/实例 tabs
- 设置页管理页跳转卡片
- 独立管理页五层 tabs
- 合并管理表
- 线层管理页（数据流图 + Point 绑定表 + 深链 + 占位符）
- Inspector
- hash 路由

### P1

- 设置页搜索跳转管理页
- 管理页搜索
- 展开全部/收起全部
- 点层跳转 atom-catalog
- 返回设置

### P2

- 其他层专属 manager
- 管理页批量操作
- 类/实例版本 diff
- 依赖图
- 审计日志

---

## 9. 一句话总结

**设置页只保留设置；管理页独立存在。**

```text
Settings Workspace  → 设置 + 管理页跳转
Layer Management    → 类/实例合并管理
Atom Catalog        → 点层深度管理
```

不再在设置页里重复管理 tab，也不再把功能类/实例拆成两个 tab。
