# 点层功能类与实例总表（v0.1）

> 文档定位：把“点层（原子能力）”从概念、契约、类目录、实例样例到可选加载/资源管理，收成一份可评审、可落地的总表。
>
> 依据：本仓库 `docs/MODULES.md`、`crates/core-modules` 契约、`examples/actions/*.json`、`atom-catalog.html` 原型，以及 Mnemon 中已归档的总设计稿/设置域深挖稿。
>
> 状态口径：**代码现状以 registry / capabilities 为准**；本文的“已实现/部分/待建”是 2026-11-23 的快照，`docs/MODULES.md` 个别条目可能滞后（例如 `sys.run` 代码已有 manifest，文档仍标 P3）。

---

## 0. 一句话结论

点层不是“一个功能一个模块”，而是**一个能力契约 + 多组参数实例**：

- **类（class）**：`ModuleManifest` + 实现 + 权限 + 测试，id 形如 `domain.verb`。
- **实例（instance）**：动作步骤 `{ id, module, inputs, output }`，同一个类换 `inputs` 就是不同实例。
- **线（flow）**：实例组成的有向数据流；**体（body）**：流程 + UI + 权限 + 资产。
- **门（gate）**：if/foreach/retry/approval 等控制节点，不是点层模块；`flow.wait` 是已落地的流程辅助模块。

典型例子：`window.activate` 是类；“切到记事本”和“切到 Chrome”是两个实例，只是 `query` 不同。**不要为复制、粘贴、切记事本、切 Chrome 各建一个类。**

---

## 1. 契约：一个点必须说清什么

### 1.1 `ModuleManifest` 字段

| 字段 | 含义 | 约束 |
|---|---|---|
| `id` | 稳定标识 | 必须 `domain.verb`；domain 限定在固定集合 |
| `name` | 中文名 | 面向用户，不写实现细节 |
| `version` | 语义版本 | 类改契约必须升版本；实例锁 revision |
| `effect` | 副作用等级 | L0–L3，决定确认/试跑 |
| `idempotent` | 是否幂等 | 决定失败后能否自动重试 |
| `inputs` | 参数规格 `ParamSpec[]` | 设置页表单的唯一来源 |
| `outputs` | 输出规格 | 多值模块必须真的返回对应键 |
| `permissions` | 权限声明 | 由模块声明，动作作者不能少报 |

`ParamSpec` 支持：`text / number / bool / enum / file / folder / json / any`；带 `required`、`default`、`options`。枚举的候选值必须写在模块里，不能在线层/面层各抄一份。

### 1.2 副作用等级

| 等级 | 判据 | 系统行为 |
|---|---|---|
| **L0 只读** | 不改变外部世界 | 静默执行，可试跑 |
| **L1 可逆写** | 改了能改回来 | 执行，提示可撤销 |
| **L2 不可逆** | 改了回不去 | 首次确认，禁止试跑 |
| **L3 系统级** | 影响整个系统 | 每次确认 |

判据只有一句：**执行完之后，能不能原样恢复？**

### 1.3 权限与错误码

权限示例：`FileRead / FileWrite / ClipboardRead / ClipboardWrite / InputSimulate / UiAutomation / ScreenCapture / NetworkOutbound / ProcessControl / RegistryWrite`。

统一错误码九个：`E_INPUT_INVALID`、`E_TARGET_NOT_FOUND`、`E_PERMISSION_DENIED`、`E_CONFLICT`、`E_TIMEOUT`、`E_EXTERNAL`、`E_ENV_UNSUPPORTED`、`E_CANCELED`、`E_INTERNAL`。

**“没找到”用返回值，不用错误**：例如 `input.selectedText` 没选中时返回空串，方便线层直接接 `list.length`。

### 1.4 预演（dry-run）

有副作用的模块应实现 `dry_run`，回答“如果现在执行会发生什么”，但不真的做。能确定的部分必须预演，不能因为一部分是运行时变量就整体放弃。

### 1.5 三条硬规则

1. **不做万能模块**（`run(script)`）：绕过权限、校验、dry-run。
2. **平台调用不进 `mod-shared`**：Windows 能力放 `mod-win`，用 capabilities 如实声明。
3. **没有动作引用的模块是死代码**：新增模块必须至少被一个 `examples/actions/*.json` 使用。

---

## 2. 类与实例的建模规则

