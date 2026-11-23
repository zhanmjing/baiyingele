# 线层功能需求：打开 YouTube 前确保 VPN 可用

> 场景：用户要打开 YouTube，但必须先确认 VPN 已开启/已连接。
>
> 目标：成功时直接打开 YouTube；失败时明确告诉用户“哪里出了问题”，并提供“打开 VPN / 重试 / 取消”等下一步动作；可配置为“VPN 未打开时自动打开默认 VPN 软件”。
>
> 分层：这是线层需求。VPN 状态检测、启动 VPN、连接 VPN、打开 URL、通知都是点层能力；线层负责组合、判断、等待、重试和错误提示。

---

## 0. 结论

建议拆成两个可复用 FlowClass：

1. **`flow.ensure-vpn`**：确保 VPN 可用（检测 → 启动/询问 → 等待 → 连接/询问 → 超时/错误）。
2. **`flow.open-youtube-with-vpn`**：先调用 `flow.ensure-vpn`，成功再 `open`，最后 `notify`。

这样“确保 VPN”可以被其他站点/应用复用，而不是把 VPN 逻辑写死在“打开 YouTube”里。

```text
flow.open-youtube-with-vpn
  ├── slot.vpn    -> flow.ensure-vpn（子流程）
  ├── slot.open   -> open.browser.youtube（点实例）
  └── slot.notify -> notify.system（点实例）
```

---

## 1. 用户故事

### 1.1 成功路径

```text
用户触发“打开 YouTube”
  → 检测到 VPN 已连接
  → 打开 https://www.youtube.com
  → 提示“VPN 已连接，已打开 YouTube”
```

### 1.2 VPN 软件没打开

```text
检测到 VPN 软件未运行
  → 如果配置为“自动打开默认 VPN”：
       启动默认 VPN → 等待连接 → 成功则打开 YouTube
  → 否则弹窗：
       “VPN 软件未运行，是否打开 [默认 VPN]？”
       按钮：打开 VPN / 我已手动打开 / 取消
  → 用户选择“打开 VPN” → 启动 → 等待
  → 超时/失败 → 提示具体原因
```

### 1.3 VPN 软件打开了但没连接

```text
检测到 VPN 进程在，但隧道未连接
  → 如果配置为“自动连接”：
       调用 VPN 连接能力 → 等待
  → 否则弹窗：
       “VPN 已打开，但未连接。是否连接？”
       按钮：连接 / 打开 VPN 面板 / 取消
```

### 1.4 失败提醒

失败提示必须包含三部分：

1. **哪里出了问题**（错误码 + 人话）；
2. **现在是什么状态**（VPN 未安装/未运行/未连接/连接超时/已连接但网络不可达）；
3. **下一步能做什么**（打开 VPN / 重试 / 打开设置 / 取消）。

---

## 2. FlowClass 设计

### 2.1 `flow.ensure-vpn`

```ts
FlowClass {
  id: "flow.ensure-vpn",
  version: "1.0.0",
  name: "确保 VPN 可用",
  family: "网络 / 连接保障",

  params: [
    { key: "mode", type: "enum", options: ["ask", "auto-open", "require-manual"], default: "ask" },
    { key: "autoConnect", type: "bool", default: false },
    { key: "timeoutSec", type: "number", default: 30 },
    { key: "pollIntervalMs", type: "number", default: 1000 }
  ],

  outputs: [
    { key: "connected", type: "bool" },
    { key: "reason", type: "text" },
    { key: "appRunning", type: "bool" }
  ],

  slots: [
    { slotId: "status",  accepts: "vpn.status",  default: "vpn.default.status@r1",  required: true },
    { slotId: "launch",  accepts: "app.launch",  default: "vpn.default.launch@r1",  required: true },
    { slotId: "connect", accepts: "vpn.connect", default: "vpn.default.connect@r1", required: false },
    { slotId: "notify",  accepts: "notify.toast", default: "notify.system@r1",      required: true }
  ],

  gates: ["if", "approval", "retry", "timeout"],
  edges: [
    "status -> if",
    "if(connected) -> return true",
    "if(!connected && !appRunning) -> launch/approval -> wait",
    "if(!connected && appRunning) -> connect/approval -> wait",
    "wait -> retry(status) -> if",
    "timeout -> notify -> return false"
  ]
}
```

