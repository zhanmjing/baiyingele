# 体层 OCR：BodyClass 与识别类型 BodyInstance 具体实现

> 需求：体层 OCR 识别，不同识别类型（普通文字、数学公式、二维码、表格）就是不同实例。
>
> 结论：一个 BodyClass `body.ocr` + 多个 BodyInstance `body.ocr.text/math/qr/table/handwriting`。它们共享同一条 `flow.ocr.recognize` 和同一个 `surface.ocr-result`；差异在识别器、后处理、输出 schema、设置、权限、快捷键。

---

## 0. 一句话结论

```text
BodyClass: body.ocr
  ├── FlowClass: flow.ocr.recognize
  │     slots: preprocess / recognize / postprocess / present
  ├── SurfaceClass: surface.ocr-result
  │     regions: header / toolbar / content / statusbar
  ├── SettingSpec: language / mode / confidence / outputFormat / autoCopy
  └── PermissionSpec: screen.capture / fs.read / clipboard.write / network?
        ↓ 实例化
BodyInstance: body.ocr.text
  flow: inst.ocr.text@r1
  surface: surface.ocr-result.text@r1
  recognizer: ocr.text@r1
  postprocess: ocr.postprocess.text@r1
  activations: hotkey Ctrl+Alt+O / screenshot / file
```

- **一个 BodyClass**：OCR 功能的统一契约。
- **多个 BodyInstance**：text / math / qr / table / handwriting。
- **不是多个 BodyClass**：否则权限、设置、安装、更新、结果面都要复制 N 份。
- **只有流程形状或面契约变化时**，才升 BodyClass 版本或拆新 BodyClass。

---

## 1. 为什么识别类型 = BodyInstance

| 类型 | 识别器 | 后处理 | 输出 | 结果面 |
|---|---|---|---|---|
| text | `ocr.text@r1` | `ocr.postprocess.text@r1` | `{ kind:"text", text, blocks, confidence }` | `surface.ocr-result.text` |
| math | `ocr.math@r1` | `ocr.postprocess.math@r1` | `{ kind:"math", latex, confidence, bbox }` | `surface.ocr-result.math` |
| qr | `ocr.qr@r1` | `ocr.postprocess.qr@r1` | `{ kind:"qr", format, value, bbox }` | `surface.ocr-result.qr` |
| table | `ocr.table@r1` | `ocr.postprocess.table@r1` | `{ kind:"table", rows, cols, cells, html, csv }` | `surface.ocr-result.table` |
| handwriting | `ocr.handwriting@r1` | `ocr.postprocess.text@r1` | `{ kind:"text", text, blocks, confidence }` | `surface.ocr-result.handwriting` |

**判定规则**：

- 只换识别器 / 后处理 / 输出格式 / 快捷键 → **新 BodyInstance**。
- 需要新的流程形状（例如多页 PDF 批处理、表格单元格合并、公式编辑回写）→ **新 FlowClass 版本 + BodyClass 版本**。
- 需要新的面契约（例如公式可视化编辑器、表格单元格编辑器）→ **新 SurfaceClass 版本 / 新 BodyClass**。
- 只增加一种二维码格式（QR → Code128）→ **改 BodyInstance settings / recognizer params，revision +1**。

---

## 2. BodyClass Manifest

`body.ocr/body.json`：