### 2.1 类

- id 形如 `domain.verb`：`text.regex`、`window.activate`、`input.clipboard`。
- 一个类只做一件事；读和写如果权限/副作用不同，应拆分（`file.read` / `file.write`）。
- 类版本不可原地改；契约变更生成新 minor/major 版本，旧版本保留。
- 类必须带：manifest、参数 Schema、权限、副作用、错误、dry-run（L2+）、测试、示例动作。

### 2.2 实例

实例是动作步骤，不是类的新代码：

```json
{
  "id": "go",
  "module": "window.activate",
  "inputs": { "query": "记事本", "by": "title" },
  "output": "r"
}
```

同一个类：

- “切到记事本” = `query: "记事本"`
- “切到 Chrome” = `query: "Chrome"`
- “切到 VS Code” = `query: "Visual Studio Code"`

### 2.3 参数与运行时变量

`inputs` 里可以写字面量，也可以写 `{$变量}` / `{$变量.字段}`：

- 单值模块：`{$c}`（如 `input.clipboard` 返回裸字符串）
- 多值模块：`{$r.window.title}`（如 `window.find` 返回对象）

**多值模块必须保证 manifest 声明的每个 output 键都真的在返回对象里**；单值模块的 `outputs` 只是文档。

### 2.4 版本与引用

- 实例编辑产生新 **revision**；Flow/Body 锁定 `instance_revision`，避免“改一下参数，线上流程悄悄变了”。
- 类编辑产生新 **class_version**；旧实例仍指向旧版本，迁移要显式做。
- 删除用归档/软删除，先看引用影响面，再决定是否迁移或停用。

---

## 3. 现状盘点

`docs/MODULES.md` 的记录：**38 个模块 · 35 个示例动作 · 615 个测试**；`examples/actions/` 当前有 **49 个 JSON 文件**（含历史/回收站文件，实际有效动作以 scenes 引用为准）。

### 3.1 已实现模块（按 domain）

| domain | 模块 |
|---|---|
| `text` | `text.regex`、`text.split`、`text.template` |
| `list` | `list.length`、`list.append` |
| `json` | `json.get` |
| `math` | `math.add` |
| `var` | `var.const` |
| `flow` | `flow.wait` |
| `file` | `file.exists`、`file.read`、`file.write`、`file.list` |
| `input` | `input.clipboard`、`input.selectedText`、`input.simulate` |
| `window` | `window.list`、`window.find`、`window.activate`、`window.minimize`、`window.close`、`window.control` |
| `screen` | `screen.pixel`、`screen.capture` |
| `image` | `image.info`、`image.crop`、`image.resize`、`image.convert` |
| `data` | `data.csv` |
| `http` | `http.request`、`http.download` |
| `web` | `web.search` |
| `sys` | `sys.env`、`sys.info`、`sys.open`、`sys.pause`、`sys.run`、`sys.volume` |

### 3.2 主要缺口

- **UIA**：`ui.getText`、`ui.click`、`ui.find` 未做；`window.getText` 也未做。
- **OCR**：`screen.ocr` 未做（P5）。
- **系统设置**：亮度、深浅主题、显示缩放、放大镜、文字大小未做；`sys.volume` 只有 up/down/mute，没有 set/level/按应用。
- **文件**：`file.move`、`file.delete`、`file.watch`、`archive.zip` 未做。
- **AI**：`ai.llm.complete`、`ai.translate`、`ai.summarize`、`ai.embed`、`ai.asr`、`ai.tts` 未做。
- **人机/安全/集成**：`ui.form`、`credential.get`、`mcp.call` 未做。
- **触发层**：热键、剪贴板监听、文件监听、定时器属于 `trig-win`/触发层，不应在点层重复造 `*.trigger` 模块。

---

## 4. 功能家族与类目录

> 说明：`当前模块` 写“—”表示设计类尚未落地；写 `input.simulate` 等表示由现有模块覆盖或部分覆盖。状态：✅ 已实现 / ◐ 部分覆盖 / ⏳ 待建 / ↗ 属于触发层。

