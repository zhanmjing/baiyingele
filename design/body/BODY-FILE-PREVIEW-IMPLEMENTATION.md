# 体层具体实现：文件预览 BodyClass 与文件类型 BodyInstance

> 需求：一个“预览文件”功能，不同文件类型就是不同实例。
>
> 结论：建议做成 **一个 BodyClass `body.file-preview` + 多个 BodyInstance `body.file-preview.text/image/pdf/video/audio`**。  
> 它们共享同一条预览流程和同一个预览窗口契约；差异只在 **文件类型路由、FlowInstance 绑定、SurfaceInstance 绑定、settings、permissions、icon**。

---

## 0. 一句话结论

```text
BodyClass: body.file-preview
  ├── FlowClass: flow.preview-file
  │     slots: detect / read / render / present
  ├── SurfaceClass: surface.preview-window
  │     regions: header / content / statusbar / toolbar
  ├── SettingSpec: maxBytes / encoding / zoom / autoplay
  └── PermissionSpec: fs.read / window.open
        ↓ 实例化
BodyInstance: body.file-preview.text
  flows:    [inst.preview-file.text@r1]
  surfaces: [surface.preview-window.text@r1]
  settings: renderer=text, encoding=utf-8, maxBytes=5MB
  activations: file [.txt .md .json .log] + mime [text/plain ...]
        ↓ 文件打开
resolveBodyForFile(path) → runFlow(inst.preview-file.text) → showSurface(surface.preview-window.text)
```

- **一个 BodyClass**：预览功能的统一契约。
- **多个 BodyInstance**：text / image / pdf / video / audio。
- **不是多个 BodyClass**：`body.preview-text`、`body.preview-image` 会把权限、设置、安装、更新复制 N 份。
- **只有流程形状或面契约变化时**，才升 BodyClass 版本或拆新 BodyClass。

---

## 1. 为什么“文件类型 = BodyInstance”

| 文件类型 | 预览流程 | 差异 | 结论 |
|---|---|---|---|
| text | detect → read → render → present | renderer=text；encoding；maxBytes | 同一 BodyClass 的实例 |
| image | detect → read → render → present | renderer=image；maxPixels | 同一 BodyClass 的实例 |
| pdf | detect → read → render → present | renderer=pdf；page/zoom | 同一 BodyClass 的实例 |
| video | detect → read stream → render → present | renderer=video；autoplay | 同一 BodyClass 的实例（P1 可升 FlowClass 版本） |
| audio | detect → read stream → render → present | renderer=audio；waveform | 同一 BodyClass 的实例 |

**判定规则**：

- 只换渲染器 / 读取方式 / 设置 / 扩展名 → **新 BodyInstance**。
- 需要新的流程形状（例如视频要 probe metadata + range request + 播放器状态同步）→ **新 FlowClass 版本**，BodyClass 也升版本。
- 需要新的面契约（例如 3D 模型要 orbit controls，而不是静态 content 区）→ **新 SurfaceClass 版本 / 新 BodyClass**。
- 只是增加一个扩展名 → **改 BodyInstance 的 activations，revision +1**。

---

## 2. BodyClass Manifest

`body.file-preview/body.json`：