```json
{
  "schemaVersion": "1.0",
  "id": "body.ocr",
  "version": "1.0.0",
  "name": "OCR 识别",
  "description": "识别文字、数学公式、二维码、表格与手写内容。",
  "minAppVersion": "0.9.0",

  "entrypoints": {
    "main": "surface.ocr-result",
    "onActivate": "flow.ocr.recognize"
  },

  "contributes": {
    "flows": ["flow.ocr.recognize"],
    "surfaces": ["surface.ocr-result"],
    "ocrModes": [
      { "mode": "text", "bodyInstance": "body.ocr.text", "label": "文字" },
      { "mode": "math", "bodyInstance": "body.ocr.math", "label": "数学公式" },
      { "mode": "qr", "bodyInstance": "body.ocr.qr", "label": "二维码/条码" },
      { "mode": "table", "bodyInstance": "body.ocr.table", "label": "表格" },
      { "mode": "handwriting", "bodyInstance": "body.ocr.handwriting", "label": "手写" }
    ],
    "settings": [
      "ocr.language",
      "ocr.maxPixels",
      "ocr.confidenceThreshold",
      "ocr.outputFormat",
      "ocr.autoCopy"
    ],
    "triggers": ["hotkey", "screenshot", "file-open", "clipboard-image", "drag-drop"]
  },

  "permissions": ["screen.capture", "fs.read", "clipboard.write"],
  "dependencies": [],
  "assets": [
    "assets/icons/text.svg",
    "assets/icons/math.svg",
    "assets/icons/qr.svg",
    "assets/icons/table.svg",
    "assets/icons/handwriting.svg"
  ],
  "tests": ["smoke.text", "smoke.math", "smoke.qr", "smoke.table", "contract.recognizer"],
  "migrations": [],
  "update": { "channel": "stable", "autoUpdate": true },
  "signature": { "publisher": "example", "keyId": "example-key-1" }
}
```

> `contributes.ocrModes` 用于模式菜单/目录展示；运行时权威仍是 BodyInstance 的 `activations` 和 `settings.mode`。

---

## 3. BodyInstance：text

```json
{
  "id": "body.ocr.text",
  "bodyClassId": "body.ocr",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",

  "flows": ["inst.ocr.text@r1"],
  "surfaces": ["surface.ocr-result.text@r1"],

  "settings": [
    { "key": "ocr.mode", "value": "text", "source": "body" },
    { "key": "ocr.language", "value": "auto", "source": "user" },
    { "key": "ocr.maxPixels", "value": 25000000, "source": "body" },
    { "key": "ocr.confidenceThreshold", "value": 0.6, "source": "body" },
    { "key": "ocr.autoCopy", "value": true, "source": "user" }
  ],

  "permissions": ["screen.capture", "fs.read", "clipboard.write"],

  "activations": [
    { "kind": "hotkey", "spec": "Ctrl+Alt+O" },
    { "kind": "file", "extensions": [".png", ".jpg", ".jpeg", ".webp"], "mime": ["image/*"], "priority": 100 }
  ],

  "revision": 1,
  "status": "active"
}
```

## 4. BodyInstance：math

```json
{
  "id": "body.ocr.math",
  "bodyClassId": "body.ocr",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",
  "flows": ["inst.ocr.math@r1"],
  "surfaces": ["surface.ocr-result.math@r1"],
  "settings": [
    { "key": "ocr.mode", "value": "math", "source": "body" },
    { "key": "ocr.outputFormat", "value": "latex", "source": "body" },
    { "key": "ocr.confidenceThreshold", "value": 0.5, "source": "body" },
    { "key": "ocr.autoCopy", "value": true, "source": "user" }
  ],
  "permissions": ["screen.capture", "fs.read", "clipboard.write"],
  "activations": [
    { "kind": "hotkey", "spec": "Ctrl+Alt+M" },
    { "kind": "file", "extensions": [".png", ".jpg", ".jpeg", ".webp"], "mime": ["image/*"], "priority": 100 }
  ],
  "revision": 1,
  "status": "active"
}
```

## 5. BodyInstance：qr

```json
{
  "id": "body.ocr.qr",
  "bodyClassId": "body.ocr",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",
  "flows": ["inst.ocr.qr@r1"],
  "surfaces": ["surface.ocr-result.qr@r1"],
  "settings": [
    { "key": "ocr.mode", "value": "qr", "source": "body" },
    { "key": "qr.formats", "value": ["qr", "microqr", "code128", "ean13"], "source": "body" },
    { "key": "qr.autoOpenUrl", "value": false, "source": "body" },
    { "key": "ocr.autoCopy", "value": true, "source": "user" }
  ],
  "permissions": ["screen.capture", "fs.read", "clipboard.write"],
  "activations": [
    { "kind": "hotkey", "spec": "Ctrl+Alt+Q" },
    { "kind": "file", "extensions": [".png", ".jpg", ".jpeg", ".webp"], "mime": ["image/*"], "priority": 100 }
  ],
  "revision": 1,
  "status": "active"
}
```

## 6. BodyInstance：table