### 4.1 输入、快捷键、剪贴板

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `input.key.send` | 向当前焦点发送组合键/文本 | `kind=key/text`、`key`、`text`、`count` | 复制 `Ctrl+C`；粘贴 `Ctrl+V`；输入邮箱 | `input.simulate` | ◐ 部分覆盖 |
| `input.mouse` | 点击、移动、滚轮 | `kind=click/move/scroll`、`x`、`y`、`button`、`count` | 点击坐标；滚到顶部 | `input.simulate` | ◐ 部分覆盖 |
| `input.clipboard` | 读写剪贴板文本 | `op=read/write`、`text` | 取文本；写入“Hello” | `input.clipboard` | ✅ |
| `input.selectedText` | 读取当前选中文本 | 无 | 取选中文字并翻译 | `input.selectedText` | ✅ |
| `input.key.trigger` | 监听全局/应用内组合键 | `keys`、`scope` | `Ctrl+Alt+Space` 打开面板 | 触发层 `trig-win` | ↗ 不属于点层 |
| `input.clipboard.watch` | 监听剪贴板变化 | `format` | 复制即翻译 | 触发层/待建 | ⏳ |

**关键设计**：`input.simulate` 是一个类，`kind` 参数区分 key/text/click/move；“复制”“粘贴”只是 `kind=key, key=Ctrl+C/V` 的两个实例。不要再造 `input.copy` / `input.paste`。

### 4.2 窗口与 UI 自动化

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `window.list` | 枚举可见窗口 | 无 | 列出当前所有窗口 | `window.list` | ✅ |
| `window.find` | 按标题/进程/类查找 | `query`、`by`、`all` | 找“记事本”；找 `chrome.exe` | `window.find` | ✅ |
| `window.activate` | 聚焦/还原窗口 | `query`、`by`、`all` | 切到记事本；切到 Chrome | `window.activate` | ✅ |
| `window.minimize` | 最小化窗口 | `query`、`by` | 最小化当前窗口 | `window.minimize` | ✅ |
| `window.close` | 发送关闭请求（WM_CLOSE） | `query`、`by` | 关闭计算器 | `window.close` | ✅ |
| `window.control` | 最大化/置顶/停靠/关闭 | `op`、`target=cursor/foreground` | 当前窗口置顶；左半屏 | `window.control` | ✅ |
| `window.getText` | 读取窗口文本 | `query`、`by` | 读取记事本内容 | — | ⏳ |
| `window.capture` | 截取指定窗口 | `query`、`path` | 截 Chrome 窗口 | 可用 `screen.capture` 区域近似 | ◐ |
| `ui.find` | 按 UIA 树查找控件 | `window`、`name`、`role` | 找“保存”按钮 | — | ⏳ |
| `ui.click` | 点击 UIA 控件/坐标 | `window`、`name`、`button` | 点“确定” | — | ⏳ |
| `ui.tree` | 导出 UIA 树 | `window`、`depth` | 调试某软件控件树 | — | ⏳ |

**关键设计**：能用 `window.find` 定位顶层窗口的，不要上 UIA；UIA 只用于窗口内部控件。UIA 覆盖率因应用而异，失败要如实返回 `E_TARGET_NOT_FOUND`，不能假装点击成功。

### 4.3 文件、文本、数据

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `file.exists` | 判断路径是否存在 | `path` | 检查导出文件是否已存在 | `file.exists` | ✅ |
| `file.read` | 读取文本文件 | `path`、`maxBytes` | 读 README | `file.read` | ✅ |
| `file.write` | 写入/追加文件 | `path`、`text`、`append`、`createDirs` | 剪贴板存文件；写日志 | `file.write` | ✅ |
| `file.list` | 枚举目录文件 | `dir`、`pattern`、`recursive`、`limit` | 列出下载目录 PDF | `file.list` | ✅ |
| `file.move` | 移动/重命名 | `from`、`to`、`overwrite` | 归档发票 | — | ⏳ |
| `file.delete` | 删除文件/目录 | `path`、`recursive` | 清理临时文件 | — | ⏳ |
| `archive.zip` | 压缩/解压 | `paths`、`out`、`mode` | 打包日志 | — | ⏳ |
| `text.regex` | 正则提取/替换 | `text`、`pattern`、`group` | 从日志提取订单号 | `text.regex` | ✅ |
| `text.split` | 按分隔符/行切分 | `text`、`sep` | 按行拆 CSV | `text.split` | ✅ |
| `text.template` | 模板变量渲染 | `tpl`、`vars` | “已写入 {n} 字节” | `text.template` | ✅ |
| `json.get` | 取 JSON 字段 | `json`、`path` | 取 API 返回的 `data.id` | `json.get` | ✅ |
| `list.length` | 列表长度 | `list` | 统计选中行数 | `list.length` | ✅ |
| `list.append` | 追加元素 | `list`、`item` | 收集结果 | `list.append` | ✅ |
| `data.csv` | 解析 CSV | `path`、`hasHeader` | 读订单表 | `data.csv` | ✅ |
| `math.add` | 数值相加 | `a`、`b` | 汇总金额 | `math.add` | ✅ |
| `var.const` | 常量 | `value` | 固定 API 基址 | `var.const` | ✅ |
| `flow.wait` | 等待 | `ms`（上限 10 分钟） | 等 500ms 再继续 | `flow.wait` | ✅ |

