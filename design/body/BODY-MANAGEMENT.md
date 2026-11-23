# 体层管理页设计（Body Management v0.1）

> 参考：`body-layer-visual.html` 的 BodyClass / BodyInstance / Composition / Manifest / Lifecycle。
>
> 目标：体层不仅可视化，还能编辑：BodyClass / BodyInstance CRUD、组合关系、功能 settings、permissions、manifest、生命周期。

---

## 0. 一句话结论

```text
body-management.html
  = BodyClass / BodyInstance
  + Composition 可视化
  + Manifest 编辑
  + Lifecycle 设置
  + Function Settings / Permissions
```

体层是产品蓝图：把 flows / surfaces / points 组合成一个可安装、可配置、可演进的 Body。

---

## 1. 数据

```text
BodyClass       29
BodyInstance    82
P0               9
categories       7
```

类别：

```text
content / input / system / utility / dev / ai / business / media
```

每个 BodyClass：

```text
id / name / icon / cat / prio / desc
flows[] / surfaces[] / points[]
settings[] / perms[] / tests[]
instances[]
lifecycle
version
```

每个 BodyInstance：

```text
label / desc / rev / acts / settings / status
```

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Body Management  29 BodyClass 82 BodyInstance 9 P0 7 categories 29 active [设置]│
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ BodyClass        │ 文件预览                                    │ Inspector    │
│ 搜索 / 分类 / P0 │ [组合][实例][Manifest][生命周期][设置]       │ 契约          │
│ ▸ 文件预览 6     │ ┌────────────────────────────────────────┐ │ 组合          │
│ ▸ OCR 5          │ │ 组合可视化：flows → body ← surfaces     │ │ 设置/权限     │
│ ...              │ └────────────────────────────────────────┘ │ 实例          │
│ BodyInstance     │ Composition / Manifest / Lifecycle ...      │ 操作          │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

---

## 3. 左栏

### 3.1 搜索

```text
body / instance / desc / category / priority
```

### 3.2 分类过滤

```text
全部 / content / input / system / utility / dev / ai / business / media
```

### 3.3 优先级过滤

```text
全部 / P0 / P1 / P2
```

### 3.4 BodyClass

每项：

```text
icon / name
id
category
priority
instance count
```

操作：

```text
＋ 新建 BodyClass
```

### 3.5 BodyInstance

当前类的实例：

```text
label / rev
desc
status
```

操作：

```text
＋ 新建 BodyInstance
```

### 3.6 重置

```text
↺ 重置示例数据
```

恢复 29 / 82。

---

## 4. 中栏 Tabs

```text
[组合] [实例] [Manifest] [生命周期] [设置]
```

### 4.1 组合

Body summary：

```text
icon / name / priority
id / version / category
desc
counts: flows / surfaces / points / instances
```

Body stack：

```text
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Line flows   │ → │ Body core    │ ← │ Surfaces     │
│ flow...      │   │ ◈ 文件预览    │   │ surface...   │
└──────────────┘   └──────────────┘   │ Points        │
                                       │ file.read...  │
                                       └──────────────┘
```

组合矩阵：

```text
LINE FLOWS      SURFACE UI      POINT ATOMS
flow.preview    surface.preview file.read
...
```

每个 chip：

- 绿色 / `↗`：已接入对应管理页。
- 琥珀 / `·ph`：占位，未接入。
- 点击已接入 chip → 对应管理页。

映射：

```text
surface.* → surface-management.html#surfaces/<id>
point.*   → atom-catalog-management.html#<id>
flow.*    → line-management.html#<id>（当前线层只有 4 个 flow，其他占位）
```

### 4.2 实例

实例卡片：

```text
label / rev
desc
status
acts[]
settings
```

操作：

```text
＋ 新建实例
点击卡片 → 选中实例
```

### 4.3 Manifest

展示完整 JSON：

```json
{
  "id": "body.file-preview",
  "name": "文件预览",
  "icon": "◈",
  "category": "content",
  "priority": "P0",
  "version": "1.0.0",
  "desc": "...",
  "composition": {
    "flows": ["flow.preview-file"],
    "surfaces": ["surface.preview-window"],
    "points": ["file.read", "render.text", "render.image"]
  },
  "settings": ["preview.maxBytes", "preview.encoding", "preview.zoom"],
  "permissions": ["fs.read", "window.open"],
  "tests": [],
  "lifecycle": {...},
  "instances": [...]
}
```