```json
{
  "schemaVersion": "1.0",
  "id": "body.file-preview",
  "version": "1.0.0",
  "name": "文件预览",
  "description": "按文件类型选择渲染器，在统一预览窗口中打开。",
  "minAppVersion": "0.9.0",

  "entrypoints": {
    "main": "surface.preview-window",
    "onActivate": "flow.preview-file"
  },

  "contributes": {
    "flows": ["flow.preview-file"],
    "surfaces": ["surface.preview-window"],
    "fileTypes": [
      {
        "extensions": [".txt", ".log", ".json"],
        "mime": ["text/plain", "application/json"],
        "bodyInstance": "body.file-preview.text"
      },
      {
        "extensions": [".md", ".markdown"],
        "mime": ["text/markdown"],
        "bodyInstance": "body.file-preview.markdown"
      },
      {
        "extensions": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
        "mime": ["image/*"],
        "bodyInstance": "body.file-preview.image"
      },
      {
        "extensions": [".pdf"],
        "mime": ["application/pdf"],
        "bodyInstance": "body.file-preview.pdf"
      },
      {
        "extensions": [".mp4", ".webm", ".mkv"],
        "mime": ["video/*"],
        "bodyInstance": "body.file-preview.video"
      },
      {
        "extensions": [".mp3", ".wav", ".flac"],
        "mime": ["audio/*"],
        "bodyInstance": "body.file-preview.audio"
      }
    ],
    "settings": ["preview.maxBytes", "preview.encoding", "preview.zoom", "preview.autoplay"],
    "triggers": ["file-open", "drag-drop", "open-with"]
  },

  "permissions": ["fs.read", "window.open"],
  "dependencies": [],
  "assets": [
    "assets/icons/text.svg",
    "assets/icons/image.svg",
    "assets/icons/pdf.svg",
    "assets/icons/video.svg",
    "assets/icons/audio.svg"
  ],
  "tests": ["smoke.text", "smoke.image", "smoke.pdf", "smoke.video", "contract.renderer"],
  "migrations": [],
  "update": { "channel": "stable", "autoUpdate": true },
  "signature": { "publisher": "example", "keyId": "example-key-1" }
}
```

> `contributes.fileTypes` 用于目录展示/校验；运行时权威仍是 BodyInstance 的 `activations`。安装时校验两者一致。

---

## 3. BodyInstance：text

`body-instances/text.json`：

```json
{
  "id": "body.file-preview.text",
  "bodyClassId": "body.file-preview",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",

  "flows": ["inst.preview-file.text@r1"],
  "surfaces": ["surface.preview-window.text@r1"],

  "settings": [
    { "key": "preview.renderer.kind", "value": "text", "source": "body" },
    { "key": "preview.encoding", "value": "utf-8", "source": "body" },
    { "key": "preview.maxBytes", "value": 5242880, "source": "body" },
    { "key": "preview.wrap", "value": true, "source": "body" }
  ],

  "permissions": ["fs.read"],

  "activations": [
    {
      "kind": "file",
      "extensions": [".txt", ".log", ".json"],
      "mime": ["text/plain", "application/json"],
      "priority": 100
    }
  ],

  "revision": 1,
  "status": "active"
}
```

## 4. BodyInstance：image

```json
{
  "id": "body.file-preview.image",
  "bodyClassId": "body.file-preview",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",

  "flows": ["inst.preview-file.image@r1"],
  "surfaces": ["surface.preview-window.image@r1"],

  "settings": [
    { "key": "preview.renderer.kind", "value": "image", "source": "body" },
    { "key": "preview.maxBytes", "value": 33554432, "source": "body" },
    { "key": "preview.maxPixels", "value": 64000000, "source": "body" },
    { "key": "preview.fit", "value": "contain", "source": "body" }
  ],

  "permissions": ["fs.read"],

  "activations": [
    {
      "kind": "file",
      "extensions": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
      "mime": ["image/*"],
      "priority": 100
    }
  ],

  "revision": 1,
  "status": "active"
}
```

## 5. 其他实例

| BodyInstance | extensions | FlowInstance | SurfaceInstance | 关键 settings |
|---|---|---|---|---|
| `body.file-preview.markdown` | `.md` `.markdown` | `inst.preview-file.markdown@r1` | `surface.preview-window.markdown@r1` | renderer=markdown, sanitize=true |
| `body.file-preview.pdf` | `.pdf` | `inst.preview-file.pdf@r1` | `surface.preview-window.pdf@r1` | page=1, zoom=fit, maxBytes=128MB |
| `body.file-preview.video` | `.mp4` `.webm` `.mkv` | `inst.preview-file.video@r1` | `surface.preview-window.video@r1` | autoplay=false, stream=true |
| `body.file-preview.audio` | `.mp3` `.wav` `.flac` | `inst.preview-file.audio@r1` | `surface.preview-window.audio@r1` | waveform=true, autoplay=false |