### 4.4 屏幕、图像、OCR

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `screen.capture` | 抓屏保存 PNG | `path`、`x`、`y`、`width`、`height` | 截全屏；截 120×80 区域 | `screen.capture` | ✅ |
| `screen.pixel` | 取单像素颜色 | `x`、`y` | 取坐标颜色 | `screen.pixel` | ✅ |
| `image.info` | 读图片元信息 | `path` | 看宽高/格式/字节数 | `image.info` | ✅ |
| `image.crop` | 裁剪 | `path`、`out`、`x`、`y`、`width`、`height` | 裁 40×40 | `image.crop` | ✅ |
| `image.resize` | 缩放 | `path`、`out`、`width`、`height`、`mode` | 放大到 80×80 | `image.resize` | ✅ |
| `image.convert` | 格式转换 | `path`、`out`、`format` | PNG → BMP | `image.convert` | ✅ |
| `screen.ocr` | 截图/图片转文字 | `image`、`lang`、`layout` | 截图转文字；英文截图 | — | ⏳ P5 |
| `screen.record` | 录屏 | `path`、`fps`、`region` | 录一段操作 | — | ⏳ P2 |

**关键边界**：`screen.capture` 是 L2（写文件 + 隐私），`screen.pixel` 是 L0；不要用 `screen.pixel` 冒充“截屏能力”。OCR 输出是文本/blocks，不是图片；截图和 OCR 应分成两个类，由线层组合。

### 4.5 系统设置

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `sys.volume` | 主音量 | `op=up/down/mute`、`steps` | 音量 +5；静音 | `sys.volume` | ◐ 无 set/level |
| `sys.volume.set` | 精确设音量/按应用 | `level`、`app` | 设 30%；网易云 20% | — | ⏳ |
| `sys.brightness` | 内屏/外屏亮度 | `action`、`value`、`monitor` | 内屏 60%；亮度 +10 | — | ⏳ |
| `sys.theme` | 深浅主题 | `mode`、`scope` | 深色；应用浅色 | — | ⏳ |
| `sys.displayScale` | 显示缩放 | `scale`、`monitor` | 设 125% | — | ⏳ |
| `sys.magnifier` | 放大镜 | `action`、`zoom`、`mode` | 全屏放大 2× | — | ⏳ |
| `sys.textScale` | 文字大小 | `scale` | 设 125% | — | ⏳ |
| `sys.notify` | 系统通知 | `title`、`body` | 任务完成通知 | — | ⏳ |
| `sys.power` | 电源计划/休眠 | `action`、`plan` | 切高性能 | — | ⏳ |
| `sys.registry` | 注册表读写 | `path`、`value`、`op` | 读主题键 | — | ⏳ L3 |

**关键设计**：`sys.volume` 的 `op` 已覆盖 up/down/mute；要做“设 30%”应扩展同一个类的 `op=set, level=30`，而不是新增 `sys.volume.set30`。按应用音量是 P1 扩展参数 `app`，仍属同一个类。

