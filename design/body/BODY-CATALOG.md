# 体层功能类与实例目录（v0.2）

> 目标：在 `body.file-preview`、`body.ocr` 的基础上，扩展更多可复用的 BodyClass 与对应 BodyInstance。
>
> 结论：体类数量应保持“少而稳定”，实例数量可以多。**新增一个工具/模式/文件类型/预设 = 新增 BodyInstance；只有流程形状、面契约、权限或资产结构变化，才新增 BodyClass 或升版本。**

---

## 0. 先给结论

```text
BodyClass = 产品蓝图（少量）
BodyInstance = 具体产品配置（大量）
BodyPackage = 不可变分发包
BodyInstallation = 物理安装记录
```

本目录给出 **29 个 BodyClass / 80+ 个 BodyInstance** 的候选。  
其中大量来自 PowerToys 类工具、Windows 工作流、文件/内容处理和 AI 助手。

**最重要的判断**：

- `body.file-preview` 是一个类；text/image/pdf/video 是实例。
- `body.ocr` 是一个类；text/math/qr/table 是实例。
- `body.image-resizer` 是一个类；web/thumbnail/avatar 是实例。
- `body.advanced-paste` 是一个类；plain/json/markdown/ai 是实例。
- `body.window-layout` 是一个类；dev/meeting/ultrawide 是实例。
- `body.external-access` 是一个类；work/personal 是实例。
- 不要做 `body.github`、`body.youtube`、`body.resize-web`、`body.ocr-math` 这种“一个变体一个类”。

---

## 1. 设计规则

### 1.1 什么时候新增 BodyInstance

- 只是换文件类型/格式/预设/目标应用/站点/语言/规则。
- 只是换 FlowInstance 绑定、SurfaceInstance 绑定、Settings、Permission 子集、Icon。
- 流程形状相同，结果面契约相同。

### 1.2 什么时候新增 BodyClass（或升版本）

- 需要新的 FlowClass 形状（多页/批处理/流式/审批/循环）。
- 需要新的 SurfaceClass 契约（编辑器、时间线、3D 视图、表格单元格编辑）。
- 需要新的权限组合或资产/模型结构。
- 需要新的 entrypoint / activation 语义。

### 1.3 BodyInstance 必须锁版本

```text
bodyClassId + bodyClassVersion
packageDigest
flowInstanceId + flowInstanceRevision
surfaceInstanceId + surfaceInstanceRevision
```

---

## 2. 外部参考

### PowerToys 类工具

PowerToys 的模块可以看作“体类候选”：

- Advanced Paste
- Always on Top
- Awake
- Color Picker
- Command Palette
- Crop and Lock
- Environment Variables
- FancyZones
- File Locksmith
- Hosts File Editor
- Image Resizer
- Keyboard Manager
- Peek（文件预览）
- PowerRename
- Screen Ruler
- Text Extractor（OCR）
- Workspaces
- ZoomIt

映射到 Atom：**模块是 BodyClass；模式/预设/格式是 BodyInstance。**

### MSIX / VS Code Extension

- MSIX：manifest + capabilities + dependencies + blockmap + signature + digest。
- VS Code：engines / activationEvents / extensionDependencies / contributes / capabilities。

对本目录的含义：

- 每个 BodyClass 必须能声明 `contributes`（flows/surfaces/settings/triggers/fileTypes/ocrModes）。
- 每个 BodyInstance 必须能声明 `activations`（hotkey/file/gesture/url/manual）。
- 包必须能锁版本、验签名、回滚。

---

## 3. 体类目录（29 个）