```json
{
  "id": "body.ocr.table",
  "bodyClassId": "body.ocr",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:...",
  "flows": ["inst.ocr.table@r1"],
  "surfaces": ["surface.ocr-result.table@r1"],
  "settings": [
    { "key": "ocr.mode", "value": "table", "source": "body" },
    { "key": "ocr.outputFormat", "value": "markdown", "source": "user" },
    { "key": "table.preserveMergedCells", "value": true, "source": "body" },
    { "key": "ocr.confidenceThreshold", "value": 0.5, "source": "body" }
  ],
  "permissions": ["screen.capture", "fs.read", "clipboard.write"],
  "activations": [
    { "kind": "hotkey", "spec": "Ctrl+Alt+T" },
    { "kind": "file", "extensions": [".png", ".jpg", ".jpeg", ".webp", ".pdf"], "mime": ["image/*", "application/pdf"], "priority": 100 }
  ],
  "revision": 1,
  "status": "active"
}
```

## 7. handwriting 实例

- `body.ocr.handwriting@r1`
- recognizer `ocr.handwriting@r1`
- postprocess `ocr.postprocess.text@r1`
- surface `surface.ocr-result.handwriting@r1`
- settings：`language=auto`、`confidenceThreshold=0.4`、`autoCopy=false`。
- 输出仍是 `OcrResult::Text`，但 blocks 带 `handwriting: true`。

---

## 8. FlowClass：`flow.ocr.recognize`

```ts
FlowClass {
  id: "flow.ocr.recognize";
  version: "1.0.0";
  params: ["image", "mode", "language", "maxPixels", "confidenceThreshold"];
  outputs: ["OcrResult"];

  slots: [
    { slotId: "preprocess", accepts: "image.preprocess", default: "image.preprocess.auto@r1" },
    { slotId: "recognize",  accepts: "ocr.recognizer",  default: "ocr.text@r1" },
    { slotId: "postprocess", accepts: "ocr.postprocess", default: "ocr.postprocess.text@r1" },
    { slotId: "present",    accepts: "ui.present",      default: "window.present.ocr@r1" }
  ];

  gates: ["if", "fallback", "timeout"];
  edges: [
    "preprocess -> recognize -> postprocess -> present"
  ];
}
```

`ocr.recognizer` 是 capability interface：

```ts
interface OcrRecognizer {
  supports: Array<"text" | "math" | "qr" | "table" | "handwriting">;
  recognize(input: OcrInput): OcrResult;
}
```

实现/PointInstance：

```text
ocr.text@r1
ocr.math@r1
ocr.qr@r1
ocr.table@r1
ocr.handwriting@r1
```

**为什么用接口而不是 5 个 FlowClass**：

- 流程形状相同：preprocess → recognize → postprocess → present。
- 差异只在 recognizer 与 postprocess 实现。
- BodyInstance 换绑定即可；不复制五条流程。

**什么时候必须拆 FlowClass**：

- 多页 PDF 批处理、逐页 OCR、合并结果 → `flow.ocr.batch` 或 `flow.ocr.recognize` v2。
- 表格需要单元格合并/跨页表头 → 可以在 postprocess 内做；如果流程新增 `mergeCells` 节点，则升 FlowClass 版本。
- 公式需要可视化编辑/回写 → 新 SurfaceClass + 可能新 FlowClass。

---

## 9. 输出 union

```ts
type OcrResult =
  | {
      kind: "text";
      text: string;
      blocks: Array<{ text: string; bbox: BBox; confidence: number; handwriting?: boolean }>;
      confidence: number;
    }
  | {
      kind: "math";
      latex: string;
      confidence: number;
      bbox: BBox;
    }
  | {
      kind: "qr";
      format: "qr" | "microqr" | "code128" | "ean13" | string;
      value: string;
      bbox: BBox;
    }
  | {
      kind: "table";
      rows: number;
      cols: number;
      cells: Array<Array<{ text: string; rowSpan: number; colSpan: number; confidence: number }>>;
      html: string;
      csv: string;
    };
```

`surface.ocr-result` 根据 `kind` 渲染不同内容；BodyInstance 的 `surface` 绑定决定默认视图。

---

## 10. SurfaceClass：`surface.ocr-result`

