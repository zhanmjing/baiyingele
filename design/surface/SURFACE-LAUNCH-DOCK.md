# CLaunch 式启动坞：面层功能类与实例（v0.1）

> 需求：类似 CLaunch 的面层启动实例——分页网格、图标、tab、页 dots、拖拽排序、右键菜单、自动隐藏、热键唤出、皮肤。
>
> 结论：拆成 `surface.launch-dock`（启动坞壳）+ `surface.launch-tile`（图标瓦片）+ `surface.launch-dock-settings`（设置）。每个 tile 绑定一个 PointInstance / FlowInstance，点击后进入 `surface.launch-console` 或轻量 launch bubble。

---

## 0. 一句话结论

```text
surface.launch-dock（分页网格壳）
  ├── tabs / pages / search / page dots
  ├── surface.launch-tile × N
  │     └── 绑定 PointInstance / FlowInstance
  └── footer: icon size / add / settings
        ↓ click tile
surface.launch-console / launch bubble
```

- **CLaunch 式 = 鼠标优先、常驻、分页网格、图标化**。
- **QuickLaunch 式 = 键盘优先、搜索覆盖层、混合列表**。
- 两者共享同一个 `LaunchTarget` 和 `runPoint/runFlow`。

---

## 1. 两类启动面的区别

| 维度 | `surface.quick-launch` | `surface.launch-dock` |
|---|---|---|
| 交互 | 搜索 + 键盘 | 图标 + 鼠标 + 页签 |
| 形态 | 临时覆盖层 | 常驻/可自动隐藏的 dock |
| 列表 | 点/线混合列表 | 分页网格 + tile |
| 排序 | 最近/收藏 | 拖拽排序、手动布局 |
| 快捷键 | Enter 启动 | 数字键 1–0 启动当前页 |
| 外观 | 搜索结果 | 皮肤、图标大小、页 dots |
| 适合 | 知道名字，快速搜 | 常用入口，肌肉记忆 |

---

## 2. 对象模型

### 2.1 `surface.launch-dock`

```ts
type LaunchDockClass = {
  id: "surface.launch-dock";
  version: "1.0.0";
  regions: ["tabs", "grid", "pager", "footer"];
  slots: {
    tabs: LaunchDockTab[];
    pages: LaunchDockPage[];
    tiles: LaunchTileSlot[];
    settings: LaunchDockSettingsSlot;
  };
  states: ["visible", "hidden", "pinned", "editing", "dragging", "searching"];
  actions: ["switchTab", "nextPage", "prevPage", "runTile", "addTile", "removeTile", "reorderTile", "openSettings", "togglePin", "toggleAutoHide"];
};
```

### 2.2 `surface.launch-tile`

```ts
type LaunchTileClass = {
  id: "surface.launch-tile";
  version: "1.0.0";
  regions: ["icon", "label", "sub", "badge", "hotkey"];
  slots: {
    target: LaunchTargetSlot;
    icon: IconRef;
    label: string;
    hotkey?: string;
  };
  states: ["idle", "hover", "running", "ok", "failed", "disabled"];
  actions: ["run", "inspect", "favorite", "edit", "remove"];
};
```

### 2.3 `LaunchDockInstance`

```ts
type LaunchDockInstance = {
  id: string;                       // surface.launch-dock.desktop
  surfaceClassId: "surface.launch-dock";
  surfaceClassVersion: "1.0.0";
  tabs: ["常用", "开发", "系统", "工具", "外网"];
  pageSize: number;                 // 10 = 5×2
  pages: LaunchDockPage[];
  settings: {
    iconSize: number;               // 64–92
    columns: number;                // 5
    rows: number;                   // 2
    autoHide: boolean;
    pin: boolean;
    skin: "dark" | "light" | "glass";
    summon: ("double-click" | "edge" | "hotkey" | "tray")[];
  };
  revision: number;
  status: "draft" | "active";
};
```

### 2.4 `LaunchTileInstance`

```ts
type LaunchTileInstance = {
  id: string;                       // tile.github
  surfaceClassId: "surface.launch-tile";
  surfaceClassVersion: "1.0.0";
  target: LaunchTarget;             // PointInstance / FlowInstance + revision
  icon: IconRef;
  label: string;
  sub: string;
  hotkey?: string;                  // 1–0, A–Z
  effect: "L0" | "L1" | "L2" | "L3";
  favorite: boolean;
  revision: number;
};
```

