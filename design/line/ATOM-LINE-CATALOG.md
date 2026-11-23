# Atom 线层功能类与实例目录（v0.1）

> 目录目标：在 `flow.open-external-site` + `flow.ensure-vpn` 的思路基础上，扩展一组可复用的线层功能类与实例。
>
> 统一原则：**FlowClass 是点实例槽位的组合模式；FlowInstance 是槽位绑定具体点实例的组合结果。新增业务场景优先新增实例，不新增类。**
>
> 关联：`ATOM-UNIFIED-MODEL.md`、`LINE-REQ-OPEN-EXTERNAL-WITH-VPN.md`、`ATOM-LINE-LAYER-BENCHMARK.md`。

---

## 0. 设计原则

### 0.1 两类线层功能类

| 类型 | 作用 | 例子 |
|---|---|---|
| **GuardFlow（保障流）** | 在执行主任务前确保某个前置条件成立 | `ensure-vpn`、`ensure-app`、`ensure-service`、`ensure-download` |
| **ActionFlow（业务流）** | 完成一个用户可感知的结果 | `open-external-site`、`open-app`、`clipboard-to-file`、`screenshot-translate` |

GuardFlow 统一返回 `GuardResult`：

```ts
type GuardResult = {
  ok: boolean;
  reason: string;       // 人话原因
  code: string;         // VPN_NOT_CONNECTED / APP_NOT_RUNNING / ...
  detail?: Json;        // 诊断信息
  retryable: boolean;
};
```

业务流只依赖 `GuardResult.ok`，不需要知道 VPN/App/Service 的内部细节。

### 0.2 共享 GuardPolicy

```ts
type GuardPolicy = {
  mode: "ask" | "auto" | "manual";
  timeoutSec: number;
  onFail: "block" | "prefer" | "ignore";
};
```

- `block`：失败就停止主任务；
- `prefer`：失败后询问“仍然继续？”；
- `ignore`：只记录，不阻塞。

### 0.3 实例化规则

- **新增站点/应用/文件类型 = 新增 FlowInstance**；
- **新增前置条件 = 新增 GuardFlow**；
- **改 VPN/App/Service 参数 = 新增 PointInstance**；
- **改图结构/门/槽位 = 新 FlowClass 版本**；
- SubflowSlot 绑定 FlowInstance，不绑定 FlowClass。

---

## 1. 目录总表

| FlowClass | 类型 | 目的 | 典型实例 |
|---|---|---|---|
| `flow.ensure-vpn` | Guard | 确保 VPN 已连接 | `inst.ensure-vpn-ask`、`auto`、`auto-connect`、`manual` |
| `flow.ensure-app` | Guard | 确保应用已安装/已运行 | `inst.ensure-app-vscode`、`inst.ensure-app-notepad` |
| `flow.ensure-service` | Guard | 确保本地服务/端口可用 | `inst.ensure-service-docker`、`inst.ensure-service-local-api` |
| `flow.ensure-download` | Guard | 下载并校验文件 | `inst.ensure-download-vscode`、`inst.ensure-download-driver` |
| `flow.open-external-site` | Action | 按策略确保 VPN 后打开外网 | `inst.site-youtube`、`github`、`google`、`intranet` |
| `flow.open-app` | Action | 确保应用可用后打开文件/项目/URL | `inst.open-app-vscode-project`、`inst.open-app-notepad-file` |
| `flow.open-workspace` | Action | 打开多个应用并布局/聚焦 | `inst.workspace-dev`、`inst.workspace-meeting` |
| `flow.clipboard-to-file` | Action | 剪贴板 → 模板 → 写文件 | `inst.clipboard-inbox`、`inst.clipboard-daily` |
| `flow.screenshot-translate` | Action | 截图 → OCR → 翻译 → 浮层 | `inst.screenshot-en-zh`、`inst.screenshot-ja-zh` |
| `flow.http-extract` | Action | HTTP → 解析 → 模板 → 保存/通知 | `inst.http-github-status`、`inst.http-weather` |
| `flow.ai-rewrite` | Action | 选中文字 → LLM → 预览/审批 → 替换 | `inst.ai-rewrite-formal`、`shorten`、`translate` |
| `flow.batch-archive` | Action | 批量扫描 → OCR/提取 → 校验 → 归档 | `inst.invoice-company`、`inst.invoice-personal` |
| `flow.approval-action` | Action | 审批通过后执行一个子流程 | `inst.approval-publish`、`delete`、`deploy` |

