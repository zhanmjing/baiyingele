# 线层管理页设计（Line Management v0.1）

> 参考：`atom-line-visual.html` 的数据流图与 FlowClass/FlowInstance 绑定模型；`atom-catalog.html` 的管理页结构（左列表、中工作区、右 Inspector、管理动作、深链）。
>
> 目标：线层管理页管理 FlowClass / FlowInstance / FlowNode；线层节点引用的点层实例，已实现的直接跳点层实例设置页，未实现的先用占位符。

---

## 0. 一句话结论

```text
line-management.html
  = FlowClass 列表
  + FlowInstance 列表
  + 数据流图
  + Point 绑定表
  + Inspector
  + 点层实例深链
  + 占位符
```

线层不实现功能，只负责组合。线层节点绑定的是 **PointInstance（点层实例）** 或 **Subflow FlowInstance（子流程）**；线层自己不是点层实例。

---

## 1. 数据

来自 `atom-line-visual.html`：

```text
FlowClass       4
FlowInstance    8
FlowNode        20
Edges           16
Point slots     17
Gate            2
Subflow         1
```

| FlowClass | 节点 | 实例 | Point slots | 已接入点层 | 占位符 |
|---|---:|---:|---:|---:|---:|
| 截图翻译 | 4 | 2 | 4 | 1 | 3 |
| 发票归档 | 8 | 2 | 6 | 1 | 5 |
| 剪贴板存文件 | 4 | 2 | 4 | 1 | 3 |
| 打开外网网站 | 4 | 2 | 3 | 1 | 2 |
| **合计** | **20** | **8** | **17** | **4** | **13** |

> 这里统计的是 **节点槽位**，不是实例数量；同一个 OCR 槽位在多个 FlowClass 中复用。

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Line Management  4 FlowClass 8 FlowInstance 17 slots 4 linked 13 占位符  [设置] │
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ FlowClass        │ 截图翻译 · 采集 → 转换 → 输出               │ Inspector    │
│ ▸ 截图翻译        │ [类定义] [实例绑定]          [▶运行] [+实例] │ win.key…     │
│ ▸ 发票归档        │ 4 nodes · 3 edges · 4 slots · 1 linked      │ …            │
│ ▸ 剪贴板存文件    │ ┌────────────────────────────────────────┐ │              │
│ ▸ 打开外网网站    │ │ 截屏[占位] → OCR[已实现↗] → 翻译[占位] │ │              │
│                  │ │                         → 浮层[占位]    │ │              │
│ FlowInstance     │ └────────────────────────────────────────┘ │              │
│ ▸ 英→中           │ Point 绑定表                               │              │
│ ▸ 日→中           │ 节点 | PointClass | Pin | 实现 | 操作       │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

三栏：

- 左：FlowClass / FlowInstance。
- 中：FlowClass hero + 数据流图 + Point 绑定表。
- 右：Inspector（FlowClass / FlowInstance / FlowNode）。

---

## 3. 左栏

### 3.1 FlowClass

每项：

```text
name
id
version
family
node count
instance count
```

点击：

- 切换 FlowClass。
- 重置 FlowInstance。
- 清除选中节点。
- 回到类定义模式。

### 3.2 FlowInstance

每项：

```text
name
id
revision
status
```

点击：

- 进入实例绑定模式。
- 图中 pin 使用该实例的 `pins`。
- Inspector 显示实例参数与 pin 列表。

---

## 4. 中间工作区

### 4.1 Hero

```text
FlowClass family
name
desc
version
```

模式：

```text
[类定义] [实例绑定]
```

动作：

```text
▶ 运行
＋ 实例
```

### 4.2 数据流图

节点来自 `flow.nodes`，边来自 `flow.edges`。

节点类型：

| 类型 | 样式 | 说明 |
|---|---|---|
| point + 已实现 | 绿色实线 | 可点击跳点层实例设置 |
| point + 未实现 | 琥珀虚线 | 占位符 |
| gate | 紫色 | 线层门节点，不绑定点实例 |
| subflow | 蓝色 | 绑定子流程 FlowInstance |

节点内容：

```text
POINT SLOT / GATE / SUBFLOW
label
pointClass / gate
pin @ rev
```

已实现节点右上角：

```text
↗
```

未实现节点右下角：

```text
占位符
```

### 4.3 Point 绑定表

列：

```text
节点
类型
PointClass
Pin
实现
点层实例
操作
```

示例：

| 节点 | PointClass | Pin | 实现 | 点层实例 | 操作 |
|---|---|---|---|---|---|
| OCR | ocr.read | ocr.zh.screen | 点层已实现 | OCR 识别 · 截图转文字 | 打开实例设置 ↗ |
| 截屏 | screen.capture | cap.region | 占位符 | — | 待接入 |
| 翻译 | translate.text | trans.en2zh | 占位符 | — | 待接入 |
| 浮层 | render.overlay | overlay.toast | 占位符 | — | 待接入 |
| 遍历文件 | gate:foreach | — | gate | — | — |
| VPN 保障 | flow.ensure-vpn | inst.ensure-vpn-ask | subflow | — | — |

---

## 5. 点层映射

只有点层已实现的实例才生成链接。

当前映射：

