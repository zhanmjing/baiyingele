# 面层系统状态显示：功能类与实例（v0.1）

> 需求：显示网速、内存、CPU、GPU 使用率与温度等系统状态。
>
> 结论：系统状态显示不是一个“系统监控页面类”，而是 **MetricCard + Dashboard + HUD + TrayMenu + Notification + Settings** 这组面层实例的组合；底层由 `sys.*` 点实例提供采样数据，面层只负责呈现与订阅。

---

## 0. 先给结论

```text
点层：sys.cpu.stats / sys.gpu.stats / sys.memory.stats / sys.network.stats / sys.disk.stats
  ↓ MetricStream（采样 + 历史窗口）
面层：surface.metric-card（单项指标）
  ├── surface.system-monitor（dashboard 实例）
  ├── surface.hud.system-status（HUD 实例）
  ├── surface.tray.system-status（托盘实例）
  ├── surface.notify.system-threshold（告警实例）
  └── surface.settings.system-monitor（设置实例）
```

- **`surface.metric-card` 是类**：CPU / GPU / 内存 / 网速 / 磁盘都是它的实例。
- **`surface.system-monitor` 是 `surface.dashboard` 的实例**：组合 5–6 个 metric card。
- **`surface.hud.system-status` 是 `surface.hud` 的实例**：紧凑浮层。
- **`surface.tray.system-status` 是 `surface.tray-menu` 的实例**：文本摘要。
- **`surface.notify.system-threshold` 是 `surface.notification` 的实例**：阈值告警。
- **`surface.settings.system-monitor` 是 `surface.form` 的实例**：采样/阈值/显示设置。

---

## 1. 点层数据源

| PointClass | 输出 | 说明 |
|---|---|---|
| `sys.cpu.stats` | `usage`、`perCore[]`、`tempC`、`freqMHz`、`cores`、`threads` | CPU 总占用 + 每核 + 温度 + 频率 |
| `sys.gpu.stats` | `usage`、`tempC`、`vramUsed`、`vramTotal`、`fanPct`、`vendor` | GPU 占用 + 温度 + VRAM + 风扇 |
| `sys.memory.stats` | `used`、`total`、`available`、`pct`、`swapUsed`、`swapTotal` | 内存 + Swap |
| `sys.network.stats` | `rxBps`、`txBps`、`rxTotal`、`txTotal`、`pingMs`、`iface` | 网速 + 总流量 + 延迟 |
| `sys.disk.stats` | `used`、`total`、`free`、`readBps`、`writeBps`、`tempC` | 磁盘容量 + 读写 + 温度 |
| `sys.sensors.temp` | `probes[]` | 通用温度探针（可选） |
| `sys.uptime` | `seconds`、`bootTime` | 开机时长 |

**GPU 厂商差异**：

```text
sys.gpu.stats
  ├── sys.gpu.nvidia@r1   (NVML)
  ├── sys.gpu.amd@r1      (ADL / WMI)
  ├── sys.gpu.intel@r1    (IGCL / WMI)
  └── sys.gpu.generic@r1  (WMI，可能没有温度)
```

同一个 `sys.gpu.stats` 类，不同厂商是不同 PointInstance；不新增 `sys.nvidia.stats` 类。

---

## 2. 采样模型

系统指标不是一次性值，而是**流**。

```ts
type MetricSpec = {
  key: string;                 // cpu.usage / gpu.temp / net.rx
  label: string;
  unit: "%" | "°C" | "MB/s" | "GB" | "MHz" | "ms" | "";
  kind: "gauge" | "rate" | "counter" | "temperature" | "text";
  min?: number;
  max?: number;
  warn?: number;
  critical?: number;
  historySec?: number;
  format?: string;
};

type MetricSample = {
  key: string;
  value: number | string;
  unit: string;
  at: string;
  status: "ok" | "warn" | "critical" | "unknown";
  source: string;              // sys.cpu.stats@r1
};

type MetricStream = {
  id: string;
  sourcePointInstance: AtomRef;
  intervalMs: number;
  windowSec: number;
  samples: MetricSample[];     // ring buffer
  status: "live" | "paused" | "error";
};
```

**关键原则**：

- 一个 `MetricStream` 只对应一个采样源；多个面层实例共享同一个流。
- Dashboard 1s、HUD 2s、Tray 5s 可以有不同的**展示节流**，但底层采样只跑一份。
- 面层隐藏时暂停订阅；重新显示时先用最后一个样本，再恢复。
- 采样失败显示 `unknown`，不要显示 0 或假装正常。
- 温度/功耗等传感器可能不存在；`unknown` 是合法状态。

---

## 3. MetricCard 类

```ts
type MetricCardClass = {
  id: "surface.metric-card";
  version: "1.0.0";
  regions: ["label", "value", "unit", "status", "history"];
  slots: ["metricSpec", "stream", "actions[]"];
  actions: ["open", "settings", "pause"];
  states: ["ok", "warn", "critical", "unknown"];
};
```

实例：