```ts
SurfaceClass {
  id: "surface.ocr-result";
  version: "1.0.0";
  regions: ["header", "toolbar", "content", "statusbar"];
  slots: ["title", "content", "actions[]", "status"];
  data: ["OcrResult"];
  actions: ["copy", "insert", "openUrl", "exportCsv", "copyLatex", "zoom", "retry"];
  states: ["loading", "ready", "empty", "lowConfidence", "error"];
}
```

实例：

| SurfaceInstance | content | 主操作 |
|---|---|---|
| `surface.ocr-result.text@r1` | 文本块 + 置信度 | 复制 / 插入 |
| `surface.ocr-result.math@r1` | LaTeX 预览 | 复制 LaTeX / 插入 |
| `surface.ocr-result.qr@r1` | 解码值 + format | 复制 / 打开 URL（需确认） |
| `surface.ocr-result.table@r1` | 表格网格 | 导出 CSV / 复制 Markdown |
| `surface.ocr-result.handwriting@r1` | 文本块 + 手写标记 | 复制 / 插入 |

---

## 11. 点层与 pack

OCR 需要新的点层能力，当前项目还没有 `screen.ocr`/`ocr.*`：

```text
pack.ocr
  ├── ocr.text@r1
  ├── ocr.math@r1
  ├── ocr.qr@r1
  ├── ocr.table@r1
  ├── ocr.handwriting@r1
  ├── ocr.postprocess.text@r1
  ├── ocr.postprocess.math@r1
  ├── ocr.postprocess.qr@r1
  ├── ocr.postprocess.table@r1
  └── image.preprocess.auto@r1
```

- 本地引擎优先；云端 OCR 作为点实例 `ocr.text.cloud@r1`，需要 `network` 权限与显式同意。
- 数学/表格模型可能较大，放 `assets/models/` 或按需下载。
- 二维码解码不需要 OCR 模型，但仍作为 `ocr.recognizer` 的实现，保持统一流程。

---

## 12. 模式选择

用户触发 OCR 的方式：

```text
Ctrl+Alt+O  → body.ocr.text
Ctrl+Alt+M  → body.ocr.math
Ctrl+Alt+Q  → body.ocr.qr
Ctrl+Alt+T  → body.ocr.table
```

也可以：

- 截屏后弹出模式菜单：文字 / 公式 / 二维码 / 表格。
- 文件右键“用 OCR 打开” → 根据 body instances 的 file activation 选择。
- 托盘菜单：最近使用的 OCR 模式。
- 命令面板：搜索“OCR 表格”。

歧义处理：

- 同一快捷键绑定多个 BodyInstance → 冲突诊断，不静默取第一个。
- 文件类型匹配多个实例 → 按 priority/specificity；仍并列 → 选择器。

---

## 13. Rust 类型（建议）

```rust
use serde::{Deserialize, Serialize};

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
pub enum OcrResult {
    Text { text: String, blocks: Vec<TextBlock>, confidence: f32 },
    Math { latex: String, confidence: f32, bbox: BBox },
    Qr { format: String, value: String, bbox: BBox },
    Table { rows: usize, cols: usize, cells: Vec<Vec<TableCell>>, html: String, csv: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrInput {
    pub image: ImageRef,
    pub mode: OcrMode,
    pub language: String,
    pub max_pixels: u64,
    pub confidence_threshold: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OcrMode {
    Text,
    Math,
    Qr,
    Table,
    Handwriting,
}
```

`BodyRegistry` 增加：

```rust
pub fn resolve_ocr(&self, mode: OcrMode) -> Option<&BodyInstance> {
    self.instances.values().find(|b| {
        b.status == BodyStatus::Active
            && b.settings.iter().any(|s| s.key == "ocr.mode" && s.value == mode.as_str())
    })
}
```

快捷键/文件触发仍走 `activations` 匹配；`mode` 是 BodyInstance 的 settings，不是全局开关。

---

## 14. 权限与安全

| 权限 | 用途 | 说明 |
|---|---|---|
| `screen.capture` | 截屏 OCR | 用户主动触发；截图不落盘 |
| `fs.read` | 图片/PDF 文件 OCR | 只读；不自动上传 |
| `clipboard.write` | 复制结果 | 可关闭 autoCopy |
| `network` | 云端 OCR | 默认关闭；需显式同意 |
| `camera` | 摄像头扫码（P2） | 单独权限 |

