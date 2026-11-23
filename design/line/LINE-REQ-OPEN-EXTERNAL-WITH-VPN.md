# 线层功能需求：打开外网网站前确保 VPN（YouTube / GitHub / Google …）

> 结论：把“打开 YouTube 前确保 VPN”泛化为 **`flow.open-external-site`**。YouTube、GitHub、Google 等都是同一个 FlowClass 的不同 **FlowInstance**；VPN 保障由可复用的 **`flow.ensure-vpn`** 子流程承担。
>
> 原则：**新增一个外网站点 = 新增一个 FlowInstance，不是新增一个 FlowClass。**
>
> 关联：`LINE-REQ-OPEN-YOUTUBE-VPN.md`（YouTube 专项版）、`ATOM-UNIFIED-MODEL.md`（点/线统一模型）。

---

## 0. 先给结论

```text
flow.open-external-site（一个类）
  ├── slot.vpn     -> inst.ensure-vpn-ask@r2（可复用子流程实例）
  ├── slot.check   -> net.reachable@r1（可选：目标可达性）
  ├── slot.open    -> open.browser.default@r2（点实例）
  └── slot.notify  -> notify.system@r1（点实例）
```

站点只是实例：

```text
inst.site-youtube  args {url:"https://www.youtube.com", vpnRequirement:"required"}
inst.site-github   args {url:"https://github.com",      vpnRequirement:"required"}
inst.site-google   args {url:"https://www.google.com",  vpnRequirement:"required"}
inst.site-intranet args {url:"http://intranet",         vpnRequirement:"none"}
```

---

## 1. FlowClass：`flow.open-external-site`

```ts
FlowClass {
  id: "flow.open-external-site",
  version: "1.0.0",
  name: "打开外网网站（按策略确保 VPN）",
  family: "网络 / 外网访问",

  params: [
    { key: "url", type: "text", required: true },
    { key: "vpnRequirement", type: "enum",
      options: ["required", "preferred", "none"], default: "required" },
    { key: "checkReachability", type: "bool", default: true },
    { key: "openIn", type: "enum", options: ["default", "browser", "app"], default: "default" }
  ],

  outputs: [
    { key: "opened", type: "bool" },
    { key: "reason", type: "text" }
  ],

  slots: [
    { slotId: "vpn",    accepts: "flow.ensure-vpn", default: "inst.ensure-vpn-ask@r2", required: false },
    { slotId: "check",  accepts: "net.reachable",   default: "net.reachable@r1",       required: false },
    { slotId: "open",   accepts: "sys.open",        default: "open.browser.default@r2", required: true },
    { slotId: "notify", accepts: "notify.toast",    default: "notify.system@r1",       required: true }
  ],

  gates: ["if", "fallback", "approval"],
  edges: [
    "policy = resolvePolicy(url, vpnRequirement)",
    "if(policy == none) -> open",
    "if(policy != none) -> vpn.connected?",
    "if(vpn.connected) -> checkReachability?",
    "if(vpn.connected && checkReachability) -> check.reachable?",
    "if(vpn.connected && reachable) -> open -> notify(success)",
    "if(vpn.failed && policy == required) -> notify(vpn.reason) -> end",
    "if(vpn.failed && policy == preferred) -> approval(仍然打开?) -> open/end",
    "if(reachable == false) -> notify(TARGET_UNREACHABLE) -> end"
  ]
}
```

### 1.1 `vpnRequirement` 三种策略

| 策略 | VPN 不可用时 | 适合 |
|---|---|---|
| `required` | 阻止打开，提示原因，提供“打开 VPN/重试” | YouTube、GitHub、Google 等外网 |
| `preferred` | 先尝试 VPN；失败后询问“仍然直接打开？” | 可选加速/可选代理的站点 |
| `none` | 跳过 VPN，直接打开 | 内网、本地服务、明确不需要 VPN 的站点 |

**默认值建议为 `required`**，但对内网/本地地址自动降级为 `none`，避免“打开 localhost 也要 VPN”这种荒唐行为。

### 1.2 域名策略解析

`resolvePolicy(url, instancePolicy)` 的优先级：