| 实例 | spec | stream | 显示 |
|---|---|---|---|
| `metric.cpu@r1` | `{key:"cpu.usage",label:"CPU",unit:"%",kind:"gauge",warn:80,critical:95,historySec:60}` | `MetricStream.cpu` | 42% · 58°C · 3.9GHz · 每核条 |
| `metric.gpu@r1` | `{key:"gpu.usage",label:"GPU",unit:"%",kind:"gauge",warn:90,critical:98}` | `MetricStream.gpu` | 67% · 63°C · VRAM 6.2/8GB · Fan 48% |
| `metric.memory@r1` | `{key:"mem.pct",label:"MEM",unit:"%",kind:"gauge",warn:80,critical:92}` | `MetricStream.memory` | 39% · 12.4/32GB · Swap 1.2GB |
| `metric.network@r1` | `{key:"net.rx",label:"NET",unit:"MB/s",kind:"rate"}` | `MetricStream.network` | ↓1.24 MB/s · ↑240 KB/s · Ping 28ms |
| `metric.disk@r1` | `{key:"disk.usedPct",label:"DISK",unit:"%",kind:"gauge",warn:85,critical:95}` | `MetricStream.disk` | 40% · 412/1024GB · R18/W4 MB/s · 41°C |

**MetricCard 的显示元素**：

- label + 主数值 + 单位
- 状态点：ok / warn / critical / unknown
- 副信息：温度、频率、VRAM、Ping、Swap 等
- sparkline：最近 60s
- 阈值标记：warn/critical 线
- 点击 → 打开系统监控页；齿轮 → 打开设置

---

## 4. Dashboard 实例：`surface.system-monitor`

```ts
Flow? no —— SurfaceInstance {
  id: "surface.system-monitor",
  surfaceClassId: "surface.dashboard",
  surfaceClassVersion: "1.0.0",
  cards: [
    "metric.cpu@r1",
    "metric.gpu@r1",
    "metric.memory@r1",
    "metric.network@r1",
    "metric.disk@r1",
    "metric.uptime@r1"
  ],
  data: {
    cards: "Metrics.system.cards",
    streams: "MetricStream.system"
  },
  actions: {
    pause: "metrics.pause",
    refresh: "metrics.refresh",
    settings: "navigate:surface.settings.system-monitor"
  },
  placement: "main",
  revision: 2
}
```

布局：

```text
┌─────────────────────────────────────────────────────┐
│ 系统状态   LIVE · 1s sample      uptime 3d 14h      │
├───────────────┬───────────────┬─────────────────────┤
│ CPU 42%       │ GPU 67%       │ MEM 39%             │
│ 58°C 3.9GHz   │ 63°C 6.2/8GB  │ 12.4/32GB           │
│ ▁▂▃▅▆▅▇▆▅▆    │ ▁▃▅▆▇▆▇▆▇▆    │ ▁▂▃▄▅▄▅▆▅▆          │
├───────────────┼───────────────┼─────────────────────┤
│ NET 1.24MB/s  │ DISK 40%      │ TEMP 58°C           │
│ ↓1.24 ↑240K   │ 412/1024GB    │ CPU 58 · GPU 63     │
└───────────────┴───────────────┴─────────────────────┘
```

细节：

- CPU 卡可展开每核条形图。
- GPU 卡显示 VRAM 使用条 + 风扇。
- 网速卡用双线：下行/上行。
- 温度卡用颜色阈值：绿/黄/红。
- 顶部有暂停/刷新/设置。

---

## 5. HUD 实例：`surface.hud.system-status`

```ts
SurfaceInstance {
  id: "surface.hud.system-status",
  surfaceClassId: "surface.hud",
  placement: "overlay",
  content: ["metric.cpu", "metric.gpu", "metric.memory", "metric.network"],
  actions: { open: "navigate:surface.system-monitor", pin: "hud.pin", dismiss: "hud.dismiss" },
  revision: 1
}
```

紧凑布局：

```text
┌─────────────────────────────┐
│ CPU 42% 58°C │ GPU 67% 63°C │
│ RAM 39%      │ NET 1.24M/s  │
└─────────────────────────────┘
```

- 2×2 或 1×4。
- 半透明背景、置顶、可拖动、可固定。
- 默认 2s 刷新，降低开销。
- 点击展开系统监控页；右键固定/关闭。
- 无传感器时显示 `—`，不显示 0。

---

## 6. Tray 实例：`surface.tray.system-status`

```text
CPU 42% · 58°C
GPU 67% · 63°C
RAM 12.4 / 32 GB
NET ↓1.24 MB/s ↑240 KB/s
────────────
打开系统监控
```

- 5s 刷新，纯文本，低开销。
- 托盘菜单不适合 sparkline/大面积图表。
- 阈值超限时在 tray icon 上显示小红点/黄色感叹号。

---

## 7. Notification 实例：`surface.notify.system-threshold`

```ts
SurfaceInstance {
  id: "surface.notify.system-threshold",
  surfaceClassId: "surface.notification",
  data: { message: "MetricAlert.summary" },
  actions: { open: "navigate:surface.system-monitor", dismiss: "toast.dismiss" },
  placement: "toast",
  revision: 1
}
```