---

## 2. GuardFlow 目录

### 2.1 `flow.ensure-vpn`

```ts
FlowClass {
  id: "flow.ensure-vpn",
  version: "1.0.0",
  params: {
    mode: "ask" | "auto-open" | "require-manual",
    autoConnect: bool,
    timeoutSec: number,
    pollIntervalMs: number
  },
  outputs: GuardResult,
  slots: {
    status:  vpn.status      default vpn.default.status@r1,
    launch:  app.launch      default vpn.default.launch@r1,
    connect: vpn.connect     default vpn.default.connect@r1 (optional),
    notify:  notify.toast    default notify.system@r1
  },
  gates: [if, approval, retry, timeout]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.ensure-vpn-ask@r2` | `{mode:"ask", autoConnect:false, timeoutSec:30}` | 默认询问 |
| `inst.ensure-vpn-auto@r1` | `{mode:"auto-open", autoConnect:false}` | 自动打开软件 |
| `inst.ensure-vpn-auto-connect@r1` | `{mode:"auto-open", autoConnect:true}` | 自动打开并连接 |
| `inst.ensure-vpn-manual@r1` | `{mode:"require-manual"}` | 只提示 |

### 2.2 `flow.ensure-app`

```ts
FlowClass {
  id: "flow.ensure-app",
  version: "1.0.0",
  params: {
    mode: "ask" | "auto" | "manual",
    timeoutSec: number,
    onFail: "block" | "prefer" | "ignore"
  },
  outputs: GuardResult,
  slots: {
    status: app.status    default app.default.status@r1,
    launch: app.launch    default app.default.launch@r1,
    notify: notify.toast  default notify.system@r1
  },
  gates: [if, approval, retry, timeout]
}
```

`app.status` 输出：`installed / running / windowVisible / pid / version / reason`。

实例：

| 实例 | args | 绑定 |
|---|---|---|
| `inst.ensure-app-vscode@r2` | `{mode:"auto", timeoutSec:15}` | `app.status` → `app.vscode.status@r1`；`app.launch` → `app.vscode.launch@r1` |
| `inst.ensure-app-notepad@r1` | `{mode:"auto", timeoutSec:5}` | `app.status` → `app.notepad.status@r1`；`app.launch` → `app.notepad.launch@r1` |

### 2.3 `flow.ensure-service`

```ts
FlowClass {
  id: "flow.ensure-service",
  version: "1.0.0",
  params: {
    mode: "ask" | "auto" | "manual",
    timeoutSec: number,
    onFail: "block" | "prefer" | "ignore"
  },
  outputs: GuardResult,
  slots: {
    status: service.status   default service.default.status@r1,
    start:  service.start    default service.default.start@r1,
    check:  net.reachable    default net.reachable.localhost@r1,
    notify: notify.toast     default notify.system@r1
  },
  gates: [if, approval, retry, timeout]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.ensure-service-docker@r1` | `{mode:"auto", timeoutSec:30}` | 确保 Docker Desktop 可用 |
| `inst.ensure-service-local-api@r1` | `{mode:"ask", timeoutSec:10}` | 确保 `localhost:3000` 可连 |

### 2.4 `flow.ensure-download`