### 4.6 网络、系统、运行

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `http.request` | HTTP 请求 | `url`、`method`、`headers`、`body`、`timeoutMs` | GET GitHub API；POST webhook | `http.request` | ✅ |
| `http.download` | 下载文件 | `url`、`path`、`timeoutMs` | 下载安装包 | `http.download` | ✅ |
| `web.search` | 搜索引擎打开 | `engine`、`query` | 搜索选中文字 | `web.search` | ✅ |
| `sys.open` | 打开文件/文件夹/URL | `target`、`kind=file/folder/url` | 打开下载文件夹；打开 GitHub | `sys.open` | ✅ |
| `sys.run` | 运行命令行 | `code`、`show_window` | 跑 `echo`；静默执行 | `sys.run` | ✅* 文档状态待同步 |
| `sys.env` | 读环境变量 | `name` | 读 `USERPROFILE` | `sys.env` | ✅ |
| `sys.info` | 系统信息 | 无 | 取 OS/架构/核数 | `sys.info` | ✅ |
| `sys.pause` | 暂停手势/触发 | 无 | 暂停识别 | `sys.pause` | ✅ |
| `sys.process` | 进程枚举/结束 | `name`、`pid`、`action` | 结束记事本 | — | ⏳ |
| `sys.service` | Windows 服务 | `name`、`action` | 重启服务 | — | ⏳ |
| `sys.task` | 计划任务 | `name`、`action` | 创建定时任务 | — | ⏳ |

**关键边界**：`sys.open` 的 `kind` 只有 file/folder/url，没有 `app`；打开任意可执行文件本质是 `ProcessControl`，权限提示必须如实。`sys.run` 是 L2/L3 高风险，必须每次确认 + dry-run。

### 4.7 AI、表单、安全、集成

| 设计类 | 目的 | 核心参数 | 实例示例 | 当前模块 | 状态 |
|---|---|---|---|---|---|
| `ai.llm.complete` | 文本补全 | `model`、`prompt`、`temperature`、`maxTokens` | 总结选中文本；改写邮件 | — | ⏳ |
| `ai.translate` | 翻译 | `text`、`from`、`to` | 中译英；英译中 | — | ⏳ |
| `ai.summarize` | 摘要 | `text`、`maxWords` | 总结网页 | — | ⏳ |
| `ai.embed` | 向量化 | `text`、`model` | 建本地索引 | — | ⏳ |
| `ai.asr` | 语音转文字 | `audio`、`lang` | 会议录音转写 | — | ⏳ |
| `ai.tts` | 文字转语音 | `text`、`voice` | 朗读选中文本 | — | ⏳ |
| `ui.form` | JSON Schema 表单 | `schema`、`title` | 发布确认；选择目标 | — | ⏳ |
| `ui.approval` | 人工审批 | `title`、`detail` | 高危操作二次确认 | 门层 | ↗ 建议做成 gate |
| `credential.get` | 取凭据 | `key` | 取 API Token | — | ⏳ |
| `secret.set` | 写凭据 | `key`、`value` | 保存 Token | — | ⏳ |
| `mcp.call` | 调用 MCP 工具 | `server`、`tool`、`args` | 调本地 MCP | — | ⏳ |
| `openapi.call` | 调 OpenAPI | `spec`、`operation`、`args` | 调内部 API | — | ⏳ |

**关键边界**：AI 类不直接“操作软件”，只做文本/语音/向量；要把 AI 输出变成动作，仍由线层把结果接到窗口/文件/HTTP 类。审批是 gate，不是点层模块。

---

## 5. 实例样例（真实动作）

### 5.1 `act.focus-notepad`：同一个类，不同 query

```json
{
  "id": "act.focus-notepad",
  "name": "切到记事本",
  "steps": [
    {
      "id": "go",
      "module": "window.activate",
      "inputs": { "query": "记事本", "by": "title" },
      "output": "r"
    },
    {
      "id": "say",
      "module": "text.template",
      "inputs": {
        "tpl": "已切到「{t}」",
        "vars": { "t": "{$r.window.title}" }
      },
      "output": "msg"
    }
  ]
}
```

“切到 Chrome”只改 `inputs.query`；类还是 `window.activate`。

### 5.2 `act.export-clipboard`：文件类 + 变量

```json
{
  "id": "act.export-clipboard",
  "name": "剪贴板存文件",
  "steps": [
    {
      "id": "check",
      "module": "file.exists",
      "inputs": { "path": "target/clipboard-export.txt" },
      "output": "before"
    },
    {
      "id": "write",
      "module": "file.write",
      "inputs": {
        "path": "target/clipboard-export.txt",
        "text": "{$clipboard}",
        "createDirs": true
      },
      "output": "w"
    }
  ]
}
```

`{$clipboard}` 是运行时变量，不是类参数；类只声明 `text` 是文本参数。