```text
站点实例的 vpnRequirement
  > 用户站点规则（sitePolicies）
  > 全局默认 external.defaultPolicy
  > 内置 fallback：外网 required / 内网 none
```

站点规则示例：

| 模式 | 策略 | 说明 |
|---|---|---|
| `*.youtube.com` | `required` | 外网视频 |
| `github.com` | `required` | 代码托管；可按用户网络覆盖 |
| `*.google.com` | `required` | 搜索/账号 |
| `*.openai.com` | `required` | 外部 AI 服务 |
| `intranet.*` / `localhost` / `127.0.0.1` | `none` | 内网/本机 |
| `*` | `preferred` | 未知外网默认先尝试 VPN |

> GitHub 在不同网络环境下可能可直连；这里按“默认需要 VPN”处理，但允许用户在站点规则里改成 `preferred` 或 `none`。

---

## 2. FlowClass：`flow.ensure-vpn`

沿用之前的可复用子流程：

```ts
FlowClass {
  id: "flow.ensure-vpn",
  version: "1.0.0",
  params: [
    { key: "mode", type: "enum", options: ["ask","auto-open","require-manual"], default: "ask" },
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
    { slotId: "status",  accepts: "vpn.status",  default: "vpn.default.status@r1" },
    { slotId: "launch",  accepts: "app.launch",  default: "vpn.default.launch@r1" },
    { slotId: "connect", accepts: "vpn.connect", default: "vpn.default.connect@r1", required: false },
    { slotId: "notify",  accepts: "notify.toast", default: "notify.system@r1" }
  ],
  gates: ["if","approval","retry","timeout"]
}
```

`flow.open-external-site` 不重复 VPN 逻辑；它只通过 `slot.vpn` 绑定一个 `flow.ensure-vpn` 的 **FlowInstance**。

---

## 3. FlowInstance 目录

### 3.1 共享的 VPN 子流程实例

| 子流程实例 | args | 用途 |
|---|---|---|
| `inst.ensure-vpn-ask@r2` | `{mode:"ask", autoConnect:false, timeoutSec:30}` | 默认：未运行时询问 |
| `inst.ensure-vpn-auto@r1` | `{mode:"auto-open", autoConnect:false, timeoutSec:30}` | 自动打开 VPN 软件 |
| `inst.ensure-vpn-auto-connect@r1` | `{mode:"auto-open", autoConnect:true, timeoutSec:30}` | 自动打开并连接（需 UiAutomation） |
| `inst.ensure-vpn-manual@r1` | `{mode:"require-manual", autoConnect:false, timeoutSec:0}` | 只提示，不自动处理 |

### 3.2 站点实例

| 站点实例 | args.url | vpnRequirement | vpn 绑定 | open 绑定 |
|---|---|---|---|---|
| `inst.site-youtube@r3` | `https://www.youtube.com` | `required` | `inst.ensure-vpn-ask@r2` | `open.browser.youtube@r2` |
| `inst.site-github@r1` | `https://github.com` | `required` | `inst.ensure-vpn-ask@r2` | `open.browser.github@r1` |
| `inst.site-google@r1` | `https://www.google.com` | `required` | `inst.ensure-vpn-ask@r2` | `open.browser.google@r1` |
| `inst.site-intranet@r1` | `http://intranet` | `none` | `—` | `open.browser.intranet@r1` |

**新增站点**：复制一个站点实例，改 `args.url` / `vpnRequirement` / `open` 绑定即可；FlowClass 不动。

### 3.3 GitHub 实例 JSON

```json
{
  "id": "inst.site-github",
  "flowClassId": "flow.open-external-site",
  "flowClassVersion": "1.0.0",
  "name": "打开 GitHub",
  "args": {
    "url": "https://github.com",
    "vpnRequirement": "required",
    "checkReachability": true,
    "openIn": "default"
  },
  "bindings": {
    "vpn": "inst.ensure-vpn-ask@r2",
    "check": "net.reachable@r1",
    "open": "open.browser.github@r1",
    "notify": "notify.system@r1"
  },
  "revision": 1,
  "status": "active"
}
```

