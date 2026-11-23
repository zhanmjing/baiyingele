# 手势管理页设计（Gesture Management v0.1）

> 目标：手势编辑（增删改查），手势识别按需启用，识别完成后自动关闭；手势可映射点层实例或线层实例。
>
> 参考：`gesture-binding-surface.html`（GestureRecognizer × GestureBinding × AtomRef）、`surface-management.html` 的 Gesture 视图、点层/线层管理页的实例深链。

---

## 0. 一句话结论

```text
gesture-management.html
  = GestureBinding CRUD
  + 按需手势录制
  + 点层 / 线层目标选择
  + 映射可视化
  + 深链
```

手势识别不是常驻服务：默认关闭，只有新建/重录手势时才启动；抬手识别后立即关闭，再进入目标映射。

---

## 1. 数据

```text
GestureBinding     5
PointInstance     32
LineInstance       8
```

现有手势：

```text
LDR → 打开 GitHub       LINE   mapped
UD  → 检测 VPN 状态     POINT  placeholder
RL  → 开发工作区        LINE   placeholder
DR  → 打开终端          POINT  placeholder
DLU → 确保 VPN          LINE   placeholder
```

统计：

```text
5 bindings
1 mapped
2 point
3 line
recorder off
```

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Gesture Management  5 bindings 1 mapped 2 point 3 line recorder off [←面层] [设置]│
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ GestureBinding   │ LDR · 打开 GitHub                          │ Inspector    │
│ 搜索             │ [✎编辑] [●重录] [⧉复制] [⌫删除]              │ 绑定          │
│ ▸ LDR            │ [Gesture] → [Target Layer] → [AtomRef]     │ 目标          │
│ ▸ UD             │ ┌────────────────────────────────────────┐ │ 操作          │
│ ▸ RL             │ │ 手势识别未启用                          │ │              │
│ ▸ DR             │ │ 只在新建/重录时启动                     │ │              │
│ ▸ DLU            │ │ [＋ 新建手势（启用识别）]                │ │              │
│                  │ └────────────────────────────────────────┘ │              │
│                  │ GestureBinding 表                           │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

---

## 3. 左栏

### 3.1 搜索

```text
pattern / name / target / kind / effect / desc
```

### 3.2 GestureBinding 列表

每项：

```text
pattern · name
target
kind: PointInstance / FlowInstance
mapped / placeholder
```

操作：

```text
＋ 新建手势（启用识别）
↺ 重置示例手势
```

点击：

- 选中手势。
- 中间映射链 + 绑定表 + Inspector 更新。

---

## 4. 中栏

### 4.1 Hero

```text
pattern · name
desc
kind
[✎编辑] [●重录] [⧉复制] [⌫删除]
```

### 4.2 映射链

```text
[Gesture: LDR · 打开 GitHub]
  → [Target Layer: FlowInstance]
  → [AtomRef: 打开外部网站 / GitHub]
  → [打开目标实例 ↗]
```

- 已映射：显示具体 AtomRef + 管理页深链。
- 未映射：显示「占位 · 未接入」，不生成死链。

### 4.3 手势识别（按需）

默认：

```text
┌────────────────────────────────────┐
│ 手势识别未启用                      │
│ 只在新建 / 重录手势时启动；          │
│ 识别完成后自动关闭                   │
│ [＋ 新建手势（启用识别）]            │
└────────────────────────────────────┘
```

没有常驻 pointer listener，没有常驻识别循环。

### 4.4 绑定表

```text
Pattern / Kind / Name / Target / Effect / Status / Action
```

状态：

```text
mapped
占位 · 待接入
```

---

## 5. 手势录制生命周期

```text
idle
  ↓ 点击「＋ 新建手势」/「重录」
recorder active
  ↓ 在 recordPad 按住左键画
collect points
  ↓ 抬手 pointerup
recognize directions
  ↓ 识别成功
recorder off
  ↓ 自动关闭录制 modal
binding modal
  ↓ 选择点层/线层目标
save
  ↓
idle
```

### 5.1 识别器启用条件

只在：

```text
新建手势
重录手势
```

时启用。

不会：

- 一直监听鼠标
- 一直加载模型
- 一直占用手势 pad
- 在后台持续识别

### 5.2 识别完成后关闭

- `pointerup` 后立即 `recorderActive = false`。
- 显示识别结果约 220ms。
- 自动关闭录制 modal。
- 打开绑定 modal，进入目标选择。

### 5.3 方向识别

8 方向：

```text
R / DR / D / DL / L / UL / U / UR
```

合并连续同方向，得到 pattern：

```text
LDR / UD / RL / DR / DLU
```

支持手绘，也支持重录。

### 5.4 录制 UI

```text
record-pad
  grid
  svg polyline
  hint
record-readout
  Recognized pattern
  directions
  [清空]
[取消]
```