操作：

```text
✎ 编辑 Manifest
```

- 直接编辑 JSON。
- 验证 JSON。
- 保存回写 BodyClass。
- 可编辑 composition / settings / permissions / tests / lifecycle / instances。

### 4.4 生命周期

可编辑：

```text
status      active / draft / archived
trust       signed / unsigned / local
update      manual / auto / pinned
isolation   process / container / vm
autoStart   false / true
```

保存：

```text
保存 → BodyClass.lifecycle
```

### 4.5 设置

展示：

```text
Function Settings
Permissions
Tests
```

操作：

```text
✎ 编辑设置
```

打开 BodyClass modal，编辑：

```text
settings[] / perms[] / tests[]
```

---

## 5. 右栏 Inspector

### BodyClass

```text
id / name / version
category / priority / status
trust / update / isolation
flows / surfaces / points
settings / perms / tests
[✎编辑] [＋实例] [⌫删除]
```

### BodyInstance

```text
label / rev / status
desc / acts / settings
[▶运行] [✎编辑] [⧉复制] [⌫删除]
```

---

## 6. CRUD

### BodyClass

| 操作 | 行为 |
|---|---|
| 新建 | modal：id/name/icon/cat/prio/version/desc + flows/surfaces/points/settings/perms/tests |
| 编辑 | 同一 modal；保存更新 |
| 删除 | confirm；级联删除实例 |
| 查询 | 左栏搜索 + 分类/优先级过滤 |
| 重置 | 恢复 29 / 82 |

### BodyInstance

| 操作 | 行为 |
|---|---|
| 新建 | modal：label/desc/rev/acts/settings/status |
| 编辑 | 保存后 rev +1 |
| 复制 | 深拷贝，新 label，rev=1，draft |
| 删除 | confirm |
| 运行 | 模拟运行 toast |

### Manifest

| 操作 | 行为 |
|---|---|
| 编辑 | JSON textarea |
| 验证 | JSON.parse + id/name 必填 |
| 保存 | 回写 class 字段 |

### 生命周期

| 操作 | 行为 |
|---|---|
| 保存 | status/trust/update/isolation/autoStart → class.lifecycle |

---

## 7. 持久化

```text
localStorage: baiying.bodyManager.v1
```

保存：

```json
{
  "classes": [...],
  "savedAt": "..."
}
```

正式版接 body registry / installer / trust store。

---

## 8. 文件

| 文件 | 作用 |
|---|---|
| `body-management.html` | 体层管理页（本设计） |
| `body-management-v2.html` | 稳定快照 |
| `BODY-MANAGEMENT.md` | 本文档 |
| `body-layer-visual.html` | 原始 Body 可视化参考 |
| `BODY-CATALOG.md` | BodyClass / BodyInstance 目录 |
| `surface-management.html` | surface chip 深链目标 |
| `atom-catalog-management.html` | point chip 深链目标 |
| `line-management.html` | flow chip 深链目标 |

---

## 9. 已做校验

- BodyClass 29 / BodyInstance 82
- P0 9 / categories 7 / active 29
- 初始：`body.file-preview / pdf / composition`
- 5 tabs 均渲染通过：
  - composition / instances / manifest / lifecycle / settings
- Body stack + composition grid 渲染
- 新建 BodyInstance 通过（6 → 7）
- BodyClass modal 渲染
- Manifest 生成字段：
  - id/name/icon/category/priority/version/desc/composition/settings/permissions/tests/lifecycle/instances
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 10. 优先级

### P0

- BodyClass / BodyInstance 列表
- Composition 可视化
- Manifest
- Lifecycle
- Function Settings / Permissions
- 新建 / 编辑 / 删除类与实例

### P1

- localStorage 持久化
- 实例复制/运行
- Manifest JSON 编辑
- 生命周期保存
- 分类/优先级过滤

### P2

- BodyPackage / 安装器
- 依赖图
- 版本 diff
- trust / signature 校验
- registry 同步
- 实例健康检查

---

## 11. 一句话总结

**体层管理页 = BodyClass / BodyInstance 管理 + Composition 可视化 + Manifest + Lifecycle + Function Settings。**

```text
BodyClass  → 产品蓝图
BodyInstance → 安装配置
Composition → flows / surfaces / points
Manifest → 完整 JSON
Lifecycle → trust / update / isolation
Settings → function settings / permissions
```

不是只读 body 可视化；体层可以编辑。
