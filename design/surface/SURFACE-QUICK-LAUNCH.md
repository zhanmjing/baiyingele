# 面层快速启动：功能类与实例（v0.1）

> 需求：面层快速启动实例，能选择点层实例或线层实例，并“可视化地启动”。
>
> 结论：拆成两个面层类：`surface.quick-launch`（选择器）与 `surface.launch-console`（启动可视化）。前者选 PointInstance / FlowInstance，后者展示 PointRun / FlowRun 的运行过程。

---

## 0. 一句话结论

```text
surface.quick-launch
  ├── 搜索 / tabs / 结果列表
  ├── 选中项预览（点实例参数 / 线实例槽位）
  └── 启动按钮
        ↓
surface.launch-console
  ├── 点实例：环形进度 + 参数 + 输出
  └── 线实例：节点逐个点亮 + slotRuns + 日志
```

- `surface.quick-launch` 不执行能力，只发 `runPoint` / `runFlow` 意图。
- `surface.launch-console` 不执行业务，只订阅 RunSession 并可视化。
- 启动对象必须是 **PointInstance** / **FlowInstance**，不是 PointClass / FlowClass。

---

## 1. 两个类

### 1.1 `surface.quick-launch`

```ts
type QuickLaunchClass = {
  id: "surface.quick-launch";
  version: "1.0.0";
  regions: ["search", "tabs", "list", "preview", "footer"];
  slots: {
    targets: LaunchTargetSlot[];       // point / flow 混合
    preview: LaunchPreviewSlot;
    actions: ["run", "inspect", "favorite"];
  };
  states: ["idle", "searching", "selected", "running", "error"];
  actions: ["runPoint", "runFlow", "inspect", "favorite", "openHistory"];
};
```

**结果列表统一显示两类对象**：

```text
[PT]   检测 VPN 状态        vpn.default.status@r1       L0   2 分钟前
[PT]   打开 GitHub          open.browser.github@r1      L1   1 分钟前
[FLOW] 确保 VPN（询问）      inst.ensure-vpn-ask@r2      L2   5 分钟前
[FLOW] 打开 GitHub          inst.site-github@r1         L2   1 分钟前
```

每行显示：

- 类型 badge：`POINT` / `FLOW`
- 名称
- 实例 ID + 所属类
- effect 等级（L0/L1/L2/L3）
- 最近运行
- 收藏星标

### 1.2 `surface.launch-console`

```ts
type LaunchConsoleClass = {
  id: "surface.launch-console";
  version: "1.0.0";
  regions: ["header", "progress", "visual", "logs", "result", "footer"];
  slots: {
    run: RunSessionSlot;
    actions: ["cancel", "again", "openHistory"];
  };
  states: ["preparing", "running", "ok", "failed", "canceled"];
};
```

**两种可视化**：

```text
PointRun：
  ┌───────────────┐
  │    ◯ 64%      │   环形进度
  │  POINT RUN    │   参数 / 输出 / 耗时
  └───────────────┘

FlowRun：
  [检测 VPN] → [启动/询问] → [等待连接] → [通知]
      ✓            ●            ○           ○
  节点逐个点亮 + slotRuns 日志
```

---

## 2. 数据模型

```ts
type LaunchTarget =
  | {
      kind: "point";
      pointClassId: string;
      pointInstanceId: string;
      pointInstanceRevision: number;
      effect: "L0" | "L1" | "L2" | "L3";
      params: Json;
    }
  | {
      kind: "flow";
      flowClassId: string;
      flowInstanceId: string;
      flowInstanceRevision: number;
      effect: "L0" | "L1" | "L2" | "L3";
      slots: string[];
    };

type LaunchItem = {
  id: string;
  kind: "point" | "flow";
  name: string;
  classId: string;
  revision: number;
  desc: string;
  effect: string;
  lastRunAt?: string;
  favorite: boolean;
  tags: string[];
};

type LaunchRequest = {
  target: LaunchTarget;
  mode: "run" | "dryRun" | "debug";
  args?: Json;
};

type LaunchRun =
  | { kind: "point"; pointRunId: string; status: RunStatus; output?: Json; error?: Json }
  | { kind: "flow"; flowRunId: string; status: RunStatus; slotRuns: SlotRun[]; error?: Json };
```

