# 启动坞管理页设计（Dock Management v0.1）

> 参考：`launch-dock-surface.html` 的 CLaunch 式启动坞；`surface-management.html` 的 Launch Dock 视图。
>
> 目标：启动坞不只预览，还能编辑 tabs / tiles / 快捷键 / 目标映射 / Dock 外观，并支持拖拽排序。

---

## 0. 一句话结论

```text
dock-management.html
  = CLaunch 式 Dock 预览
  + Tab CRUD
  + Tile CRUD
  + 拖拽排序
  + 点层 / 线层目标映射
  + Dock 外观设置
```

启动坞是 CLaunch 式：顶部 tabs，分页 tile grid，底部 page dots，tile 带图标、名称、快捷键、目标实例。

---

## 1. 数据

```text
Tabs        5
Tiles      48
flow       23
point      25
mapped      5
占位       43
```

Tabs：

```text
常用 12
开发  8
系统 10
工具  8
外网 10
```

点层目标：

```text
32 PointInstance（13 PointClass）
```

线层目标：

```text
8 FlowInstance（4 FlowClass）
```

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Dock Management  5 tabs 48 tiles 23 flow 25 point 5 mapped 43 占位 [←面层] [设置]│
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ Launch Dock Tabs │ CLaunch 式启动坞                            │ Inspector    │
│ 搜索             │ [常用][开发][系统][工具][外网]               │ Tile         │
│ ▸ 常用 12        │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │ Dock 设置    │
│ ▸ 开发 8         │ │GH│ │▶ │ │VPN│ │VS│ │>_│ │文│              │              │
│ ...              │ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘              │              │
│ Tiles 12         │ ● ○ ○ ○ ○                                  │              │
│ ▸ GitHub         │ Tiles 表                                   │              │
│ ▸ YouTube        │                                            │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

---

## 3. 左栏

### 3.1 搜索

```text
tile / target / hotkey / kind / effect
```

### 3.2 Tabs

每个 tab：

```text
name
id
tile count
[✎ 编辑]
[⌫ 删除]
```

操作：

```text
＋ 新建 Tab
```

删除 tab：

- confirm。
- 级联删除该 tab 的全部 tiles。
- 至少保留一个 tab。

### 3.3 Tiles

当前 tab 的 tile 列表：

```text
icon / name
kind
targetLabel / target
effect · hotkey
```

操作：

```text
＋ 新建 Tile
```

点击：

- 选中 tile。
- 中间 Dock 预览高亮。
- 右侧 Inspector 更新。

### 3.4 重置

```text
↺ 重置示例启动坞
```

恢复 5 tabs / 48 tiles / 默认 Dock 设置。

---

## 4. 中栏：CLaunch 式 Dock

### 4.1 Hero

```text
CLaunch 式启动坞
分页、Tile、快捷键、拖拽排序、目标映射
[＋ Tile] [＋ Tab] [↺ 重置]
```

### 4.2 Dock Preview

```text
┌────────────────────────────────────────────┐
│ ▣ CLaunch   [常用][开发][系统][工具][外网]  │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐             │
│ │GH│ │▶ │ │VPN│ │VS│ │>_│ │文│             │
│ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘             │
│ ● ○ ○ ○ ○                                  │
└────────────────────────────────────────────┘
```

Tile 内容：

```text
映射状态点
hotkey 角标
icon
name
sub/target
```

状态点：

```text
绿色 = mapped
琥珀 = placeholder
```

### 4.3 拖拽排序

- Tile `draggable=true`。
- 拖动时 `dragging` 半透明。
- 目标 tile 显示 `drop-target`。
- drop 后重排当前 tab 的 `TILES` 顺序。
- 保存到 localStorage。

### 4.4 Tiles 表

```text
Tile / Kind / Target / Hotkey / Effect / Status / Action
```

Status：

```text
mapped
占位
```

Action：

```text
打开目标实例 ↗
```

---

## 5. 右栏 Inspector

### 5.1 Tile

```text
icon / name
kind
targetLabel / target / atomRef
effect
hotkey
status
[打开目标实例 ↗]
[✎编辑] [⧉复制] [⌫删除]
```

### 5.2 Dock Settings