| # | BodyClass | 类别 | 组合的线/面（示例） | 实例数 | 优先级 |
|---|---|---|---|---|---|
| 1 | `body.file-preview` | content | flow.preview-file + surface.preview-window | 6 | P0 |
| 2 | `body.ocr` | content | flow.ocr.recognize + surface.ocr-result | 5 | P0 |
| 3 | `body.image-resizer` | media | flow.resize-image + surface.resize-dialog | 4 | P0 |
| 4 | `body.batch-rename` | files | flow.rename-files + surface.rename-dialog + surface.diff | 4 | P0 |
| 5 | `body.pdf-toolkit` | media | flow.pdf-op + surface.pdf-workspace | 4 | P1 |
| 6 | `body.media-converter` | media | flow.convert-media + surface.convert-dialog | 3 | P1 |
| 7 | `body.file-organizer` | files | flow.organize-files + surface.organize-preview | 3 | P1 |
| 8 | `body.advanced-paste` | clipboard | flow.paste-transform + surface.paste-preview | 4 | P0 |
| 9 | `body.clipboard-history` | clipboard | flow.clipboard-history + surface.clipboard-list | 3 | P1 |
| 10 | `body.color-picker` | input | flow.pick-color + surface.color-inspector | 2 | P0 |
| 11 | `body.screen-ruler` | input | flow.measure-screen + surface.hud.ruler | 3 | P1 |
| 12 | `body.window-layout` | window | flow.layout-windows + surface.layout-editor | 3 | P0 |
| 13 | `body.always-on-top` | window | flow.pin-window + surface.pin-indicator | 2 | P1 |
| 14 | `body.awake` | system | flow.keep-awake + surface.awake-status | 3 | P1 |
| 15 | `body.workspace` | workspace | flow.open-workspace + surface.workspace-launcher | 3 | P1 |
| 16 | `body.quick-launch` | launcher | surface.launch-dock + surface.quick-launch | 2 | P0 |
| 17 | `body.system-monitor` | monitor | flow.metric-stream + surface.system-monitor + surface.hud.system-status | 2 | P1 |
| 18 | `body.service-health` | ops | flow.ensure-service + surface.service-dashboard | 3 | P1 |
| 19 | `body.file-locksmith` | ops | flow.find-file-lock + surface.lock-list | 2 | P1 |
| 20 | `body.hosts-editor` | ops | flow.edit-hosts + surface.text-editor + surface.diff | 2 | P2 |
| 21 | `body.env-vars` | ops | flow.edit-env + surface.key-value-editor | 2 | P2 |
| 22 | `body.external-access` | web | flow.open-external-site + ensure-vpn + surface.site-launcher | 2 | P0 |
| 23 | `body.screenshot-translate` | ai | flow.screenshot-translate + surface.hud.translate | 2 | P1 |
| 24 | `body.ai-rewrite` | ai | flow.ai-rewrite + surface.diff + approval | 3 | P1 |
| 25 | `body.meeting-notes` | ai | flow.transcribe + summarize + surface.notes | 2 | P2 |
| 26 | `body.invoice-archive` | pipeline | flow.batch-archive + surface.table + surface.settings.invoice | 2 | P1 |
| 27 | `body.suite` | suite | 引用其他 BodyClass + surface.card-grid | 2 | P2 |
| 28 | `body.web-clipper` | web | flow.clip-page + surface.clipper-preview | 3 | P2 |
| 29 | `body.backup-sync` | files | flow.backup-folder + surface.backup-status | 2 | P2 |

---

## 4. 代表性体类卡

### 4.1 `body.file-preview`

- **类**：任意文件预览；统一 flow + 统一 surface。
- **实例**：`text` / `markdown` / `image` / `pdf` / `video` / `audio`。
- **差异**：renderer、read 方式、settings、file activations、icon。
- **关键**：文件类型是实例，不是类。

### 4.2 `body.ocr`

- **类**：图像 → 文本/公式/二维码/表格/手写。
- **实例**：`text` / `math` / `qr` / `table` / `handwriting`。
- **差异**：recognizer、postprocess、输出 union、结果面、快捷键。
- **关键**：识别类型是实例；流程形状相同。

### 4.3 `body.image-resizer`

- **类**：批量图片尺寸调整。
- **实例**：
  - `body.image-resizer.web@r2`：1920px 长边，JPEG 85%，suffix `-web`。
  - `body.image-resizer.thumbnail@r1`：256×256 cover，WebP 80%。
  - `body.image-resizer.avatar@r1`：512×512 cover，PNG。
  - `body.image-resizer.email@r1`：1280px 长边，JPEG 75%，max 500KB。
- **差异**：settings 预设；流程/面相同。
- **新增预设 = 新实例**，不是新类。

### 4.4 `body.batch-rename`

- **类**：批量重命名，预览 + 冲突检测 + 撤销。
- **实例**：
  - `regex@r1`：正则替换。
  - `sequence@r1`：`IMG_0001` 序列。
  - `date-prefix@r1`：`2026-11-23_` 前缀。
  - `extension-normalize@r1`：`.jpeg → .jpg`。