### 3.4 YouTube 实例 JSON

```json
{
  "id": "inst.site-youtube",
  "flowClassId": "flow.open-external-site",
  "flowClassVersion": "1.0.0",
  "name": "打开 YouTube",
  "args": {
    "url": "https://www.youtube.com",
    "vpnRequirement": "required",
    "checkReachability": true,
    "openIn": "default"
  },
  "bindings": {
    "vpn": "inst.ensure-vpn-ask@r2",
    "check": "net.reachable@r1",
    "open": "open.browser.youtube@r2",
    "notify": "notify.system@r1"
  },
  "revision": 3,
  "status": "active"
}
```

---

## 4. 点层类与实例

| 槽位 | PointClass | PointInstance | 作用 |
|---|---|---|---|
| `status` | `vpn.status` | `vpn.default.status@r1` | 返回 `appFound/appRunning/tunnelConnected/profile/error` |
| `launch` | `app.launch` | `vpn.default.launch@r1` | 启动默认 VPN 软件 |
| `connect` | `vpn.connect` | `vpn.default.connect@r1` | 自动连接（可选） |
| `check` | `net.reachable` | `net.reachable@r1` | TCP/HTTP 可达性检查 |
| `open` | `sys.open` | `open.browser.default@r2` | 用默认浏览器打开 URL |
| `notify` | `notify.toast` | `notify.system@r1` | 成功/失败提示 |

**点实例参数示例**：

```json
// vpn.default.status@r1
{ "app": "DefaultVPN", "check": ["process", "window", "tunnel"] }

// net.reachable@r1
{ "host": "github.com", "port": 443, "timeoutMs": 5000 }

// open.browser.github@r1
{ "browser": "default", "args": [] }
```

> `net.reachable@r1` 里的 host 是否要随站点变化？严格模型下，不同 host 是不同 PointInstance，例如 `net.reachable.github@r1`、`net.reachable.youtube@r1`；不要在 FlowInstance 内联改 host。

---

## 5. 设置

| 设置 | 默认 | 说明 |
|---|---|---|
| `vpn.defaultApp` | 空 | 默认 VPN 软件；未设置报 `VPN_APP_NOT_FOUND` |
| `vpn.mode` | `ask` | `ask / auto-open / require-manual` |
| `vpn.autoOpenApp` | `false` | VPN 未运行时自动打开软件 |
| `vpn.autoConnect` | `false` | VPN 已打开未连接时自动连接（需 UiAutomation） |
| `vpn.timeoutSec` | `30` | 等待连接超时 |
| `external.defaultPolicy` | `preferred` | 未知外网默认策略 |
| `sitePolicies` | 见上表 | 域名 → `required/preferred/none` |
| `notify.onBlocked` | `true` | 被 VPN 阻止时是否提示 |
| `notify.onSuccess` | `false` | 成功时是否提示（外网站点可关掉） |

**自动打开软件** 与 **自动连接 VPN** 必须是两个独立开关；自动连接涉及 UI 自动化、登录、验证码，默认关闭。

---

## 6. 状态机

```text
[触发站点实例]
  ↓
[resolvePolicy(url)]
  ├── none ─────────────────────────→ [Open URL] → [Notify success] → End
  └── required/preferred
        ↓
[flow.ensure-vpn]
  ├── connected=false
  │     ├── policy=required → [Notify reason] → [Open VPN/Retry/Cancel] → End
  │     └── policy=preferred → [Approval: 仍然直接打开?]
  │             ├── yes → [Open URL] → End
  │             └── no  → End
  └── connected=true
        ↓
[checkReachability?]
  ├── false → [Notify TARGET_UNREACHABLE] → [Retry/Network settings] → End
  └── true  → [Open URL] → [Notify success] → End
```

---

## 7. 错误码