```ts
FlowClass {
  id: "flow.ensure-download",
  version: "1.0.0",
  params: {
    url: string,
    path: string,
    expectedHash?: string,
    openAfter: bool
  },
  outputs: GuardResult & { path: string },
  slots: {
    download: http.download   default http.download.default@r1,
    verify:   hash.verify     default hash.sha256@r1,
    open:     sys.open        default open.file.default@r1 (optional),
    notify:   notify.toast    default notify.system@r1
  },
  gates: [if, retry, timeout, fallback]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.ensure-download-vscode@r1` | `{url:"https://.../VSCodeSetup.exe", path:"~/Downloads/VSCodeSetup.exe", expectedHash:"..."}` | 下载并校验 VS Code |
| `inst.ensure-download-driver@r1` | `{url:"...", path:"~/Downloads/driver.zip", openAfter:false}` | 下载驱动包 |

> `expectedHash` 是实例参数；不同文件不同 hash，不改 FlowClass。

---

## 3. ActionFlow 目录

### 3.1 `flow.open-external-site`

```ts
FlowClass {
  id: "flow.open-external-site",
  version: "1.0.0",
  params: {
    url: string,
    vpnRequirement: "required" | "preferred" | "none",
    checkReachability: bool,
    openIn: "default" | "browser" | "app"
  },
  slots: {
    vpn:    flow.ensure-vpn   default inst.ensure-vpn-ask@r2 (optional),
    check:  net.reachable     default net.reachable.default@r1 (optional),
    open:   sys.open          default open.browser.default@r2,
    notify: notify.toast      default notify.system@r1
  },
  gates: [if, fallback, approval]
}
```

实例：

| 实例 | args.url | vpnRequirement | open 绑定 |
|---|---|---|---|
| `inst.site-youtube@r3` | `https://www.youtube.com` | required | `open.browser.youtube@r2` |
| `inst.site-github@r1` | `https://github.com` | required | `open.browser.github@r1` |
| `inst.site-google@r1` | `https://www.google.com` | required | `open.browser.google@r1` |
| `inst.site-intranet@r1` | `http://intranet` | none | `open.browser.intranet@r1` |

### 3.2 `flow.open-app`

```ts
FlowClass {
  id: "flow.open-app",
  version: "1.0.0",
  params: {
    target: string,          // 文件/文件夹/项目路径
    appArgs?: string[],
    onAppMissing: "ask" | "block" | "install"
  },
  slots: {
    ensure: flow.ensure-app  default inst.ensure-app-default@r1,
    open:   sys.open         default open.app.default@r1,
    notify: notify.toast     default notify.system@r1
  },
  gates: [if, fallback]
}
```

实例：

| 实例 | args | 绑定 |
|---|---|---|
| `inst.open-app-vscode-project@r2` | `{target:"C:\\project", appArgs:["."]}` | `ensure` → `inst.ensure-app-vscode@r2`；`open` → `open.vscode.project@r1` |
| `inst.open-app-notepad-file@r1` | `{target:"C:\\notes.txt"}` | `ensure` → `inst.ensure-app-notepad@r1`；`open` → `open.notepad.file@r1` |

### 3.3 `flow.open-workspace`

```ts
FlowClass {
  id: "flow.open-workspace",
  version: "1.0.0",
  params: {
    layout: "single" | "dual" | "left-right" | "custom",
    focus: "editor" | "terminal" | "meeting",
    notifyOnReady: bool
  },
  slots: {
    ensureEditor:   flow.ensure-app  default inst.ensure-app-vscode@r2,
    ensureTerminal: flow.ensure-app  default inst.ensure-app-terminal@r1,
    layout:         window.layout     default window.layout.default@r1,
    focus:          window.focus      default window.focus.default@r1,
    notify:         notify.toast      default notify.system@r1
  },
  gates: [if, fallback]
}
```

实例：

| 实例 | args | 绑定 |
|---|---|---|
| `inst.workspace-dev@r3` | `{layout:"dual", focus:"editor"}` | VS Code + 终端 + 双屏布局 |
| `inst.workspace-meeting@r1` | `{layout:"single", focus:"meeting"}` | 会议软件 + 笔记 + 单屏 |