- **差异**：rename rules；流程/面相同。
- **关键**：必须有 preview/diff 面，不能直接批量改名。

### 4.5 `body.advanced-paste`

- **类**：剪贴板内容 → 目标格式。
- **实例**：
  - `plain@r1`：去格式。
  - `markdown@r1`：HTML → Markdown。
  - `json@r1`：JSON 格式化/压缩。
  - `ai@r1`：AI 改写/摘要/翻译；需要 network/ai 权限。
- **差异**：transform flow 绑定；面相同。
- **关键**：AI 实例需要审批/预览；不能静默覆盖剪贴板。

### 4.6 `body.window-layout`

- **类**：窗口布局/工作区。
- **实例**：
  - `dev@r1`：VS Code + 终端 + 浏览器，左右布局。
  - `meeting@r1`：会议 + 笔记，单屏。
  - `ultrawide@r1`：三栏。
- **差异**：layout/settings/激活热键；流程/面相同。
- **关键**：布局是实例配置；新布局不是新类。

### 4.7 `body.external-access`

- **类**：外网访问 + VPN 保障。
- **实例**：
  - `work@r3`：GitHub/YouTube/内网；work VPN；hotkey `Ctrl+Alt+E`。
  - `personal@r2`：YouTube/Google；personal VPN；gesture `LDR`。
- **差异**：site flows、VPN binding、policy、activation；流程/面相同。
- **关键**：站点是实例内部绑定，不是 `body.github`。

### 4.8 `body.system-monitor`

- **类**：系统状态显示。
- **实例**：
  - `desktop@r2`：dashboard + HUD。
  - `minimal@r1`：仅托盘 + HUD 2×2。
- **差异**：surface 组合、刷新频率、settings；流程/面相同。
- **关键**：指标是 `surface.metric-card` 实例，不是体类。

### 4.9 `body.service-health`

- **类**：本地服务/端口/依赖健康检查。
- **实例**：
  - `docker@r1`：Docker Desktop。
  - `local-api@r1`：`localhost:3000`。
  - `vpn@r1`：VPN 隧道。
- **差异**：service.status/service.start/net.reachable 绑定；面相同。
- **关键**：服务是点实例，体只是组合。

### 4.10 `body.suite`

- **类**：把多个体打包成一个套件。
- **实例**：
  - `office@r1`：external-access + invoice-archive + screenshot-translate + pdf-toolkit。
  - `dev@r1`：external-access + workspace + ocr + quick-launch。
- **差异**：子体列表/权限并集/入口排序；不复制子体。
- **关键**：suite 是组合体，不是 super-body。

---

## 5. 实例目录（60+）

### 5.1 文件与内容

| BodyInstance | BodyClass | 关键差异 |
|---|---|---|
| `body.file-preview.text@r1` | file-preview | renderer=text；.txt/.log/.json |
| `body.file-preview.markdown@r1` | file-preview | renderer=markdown；.md |
| `body.file-preview.image@r1` | file-preview | renderer=image；.png/.jpg/.webp |
| `body.file-preview.pdf@r1` | file-preview | renderer=pdf；page/zoom |
| `body.file-preview.video@r1` | file-preview | renderer=video；stream |
| `body.file-preview.audio@r1` | file-preview | renderer=audio；waveform |
| `body.ocr.text@r1` | ocr | recognizer=text；Ctrl+Alt+O |
| `body.ocr.math@r1` | ocr | recognizer=math；LaTeX |
| `body.ocr.qr@r1` | ocr | recognizer=qr；format/value |
| `body.ocr.table@r1` | ocr | recognizer=table；cells/csv |
| `body.ocr.handwriting@r1` | ocr | recognizer=handwriting |
| `body.image-resizer.web@r2` | image-resizer | 1920px / JPEG 85% |
| `body.image-resizer.thumbnail@r1` | image-resizer | 256×256 cover |
| `body.image-resizer.avatar@r1` | image-resizer | 512×512 PNG |
| `body.image-resizer.email@r1` | image-resizer | 1280px / ≤500KB |
| `body.batch-rename.regex@r1` | batch-rename | 正则替换 |
| `body.batch-rename.sequence@r1` | batch-rename | 序列号 |
| `body.batch-rename.date-prefix@r1` | batch-rename | 日期前缀 |
| `body.batch-rename.extension-normalize@r1` | batch-rename | 扩展名统一 |
| `body.pdf-toolkit.merge@r1` | pdf-toolkit | 合并 |
| `body.pdf-toolkit.split@r1` | pdf-toolkit | 拆分 |
| `body.pdf-toolkit.compress@r1` | pdf-toolkit | 压缩 |
| `body.pdf-toolkit.rotate@r1` | pdf-toolkit | 旋转/整理 |
| `body.media-converter.image@r1` | media-converter | PNG/JPG/WebP |
| `body.media-converter.video@r1` | media-converter | MP4/WebM |
| `body.media-converter.audio@r1` | media-converter | MP3/WAV |
| `body.file-organizer.downloads@r1` | file-organizer | 按类型/日期 |
| `body.file-organizer.screenshots@r1` | file-organizer | 截图归档 |
| `body.file-organizer.duplicates@r1` | file-organizer | 重复文件 |