### 5.3 `act.screenshot-pipeline`：点层组合成线

步骤：`screen.capture` → `image.info` → `image.crop` → `image.resize` → `image.convert` → `text.template`。

这证明点层不是“单个功能按钮”，而是可组合的数据流原子。OCR 落地后，应插在 `screen.capture` 与 `text.template` 之间，而不是塞进 `screen.capture` 里。

---

## 6. 优先级与工时

### 6.1 P0（先让点层够用）

已落地：`input.simulate`、`input.clipboard`、`input.selectedText`、`window.list/find/activate/minimize/close/control`、`file.exists/read/write/list`、`text.regex/split/template`、`json.get`、`http.request/download`、`sys.open`、`sys.volume`、`screen.capture`、`image.*`、`data.csv`、`flow.wait`。

仍缺的 P0/P1 关键项：

| 项 | 为什么重要 | 粗估 |
|---|---|---|
| `ui.getText` / `ui.click` | 没有 UIA，点层只能控顶层窗口，进不了软件内部 | 10–15 人天 |
| `screen.ocr` | 截图翻译/发票归档的核心 | 10–15 人天 |
| `sys.brightness/theme/scale` | 系统设置域的基础能力 | 8–12 人天 |
| `ui.form` | 人工确认/选择目标，body 必需 | 4–6 人天 |
| `file.move/delete` | 文件整理 body 必需 | 4–6 人天 |
| `ai.llm/translate/summarize` | 智能 body 的核心 | 10–20 人天 |
| `credential.get` / `mcp.call` | 企业集成/安全边界 | 8–12 人天 |

> 以上是增量粗估，不含模型采购、UI 设计、打包签名和跨平台。先把 P0 收口，再谈 AI 全家桶。

### 6.2 P1/P2

- **P1**：按应用音量、窗口文本、OCR、表单、文件移动/删除、归档 zip、系统亮度/主题/缩放。
- **P2**：UIA 点击、录屏、AI ASR/TTS/Embed、MCP/OpenAPI、服务/计划任务、企业策略。

### 6.3 点层健康度指标

| 指标 | 现状 | 目标 |
|---|---|---|
| 模块数 | 38 | ≥ 45（P0/P1 收口） |
| 带副作用模块占比 | 约 1/3 | ≥ 50% |
| 每模块平均测试 | 约 2.8 | ≥ 4 |
| 被动作引用的模块占比 | 100% | 100% |
| L2+ 有 dry-run 的比例 | 100%（已实现项） | 100% |

---

## 7. 类/实例管理与可选加载

### 7.1 四层资源模型

| 层 | 内容 | 资源特征 |
|---|---|---|
| 元数据 | 类、实例、manifest、依赖、权限 | 常驻，几乎不占 |
| 包实现 | DLL/WASM/native/model/资源 | 占内存/磁盘/GPU/句柄 |
| 实例 | 参数 JSON、绑定、策略 | 很小，可全量常驻 |
| 运行会话 | 线程、句柄、模型 session、缓存 | 运行结束必须释放 |

### 7.2 加载状态

`available`（可下载）→ `installed`（已安装未加载）→ `loading`（加载中）→ `loaded`（已加载）→ `active`（运行中）→ `idle`（空闲）→ `unloaded`。

实例可以 `enabled=true` 但包 `loaded=false`：热键/文件监听/定时器只注册轻量描述符，真正触发时才加载包。

### 7.3 加载策略

- `on-demand`：默认，首次触发加载，空闲卸载。
- `preload`：启动后异步预加载，适合高频/低延迟。
- `pinned`：常驻，不自动卸载。
- `metadata-only`：浏览/市场只读清单，不加载实现。

### 7.4 卸载的真实边界

- .NET 托管包可用 collectible `AssemblyLoadContext` 卸载，但要求无静态引用/后台线程/未释放句柄。
- Native DLL 通常不能可靠卸载；三方/原生/重模型应放**子进程 Host**，卸载 = 终止进程。
- WASM 可直接丢弃线性内存；模型/GPU 要 `Dispose` session。
- 卸载前检查：无 active run、无注册触发器、无未完成异步任务、无 UI 面板挂着。

### 7.5 原型 `atom-catalog.html`