| 错误码 | 场景 | 提示 | 下一步 |
|---|---|---|---|
| `VPN_APP_NOT_FOUND` | 默认 VPN 未配置 | 未找到默认 VPN 软件 | 打开设置 |
| `VPN_APP_NOT_RUNNING` | VPN 进程不在 | VPN 软件未运行 | 打开 VPN / 取消 |
| `VPN_NOT_CONNECTED` | 进程在，隧道未连 | VPN 已打开但未连接 | 连接 / 打开面板 / 取消 |
| `VPN_CONNECT_TIMEOUT` | 等待超时 | 30 秒内未连接 | 重试 / 打开 VPN |
| `VPN_AUTH_REQUIRED` | 需要登录/验证码 | 需要登录或验证 | 打开 VPN 面板 |
| `TARGET_UNREACHABLE` | VPN 已连但目标不可达 | 目标站点不可达 | 重试 / 网络设置 |
| `SITE_POLICY_BLOCKED` | 策略要求 VPN，用户拒绝 | 该站点要求 VPN | 打开 VPN / 取消 |
| `BROWSER_OPEN_FAILED` | 浏览器启动失败 | 浏览器打开失败 | 重试 / 选择浏览器 |
| `USER_CANCELED` | 用户取消 | 已取消 | 无 |

---

## 8. 复用规则

1. **新增外网站点 = 新增 FlowInstance**  
   YouTube / GitHub / Google 都是 `flow.open-external-site` 的实例；不要为每个站点建 FlowClass。

2. **新增 VPN 行为 = 新增 `flow.ensure-vpn` 的 FlowInstance 变体**  
   `ask` / `auto` / `auto-connect` / `manual` 是实例，不是新类。

3. **改 VPN 软件路径/检查项 = 新增 PointInstance**  
   例如 `vpn.other.status@r1`、`vpn.other.launch@r1`，而不是在父 FlowInstance 里内联改参数。

4. **改“先 VPN 后打开”的图结构 = 新 FlowClass 版本**  
   例如增加“目标可达性检查”节点、增加“仍然打开”的 approval 分支。

5. **站点策略是实例参数/设置，不是图**  
   `required / preferred / none` 是 `vpnRequirement` 参数，不需要三个 FlowClass。

---

## 9. 验收标准

1. YouTube 实例：VPN 已连接 → 打开 YouTube；未连接 → 按策略提示/阻止。
2. GitHub 实例：复用同一个 FlowClass 和同一个 `inst.ensure-vpn-ask@r2`；只改 `url`/`open` 绑定。
3. 内网站点：`vpnRequirement=none`，不启动 VPN，直接打开。
4. `required` 策略：VPN 失败时不打开目标；提示具体错误和下一步。
5. `preferred` 策略：VPN 失败时询问“仍然直接打开？”；用户确认才打开。
6. `autoOpenApp=true`：VPN 未运行时自动启动默认 VPN；`autoConnect=true` 才自动连接。
7. 目标可达性检查失败：提示 `TARGET_UNREACHABLE`，不假装成功。
8. 用户取消：不打开浏览器，提示 `USER_CANCELED`。
9. 站点规则修改后，新 FlowInstance revision 生效；旧 revision 不漂移。
10. 运行记录包含：站点实例、policy、VPN 状态、动作、耗时、结果、错误码；不记录账号/密码/Token。

---

## 10. 优先级

### P0

- `flow.ensure-vpn` + `inst.ensure-vpn-ask@r2`
- `flow.open-external-site` + `inst.site-youtube` / `inst.site-github`
- `vpn.status`、`app.launch`、`sys.open`、`notify.toast`
- `vpnRequirement=required`
- 基本错误提示与 approval

### P1

- `net.reachable` 可达性检查
- `preferred` 策略 + “仍然打开”
- `vpn.connect` 自动连接
- 站点规则 `sitePolicies`
- 多 VPN 配置

### P2

- 按站点自动选择 VPN profile/节点
- 企业策略（必须 VPN/禁止直连）
- 健康检查/自动重连
- 批量站点实例管理

---

## 11. 一句话总结

**一个 `flow.open-external-site` 类 + 一个 `flow.ensure-vpn` 子流程 + 每个站点一个 FlowInstance**，就能复用 YouTube、GitHub、Google 等所有外网访问；VPN 细节只在 `flow.ensure-vpn` 里改，站点差异只在实例的 `url`、`vpnRequirement` 和绑定里改。
