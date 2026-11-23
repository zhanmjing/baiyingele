# 原子工坊：点层管理页与可视化（v0.2）

> 目标：把 `atom-catalog.html` 从“点层可视化”升级为**点层管理页**，并在同一页面加入管理总览、矩阵可视化、健康度、批量操作与加载管理。
>
> 结论：管理页不是设置页。设置页管“允许什么”；管理页管“有哪些类/实例、它们是否健康、是否加载、是否归档”。

---

## 0. 一句话结论

```text
atom-catalog.html
  = 点层类/实例目录
  + 管理总览
  + 卡片 / 表格 / 图谱 / 矩阵 / 加载
  + 批量操作
  + 右侧 Inspector
  + 运行 / 编辑 / 复制 / 归档 / 恢复 / 导出
```

当前点层数据：

```text
13 个 PointClass / 32 个 PointInstance
```

---

## 1. 视图结构

```text
[卡片] [表格] [图谱] [矩阵] [管理] [加载]
```

| 视图 | 作用 | 关键交互 |
|---|---|---|
| 卡片 | 按功能家族浏览类与实例 | 展开实例、运行、编辑、复制、归档 |
| 表格 | 类/实例的紧凑表格 | 展开类、新建实例、编辑 |
| 图谱 | 类 → 实例的关系视图 | 点击类/实例打开 Inspector |
| **矩阵** | 类 × 实例矩阵，快速看覆盖/状态 | 点击单元格选中实例 |
| **管理** | 管理总览 + 批量操作 + 健康度 | 全选、启用、归档、恢复、导出 |
| 加载 | 资源/包加载管理 | 安装、加载、预加载、固定、卸载 |

---

## 2. 管理总览

管理视图顶部 6 个 KPI：

```text
Classes        13
Instances      32
P0             13
References     12
Avg success    97.8%
Archived       0
```

### 2.1 Attention

自动列出需要关注的类：

```text
draft
archived
success < 95%
```

点击 attention 项 → 打开对应类 Inspector。

### 2.2 批量操作

```text
[全选]  [启用]  [归档]  [恢复]  [导出 JSON]
```

规则：

- `启用`：把选中类状态设为 `stable`。
- `恢复`：把选中类状态设为 `stable`。
- `归档`：只归档**没有实例**的类；有实例的类跳过并提示。
- `导出 JSON`：导出选中类的 id/name/version/status/instances/params。
- 全选只选当前筛选结果。
- 选中数量实时显示。

### 2.3 管理表格

列：

```text
[ ] 类 / ID
家族
状态
实例数
引用数
成功率
更新时间
操作
```

行操作：

```text
＋ 新建实例
✎ 编辑类
⌫ 归档类
```

---

## 3. 矩阵可视化

```text
PointClass         实例 1   实例 2   实例 3   实例 4   更多
发送快捷键           ●        ●        ●        ●        +1
监听快捷键           ●        ●
控制窗口             ●        ●        ●        ●
查询窗口             ●        ●
打开目标             ●        ●        ●
...
```

编码：

- 行 = PointClass。
- 列 = PointInstance（最多显示 4 个，更多显示 `+N`）。
- 实心圆点 = 实例。
- 颜色 = 状态：
  - stable：绿
  - draft：琥珀
  - deprecated：红
  - archived：灰
- `rN` = revision。
- 点击单元格 → 选中实例 → 右侧 Inspector。
- 点击行标签 → 选中类。

规则：

- 坐标/颜色只表达状态与 revision，不表达业务重要性。
- 有标签、图例、Inspector，不能只靠颜色。
- 矩阵是管理视图，不是设置项。

---

## 4. 右侧 Inspector

### 类

```text
id / name / version / status
权限 / 副作用
实例数 / 被引用 / 成功率 / 更新时间
参数 Schema（示例）
实例列表
新建实例 / 编辑类 / 归档类
```

### 实例

```text
instance id / class@version
参数表单
参数预览 JSON
被引用 / 最近运行 / 成功率 / revision
保存 / 运行测试 / 复制 / 归档 / 恢复
```

### 加载资源

如果类有 `pack`：

```text
state: available / installed / loaded / loading / error
memoryMB / diskMB / gpuMB / model
policy: on-demand / preload / pinned
lastUsed
加载 / 预加载 / 固定 / 卸载
```

---

## 5. 管理动作