**要点**：

- `status` 点实例返回的不只是 bool，而是结构化状态：`appFound / appRunning / tunnelConnected / profile / error`。
- `launch` 只负责启动 VPN 软件，不假设启动后就自动连接。
- `connect` 是可选的；没有自动连接能力时，走 `approval` gate 让用户打开 VPN 面板。
- `retry` 用于轮询等待连接；`timeout` 防止无限等待。
- `approval` 是线层门，不是 PointInstance；弹窗、按钮、记住选择都由 gate 的 UI schema 提供。
- 这样 `vpn.status / app.launch / vpn.connect / sys.open / notify` 是点实例，`approval / if / retry / timeout` 是线层门，边界清楚。

### 2.2 `flow.open-youtube-with-vpn`

```ts
FlowClass {
  id: "flow.open-youtube-with-vpn",
  version: "1.0.0",
  name: "打开 YouTube（确保 VPN）",
  family: "网站 / 连接保障",

  params: [
    { key: "url", type: "text", default: "https://www.youtube.com" }
  ],

  slots: [
    { slotId: "vpn",    accepts: "flow.ensure-vpn", default: "inst.ensure-vpn-ask@r2", required: true },
    { slotId: "open",   accepts: "sys.open",        default: "open.browser.youtube@r2", required: true },
    { slotId: "notify", accepts: "notify.toast",    default: "notify.system@r1", required: true }
  ],

  edges: [
    "vpn.connected -> if(true) -> open(url)",
    "vpn.connected -> if(false) -> notify(reason)",
    "open -> notify(success)"
  ]
}
```

**要点**：

- `flow.open-youtube-with-vpn` 不直接检测 VPN；它组合 `flow.ensure-vpn` 子流程。
- `open` 点实例参数只关心 `url` 和浏览器选择；VPN 细节不泄漏到打开动作。
- 成功/失败通知都由 `notify` 点实例承担。

---

## 3. FlowInstance 示例

```json
{
  "id": "inst.youtube-with-vpn",
  "flowClassId": "flow.open-youtube-with-vpn",
  "flowClassVersion": "1.0.0",
  "name": "打开 YouTube（默认 VPN）",
  "args": {
    "url": "https://www.youtube.com"
  },
  "bindings": {
    "vpn": "inst.ensure-vpn-ask@r2",
    "open": "open.browser.youtube@r2",
    "notify": "notify.system@r1"
  },
  "revision": 3,
  "status": "active",
  "triggers": [
    { "type": "hotkey", "keys": "Ctrl+Alt+Y" }
  ]
}
```

> `inst.ensure-vpn-ask@r2` 是**子流程实例**绑定，不是 `flow.ensure-vpn` 类引用；`open.browser.youtube@r2`、`notify.system@r1` 是点实例绑定。触发热键属于触发层，不写进 FlowClass。

### 3.1 子流程实例的三种变体

| 子流程实例 | args | 用途 |
|---|---|---|
| `inst.ensure-vpn-ask@r2` | `{mode:"ask", autoConnect:false, timeoutSec:30}` | 默认：未运行时询问用户 |
| `inst.ensure-vpn-auto@r1` | `{mode:"auto-open", autoConnect:false, timeoutSec:30}` | 自动打开 VPN 软件，不自动连接 |
| `inst.ensure-vpn-auto-connect@r1` | `{mode:"auto-open", autoConnect:true, timeoutSec:30}` | 自动打开并尝试连接（需 UiAutomation 权限） |
| `inst.ensure-vpn-manual@r1` | `{mode:"require-manual", autoConnect:false, timeoutSec:0}` | 只提示，不自动处理 |

**父实例绑定哪个子流程实例，由设置决定；换绑定 = 新 FlowInstance revision。** 例如：

```text
autoOpenApp=false -> inst.youtube-with-vpn-ask@r3   (bindings.vpn = inst.ensure-vpn-ask@r2)
autoOpenApp=true  -> inst.youtube-with-vpn-auto@r1  (bindings.vpn = inst.ensure-vpn-auto@r1)
```

> 严格模型下，SubflowSlot 绑定的是 FlowInstance，不是 FlowClass。若要把 `vpnMode` 作为父流程的运行时参数，需要额外的“子流程调用”机制；P0 先用实例变体，边界更清晰。