**注意**：video/audio 的 `read` 槽位绑定 `file.read.stream@r1`，不是 `file.read.bytes@r1`；如果 FlowClass 不支持流式读取，就升 `flow.preview-file` 版本，而不是把整个文件读进内存。

---

## 6. FlowClass：`flow.preview-file`

```ts
FlowClass {
  id: "flow.preview-file";
  version: "1.0.0";
  params: ["path", "maxBytes"];
  outputs: ["PreviewResult"];

  slots: [
    { slotId: "detect",  accepts: "mime.detect",       default: "mime.detect.extension@r1" },
    { slotId: "read",    accepts: "file.read",         default: "file.read.bytes@r1" },
    { slotId: "render",  accepts: "preview.renderer",  default: "render.text@r1" },
    { slotId: "present", accepts: "ui.present",        default: "window.present.preview@r1" }
  ];

  gates: ["if", "fallback", "timeout"];
  edges: [
    "detect -> read -> render -> present"
  ];
}
```

`render` 槽位接受 **capability interface** `preview.renderer`：

```ts
interface PreviewRenderer {
  supports: string[];          // mime patterns
  render(input: RenderInput): RenderOutput;
}
```

实现/PointInstance：

```text
render.text@r1
render.markdown@r1
render.image@r1
render.pdf@r1
render.video@r1
render.audio@r1
```

**为什么用接口而不是 6 个 FlowClass**：

- 预览流程形状相同：detect → read → render → present。
- 差异只在 renderer 实现。
- BodyInstance 换 renderer 绑定即可；不复制流程。

**什么时候必须拆 FlowClass**：

- video 需要 probe metadata、range request、播放器状态同步 → `flow.preview-video` 或 `flow.preview-file` v2。
- pdf 需要分页/缩略图/文本层 → 可以在 renderer 内部做；如果流程要加 `renderThumbnails` 节点，则升 FlowClass 版本。
- 3D 模型需要 orbit controls / 资源加载 → 新 SurfaceClass + 新 FlowClass。

---

## 7. SurfaceClass：`surface.preview-window`

```ts
SurfaceClass {
  id: "surface.preview-window";
  version: "1.0.0";
  regions: ["header", "toolbar", "content", "statusbar"];
  slots: ["title", "content", "actions[]", "status"];
  data: ["PreviewResult"];
  actions: ["zoomIn", "zoomOut", "fit", "openExternal", "copyPath", "retry"];
  states: ["loading", "ready", "unsupported", "error"];
}
```

实例：

```text
surface.preview-window.text@r1
surface.preview-window.markdown@r1
surface.preview-window.image@r1
surface.preview-window.pdf@r1
surface.preview-window.video@r1
surface.preview-window.audio@r1
```

差异只在 `content` 绑定：

| 实例 | content binding |
|---|---|
| `.text` | `render.text@r1` output |
| `.markdown` | `render.markdown@r1` output |
| `.image` | `render.image@r1` output |
| `.pdf` | `render.pdf@r1` output |
| `.video` | `render.video@r1` output |
| `.audio` | `render.audio@r1` output |

---