规则：

- 图片/识别结果默认不离开本机；云端 OCR 必须显式开启并显示 provider。
- 二维码可能包含 URL/凭据；不自动打开，先展示 value，打开 URL 需确认。
- 识别结果可能含 PII；日志脱敏，不写原始图片。
- 表格/公式复制到剪贴板是 L1 操作，可撤销/提示。
- 云端 OCR 的 provider/model 写入 BodyInstance settings，运行历史记录。

---

## 15. 包布局

```text
body.ocr-1.0.0.body
  ├── body.json
  ├── body-instances/
  │     ├── text.json
  │     ├── math.json
  │     ├── qr.json
  │     ├── table.json
  │     └── handwriting.json
  ├── payload/
  │     ├── flows/flow.ocr.recognize.flow.json
  │     ├── surfaces/surface.ocr-result.surface.json
  │     ├── assets/icons/
  │     ├── models/             # 数学/表格模型（可选）
  │     └── tests/
  ├── blockmap.json
  └── signature.p7s
```

安装器校验：

- 每个 BodyInstance 的 `flows` / `surfaces` 存在。
- `permissions` ⊆ manifest.permissions。
- `ocr.mode` 唯一（同一 mode 不重复绑定，除非 priority/用户选择）。
- 快捷键冲突诊断。
- 文件类型规则冲突诊断。
- 模型/资产哈希与 blockmap 一致。

---

## 16. 测试与验收

### 单元

- `resolve_ocr(OcrMode::Text)` → `body.ocr.text`
- `resolve_ocr(OcrMode::Math)` → `body.ocr.math`
- `resolve_ocr(OcrMode::Qr)` → `body.ocr.qr`
- `resolve_ocr(OcrMode::Table)` → `body.ocr.table`
- 输出 union 序列化/反序列化
- 文件类型冲突 priority/specificity
- 权限不足返回 `PermissionDenied`

### 集成

1. 截屏文字 → text 结果面，复制文本。
2. 截屏公式 → LaTeX 预览，复制 LaTeX。
3. 截屏二维码 → 解码值 + format；打开 URL 需确认。
4. 截屏表格 → 表格网格；导出 CSV / 复制 Markdown。
5. 低置信度 → lowConfidence 状态 + 重试。
6. 云端 OCR 未授权 → 本地实例 / 提示开启。
7. 修改 `ocr.language` → 新 BodyInstance revision，旧实例不漂移。
8. 新增 Code128 格式 → 改 qr 实例 settings/revision，不新建 BodyClass。

---

## 17. 优先级

### P0

- `body.ocr` + `body.ocr.text` / `body.ocr.qr` / `body.ocr.table`
- `flow.ocr.recognize` + `surface.ocr-result`
- `ocr.text@r1` / `ocr.qr@r1` / `ocr.table@r1`
- 截屏/文件触发 + 复制结果
- 未知/低置信度 fallback

### P1

- `body.ocr.math` + `ocr.math@r1`
- `body.ocr.handwriting`
- 多页 PDF
- 云端 OCR 实例 + 权限 consent
- 输出格式（CSV/Markdown/JSON）
- 运行历史 + BodyInstance revision

### P2

- 实时摄像头扫码
- 表格单元格编辑/公式可视化编辑
- 批量 OCR / 文件夹监控
- OCR 模型市场
- 自定义识别器 pack
- AI 自动选择 OCR 模式

---

## 18. 一句话总结

**一个 `body.ocr` 类，多个识别类型实例：text / math / qr / table / handwriting。**

每个实例 = 识别器 + 后处理 + 输出 union + 结果面 + settings + permissions + 快捷键。

新增识别类型时先问：

1. 只是换 recognizer/postprocess/settings？→ **新 BodyInstance**。
2. 流程形状变了？→ **新 FlowClass 版本 + BodyClass 版本**。
3. 结果面契约变了？→ **新 SurfaceClass / 新 BodyClass**。

这样“不同文字类型就是不同实例”成立，但不会退化成“每种 OCR 一个体类”。