### 3.4 `flow.clipboard-to-file`

```ts
FlowClass {
  id: "flow.clipboard-to-file",
  version: "1.0.0",
  params: {
    path: string,
    append: bool,
    template: "raw" | "markdown" | "daily"
  },
  slots: {
    clipboard: input.clipboard  default input.clipboard.text@r1,
    template:  text.template     default text.template.markdown@r2,
    write:     file.write        default file.write.append@r3,
    notify:    notify.toast      default notify.system@r1
  },
  gates: [if, fallback]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.clipboard-inbox@r3` | `{path:"~/inbox.md", append:true, template:"markdown"}` | 收件箱追加 |
| `inst.clipboard-daily@r2` | `{path:"~/daily/2026-11-23.md", append:false, template:"daily"}` | 每日笔记 |

### 3.5 `flow.screenshot-translate`

```ts
FlowClass {
  id: "flow.screenshot-translate",
  version: "1.0.0",
  params: {
    sourceLang: "auto" | "en" | "ja" | "zh",
    targetLang: "zh" | "en",
    overlay: bool
  },
  slots: {
    capture:   screen.capture   default cap.region@r2,
    ocr:       ocr.read         default ocr.zh.screen@r3,
    translate: translate.text   default trans.en2zh@r1,
    overlay:   render.overlay   default overlay.toast@r2,
    notify:    notify.toast     default notify.system@r1
  },
  gates: [if, fallback]
}
```

实例：

| 实例 | args | 绑定差异 |
|---|---|---|
| `inst.screenshot-en-zh@r4` | `{sourceLang:"en", targetLang:"zh", overlay:true}` | `ocr` → `ocr.en.screen@r2`；`translate` → `trans.en2zh@r1` |
| `inst.screenshot-ja-zh@r2` | `{sourceLang:"ja", targetLang:"zh", overlay:false}` | `ocr` → `ocr.ja.screen@r1`；`translate` → `trans.ja2zh@r2` |

### 3.6 `flow.http-extract`

```ts
FlowClass {
  id: "flow.http-extract",
  version: "1.0.0",
  params: {
    url: string,
    method: "GET" | "POST",
    jsonPath?: string,
    outputPath?: string
  },
  slots: {
    request: http.request   default http.request.default@r1,
    extract: json.get       default json.get.default@r1,
    render:  text.template  default text.template.json@r1,
    write:   file.write     default file.write.overwrite@r1 (optional),
    notify:  notify.toast   default notify.system@r1
  },
  gates: [if, retry, timeout, fallback]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.http-github-status@r2` | `{url:"https://api.github.com/repos/...", method:"GET", jsonPath:"stargazers_count"}` | 查 GitHub 仓库 star |
| `inst.http-weather@r1` | `{url:"https://api.open-meteo.com/...", method:"GET", jsonPath:"current.temperature_2m"}` | 查天气 |

### 3.7 `flow.ai-rewrite`

```ts
FlowClass {
  id: "flow.ai-rewrite",
  version: "1.0.0",
  params: {
    instruction: string,
    style: "formal" | "short" | "friendly" | "translate",
    maxTokens: number,
    requireApproval: bool
  },
  slots: {
    selection: input.selectedText  default input.selection.text@r1,
    rewrite:   llm.complete         default llm.default.complete@r1,
    preview:   text.diff            default text.diff.default@r1,
    replace:   input.simulate       default input.simulate.replace@r1,
    notify:    notify.toast         default notify.system@r1
  },
  gates: [if, approval, fallback]
}
```

实例：

| 实例 | args | 用途 |
|---|---|---|
| `inst.ai-rewrite-formal@r2` | `{instruction:"改写得更正式", style:"formal", requireApproval:true}` | 邮件正式化 |
| `inst.ai-rewrite-shorten@r1` | `{instruction:"压缩到 100 字以内", style:"short", requireApproval:true}` | 摘要 |
| `inst.ai-rewrite-translate@r1` | `{instruction:"翻译成英文", style:"translate", requireApproval:false}` | 选中文字翻译 |