取消：

```text
recorderActive = false
modal close
```

---

## 6. 目标映射：点层 / 线层

绑定 modal：

```text
pattern
name
effect
desc
[点层实例 · 32] [线层实例 · 8]
搜索实例 / class / flow…
目标列表
已选目标摘要
[取消] [保存绑定]
```

### 6.1 点层实例

来源：点层管理页的 13 PointClass / 32 PointInstance。

目标格式：

```text
classId / instanceId
```

深链：

```text
atom-catalog-management.html#classId/instanceId
```

### 6.2 线层实例

来源：线层管理页的 4 FlowClass / 8 FlowInstance。

目标格式：

```text
flowId / instanceId
```

深链：

```text
line-management.html#flowId/instanceId
```

### 6.3 保存

```json
{
  "pattern": "LDR",
  "name": "打开 GitHub",
  "kind": "flow",
  "target": "inst.site-github@r1",
  "targetKind": "line",
  "targetId": "line:flow.open-external-site/inst.site-github",
  "targetLabel": "打开外网网站 / GitHub",
  "href": "line-management.html#flow.open-external-site/inst.site-github",
  "effect": "L2",
  "desc": "..."
}
```

点层目标：

```json
{
  "kind": "point",
  "targetKind": "point",
  "target": "win.ocr.read/i-ocr-auto",
  "href": "atom-catalog-management.html#win.ocr.read/i-ocr-auto"
}
```

---

## 7. 增删改查

| 操作 | 对象 | 行为 |
|---|---|---|
| 新建 | GestureBinding | 先录制，识别后自动关闭；再选点/线目标，保存 |
| 编辑 | GestureBinding | 直接打开绑定 modal；改 pattern/name/effect/desc/target |
| 重录 | GestureBinding | 启动按需识别；识别后关闭并回到绑定 modal |
| 复制 | GestureBinding | 深拷贝，pattern 加 `2`，新 name 副本 |
| 删除 | GestureBinding | confirm 后删除 |
| 查询 | GestureBinding | 左侧搜索 + 列表 |
| 重置 | 示例数据 | 恢复 5 条示例手势 |

持久化：

```text
localStorage: baiying.gestureManager.v1
```

正式版接 gesture registry / binding store。

---

## 8. 与面层管理页的关系

`surface-management.html` 的 **手势** tab 是概览：

- GestureBinding 列表
- 静态手势预览
- 映射状态

完整 CRUD + 按需录制 + 点/线目标选择在：

```text
gesture-management.html
```

入口：

```text
Surface Management → 手势 tab → G 打开手势管理页 ↗
```

返回：

```text
Gesture Management → ← 面层管理 → surface-management.html#gestures
```

---

## 9. 文件

| 文件 | 作用 |
|---|---|
| `gesture-management.html` | 手势管理页（本设计） |
| `gesture-management-v2.html` | 稳定快照 |
| `GESTURE-MANAGEMENT.md` | 本文档 |
| `gesture-binding-surface.html` | 原始手势识别参考 |
| `surface-management.html` | 面层管理页，手势 tab 链接本页 |
| `atom-catalog-management.html` | 点层实例深链目标 |
| `line-management.html` | 线层实例深链目标 |

---

## 10. 已做校验

- GestureBinding 5
- Point targets 32
- Line targets 8
- 初始：LDR / 打开 GitHub / line / mapped
- 未映射：UD / RL / DR / DLU → placeholder
- 识别器默认 off
- 点击新建后 recorder active
- 取消后 recorder off
- 录制 modal 关闭后打开绑定 modal
- 方向识别测试：
  - LDR → LDR
  - UD → UD
  - DR → DR
- 编辑 LDR 名称 + 保存通过
- 目标选择：
  - 点层 32
  - 线层 8
- 深链：
  - `atom-catalog-management.html#classId/instanceId`
  - `line-management.html#flowId/instanceId`
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 11. 优先级

### P0

- GestureBinding 列表 / 搜索
- 按需录制（默认关闭）
- 识别后自动关闭
- 点层 / 线层目标选择
- 新建 / 编辑 / 复制 / 删除
- 映射链 + Inspector

### P1

- localStorage 持久化
- 重录
- 重置示例
- 深链
- 方向识别

### P2

- 模糊匹配
- 手势模板库
- 冲突检测
- 手势热键
- 手势录制轨迹回放
- 真实 GestureRecognizer 集成

---

## 12. 一句话总结

**手势识别是按需启动的，不是常驻服务。**

```text
默认 off
  → 新建/重录才开启
  → 抬手识别
  → 立即 off + 关闭录制
  → 选择点层/线层实例
  → 保存 GestureBinding
```

手势绑定管理支持增删改查；目标可映射点层实例或线层实例，并直接深链到对应管理页。