当前原型已包含：13 个类、32 个实例、卡片/表格/图谱/**加载管理**四视图。加载页显示：

- 内存、磁盘、GPU 显存、句柄、线程、模型、依赖
- 已加载/已安装/可下载/加载中
- `on-demand / preload / pinned` 策略
- 加载、卸载、预加载、固定、下载安装
- 512 MB 内存预算条与资源汇总

资源数字是演示估算；真实实现以 pack manifest 和运行时计量为准。原型中的 `ai.llm.complete`（2 GB 内存 / 5.2 GB 磁盘 / 6 GB 显存 / Qwen3.5-7B Q4）就是“未加载时不占资源”的展示样例。

---

## 8. 版本、权限、安全、测试

### 8.1 版本

- 类：`major.minor.patch`；契约破坏升 major，新增参数/能力升 minor。
- 实例：`revision` 每次保存 +1；Flow/Body 锁 revision。
- 包：manifest 带版本/哈希/签名/依赖范围；更新时新旧版本可并存，切换引用后再卸载旧版。

### 8.2 权限

权限由模块声明，动作作者不能少报；首次使用时提示，企业策略可禁用某类权限。高危类（`sys.run`、`file.write`、`window.close`、`input.simulate`、`screen.capture`、`http.*`）必须确认 + dry-run。

### 8.3 安全

- 三方包必须签名/哈希校验；未签名默认拒绝。
- 三方/原生/重包 out-of-process；用 Job Object 限制内存/CPU。
- 不自动安装/加载未授权包；依赖版本锁定，防依赖混淆。
- 所有加载/卸载/运行写审计：谁、何时、哪个包/实例、结果、资源峰值。

### 8.4 测试

每个类至少四类测试：正常路径、边界、失败路径（每个错误码至少一次）、契约（manifest 与实现一致）。新增字段必须同步模板测试；新增模块必须被示例动作引用。

---

## 9. 风险与边界

1. **类爆炸**：把“复制/粘贴/切记事本”各建一个类，点层会退化成动作库。坚持“类 + 参数 = 实例”。
2. **点层/触发层混淆**：热键监听、文件监听、定时器属于触发层；点层只做“被触发后的动作”。
3. **UIA 稳定性**：UIA 覆盖率因应用而异，必须如实失败，不能“点了但没点中”还返回成功。
4. **OCR/模型体积**：OCR/LLM 是重资源包，必须可选加载、显存单独统计、空闲卸载。
5. **Native 卸载假象**：进程内 native 库通常卸不掉；重包一律子进程。
6. **文档/代码漂移**：`docs/MODULES.md` 个别状态滞后（如 `sys.run`）；以 registry/capabilities 与测试为准。
7. **死模块**：没有动作引用的模块等于没有；新增模块必须带示例动作。

---

## 10. 下一步

1. **冻结命名与映射**：把本文 4.x 的“设计类”与现有 module id 的映射表确认；不新增重复语义的类。
2. **收口 P0**：优先 `ui.getText`/`ui.click`、`screen.ocr`、`sys.brightness/theme/scale`、`ui.form`、`file.move/delete`。
3. **点层契约扩展**：为类补 `pack_id`、`load_policy`、`resource_profile`（内存/磁盘/GPU/句柄/线程/模型）。
4. **加载管理器**：实现 `ensureLoaded/release/evict`、引用计数、空闲 TTL、内存压力、子进程 Host。
5. **把原型接进 `ui/`**：类/实例表、Inspector、快捷键录制器、加载管理页，接 SQLite CRUD。
6. **每类一个示例动作**：`examples/actions/` 必须能跑；没有示例的类不进 P0。

---

## 11. 参考

- `docs/MODULES.md`：点层开发手册、38 模块清单、P1–P7 状态、三条自动化护栏。
- `crates/core-modules/src/types.rs`：`ModuleManifest`、`ParamSpec`、`EffectLevel`、`DryOutcome`。
- `crates/core-modules/src/registry.rs`：`Module` trait、`Registry`、`max_effect`、`missing`。
- `examples/actions/act.focus-notepad.json`、`act.export-clipboard.json`、`act.screenshot-pipeline.json`：真实实例样例。
- `atom-catalog.html`：类/实例/加载管理可视化原型。
- Mnemon 文档：`1a002cda`（点线面体场总设计）、`0207d2fc`（atom-catalog 原型）、`452bf59e`（音量/亮度/主题/缩放深挖）。