| 线层 PointClass | 点层 Class | 点层 Instance | 说明 |
|---|---|---|---|
| `ocr.read` | `win.ocr.read` | `i-ocr-auto` | OCR 识别 · 截图转文字 |
| `input.clipboard` | `win.clipboard.get` | `i-clip-text` | 读取剪贴板 · 取文本 |
| `sys.open` | `win.open` | `i-open-github` | 打开目标 · 打开 GitHub |

未在映射中的 PointClass：

```text
screen.capture
translate.text
render.overlay
file.watch
extract.invoice
validate.invoice
file.move
notify.tray
text.template
file.write
notify.toast
net.reachable
```

全部显示为：

```text
占位符 · 待接入
```

不生成死链。

---

## 6. 点层实例深链

目标格式：

```text
atom-catalog-management.html#win.ocr.read/i-ocr-auto
atom-catalog-management.html#win.clipboard.get/i-clip-text
atom-catalog-management.html#win.open/i-open-github
```

点层管理页收到 hash 后：

1. 找到 PointClass。
2. 找到 PointInstance。
3. 选中实例。
4. 打开右侧 Inspector。
5. 显示参数表单、参数预览、运行与引用。
6. 窄屏下 Inspector 以 overlay 打开。

也支持 query：

```text
atom-catalog-management.html?class=win.ocr.read&instance=i-ocr-auto
```

### 点击行为

- 点击节点：选中节点，Inspector 显示节点信息。
- 点击节点右上角 `↗`：直接跳点层实例设置页。
- 点击绑定表 `打开实例设置 ↗`：直接跳。
- 点击 Inspector 的 `打开点层实例设置 ↗`：直接跳。

未实现节点：

```text
占位符 → 无链接 → 不跳转
```

---

## 7. Inspector

### 7.1 FlowClass

```text
id / name / version / family
nodes / edges / instances
point slots / linked / placeholders
summary
[＋新建实例] [✎编辑类] [▶运行默认]
```

### 7.2 FlowInstance

```text
id / name / rev / status
flow
args JSON
Point Pins 列表
[▶运行] [⧉复制] [⌫归档]
```

Pins 列表：

```text
节点 label → pin id
绿色 ↗ = 点层已实现
琥珀 · ph = 占位符
```

### 7.3 FlowNode

```text
kind
pointClass / gate
pin id
revision
implemented yes/no
Pin params JSON
```

已实现：

```text
[打开点层实例设置 ↗]
```

未实现：

```text
该点层实例尚未实现，线层先用占位符。
点层实现后，这里会显示可跳转的点层实例设置入口。
```

Gate：

```text
门节点由线层引擎执行，不绑定 PointInstance。
```

Subflow：

```text
该节点绑定的是子流程 FlowInstance，不是点层实例。
```

---

## 8. 管理动作

| 动作 | 对象 | 行为 |
|---|---|---|
| 新建 FlowClass | FlowClass | prompt 名称，创建空类 |
| 编辑 FlowClass | FlowClass | 修改名称 |
| 新建 FlowInstance | FlowInstance | 从当前 FlowClass 默认 pin 创建 |
| 复制 FlowInstance | FlowInstance | 深拷贝实例，新 id，rev=1，draft |
| 归档 FlowInstance | FlowInstance | status=archived |
| 运行 | FlowClass / FlowInstance | 模拟运行，toast 轨迹正常 |
| 展开/收起 | 图/表 | 点击节点/行选中 |
| 模式切换 | FlowClass | 类定义 / 实例绑定 |

> 当前原型是内存态；真正持久化、版本 diff、依赖图属于下一阶段。

---

## 9. 文件

| 文件 | 作用 |
|---|---|
| `line-management.html` | 线层管理页（本设计） |
| `atom-line-visual.html` | 线层数据流图原始可视化参考 |
| `atom-catalog.html` | 点层深度管理页 |
| `atom-catalog-management.html` | 点层管理稳定快照，支持实例深链 |
| `LINE-MANAGEMENT.md` | 本文档 |
| `ATOM-CATALOG-MANAGEMENT.md` | 点层管理页设计 |

---

## 10. 已做校验

- FlowClass 4 / FlowInstance 8
- FlowNode 20 / Edge 16
- Point slots 17
- Gate 2 / Subflow 1
- 已接入点层 4 个节点槽位
- 占位符 13 个节点槽位
- 点层深链：
  - `win.ocr.read/i-ocr-auto`
  - `win.clipboard.get/i-clip-text`
  - `win.open/i-open-github`
- 点层管理页 hash 深链测试通过：选中实例、view=cards、family=all、filter=all
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 11. 优先级

### P0

- FlowClass / FlowInstance 列表
- 数据流图
- Point 绑定表
- 已实现点实例深链
- 占位符状态
- Inspector

### P1

- 新建/复制/归档 FlowInstance
- 运行模拟
- 类定义 / 实例绑定模式
- 节点选中与表行联动
- hash 路由

### P2

- FlowClass / FlowInstance 持久化
- 版本 diff
- 依赖图
- 批量运行
- 用点层 registry 动态生成占位符
- 点层实现后自动解除占位符

---

## 12. 一句话总结

**线层管理页负责组合，点层管理页负责实现。**

```text
Line Management  → FlowClass / FlowInstance / 绑定 / 占位符
Point Management → PointClass / PointInstance / 实例设置
```

已实现的点层实例：点击直接跳点层实例设置页。  
未实现的点层实例：先显示占位符，不生成死链。