## 8. Rust 类型（建议）

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyManifest {
    pub schema_version: String,
    pub id: String,
    pub version: String,
    pub name: String,
    pub min_app_version: String,
    pub entrypoints: BodyEntrypoints,
    pub contributes: BodyContributions,
    pub permissions: Vec<String>,
    pub dependencies: Vec<BodyDependency>,
    pub assets: Vec<AssetRef>,
    pub tests: Vec<BodyTest>,
    pub migrations: Vec<BodyMigration>,
    pub signature: SignatureRef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyInstance {
    pub id: String,
    pub body_class_id: String,
    pub body_class_version: String,
    pub package_digest: String,
    pub flows: Vec<FlowInstanceRef>,
    pub surfaces: Vec<SurfaceInstanceRef>,
    pub settings: Vec<SettingValue>,
    pub permissions: Vec<String>,
    pub activations: Vec<ActivationBinding>,
    pub revision: u32,
    pub status: BodyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ActivationBinding {
    File {
        extensions: Vec<String>,
        mime: Vec<String>,
        priority: i32,
    },
    Hotkey { spec: String },
    Gesture { pattern: String, button: String },
    Url { pattern: String },
    Manual,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BodyStatus {
    Staged,
    Installed,
    Active,
    Updating,
    Degraded,
    Archived,
}
```

---

## 9. BodyRegistry / FileTypeRouter

```rust
use std::path::Path;

pub struct BodyRegistry {
    instances: std::collections::HashMap<String, BodyInstance>,
    file_rules: Vec<FileTypeRule>,
}

pub struct FileTypeRule {
    pub body_instance_id: String,
    pub extensions: Vec<String>,
    pub mime: Vec<String>,
    pub priority: i32,
    pub enabled: bool,
}

impl FileTypeRule {
    pub fn matches(&self, ext: &str, mime: &str) -> bool {
        let ext = ext.to_ascii_lowercase();
        let ext_hit = self.extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext));
        let mime_hit = self.mime.iter().any(|m| {
            m == "*"
                || m.eq_ignore_ascii_case(mime)
                || (m.ends_with("/*")
                    && mime.to_ascii_lowercase().starts_with(&m[..m.len() - 1].to_ascii_lowercase()))
        });
        ext_hit || mime_hit
    }

    pub fn specificity(&self, ext: &str, mime: &str) -> (i32, i32, i32) {
        let ext = ext.to_ascii_lowercase();
        let ext_exact = self.extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext)) as i32;
        let mime_exact = self.mime.iter().any(|m| m.eq_ignore_ascii_case(mime)) as i32;
        let mime_wild = self.mime.iter().any(|m| m.ends_with("/*")) as i32;
        (ext_exact * 3 + mime_exact * 2 + mime_wild, self.priority, self.extensions.len() as i32)
    }
}

impl BodyRegistry {
    pub fn resolve_for_file(&self, path: &Path) -> Option<&BodyInstance> {
        let ext = path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_ascii_lowercase()))
            .unwrap_or_default();
        let mime = mime_guess::from_path(path).first_raw().unwrap_or("");

        self.file_rules
            .iter()
            .filter(|r| r.enabled)
            .filter(|r| r.matches(&ext, mime))
            .max_by_key(|r| r.specificity(&ext, mime))
            .and_then(|r| self.instances.get(&r.body_instance_id))
    }
}
```

匹配优先级：

```text
exact extension > mime exact > mime wildcard > generic *
priority 高者优先
specificity 高者优先
仍并列 → 歧义选择器 / 不自动打开
```

**不要**按注册顺序取第一条；用户装两个预览体时，顺序会变。

---

## 10. 运行时序列

```text
用户双击 / 拖入 / Open With
  → BodyRegistry.resolve_for_file(path)
  → BodyInstance
  → FlowRegistry.get(body.flows[0])
  → engine.run(flow, { path })
       detect → read → render → present
  → PreviewResult
  → SurfaceRegistry.get(body.surfaces[0])
  → surface.show(PreviewResult)
```

伪代码：

```rust
pub fn preview_file(path: &Path) -> Result<PreviewResult, PreviewError> {
    let body = body_registry()
        .resolve_for_file(path)
        .ok_or(PreviewError::UnsupportedType)?;

    let flow = flow_registry()
        .get(&body.flows[0])
        .ok_or(PreviewError::MissingFlow)?;

    let result = engine.run(flow, serde_json::json!({ "path": path }))?;

    surface_registry()
        .get(&body.surfaces[0])
        .ok_or(PreviewError::MissingSurface)?
        .show(result.clone())?;

    Ok(result)
}
```

---

## 11. 包布局

```text
body.file-preview-1.0.0.body
  ├── body.json
  ├── body-instances/
  │     ├── text.json
  │     ├── markdown.json
  │     ├── image.json
  │     ├── pdf.json
  │     ├── video.json
  │     └── audio.json
  ├── payload/
  │     ├── flows/
  │     │     └── flow.preview-file.flow.json
  │     ├── surfaces/
  │     │     └── surface.preview-window.surface.json
  │     ├── assets/icons/
  │     └── tests/
  ├── blockmap.json
  └── signature.p7s