### 3.8 `flow.batch-archive`

```ts
FlowClass {
  id: "flow.batch-archive",
  version: "1.0.0",
  params: {
    sourceDir: string,
    pattern: string,
    archiveDir: string,
    ocrLang: "zh" | "en",
    onItemError: "terminate" | "continue" | "drop"
  },
  slots: {
    list:     file.list       default file.list.inbox@r1,
    ocr:      ocr.read        default ocr.zh.invoice@r4,
    extract:  extract.invoice default extract.vendor@r2,
    validate: validate.invoice default validate.amount@r1,
    move:     file.move       default file.move.archive@r2,
    notify:   notify.toast    default notify.system@r1
  },
  gates: [foreach, if, fallback]
}
```

实例：

| 实例 | args | 绑定差异 |
|---|---|---|
| `inst.invoice-company@r6` | `{sourceDir:"C:\\inbox", pattern:"*.pdf", archiveDir:"C:\\archive\\company", ocrLang:"zh"}` | `ocr` → `ocr.zh.invoice@r4`；`extract` → `extract.vendor@r2`；`validate` → `validate.amount@r1` |
| `inst.invoice-personal@r2` | `{sourceDir:"C:\\inbox", pattern:"*.pdf", archiveDir:"C:\\archive\\personal", ocrLang:"en"}` | `ocr` → `ocr.en.invoice@r2`；`extract` → `extract.personal@r1`；`validate` → `validate.personal@r1` |

### 3.9 `flow.approval-action`

```ts
FlowClass {
  id: "flow.approval-action",
  version: "0.9.0",
  params: {
    title: string,
    reason: string,
    risk: "L1" | "L2" | "L3",
    timeoutSec: number
  },
  slots: {
    action: flow.*            default flow.noop@1.0.0,
    notify: notify.toast      default notify.system@r1
  },
  gates: [approval, if, fallback]
}
```

实例：

| 实例 | args | action 绑定 |
|---|---|---|
| `inst.approval-publish@r1` | `{title:"确认发布", reason:"生产发布", risk:"L2"}` | `inst.publish-site@r3` |
| `inst.approval-delete@r1` | `{title:"确认删除", reason:"清理旧文件", risk:"L2"}` | `inst.cleanup-old-files@r2` |
| `inst.approval-deploy@r1` | `{title:"确认部署", reason:"部署到生产", risk:"L3"}` | `inst.deploy-prod@r4` |

---

## 4. 实例目录（汇总）

| 实例 | FlowClass | 关键 args / bindings |
|---|---|---|
| `inst.site-youtube@r3` | `flow.open-external-site` | url=YouTube；vpn=inst.ensure-vpn-ask@r2 |
| `inst.site-github@r1` | `flow.open-external-site` | url=GitHub；vpn=inst.ensure-vpn-ask@r2 |
| `inst.site-google@r1` | `flow.open-external-site` | url=Google；vpn=inst.ensure-vpn-ask@r2 |
| `inst.site-intranet@r1` | `flow.open-external-site` | vpnRequirement=none |
| `inst.open-app-vscode-project@r2` | `flow.open-app` | ensure=inst.ensure-app-vscode@r2 |
| `inst.open-app-notepad-file@r1` | `flow.open-app` | ensure=inst.ensure-app-notepad@r1 |
| `inst.workspace-dev@r3` | `flow.open-workspace` | editor=VS Code；terminal；dual |
| `inst.workspace-meeting@r1` | `flow.open-workspace` | meeting；single |
| `inst.clipboard-inbox@r3` | `flow.clipboard-to-file` | path=inbox.md；append=true |
| `inst.clipboard-daily@r2` | `flow.clipboard-to-file` | path=daily/...；append=false |
| `inst.screenshot-en-zh@r4` | `flow.screenshot-translate` | en→zh；overlay=true |
| `inst.screenshot-ja-zh@r2` | `flow.screenshot-translate` | ja→zh；overlay=false |
| `inst.http-github-status@r2` | `flow.http-extract` | GitHub API |
| `inst.http-weather@r1` | `flow.http-extract` | Open-Meteo |
| `inst.ai-rewrite-formal@r2` | `flow.ai-rewrite` | formal；approval=true |
| `inst.ai-rewrite-shorten@r1` | `flow.ai-rewrite` | shorten；approval=true |
| `inst.ai-rewrite-translate@r1` | `flow.ai-rewrite` | translate；approval=false |
| `inst.invoice-company@r6` | `flow.batch-archive` | company；zh OCR |
| `inst.invoice-personal@r2` | `flow.batch-archive` | personal；en OCR |
| `inst.approval-publish@r1` | `flow.approval-action` | action=publish |
| `inst.approval-delete@r1` | `flow.approval-action` | action=cleanup |
| `inst.approval-deploy@r1` | `flow.approval-action` | action=deploy |