**关键**：

- tile 绑定的是 **实例**，不是类。
- `target` 必须带 `pointInstanceRevision` / `flowInstanceRevision`。
- tile 的 icon/label/hotkey 是 tile 实例内容，不是 PointClass 内容。
- 拖拽排序改变的是 `LaunchDockPage.tileOrder`，不是 FlowClass/PointClass。

---

## 3. 实例

### 3.1 `surface.launch-dock.desktop`

```json
{
  "id": "surface.launch-dock.desktop",
  "surfaceClassId": "surface.launch-dock",
  "surfaceClassVersion": "1.0.0",
  "tabs": ["常用", "开发", "系统", "工具", "外网"],
  "pageSize": 10,
  "pages": [
    { "id": "page.common.1", "tab": "常用", "tiles": ["tile.github", "tile.youtube", "tile.vpn", "tile.vscode"] },
    { "id": "page.system.1", "tab": "系统", "tiles": ["tile.cpu", "tile.gpu", "tile.memory", "tile.network"] }
  ],
  "settings": {
    "iconSize": 74,
    "columns": 5,
    "rows": 2,
    "autoHide": true,
    "pin": true,
    "skin": "dark",
    "summon": ["double-click", "edge", "hotkey"]
  },
  "revision": 1,
  "status": "active"
}
```

### 3.2 tile 实例

| tile | target | 类型 | 热键 | effect |
|---|---|---|---|---|
| `tile.github` | `inst.site-github@r1` | FlowInstance | 1 | L2 |
| `tile.youtube` | `inst.site-youtube@r3` | FlowInstance | 2 | L2 |
| `tile.vpn` | `inst.ensure-vpn-ask@r2` | FlowInstance | 3 | L2 |
| `tile.vscode` | `inst.open-app-vscode-project@r2` | FlowInstance | 4 | L1 |
| `tile.terminal` | `open.terminal@r1` | PointInstance | 5 | L1 |
| `tile.translate` | `inst.screenshot-en-zh@r4` | FlowInstance | 6 | L1 |
| `tile.invoice` | `inst.invoice-company@r6` | FlowInstance | 7 | L1 |
| `tile.cpu` | `sys.cpu.stats@r1` | PointInstance | 1（系统页） | L0 |
| `tile.gpu` | `sys.gpu.stats@r1` | PointInstance | 2（系统页） | L0 |
| `tile.memory` | `sys.memory.stats@r1` | PointInstance | 3（系统页） | L0 |
| `tile.network` | `sys.network.stats@r1` | PointInstance | 4（系统页） | L0 |

---

## 4. CLaunch 式行为

### 4.1 分页网格

- 默认 5 列 × 2 行 = 10 个 tile/页。
- 页 dots 显示页数，可点击切换。
- Tabs 切换分类；每个 tab 独立页码。
- 搜索时跨当前 tab 过滤，重置到第 1 页。
- 空页显示“没有图标 + 添加”。

### 4.2 图标大小 / 皮肤

- `iconSize` 64–92，影响图标与 tile 高度。
- 皮肤：dark / light / glass。
- 图标大小/皮肤属于 `LaunchDockSettings`，不是 tile 内容。

### 4.3 唤出方式

- 双击桌面空白处。
- 鼠标移动到屏幕边缘。
- 全局热键 `Ctrl+Space`。
- 托盘菜单“显示启动坞”。

### 4.4 自动隐藏

- `autoHide=true` 且未 pin：鼠标离开 850ms 后隐藏。
- 鼠标进入 dock / 搜索框聚焦 / 拖拽中 / 右键菜单打开时，不隐藏。
- pin=true：永不自动隐藏。
- 隐藏后显示“显示启动坞”按钮；鼠标靠近屏幕底部再次唤出。

### 4.5 拖拽排序

- tile `draggable=true`。
- 拖到另一个 tile 上：交换/插入顺序。
- 拖拽中不启动 tile。
- 排序写入 `LaunchDockPage.tileOrder`，产生 `LaunchDockInstance` revision。
- 不改变 tile 的 target、PointClass、FlowClass。

### 4.6 右键菜单

```text
启动
检查器
收藏
────
编辑图标
移除
```

- 启动：`runPoint` / `runFlow`。
- 检查器：打开 `surface.inspector.point` / `slot`。
- 收藏：写 `Favorites`。
- 编辑图标：改 label/icon/hotkey；不改 target。
- 移除：从当前页移除 tile；不删除 Point/Flow 实例。