### 5.2 剪贴板与输入

| BodyInstance | BodyClass | 关键差异 |
|---|---|---|
| `body.advanced-paste.plain@r1` | advanced-paste | 去格式 |
| `body.advanced-paste.markdown@r1` | advanced-paste | HTML→Markdown |
| `body.advanced-paste.json@r1` | advanced-paste | JSON 格式化 |
| `body.advanced-paste.ai@r1` | advanced-paste | AI 改写/摘要 |
| `body.clipboard-history.recent@r1` | clipboard-history | 最近 100 条 |
| `body.clipboard-history.pinned@r1` | clipboard-history | 固定片段 |
| `body.color-picker.hex@r1` | color-picker | HEX/RGB/HSL |
| `body.color-picker.palette@r1` | color-picker | 屏幕取色板 |
| `body.screen-ruler.px@r1` | screen-ruler | 像素测量 |
| `body.screen-ruler.inches@r1` | screen-ruler | 英寸/厘米 |
| `body.screen-ruler.angle@r1` | screen-ruler | 角度 |

### 5.3 窗口与工作区

| BodyInstance | BodyClass | 关键差异 |
|---|---|---|
| `body.window-layout.dev@r1` | window-layout | VS Code+终端+浏览器 |
| `body.window-layout.meeting@r1` | window-layout | 会议+笔记 |
| `body.window-layout.ultrawide@r1` | window-layout | 三栏 |
| `body.always-on-top.window@r1` | always-on-top | 钉窗口 |
| `body.always-on-top.region@r1` | always-on-top | 钉区域（Crop and Lock） |
| `body.awake.30m@r1` | awake | 30 分钟 |
| `body.awake.until@r1` | awake | 到指定时间 |
| `body.awake.while-app@r1` | awake | 某应用运行期间 |
| `body.workspace.dev@r3` | workspace | 开发 |
| `body.workspace.meeting@r1` | workspace | 会议 |
| `body.workspace.writing@r1` | workspace | 写作 |
| `body.quick-launch.dock@r1` | quick-launch | CLaunch 式 |
| `body.quick-launch.palette@r1` | quick-launch | 命令面板式 |

### 5.4 系统与运维

| BodyInstance | BodyClass | 关键差异 |
|---|---|---|
| `body.system-monitor.desktop@r2` | system-monitor | Dashboard + HUD |
| `body.system-monitor.minimal@r1` | system-monitor | 托盘 + 2×2 HUD |
| `body.service-health.docker@r1` | service-health | Docker |
| `body.service-health.local-api@r1` | service-health | localhost:3000 |
| `body.service-health.vpn@r1` | service-health | VPN |
| `body.file-locksmith.process@r1` | file-locksmith | 锁文件进程 |
| `body.file-locksmith.handle@r1` | file-locksmith | 句柄搜索 |
| `body.hosts-editor.local@r1` | hosts-editor | 本地 hosts |
| `body.hosts-editor.blocklist@r1` | hosts-editor | 广告/域名 blocklist |
| `body.env-vars.user@r1` | env-vars | 用户变量 |
| `body.env-vars.path@r1` | env-vars | PATH 编辑 |

### 5.5 Web / AI / 自动化

