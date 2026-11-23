# 类 / 实例 / 点线面体的 3D 坐标轴可视化（v0.1）

> 需求：把类与实例融入 3D 可视化：
>
> **X 轴 = 类，Y 轴 = 实例，Z 轴 = 点 / 线 / 面 / 体。**

结论：可以做成一个 **三维晶格（lattice）**：

- 每个 Z 平面 = 一层（点 / 线 / 面 / 体）。
- 每个 X 位置 = 该层的一个类。
- 每个 Y 位置 = 该类的一个实例。
- 类定义在 `Y=0` 的空心方块；实例在 `Y>0` 的实心发光点。
- 组合关系（体→面→线→点）用跨层虚线连接。

这样 3D 同时回答三个问题：

```text
X：这个层有哪些类？
Y：这个类有哪些实例？
Z：这些类/实例属于哪一层？
```

---

## 0. 一句话结论

```text
X = Class
Y = Instance
Z = Layer（点 → 线 → 面 → 体）

每个 Z 平面：一个 X×Y 网格
  每一列 = 一个类
  每一行 = 一个实例
  Y=0   = 类定义（空心）
  Y>0   = 实例（实心）
```

这不是“嵌套体积”的替代，而是另一种视角：

| 视图 | 回答的问题 |
|---|---|
| 嵌套体积 | 谁包含谁？ |
| 坐标轴晶格 | 类有哪些实例？实例属于哪层？实例如何组合？ |

---

## 1. 轴的定义

| 轴 | 含义 | 视觉 |
|---|---|---|
| X | 类 | 每层内从左到右排列；列标签 = 类名 |
| Y | 实例 | 类在 `Y=0`，实例沿 Y 正向排列；行号 = 实例序号 |
| Z | 层 | 点 / 线 / 面 / 体四个平面，沿深度方向排列 |

### 为什么类在 Y=0

类不是实例。  
把类放在 `Y=0` 的空心方块，实例放在 `Y>0` 的实心点，可以明确表达：

```text
Y=0        Y=0.42        Y=1.14
□ Class ── ● instance 1 ── ● instance 2
```

---

## 2. 视觉语法

### 2.1 类

- 空心方块 / 线框立方体。
- 颜色 = 层颜色。
- 标签 = 类短名（如 `vpn.status`、`open-external`、`site-launcher`）。
- 选中：白色描边 + 外圈。
- 点击：Inspector 显示 `Class@version`、实例数量、contract。

### 2.2 实例

- 实心发光点。
- 颜色 = 层颜色。
- 大小 = revision / 重要性。
- L2/L3 effect 加琥珀/红色外环。
- 选中/悬停：外圈 + 完整 id 标签。
- 点击：Inspector 显示 `Class`、`revision`、`effect`、`params`。

### 2.3 层平面

- 每个 Z 层一个半透明矩形平面。
- 网格线：X 方向是类列，Y 方向是类行/实例行。
- 层标签：`点层 Z=0`、`线层 Z=2.4`、`面层 Z=4.8`、`体层 Z=7.2`。
- 平面颜色 = 层颜色。

### 2.4 组合关系

- 体实例 → 面实例。
- 面实例 → 线实例。
- 线实例 → 点实例。
- 用跨层虚线 + 小粒子表示。
- 选中实例时，相关组合线高亮。

### 2.5 类→实例关系

- 同一 X 列内，从 `Y=0` 的类方块连接到每个实例点。
- 虚线；选中类时整列高亮。

---

## 3. 轴与晶格布局

```text
Z
↑
│   ┌─────────────┐  body layer (Z=7.2)
│   │ X classes   │
│   │  □ → ● ●    │
│   └─────────────┘
│   ┌─────────────┐  surface layer (Z=4.8)
│   │  □ → ●      │
│   └─────────────┘
│   ┌─────────────┐  line layer (Z=2.4)
│   │  □ → ● ●    │
│   └─────────────┘
│   ┌─────────────┐  point layer (Z=0)
│   │  □ → ● ●    │
│   └─────────────┘
└────────────────────→ X（类）
   Y（实例）向屏幕深处
```

实际相机：

- X 轴向右。
- Y 轴向上（实例）。
- Z 轴向后/深度（层）。
- 拖拽旋转可以看到层与层之间的关系。

---

## 4. 原型数据

`atom-3d-axes.html` 当前包含：

```text
16 classes
24 instances
30 composition links
4 Z layers
```

### 点层

- `vpn.status` → `default` / `work`
- `net.reachable` → `default`
- `browser.open` → `chrome` / `edge`
- `notify.toast` → `default`
- `render.text` → `default`
- `render.image` → `default`

### 线层