### 4.7 数字热键

- 当前页 tile 对应 `1–9, 0`。
- 不在搜索框聚焦时生效。
- 全局热键冲突检测；冲突时提示。
- 直接启动不展开 dock（CLaunch 的“直接热键启动”）。

---

## 5. 启动可视化

Dock 点击 tile 后有两种呈现：

### 5.1 轻量 launch bubble

适合 L0/L1：

```text
┌──────────────────────────────────────┐
│ FLOW  打开 GitHub          running   │
│ ███████████░░░░░░  62%               │
│ FlowRun · inst.site-github@r1 · L2    │
└──────────────────────────────────────┘
```

- 2–3 秒自动消失。
- 成功：绿色 ok；失败：红色 failed + 打开 console。
- 不阻塞 dock。

### 5.2 完整 launch console

适合 L2/L3、长流程：

- 复用 `surface.launch-console`。
- 节点图 / slotRuns / 日志 / 取消 / 打开历史。
- 用户点击“详情”或失败时进入。

---

## 6. 规则与反模式

### 规则

1. **tile 绑定实例，不绑定类**：PointInstance / FlowInstance + revision。
2. **拖拽只改布局**：`tileOrder` 属于 dock 实例，不改变业务实例。
3. **新增一个图标 = 新增一个 tile 实例**，不是新增 `surface.github-tile` 类。
4. **图标/标签/热键是 tile 内容**，不是 PointClass 内容。
5. **自动隐藏不能打断交互**：拖拽/右键/搜索聚焦时不隐藏。
6. **L2/L3 启动前确认**；L3 二次确认。
7. **热键冲突检测**；数字键只在当前页有效。
8. **隐藏/显示/固定是 dock 状态**，不是新 class。

### 反模式

- ❌ 为 GitHub/YouTube 各建一个启动坞类。
- ❌ 把 PointClass 直接放在 tile 上，没有 PointInstance/revision。
- ❌ 拖拽排序改 FlowClass 或 PointClass。
- ❌ 自动隐藏在拖拽时触发，图标“跑掉”。
- ❌ 右键菜单的“移除”删除底层 Point/Flow 实例。
- ❌ 所有 tile 共用同一个图标/标签。
- ❌ 启动 L3 不确认。

---

## 7. 优先级

### P0

- `surface.launch-dock` + `surface.launch-dock.desktop`
- `surface.launch-tile` + 10 个常用 tile
- 分页网格（5×2）、tabs、页 dots
- 搜索、拖拽排序、右键菜单
- 轻量 launch bubble
- 固定/自动隐藏、Ctrl+Space

### P1

- 图标大小、皮肤（dark/light/glass）
- 数字热键 1–0
- 添加/编辑 tile
- 边缘唤出、双击桌面
- L2/L3 确认
- 完整 launch console 联动

### P2

- 多页/多 dock/多显示器
- tile 文件夹/分组
- 动态 tile（显示系统状态/最近运行）
- 皮肤市场
- 导入/导出 dock 布局
- AI 自动整理图标

---

## 8. 当前原型

`launch-dock-surface.html` 已实现：

- 5 个 tab：常用 / 开发 / 系统 / 工具 / 外网
- 5×2 分页网格 + 页 dots（常用/外网有 2 页）
- 30+ tile：GitHub、YouTube、VPN、VS Code、终端、截图翻译、发票归档、CPU/GPU/内存/网速等
- 搜索、拖拽排序、右键菜单（启动/检查器/收藏/编辑/移除）
- 点击 tile → 轻量 launch bubble，带进度与成功状态
- 固定/自动隐藏、双击桌面、边缘唤出、`Ctrl+Space`、数字键 1–0
- 图标大小 slider、深浅皮肤、localStorage

**原型边界**：数据 mock；tile 点击是模拟进度；不执行真实 PointRun/FlowRun；检查器/设置/添加只弹 Toast。

---

## 9. 一句话总结

**CLaunch 式面层实例 = `surface.launch-dock`（分页网格壳）+ `surface.launch-tile`（绑定 Point/Flow 实例的图标）。**

新增一个图标是新增 tile 实例；新增一个分类是新增 tab/page；拖拽只改 dock 布局；启动仍然走 `runPoint` / `runFlow`。