| BodyInstance | BodyClass | 关键差异 |
|---|---|---|
| `body.external-access.work@r3` | external-access | work VPN + GitHub/YouTube/内网 |
| `body.external-access.personal@r2` | external-access | personal VPN + YouTube/Google |
| `body.screenshot-translate.en-zh@r4` | screenshot-translate | en→zh |
| `body.screenshot-translate.ja-zh@r2` | screenshot-translate | ja→zh |
| `body.ai-rewrite.formal@r2` | ai-rewrite | 正式化 |
| `body.ai-rewrite.shorten@r1` | ai-rewrite | 压缩 |
| `body.ai-rewrite.translate@r1` | ai-rewrite | 翻译 |
| `body.meeting-notes.local@r1` | meeting-notes | 本地转录 |
| `body.meeting-notes.cloud@r1` | meeting-notes | 云端转录 |
| `body.web-clipper.selection@r1` | web-clipper | 选中内容→Markdown |
| `body.web-clipper.page@r1` | web-clipper | 整页→Markdown |
| `body.web-clipper.readability@r1` | web-clipper | 正文提取 |
| `body.backup-sync.folder@r1` | backup-sync | 文件夹快照 |
| `body.backup-sync.daily@r1` | backup-sync | 每日增量 |
| `body.invoice-archive.company@r6` | invoice-archive | 公司发票 |
| `body.invoice-archive.personal@r2` | invoice-archive | 个人发票 |
| `body.suite.office@r1` | suite | 办公套件 |
| `body.suite.dev@r1` | suite | 开发套件 |

---

## 6. 复用关系

```text
body.file-preview
  ├── flow.preview-file
  ├── surface.preview-window
  └── renderer point instances

body.ocr
  ├── flow.ocr.recognize
  ├── surface.ocr-result
  └── ocr.recognizer point instances

body.image-resizer
  ├── flow.resize-image
  └── surface.resize-dialog
        ↑ settings 预设不同 → 多实例

body.advanced-paste
  ├── flow.paste-transform
  └── surface.paste-preview
        ↑ transform 绑定不同 → 多实例

body.external-access
  ├── flow.open-external-site
  ├── flow.ensure-vpn
  └── surface.site-launcher
        ↑ site/VPN/policy 不同 → 多实例
```

---

## 7. 反模式

- ❌ `body.github`、`body.youtube`：应是 external-access 的实例配置。
- ❌ `body.resize-web`、`body.resize-avatar`：应是 image-resizer 的实例。
- ❌ `body.ocr-math`、`body.ocr-table`：应是 ocr 的实例。
- ❌ `body.plain-paste`、`body.json-paste`：应是 advanced-paste 的实例。
- ❌ `body.dev-layout`、`body.meeting-layout`：应是 window-layout 的实例。
- ❌ 每个文件类型/格式/预设建一个 BodyClass。
- ❌ 把 BodyInstance 当安装目录。
- ❌ BodyInstance 不锁 Flow/Surface revision。
- ❌ 把“设置/预设”写进 BodyClass 版本。
- ❌ Suite 复制子体，而不是引用。

---

## 8. 优先级

### P0（先做 9 个类）

- `body.file-preview`
- `body.ocr`
- `body.image-resizer`
- `body.batch-rename`
- `body.advanced-paste`
- `body.color-picker`
- `body.window-layout`
- `body.quick-launch`
- `body.external-access`

### P1（再做 13 个类）

- `body.pdf-toolkit`
- `body.media-converter`
- `body.file-organizer`
- `body.clipboard-history`
- `body.screen-ruler`
- `body.always-on-top`
- `body.awake`
- `body.workspace`
- `body.system-monitor`
- `body.service-health`
- `body.screenshot-translate`
- `body.ai-rewrite`
- `body.invoice-archive`

### P2（生态与运维）

- `body.file-locksmith`
- `body.hosts-editor`
- `body.env-vars`
- `body.meeting-notes`
- `body.suite`
- `body.web-clipper`
- `body.backup-sync`

---

## 9. 一句话总结

**体类要少，实例要多。**

一个 `body.image-resizer` 可以有 web/thumbnail/avatar/email 四个实例；一个 `body.ocr` 可以有 text/math/qr/table 四个实例；一个 `body.external-access` 可以有 work/personal 两个实例。

新增需求时先问：这是**新实例**，还是**新流程/新面/新权限**？只有后者才值得新增 BodyClass。