---

## 4. 点实例建议

| 槽位 | PointClass | 点实例 | 参数 |
|---|---|---|---|
| `status` | `vpn.status` | `vpn.default.status@r1` | `{app: "DefaultVPN", check: ["process","window","tunnel"]}` |
| `launch` | `app.launch` | `vpn.default.launch@r1` | `{app: "DefaultVPN", args: ["--minimized"]}` |
| `connect` | `vpn.connect` | `vpn.default.connect@r1` | `{profile: "default", method: "uia"}` |
| `open` | `sys.open` | `open.browser.youtube@r2` | `{url: "https://www.youtube.com", browser: "default"}` |
| `notify` | `notify.toast` | `notify.system@r1` | `{position: "bottom-right", duration: 3000}` |

**注意**：

- `vpn.status` 必须区分“进程存在”和“隧道已连接”；否则会把“VPN 软件开着但没连上”误判为成功。
- `vpn.connect` 如果通过 UI 自动化点击“连接”，必须声明 `UiAutomation` 权限，并处理登录/验证码/二次验证失败。
- 默认 VPN 应用路径来自设置，不让 FlowInstance 传任意 exe 路径，避免变成“启动任意程序”的提权入口。

---

## 5. 状态机

```text
[Start]
  ↓
[Check VPN]
  ├── connected=true ──────────────→ [Open YouTube] → [Notify success] → [End]
  ├── appFound=false ──────────────→ [Error: VPN_APP_NOT_FOUND] → [Open settings] → [End]
  ├── appRunning=false
  │     ├── mode=auto-open ────────→ [Launch VPN] → [Wait]
  │     └── mode=ask/require-manual → [Ask: 打开 VPN?]
  │             ├── yes → [Launch VPN] → [Wait]
  │             └── no  → [Notify canceled] → [End]
  └── appRunning=true, connected=false
        ├── autoConnect=true ──────→ [Connect VPN] → [Wait]
        └── autoConnect=false ─────→ [Ask: 连接 VPN?]
              ├── yes → [Connect VPN] → [Wait]
              ├── open panel → [Open VPN panel] → [Wait]
              └── no → [Notify canceled] → [End]

[Wait]
  ├── connected=true ──────────────→ [Open YouTube] → [Notify success] → [End]
  ├── timeout ─────────────────────→ [Notify VPN_CONNECT_TIMEOUT] → [Retry/Cancel] → [End]
  └── auth required ───────────────→ [Notify VPN_AUTH_REQUIRED] → [Open VPN] → [End]
```

---

## 6. 设置项

| 设置 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `vpn.defaultApp` | app picker | 空 | 默认 VPN 软件；未设置时 `VPN_APP_NOT_FOUND` |
| `vpn.mode` | enum | `ask` | `ask` / `auto-open` / `require-manual` |
| `vpn.autoOpenApp` | bool | `false` | VPN 未运行时自动打开软件 |
| `vpn.autoConnect` | bool | `false` | VPN 已打开但未连接时自动连接（需要 UiAutomation 权限） |
| `vpn.timeoutSec` | number | `30` | 等待连接的超时 |
| `vpn.pollIntervalMs` | number | `1000` | 状态轮询间隔 |
| `vpn.rememberChoice` | bool | `true` | 记住“以后自动打开默认 VPN” |
| `youtube.url` | text | `https://www.youtube.com` | 目标 URL |
| `notify.onSuccess` | bool | `true` | 成功时是否提示 |

**交互细节**：

- 弹窗按钮：**打开 VPN** / **我已手动打开** / **重试** / **取消**。
- 勾选框：**以后 VPN 未运行时自动打开默认 VPN**；勾选后写 `vpn.autoOpenApp=true`。
- “自动连接”必须单独开关，不能和“自动打开”混为一个设置；自动连接风险更高。
- 失败弹窗提供 **打开 VPN 面板** 和 **打开设置** 两个出口。

---

## 7. 错误模型