**关键**：

- `LaunchTarget` 必须带 revision；不能只写 `vpn.status` 或 `flow.ensure-vpn`。
- `LaunchRequest.mode` 区分运行 / dry-run / 单步调试。
- `LaunchRun.kind` 决定 console 用哪种可视化。

---

## 3. 实例

### 3.1 `surface.quick-launch.global`

```json
{
  "id": "surface.quick-launch.global",
  "surfaceClassId": "surface.quick-launch",
  "surfaceClassVersion": "1.0.0",
  "data": {
    "points": "PointRegistry.search",
    "flows": "FlowInstance.list",
    "favorites": "Favorites.list",
    "recent": "RunHistory.recent"
  },
  "actions": {
    "runPoint": "runPoint:selected",
    "runFlow": "runFlow:selected",
    "inspect": "navigate:surface.inspector",
    "favorite": "command:favorites.toggle",
    "openHistory": "navigate:surface.run-history.flow"
  },
  "placement": "overlay",
  "revision": 1
}
```

- 全局快捷键 `Ctrl+Space` / `Alt+Space` 打开。
- 覆盖层，不阻塞主窗口。

### 3.2 `surface.quick-launch.sidebar`

```json
{
  "id": "surface.quick-launch.sidebar",
  "surfaceClassId": "surface.quick-launch",
  "surfaceClassVersion": "1.0.0",
  "data": {
    "points": "PointRegistry.list",
    "flows": "FlowInstance.favorites",
    "favorites": "Favorites.list",
    "recent": "RunHistory.recent"
  },
  "placement": "sidebar",
  "revision": 1
}
```

- 常驻侧栏，适合开发/调试。
- 只显示收藏 + 最近，不显示全量。

### 3.3 `surface.quick-launch.tray`

```json
{
  "id": "surface.quick-launch.tray",
  "surfaceClassId": "surface.quick-launch",
  "surfaceClassVersion": "1.0.0",
  "data": {
    "targets": "Favorites.list"
  },
  "placement": "tray",
  "revision": 1
}
```

- 托盘菜单里的“快速启动”子菜单。
- 只放收藏的 5–10 个实例。

### 3.4 `surface.launch-console.global`

```json
{
  "id": "surface.launch-console.global",
  "surfaceClassId": "surface.launch-console",
  "surfaceClassVersion": "1.0.0",
  "data": {
    "run": "RunSession.current"
  },
  "actions": {
    "cancel": "run.cancel",
    "again": "run.again",
    "openHistory": "navigate:surface.run-history.flow"
  },
  "placement": "modal",
  "revision": 1
}
```

- 点实例：环形进度 + 参数 + 输出。
- 线实例：节点图 + slotRuns + 日志。
- 失败：错误码、失败节点、重试/打开历史。

---

## 4. 选择逻辑

### 4.1 统一搜索

```text
query 匹配：
  - 实例 id
  - 实例名称
  - 所属类 id / 名称
  - 参数 key/value
  - 槽位名
  - 标签
```

### 4.2 Tabs

```text
全部 / 点实例 / 线实例 / 收藏 / 最近
```

- 默认“全部”，点/线分组显示。
- 收藏/最近来自 `Favorites.list` / `RunHistory.recent`。
- 每组按最近运行/名称排序。

### 4.3 选中预览

- 点实例：显示 `PointClass`、参数、effect、权限、最近输出。
- 线实例：显示 `FlowClass`、槽位列表、绑定的 PointInstance、最近 FlowRun。
- 高风险（L2/L3）显示确认提示；L3 可要求二次确认。

### 4.4 启动

```text
点实例 → runPoint(pointInstanceId@revision, args)
线实例 → runFlow(flowInstanceId@revision, args)
```

**不允许**：

- 直接启动 `PointClass`（没有参数/revision）；
- 直接启动 `FlowClass`（没有绑定具体槽位）；
- 启动没有 revision 的引用。

---

## 5. 可视化启动

### 5.1 PointRun