- `open-external` → `github` / `youtube`
- `ensure-vpn` → `ask` / `auto`
- `vpn-profile` → `work`
- `preview-file` → `image` / `text`

### 面层

- `site-launcher` → `main`
- `settings.vpn` → `settings`
- `run-history` → `vpn`
- `preview-window` → `image` / `text`

### 体层

- `external-access` → `work` / `personal`
- `file-preview` → `image` / `text`

### 组合关系

```text
body.external-access.work
  → surface.site-launcher
  → surface.settings.vpn
  → surface.run-history.vpn
      → inst.site-github
      → inst.ensure-vpn-ask
          → vpn.default.status
          → net.reachable.default
          → browser.open.chrome
```

---

## 5. 交互

| 操作 | 作用 |
|---|---|
| 拖拽 | 旋转轨道 |
| 滚轮 | 缩放 |
| 点击类方块 | 选中类；高亮该列所有实例 |
| 点击实例点 | 选中实例；高亮类与相关组合线 |
| Z 层间距滑块 | 拉开/压缩点线面体四层 |
| 显示组合关系 | 体→面→线→点的跨层虚线 |
| 显示类标签 | 类短名常驻 |
| 显示层网格 | 每层 X×Y 网格 |
| 自动旋转 | 慢速旋转 |
| R | 重置视角 |
| Esc | 清除选择 |

---

## 6. 为什么这个视图有价值

### 6.1 可以看“类的实例覆盖”

某个类只有 1 个实例，还是 2 个、3 个？

```text
vpn.status  → ● default
            → ● work
browser.open → ● chrome
             → ● edge
```

### 6.2 可以看“层的类密度”

点层类多、面层类少、体层更少——这符合“越往上越聚合”的架构直觉。

### 6.3 可以看“跨层组合”

体实例不是孤立的；它通过组合关系连接到面、线、点。

### 6.4 可以看“类/实例比例”

- 类多、实例少 → 复用不足或刚起步。
- 类少、实例多 → 模板化程度高。
- 某层实例爆炸 → 需要抽象新类。

---

## 7. 与嵌套体积视图的关系

| 视图 | 文件 | 强项 | 弱项 |
|---|---|---|---|
| 嵌套体积 | `atom-3d.html` | 包含关系、空间感、运行粒子 | 类/实例数量不直观 |
| 坐标轴晶格 | `atom-3d-axes.html` | 类×实例×层、组合关系、统计 | 空间包含感较弱 |

建议：

- **默认进入坐标轴晶格**：看类/实例/层结构。
- **点击某个体实例 → 切到嵌套体积**：看它包住哪些面/线/点。
- 两个视图共用同一份数据，只是投影不同。

---

## 8. 实现说明

- 单文件 `atom-3d-axes.html`。
- Canvas 2D + 手写 3D 投影。
- 画家算法：远到近绘制。
- 类 = 线框立方体；实例 = 径向渐变发光点；层 = 半透明多边形 + 网格。
- 组合关系 = 投影后的二次贝塞尔曲线 + 流动粒子。
- 无外部依赖；约 33KB。
- 已通过 `node --check`、HTMLParser 标签平衡、mock DOM/canvas 运行时冒烟。

### 数据接口

```ts
type AxisNode = {
  kind: "class" | "instance";
  layer: "point" | "line" | "surface" | "body";
  x: number;          // class index
  y: number;          // instance index（class=0）
  z: number;          // layer
  id: string;
  classId?: string;
  revision?: number;
  effect?: "L0" | "L1" | "L2" | "L3";
};

type ComposeEdge = {
  from: string;
  to: string;
  kind: "compose";
};
```

---

## 9. 风险与修正

| 风险 | 修正 |
|---|---|
| X 轴每层类数不同，列不对齐 | 每层独立列；X 轴只表示“类序号”，不表示全局类 id |
| 类与实例混淆 | 类=空心方块 `Y=0`；实例=实心点 `Y>0` |
| 层平面透视遮挡 | 半透明平面 + 可调 Z 间距 + 旋转 |
| 组合线太乱 | 默认低透明度；选中实例才高亮相关线；可关闭 |
| 标签重叠 | 类标签常驻；实例标签仅 hover/selected |
| 3D 距离被误读 | 轴标签 + 层标签 + 图例；不要用距离表达业务重要性 |

---

## 10. 一句话总结

**X 轴放类，Y 轴放实例，Z 轴放点/线/面/体。**

每个 Z 平面是一个层；每列是一个类；每个实例沿 Y 展开；跨层虚线表示组合关系。  
这样一张 3D 晶格同时回答：**有哪些类、每个类有哪些实例、它们属于哪层、如何组合。**