| 动作 | 对象 | 行为 |
|---|---|---|
| 新建类 | PointClass | 创建 draft 类 |
| 编辑类 | PointClass | 生成新 minor 版本草稿，不原地改已发布版本 |
| 新建实例 | PointInstance | 选类 + 名称；参数在 Inspector 继续编辑 |
| 编辑实例 | PointInstance | 修改参数，保存生成新 revision |
| 运行测试 | PointInstance | 模拟运行，写最近运行/成功率 |
| 复制实例 | PointInstance | 复制参数生成新实例 |
| 归档实例 | PointInstance | 标记 archived，保留引用 |
| 恢复实例 | PointInstance | archived → stable |
| 归档类 | PointClass | 无实例才可归档 |
| 批量启用/归档/恢复 | PointClass | 管理视图批量操作 |
| 导出 JSON | PointClass[] | 导出选中类与实例 |

---

## 5.1 深链：点层实例设置页

点层管理页支持从线层管理页直接跳转到某个实例设置页：

```text
atom-catalog-management.html#win.ocr.read/i-ocr-auto
atom-catalog-management.html#win.clipboard.get/i-clip-text
atom-catalog-management.html#win.open/i-open-github
```

也支持 query：

```text
atom-catalog-management.html?class=win.ocr.read&instance=i-ocr-auto
```

打开后：

- 找到对应 PointClass。
- 选中 PointInstance。
- 右侧 Inspector 直接显示该实例的参数表单、参数预览、运行与引用。
- 视图回到 cards，family/filter 重置为 all，避免实例被筛选隐藏。
- 窄屏下 Inspector 以 overlay 打开。

线层管理页只在点层已实现的实例上显示 `打开实例设置 ↗`；未实现的节点显示 `占位符`，不生成死链。

---

## 6. 管理页 vs 设置页

| 问题 | 管理页 `atom-catalog.html` | 设置页 `settings-workspace-layers.html` |
|---|---|---|
| 有哪些类/实例？ | ✅ | ✅（只读目录） |
| 新建/编辑/复制/归档？ | ✅ | ❌ |
| 运行测试？ | ✅ | ❌ |
| 批量操作？ | ✅ | ❌ |
| 加载/卸载/固定包？ | ✅ | ❌ |
| 设置 timeout/effect/policy？ | ❌ | ✅ |
| 设置 secret？ | ❌ | ✅ |
| 设置 build/compile？ | ❌ | ✅（Build Settings） |

**边界**：

```text
Settings  → 允许什么（policy / defaults / scope）
Management → 有什么、是否健康、是否加载、是否归档
```

---

## 7. 原型

文件：

- `atom-catalog.html`（更新后的点层管理页）
- `atom-catalog-management.html`（同一版本的稳定快照，便于查看）
- `atom-catalog-manage.html`（早期管理扩展快照）

当前实现：

- 原有点层数据：13 classes / 32 instances。
- 视图：卡片 / 表格 / 图谱 / 矩阵 / 管理 / 加载。
- 管理视图：6 KPI + attention + 批量工具栏 + 管理表格。
- 矩阵视图：class × instance，状态色 + revision + 更多。
- 右侧 Inspector：类/实例详情、参数、运行、复制、归档/恢复、资源区。
- 加载视图：安装/加载/预加载/固定/卸载。
- 原有 CRUD、搜索、家族筛选、保存视图、主题切换、重置演示数据保留。

### 校验

- 3 个 script 均 `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过
- 矩阵 render 测试通过（31 个可点击实例单元）
- 管理 render 测试通过（manage table + checkbox）
- 点层统计：13 classes / 32 instances

---

## 8. 优先级

### P0

- 管理视图（KPI + attention + 批量工具栏 + 管理表格）
- 矩阵视图
- 类/实例 Inspector
- 新建/编辑/复制/归档/恢复
- 运行测试

### P1

- 批量导出 JSON
- 健康度（success < 95%）attention
- 加载/预加载/固定/卸载
- 搜索结果高亮
- 归档实例恢复

### P2

- 导入 JSON
- 版本 diff
- 批量运行
- 依赖图
- 审计日志/操作历史
- 多选实例批量编辑

---

## 9. 一句话总结

**管理页回答“有什么、是否健康、是否加载、是否归档”；设置页回答“允许什么、默认值是什么、策略是什么”。**

```text
Cards / Table / Graph  → 浏览
Matrix                → 覆盖与状态
Manage                → 批量管理 + 健康
Load                  → 资源与包
Inspector             → 单个类/实例
Settings              → 策略与默认值
```