```text
加载 PointInstance
  → 校验参数
  → 执行原子能力
  → 写入 PointRun
  → 输出
```

控制台显示：

- 环形进度 0–100%
- 当前步骤
- 参数摘要
- 输出 JSON（可折叠）
- 耗时 / 状态
- 取消按钮（L0 可立即取消；L2 可能需要等待安全点）

### 5.2 FlowRun

```text
检测 VPN → 启动/询问 → 等待连接 → 通知
   ✓           ●            ○           ○
```

控制台显示：

- 节点图：pending / running / ok / failed / skipped
- 当前 slot + 绑定的 PointInstance
- slotRuns 列表
- 日志
- 取消（请求取消，等待当前节点到安全点）
- 完成后打开运行历史

### 5.3 结束后

- 成功：输出摘要 + “再次启动” + “打开运行历史”
- 失败：错误码 + 失败 slot + 重试 / 打开设置
- 取消：保留已完成的 PointRun / slotRuns

---

## 6. 键盘与交互

```text
↑ / ↓     移动选择
Enter     启动选中实例
/         聚焦搜索
Esc       关闭 console / 清空搜索
Ctrl+Space 打开全局 quick-launch
```

- 结果列表支持鼠标 + 键盘。
- 收藏星标不触发启动。
- 启动后 console 覆盖，Esc 可关闭；运行中关闭不取消（后台继续）或提示“取消并关闭”。
- 高风险实例启动前确认。

---

## 7. 规则与反模式

### 规则

1. **快速启动是面层，不执行能力**：只发 `runPoint` / `runFlow`。
2. **启动实例，不启动类**：必须带 pointInstanceId / flowInstanceId + revision。
3. **点/线统一列表**：用一个 launcher 服务两类对象，不建两个启动器。
4. **可视化按 run.kind 分支**：PointRun 用 ring，FlowRun 用节点图。
5. **effect 可见**：L0/L1/L2/L3 必须显示；高风险启动前确认。
6. **运行可取消/可回看**：取消保留已完成记录；结束后可打开运行历史。

### 反模式

- ❌ `point-quick-launch` 和 `flow-quick-launch` 两个类。
- ❌ 直接启动 `PointClass` / `FlowClass`。
- ❌ 启动不带 revision 的实例。
- ❌ 所有实例都用同一个进度条，不区分 PointRun / FlowRun。
- ❌ 启动后无日志、无取消、无错误定位。
- ❌ 把 launcher 做成“另一个点层能力”。

---

## 8. 优先级

### P0

- `surface.quick-launch` + `surface.quick-launch.global`
- `surface.launch-console` + `surface.launch-console.global`
- PointInstance / FlowInstance 混合列表
- 搜索、tabs、收藏、最近
- PointRun ring + FlowRun 节点图
- 取消、日志、结果

### P1

- `surface.quick-launch.sidebar`
- `surface.quick-launch.tray`
- dry-run / debug 模式
- 参数表单（启动前可改 args）
- 运行历史联动
- 高风险确认

### P2

- 多选批量启动
- 参数预设/模板
- 语音/自然语言启动
- AI 推荐下一步实例
- 跨设备快速启动

---

## 9. 当前原型

`quick-launch-surface.html` 已实现：

- 混合列表：5 个点实例 + 4 个线实例
- 搜索 / 全部 / 点 / 线 / 收藏 / 最近
- 选中预览：点实例参数、线实例槽位、effect、最近运行
- 启动可视化：
  - 点实例：环形进度 + 4 步日志
  - 线实例：节点逐个点亮 + slotRuns 日志
- 取消 / 再次启动 / 关闭
- 深浅主题
- 键盘 ↑↓ / Enter / `/` / Esc

**原型边界**：所有数据 mock，不执行真实 PointRun/FlowRun；启动是模拟计时器；检查器/运行历史按钮只弹 Toast。

---

## 10. 一句话总结

**快速启动 = 一个混合选择器（`surface.quick-launch`）+ 一个运行可视化台（`surface.launch-console`）。**

点实例和线实例在同一个列表里选；点实例用 PointRun 环形进度，线实例用 FlowRun 节点图；两者都不直接执行能力，只调用运行时。