示例：

```text
GPU 温度告警
GPU 温度 86°C，超过警戒线 80°C。
当前占用 94%，风扇 72%。
[打开系统监控] [关闭]
```

告警规则：

- 连续 3 个采样超过阈值才告警，避免瞬时尖峰。
- 同一指标 5 分钟内不重复弹窗（可配置冷却）。
- 恢复后发一条“已恢复”通知（可选）。
- 阈值来源：`SettingValue`，不是硬编码。

---

## 8. Settings 实例：`surface.settings.system-monitor`

```ts
SurfaceInstance {
  id: "surface.settings.system-monitor",
  surfaceClassId: "surface.form",
  placement: "settings",
  data: {
    sampleIntervalMs: "settings.system.sampleIntervalMs",
    historySec: "settings.system.historySec",
    cpuWarn: "settings.system.cpu.warn",
    gpuTempWarn: "settings.system.gpu.tempWarn",
    alwaysOnTop: "settings.system.alwaysOnTop"
  },
  actions: { save: "settings.saveSystem", test: "metrics.test" },
  revision: 2
}
```

设置项：

| 设置 | 默认 | 说明 |
|---|---|---|
| `sampleIntervalMs` | 1000 | 采样间隔，500–5000ms |
| `historySec` | 60 | sparkline 窗口，10–300s |
| `cpuWarn` | 80 | CPU 警戒线 |
| `cpuCritical` | 95 | CPU 严重线 |
| `gpuTempWarn` | 80 | GPU 温度警戒线 |
| `gpuTempCritical` | 88 | GPU 温度严重线 |
| `memWarn` | 80 | 内存警戒线 |
| `diskWarn` | 85 | 磁盘警戒线 |
| `alwaysOnTop` | false | HUD 置顶 |
| `hudRefreshMs` | 2000 | HUD 刷新 |
| `trayRefreshMs` | 5000 | 托盘刷新 |

---

## 9. 刷新策略

| 面层 | 刷新 | 说明 |
|---|---|---|
| Dashboard | 1s | 可见时刷新；隐藏暂停 |
| HUD | 2s | 低开销；置顶时也限频 |
| Tray | 5s | 文本摘要 |
| Notification | 事件驱动 | 阈值触发，不轮询 |
| Settings | 手动 | 保存后重启采样 |

**共享采样**：

```text
sys.cpu.stats@r1 ──┐
sys.gpu.stats@r1 ──┼──> MetricStream.system (1s)
sys.mem.stats@r1 ──┤        │
sys.net.stats@r1 ──┘        ├── Dashboard (1s)
                             ├── HUD (2s)
                             ├── Tray (5s)
                             └── Notification (event)
```

不要 dashboard/HUD/tray 各起一个 WMI 查询；用一个采样服务，面层只订阅。

---

## 10. 阈值与状态

```text
ok       → 正常
warn     → 超过警戒线
critical → 超过严重线
unknown  → 传感器不可用/采样失败
```

颜色：

- ok：绿 `#22c55e`
- warn：黄 `#f59e0b`
- critical：红 `#ef4444`
- unknown：灰 `#64748b`

**不要用 0 表示 unknown**；0% 和“读不到”是两件事。

---

## 11. 当前原型

`surface-instance-visual.html` 已加入：

- 新类：`surface.metric-card`
- 新实例：
  - `metric.cpu@r1`
  - `metric.gpu@r1`
  - `metric.memory@r1`
  - `metric.network@r1`
  - `metric.disk@r1`
  - `surface.system-monitor@r2`（dashboard）
  - `surface.hud.system-status@r1`
  - `surface.tray.system-status@r1`
  - `surface.notify.system-threshold@r1`
  - `surface.settings.system-monitor@r2`
- 默认打开 `surface.system-monitor`。
- 点击绑定行仍可换 target / 生成新 revision。
- 数据是 mock；没有接 WMI/PDH/NVML/ADL。

---

## 12. 实现优先级

### P0

- `sys.cpu.stats`、`sys.memory.stats`、`sys.network.stats`
- `surface.metric-card`（CPU / MEM / NET）
- `surface.system-monitor`（dashboard）
- 1s 采样 + 60s 环形缓冲
- 阈值状态

### P1

- `sys.gpu.stats`（NVIDIA/AMD/Intel 实例）
- `sys.disk.stats`
- `surface.hud.system-status`
- `surface.tray.system-status`
- `surface.notify.system-threshold`
- `surface.settings.system-monitor`

### P2

- 每核 CPU、每 GPU、多磁盘、多网卡
- 历史持久化/导出
- 进程 Top N
- 传感器扩展（风扇、功耗、电池）
- 远程/多机监控

---

## 13. 一句话总结

**系统状态显示 = 少量面层类 + 每个指标一个 MetricCard 实例 + 一个共享 MetricStream。**

不要为 CPU、GPU、内存、网速各建一个“系统监控页面类”；它们是 `surface.metric-card` 的实例，由 `surface.system-monitor` 这个 dashboard 实例组合起来。