```text
tile size   [48 — 86] 64px
columns     [4 — 8] 6
gap         [2 — 16] 6
theme       dark / light
[ ] labels
[ ] sub
```

修改即时反映到 Dock 预览，并保存。

---

## 6. Tab / Tile CRUD

### 6.1 Tab

| 操作 | 行为 |
|---|---|
| 新建 | modal：id / name |
| 编辑 | modal：name；id 只读 |
| 删除 | confirm；级联删除该 tab 的 tiles；至少保留一个 tab |
| 切换 | 点击 tab；重置 tile 选择 |

### 6.2 Tile

| 操作 | 行为 |
|---|---|
| 新建 | modal：name / icon / kind / effect / hotkey / tab / target |
| 编辑 | modal；保存更新 |
| 复制 | 深拷贝，新 id，name + 副本 |
| 删除 | confirm |
| 移动 | 编辑 tile 时改 tab |
| 排序 | Dock 预览中拖拽 |
| 目标 | 点层 32 / 线层 8 实例选择 |

### 6.3 目标映射

点层：

```text
classId / instanceId
atom-catalog-management.html#classId/instanceId
```

线层：

```text
flowId / instanceId
line-management.html#flowId/instanceId
```

Tile 保存字段：

```json
{
  "name": "GitHub",
  "icon": "GH",
  "kind": "flow",
  "effect": "L2",
  "hotkey": "1",
  "tab": "common",
  "target": "inst.site-github@r1",
  "targetKind": "line",
  "targetId": "line:flow.open-external-site/inst.site-github",
  "targetLabel": "打开外网网站 / GitHub",
  "href": "line-management.html#flow.open-external-site/inst.site-github"
}
```

---

## 7. 持久化

```text
localStorage: baiying.dockManager.v1
```

保存：

```json
{
  "tabs": [...],
  "tiles": [...],
  "settings": {...},
  "savedAt": "..."
}
```

正式版接 dock registry / surface binding store。

---

## 8. 与面层管理页的关系

`surface-management.html` 的 **启动坞** tab 是概览：

- CLaunch Dock 预览
- 5 tabs / 48 tiles
- tile 表
- `⌘ 打开启动坞管理页 ↗`

完整编辑在：

```text
dock-management.html
```

返回：

```text
Dock Management → ← 面层管理 → surface-management.html#dock
```

---

## 9. 文件

| 文件 | 作用 |
|---|---|
| `dock-management.html` | 启动坞管理页 |
| `dock-management-v2.html` | 稳定快照 |
| `DOCK-MANAGEMENT.md` | 本文档 |
| `launch-dock-surface.html` | CLaunch 式启动坞参考 |
| `surface-management.html` | 面层管理页，启动坞 tab 链接本页 |
| `atom-catalog-management.html` | 点层目标深链 |
| `line-management.html` | 线层目标深链 |

---

## 10. 已做校验

- Tabs 5 / Tiles 48
- flow 23 / point 25
- mapped 5 / 占位 43
- Point targets 32
- Line targets 8
- 初始 active tab：common
- 初始 selected tile：github
- Dock preview 渲染 12 个 common tiles
- Draggable tile 生成
- Dock Settings 渲染
- 编辑 Tile 名称保存通过
- 新建 Tab（5 → 6）通过
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 11. 优先级

### P0

- CLaunch Dock 预览
- Tab / Tile 列表
- 新建 / 编辑 / 删除 Tab
- 新建 / 编辑 / 复制 / 删除 Tile
- 点层 / 线层目标选择
- 拖拽排序
- Dock 外观设置

### P1

- localStorage 持久化
- 重置示例
- hotkey 编辑
- theme light/dark
- tile size / columns / gap
- page dots

### P2

- 跨 tab 拖拽
- Tab 拖拽排序
- tile 图标库
- 导入/导出
- 快捷键冲突检测
- 真实 CLaunch 启动器集成

---

## 12. 一句话总结

**启动坞管理页 = CLaunch 式 Dock 预览 + Tab/Tile CRUD + 拖拽排序 + 点层/线层目标映射 + 外观设置。**

```text
左：tabs / tiles
中：CLaunch Dock + 拖拽 + 分页
右：Tile Inspector + Dock Settings
```

不是只读预览；启动坞可以真正编辑。