```

安装器：

```text
verify package
  → parse body.json
  → validate body-instances
      flows exist
      surfaces exist
      permissions ⊆ manifest.permissions
      file type rules don't conflict (or have priority)
  → write BodyInstance records
  → write BodyInstallation record
  → register file rules
```

---

## 12. 文件类型路由表

| 扩展名 | MIME | BodyInstance | Renderer | 读法 |
|---|---|---|---|---|
| `.txt` `.log` `.json` | text/plain, application/json | `body.file-preview.text` | `render.text@r1` | `file.read.text@r1` |
| `.md` `.markdown` | text/markdown | `body.file-preview.markdown` | `render.markdown@r1` | `file.read.text@r1` |
| `.png` `.jpg` `.jpeg` `.webp` `.gif` | image/* | `body.file-preview.image` | `render.image@r1` | `file.read.bytes@r1` |
| `.pdf` | application/pdf | `body.file-preview.pdf` | `render.pdf@r1` | `file.read.bytes@r1` |
| `.mp4` `.webm` `.mkv` | video/* | `body.file-preview.video` | `render.video@r1` | `file.read.stream@r1` |
| `.mp3` `.wav` `.flac` | audio/* | `body.file-preview.audio` | `render.audio@r1` | `file.read.stream@r1` |

---

## 13. 测试与验收

### 单元测试

- `resolve_for_file("a.txt") == body.file-preview.text`
- `resolve_for_file("a.png") == body.file-preview.image`
- `resolve_for_file("a.pdf") == body.file-preview.pdf`
- 大小写扩展名归一化
- MIME 缺失时按扩展名
- 扩展名冲突时按 priority/specificity
- 未知类型返回 `UnsupportedType`
- 权限不足返回 `PermissionDenied`

### 集成测试

1. 打开 `.txt`：文本预览窗口，编码/换行正确。
2. 打开 `.png`：图片预览，fit/zoom 正常。
3. 打开 `.pdf`：PDF 第一页/翻页/缩放。
4. 打开 `.mp4`：播放器出现，未把整个文件读入内存。
5. 打开未知文件：显示“不支持预览”，提供“用系统默认应用打开”。
6. 关闭 body instance：路由回退到下一个匹配/系统默认。
7. 修改 `.txt` 的 maxBytes：新 BodyInstance revision，旧实例不漂移。
8. body class 升级：实例迁移/保持旧版，运行历史记录版本。

---

## 14. 迁移与优先级

### P0

- `BodyManifest` / `BodyClass` / `BodyInstance` / `BodyInstallation` 类型
- `body.file-preview` manifest + text/image/pdf 三个实例
- `flow.preview-file` + `surface.preview-window`
- `BodyRegistry.resolve_for_file`
- 包安装写 BodyInstance + BodyInstallation
- 未知类型 fallback

### P1

- markdown/video/audio
- 流式读取
- 每包独立目录 + blockmap/signature
- 权限 consent
- body update/rollback
- file type 冲突选择器

### P2

- 3D/CAD/archive 等新 SurfaceClass/FlowClass
- 预览插件市场
- 系统“打开方式”注册
- 多预览器竞争/评分
- AI 选择 renderer

---

## 15. 一句话总结

**一个 `body.file-preview` 类，多个文件类型实例；每个实例 = 文件类型路由 + FlowInstance + SurfaceInstance + settings + permissions + icon。**

新增文件类型时，先问：

1. 只是换 renderer/扩展名/设置？→ **新 BodyInstance**。
2. 流程形状变了？→ **新 FlowClass 版本 + BodyClass 版本**。
3. 面契约变了？→ **新 SurfaceClass 版本 / 新 BodyClass**。

这样“不同文件类型就是不同实例”成立，但不会退化成“每个文件类型一个体类”。