---

## 5. 复用矩阵

| ActionFlow | ensure-vpn | ensure-app | ensure-service | ensure-download | approval |
|---|---:|---:|---:|---:|---:|
| `open-external-site` | ✓ | — | — | — | optional |
| `open-app` | — | ✓ | — | — | — |
| `open-workspace` | — | ✓ | optional | — | — |
| `clipboard-to-file` | — | — | — | — | — |
| `screenshot-translate` | — | — | — | — | optional |
| `http-extract` | optional | — | optional | — | — |
| `ai-rewrite` | — | — | — | — | ✓ |
| `batch-archive` | — | — | — | — | optional |
| `approval-action` | — | — | — | — | ✓ |

**结论**：GuardFlow 是复用核心；业务 FlowClass 只负责“把 GuardFlow + 点实例 + 门”组合起来。

---

## 6. 不要做的事

1. 不要为 YouTube、GitHub、Google 各建一个 FlowClass；它们是 `flow.open-external-site` 的实例。
2. 不要为 VS Code、记事本、终端各建一个 `flow.open-app` 类；它们是实例。
3. 不要把“检查 VPN/App/Service”写成业务 FlowClass 的内部节点；抽成 GuardFlow。
4. 不要在 FlowInstance 里内联改点参数；不同参数 → 新 PointInstance。
5. 不要把 approval 做成 PointInstance；它是线层门。
6. 不要为“公司发票/个人发票”建两个类；它们是 `flow.batch-archive` 的实例。
7. 不要为“正式/简短/翻译”建三个 AI 类；它们是 `flow.ai-rewrite` 的实例。
8. 不要把所有 GuardFlow 合成一个“万能 ensure”；不同前置条件语义不同。

---

## 7. 优先级

### P0

- `flow.ensure-vpn` + `inst.ensure-vpn-ask@r2`
- `flow.open-external-site` + YouTube/GitHub 实例
- `flow.ensure-app` + VS Code/记事本实例
- `flow.open-app`
- `flow.clipboard-to-file`
- `flow.screenshot-translate`
- `flow.open-workspace`（基础布局）
- `flow.batch-archive`（发票）

### P1

- `flow.ensure-service`
- `flow.ensure-download`
- `flow.http-extract`
- `flow.ai-rewrite`
- `flow.approval-action`
- `net.reachable`、`hash.verify`、`text.diff`

### P2

- 多 Guard 组合（VPN + Service + App）
- 站点策略中心
- 模板市场
- AI 生成 FlowClass/实例

---

## 8. 一句话总结

**GuardFlow 负责“能不能开始”，ActionFlow 负责“怎么完成”，FlowInstance 负责“这次用哪些点实例”。**

这张目录里真正的类只有十几个；站点、应用、文件、语言、规则都是实例。新增需求时先问：是新增一个 Guard、一个 Action 组合，还是只新增一个实例？