| 错误码 | 触发条件 | 用户提示 | 下一步 |
|---|---|---|---|
| `VPN_APP_NOT_FOUND` | 默认 VPN 未配置/路径不存在 | “未找到默认 VPN 软件，请先在设置中选择。” | 打开设置 |
| `VPN_APP_NOT_RUNNING` | 进程不在 | “VPN 软件未运行。” | 打开 VPN / 取消 |
| `VPN_NOT_CONNECTED` | 进程在，隧道未连接 | “VPN 已打开，但未连接。” | 连接 / 打开面板 / 取消 |
| `VPN_CONNECT_TIMEOUT` | 超时仍未连接 | “已等待 30 秒，VPN 仍未连接。” | 重试 / 打开 VPN / 取消 |
| `VPN_AUTH_REQUIRED` | 需要登录/验证码/二次验证 | “VPN 需要登录或验证。” | 打开 VPN 面板 |
| `VPN_PROFILE_MISSING` | 没有可用配置/节点 | “VPN 没有可用配置或节点。” | 打开 VPN 面板 |
| `NETWORK_UNREACHABLE` | VPN 已连接但 YouTube 不可达 | “VPN 已连接，但 YouTube 不可达。” | 重试 / 打开网络设置 |
| `BROWSER_OPEN_FAILED` | 浏览器启动失败 | “VPN 正常，但浏览器打开失败。” | 重试 / 选择浏览器 |
| `USER_CANCELED` | 用户取消 | “已取消打开 YouTube。” | 无 |

---

## 8. 验收标准

1. **VPN 已连接**：触发后直接打开 YouTube，提示“VPN 已连接，已打开 YouTube”。
2. **VPN 未运行 + autoOpen=true**：自动启动默认 VPN，等待连接；成功后打开 YouTube；失败给出具体错误。
3. **VPN 未运行 + autoOpen=false**：弹窗询问“打开 VPN / 取消”；取消则不打开 YouTube。
4. **VPN 进程在但未连接 + autoConnect=false**：弹窗询问“连接 / 打开面板 / 取消”。
5. **VPN 进程在但未连接 + autoConnect=true**：自动调用连接；超时后提示 `VPN_CONNECT_TIMEOUT`，提供重试。
6. **VPN 未配置**：提示 `VPN_APP_NOT_FOUND`，提供“打开设置”。
7. **用户取消**：不打开浏览器，提示 `USER_CANCELED`。
8. **记住选择**：勾选“以后自动打开默认 VPN”后，下次不再询问，直接自动打开。
9. **安全**：不存储 VPN 账号密码；不自动填写验证码；自动连接只使用用户已配置的默认配置。
10. **可观测**：每次运行记录 VPN 状态、采取的动作为、耗时、最终结果、错误码；不记录敏感信息。

---

## 9. 权限与安全

- `vpn.status`：`ProcessRead` / `NetworkRead`（只读）。
- `app.launch`：`ProcessControl`（启动 VPN 软件）。
- `vpn.connect`：`UiAutomation` + `ProcessControl`（可能点击 UI）。
- `approval` gate：无系统权限，但会阻塞等待用户；它不是点实例。
- `sys.open`：`ProcessControl`（打开浏览器/URL）。
- 默认 VPN 应用由设置选择，FlowInstance 不能传任意 exe 路径。
- 自动连接/自动登录必须显式开启；登录、验证码、二次验证一律转人工。
- 失败日志脱敏：不记录账号、密码、Token、节点凭证。

---

## 10. 实现优先级

### P0

- `vpn.status`（进程 + 窗口 + 连接状态）
- `app.launch`
- `approval` gate（打开/取消/重试，线层门）
- `sys.open`
- `notify.toast`
- `flow.ensure-vpn` + `flow.open-youtube-with-vpn`
- 错误码与超时/重试
- 设置项：默认 VPN、autoOpen、timeout

### P1

- `vpn.connect`（自动连接）
- `NETWORK_UNREACHABLE` 检查
- 记住选择/不再提示
- 运行历史与错误诊断

### P2

- 多 VPN 配置/多节点选择
- 按站点自动选择 VPN 配置
- 健康检查与自动重连
- 企业策略（必须使用 VPN、禁止直连）

---

## 11. 一句话总结

这条线的核心不是“打开 YouTube”，而是：

> **先用点实例检测 VPN、启动 VPN、等待/连接 VPN，再由线层根据状态决定“打开、询问、重试还是报错”。**

`flow.ensure-vpn` 是可复用的连接保障子流程；`flow.open-youtube-with-vpn` 只是它的一个具体组合实例。
