# 体层功能类与实例：搜索调研分析（v0.1）

> 问题：体层（Body）的功能类和实例应该怎么拆？它和点/线/面、Pack、安装包、应用市场是什么关系？
>
> 结论：体层不是“又一个流程”，也不是“一个安装包”。建议拆成四个对象：
>
> **BodyClass（产品蓝图） → BodyPackage（不可变分发包） → BodyInstance（已安装/已配置实例） → BodyInstallation（物理安装记录）**
>
> 当前项目的 `Pack` 是 BodyPackage 的雏形，不是完整的 BodyClass / BodyInstance。

---

## 0. 一句话结论

```text
BodyClass
  = 产品蓝图：FlowClassRef[] + SurfaceClassRef[] + SettingSpec[] + PermissionSpec[]
    + AssetRef[] + ModelRef[] + Test[] + Migration[] + Manifest + Version

BodyPackage
  = 不可变分发包：manifest + payload + blockmap + signature + digest

BodyInstance
  = 已安装/已配置产品：BodyClass@version + FlowInstanceRef[] + SurfaceInstanceRef[]
    + SettingValue[] + GrantedPermission[] + ActivationBinding[] + revision

BodyInstallation
  = 物理安装记录：package digest + install path + source/channel + status + rollbackTo
```

- **类是模板，包是产物，实例是配置，安装是物理记录。**
- 同一个 BodyClass 可以有多个 BodyInstance（工作/个人、桌面/笔记本）。
- 同一个 BodyPackage 可以被多个 BodyInstance 共享。
- 新增站点/品牌/配置 → 新 BodyInstance；新增流程/面/权限/资产 → 新 BodyClass 版本。

---

## 1. 体层边界

| 层 | 关注 | 例子 |
|---|---|---|
| 点 | 原子能力 | `vpn.status`、`sys.open`、`ocr.read` |
| 线 | 组合流程 | `flow.ensure-vpn`、`flow.open-external-site` |
| 面 | 交互呈现 | `surface.site-launcher`、`surface.dialog.vpn-approval` |
| **体** | **打包成产品** | “外网访问助手”“截图翻译”“发票归档” |
| 场 | AI 理解/生成/修复 | “帮我做一个打开 GitHub 前检查 VPN 的按钮” |

### 体不是什么

- 不是 FlowClass：体包含多个 FlowClass/FlowInstance，以及面、设置、权限、资产、测试。
- 不是 SurfaceInstance：面只是体的一个入口。
- 不是 Pack 文件：Pack 是分发载体，体是产品实例。
- 不是安装目录：安装目录只是体的物理落点。
- 不是应用市场条目：市场条目是体的发布元数据，不是体本身。

---

## 2. 外部 benchmark

### 2.1 MSIX

Microsoft MSIX 的核心结构：

- `AppxManifest.xml`：包身份、依赖、能力（capabilities）、视觉元素、扩展点。
- `AppxBlockMap.xml`：每个 64KB 块的哈希，用于完整性校验与差分更新。
- `AppxSignature.p7x`：包签名，安装前必须签名。
- 包身份 + payload + manifest + blockmap + signature。

对 Atom 的启示：

- BodyPackage 必须有 **manifest + blockmap + signature + digest**。
- BodyManifest 要显式声明 **capabilities / dependencies / entrypoints / visual assets**。
- 安装/更新必须先验证完整性和签名，再落盘。
- 差分更新、原子切换、回滚是包格式的一部分，不是后期补丁。

来源：MSIX overview / packaging docs（见文末）。

### 2.2 VS Code Extension Manifest

VS Code 的 `package.json` 关键字段：

- `engines.vscode`：最低宿主版本。
- `activationEvents`：什么时候激活。
- `extensionDependencies`：依赖其他扩展。
- `contributes`：命令、配置、视图、语言、主题等贡献点。
- `capabilities.untrustedWorkspaces`：在非信任工作区的能力声明。
- `main` / `browser`：入口。
- `icon` / `galleryBanner` / `categories` / `keywords` / `license` / `repository`：发布元数据。

对 Atom 的启示：

- BodyManifest 要有 `minAppVersion`、`activationEvents`、`dependencies`、`contributes`、`capabilities`。
- `contributes` 应该声明：flows、surfaces、commands、settings、triggers、assets。
- 体不是“黑盒 exe”，它要向宿主声明自己贡献了什么。

### 2.3 ComfyUI / Dify

- ComfyUI：节点包（node pack）+ 工作流模板 + App Mode；节点定义/实例分离；缺失节点提示；子图复用。
- Dify：Workflow/Chatflow + DSL 导出导入 + 版本控制 + 运行历史 + Human Input + 插件/工具市场。

对 Atom 的启示：

- BodyClass 应引用 FlowClass/SurfaceClass，而不是内联复制图。
- BodyPackage 应可导出/导入 DSL（JSON/YAML），带版本、依赖、权限、测试。
- BodyInstance 应有运行历史、版本锁、回滚、发布通道。
- Body 的“App 模式”= 隐藏图，只暴露面层表单/入口。

---

## 3. 对象模型

### 3.1 BodyClass

```ts
type BodyClass = {
  id: string;                    // body.external-access
  version: string;               // semver
  name: string;
  description: string;
  category: "connector" | "workspace" | "pipeline" | "monitor" | "assistant" | "launcher" | "suite";
  manifest: BodyManifest;

  flows: FlowClassRef[];         // 引用的线层类
  surfaces: SurfaceClassRef[];   // 引用的面层类
  settings: SettingSpec[];       // 体的设置 schema
  permissions: PermissionSpec[]; // 体的权限并集
  assets: AssetRef[];            // 图标/图片/模板
  models: ModelRef[];            // 模型引用（可选）
  tests: BodyTest[];             // smoke/contract/upgrade
  migrations: BodyMigration[];   // 版本迁移

  ui: BodyUiMeta;                // 图标/分类/截图/关键词
  signaturePolicy: SignaturePolicy;
};
```

### 3.2 BodyPackage

```ts
type BodyPackage = {
  id: string;                    // body.external-access
  version: string;               // 1.0.0
  manifest: BodyManifest;
  digest: string;                // sha256:...
  blockmap: BlockMap;            // 文件/块哈希
  signature: Signature;          // publisher/keyId/sig
  payload: {
    flows: FlowClassFile[];
    surfaces: SurfaceClassFile[];
    assets: AssetFile[];
    models: ModelFile[];
    migrations: MigrationFile[];
    tests: TestFile[];
  };
};
```

### 3.3 BodyInstance

```ts
type BodyInstance = {
  id: string;                    // body.external-access.work
  bodyClassId: string;
  bodyClassVersion: string;
  packageDigest: string;

  flows: FlowInstanceRef[];      // 具体线实例 + revision
  surfaces: SurfaceInstanceRef[];// 具体面实例 + revision
  settings: SettingValue[];      // 有效值 + 来源
  permissions: GrantedPermission[];
  activations: ActivationBinding[]; // 热键/手势/托盘/URL/定时

  revision: number;
  status: "staged" | "installed" | "active" | "updating" | "degraded" | "archived";
  installedAt: string;
  updatedAt: string;
};
```

### 3.4 BodyInstallation

```ts
type BodyInstallation = {
  id: string;
  packageDigest: string;
  installPath: string;
  source: "market" | "file" | "url" | "dev";
  channel: "stable" | "beta" | "nightly";
  installedAt: string;
  lastVerifiedAt: string;
  status: "ok" | "corrupt" | "missing" | "update-available";
  rollbackTo?: string;           // 上一个 packageDigest
};
```

### 3.5 BodyManifest

```ts
type BodyManifest = {
  schemaVersion: "1.0";
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  categories: string[];
  keywords: string[];
  minAppVersion: string;

  entrypoints: {
    main: SurfaceClassRef;
    settings?: SurfaceClassRef;
    quickLaunch?: SurfaceClassRef;
    onActivate?: FlowClassRef;
  };

  contributes: {
    flows: FlowClassRef[];
    surfaces: SurfaceClassRef[];
    commands: CommandContribution[];
    settings: SettingSpec[];
    triggers: TriggerContribution[];
  };

  permissions: PermissionSpec[];
  dependencies: BodyDependency[];
  optionalDependencies?: BodyDependency[];
  assets: AssetRef[];
  models?: ModelRef[];
  migrations: BodyMigration[];
  tests: BodyTest[];

  update: {
    channel: "stable" | "beta" | "nightly";
    autoUpdate: boolean;
  };
  signature: {
    publisher: string;
    keyId: string;
  };
};
```

---

## 4. 体层功能类目录

| BodyClass | 类别 | 组合的线 | 组合的面 | 权限 | 实例 |
|---|---|---|---|---|---|
| `body.external-access` | connector | `flow.open-external-site`、`flow.ensure-vpn` | `surface.site-launcher`、`surface.settings.vpn`、`surface.dialog.vpn-approval`、`surface.run-history.vpn` | network / process / uia | `.work`、`.personal` |
| `body.screenshot-translate` | assistant | `flow.screenshot-translate` | `surface.hud.translate`、`surface.settings.translate`、`surface.run-history.flow` | screen / clipboard / ai | `.en-zh`、`.ja-zh` |
| `body.invoice-archive` | pipeline | `flow.batch-archive` | `surface.table`、`surface.settings.invoice`、`surface.run-history.flow` | fs / ocr / process | `.company`、`.personal` |
| `body.dev-workspace` | workspace | `flow.open-workspace`、`flow.open-app` | `surface.tray.quick-actions`、`surface.settings.workspace` | process / window | `.desktop`、`.laptop` |
| `body.system-monitor` | monitor | `flow.ensure-service`（可选） | `surface.system-monitor`、`surface.hud.system-status`、`surface.settings.system-monitor` | process / sensor | `.desktop` |
| `body.quick-launch` | launcher | `flow.open-external-site`（目标） | `surface.launch-dock`、`surface.quick-launch`、`surface.settings.launch-dock` | process | `.desktop-dock` |
| `body.suite` | suite | 引用其他 BodyClass | `surface.card-grid`、`surface.settings` | 子体权限并集 | `.office`、`.dev` |

> 类别不是类：`connector` 是分类；`body.external-access` 才是类。

---

## 5. 体层实例目录

| BodyInstance | BodyClass | 关键绑定/设置 | 说明 |
|---|---|---|---|
| `body.external-access.work@r3` | `body.external-access@1.0.0` | VPN=work；sites=GitHub/YouTube/内网；hotkey=Ctrl+Alt+E | 工作外网访问 |
| `body.external-access.personal@r2` | `body.external-access@1.0.0` | VPN=personal；sites=YouTube/Google；gesture=LDR | 个人外网访问 |
| `body.screenshot-translate.en-zh@r4` | `body.screenshot-translate@1.2.0` | ocr=en；translate=en→zh；overlay=true | 英文截图翻译 |
| `body.screenshot-translate.ja-zh@r2` | `body.screenshot-translate@1.2.0` | ocr=ja；translate=ja→zh；overlay=false | 日文截图翻译 |
| `body.invoice-archive.company@r6` | `body.invoice-archive@2.0.0` | OCR=zh；rules=company；archive=company | 公司发票归档 |
| `body.invoice-archive.personal@r2` | `body.invoice-archive@2.0.0` | OCR=en；rules=personal；archive=personal | 个人发票归档 |
| `body.dev-workspace.desktop@r3` | `body.dev-workspace@1.0.0` | VS Code+终端；dual layout；focus=editor | 桌面开发工作区 |
| `body.system-monitor.desktop@r2` | `body.system-monitor@0.9.0` | sample=1s；history=60s；HUD pinned | 系统状态 |
| `body.quick-launch.desktop-dock@r1` | `body.quick-launch@1.0.0` | tabs=常用/开发/系统/工具/外网；30+ tiles | CLaunch 式启动坞 |
| `body.suite.office@r1` | `body.suite@1.0.0` | 包含 external-access + invoice + screenshot | 办公套件 |

---

## 6. BodyInstance 示例

```json
{
  "id": "body.external-access.work",
  "bodyClassId": "body.external-access",
  "bodyClassVersion": "1.0.0",
  "packageDigest": "sha256:9f2c...",
  "flows": [
    "inst.site-github@r1",
    "inst.site-youtube@r3",
    "inst.ensure-vpn-ask@r2"
  ],
  "surfaces": [
    "surface.site-launcher@r3",
    "surface.settings.vpn@r2",
    "surface.dialog.vpn-approval@r2",
    "surface.run-history.vpn@r2"
  ],
  "settings": [
    { "key": "vpn.profile", "value": "work", "source": "user" },
    { "key": "site.policy", "value": "required", "source": "body" }
  ],
  "permissions": ["network", "process", "uia"],
  "activations": [
    { "kind": "hotkey", "spec": "Ctrl+Alt+E" },
    { "kind": "gesture", "spec": "LDR", "button": "right" }
  ],
  "revision": 3,
  "status": "active",
  "installedAt": "2026-11-20T09:00:00Z",
  "updatedAt": "2026-11-22T18:30:00Z"
}
```

**注意**：

- `flows` / `surfaces` 是实例引用，不是类引用，必须带 revision。
- `packageDigest` 锁包；`bodyClassVersion` 锁蓝图。
- `settings` 只存有效值/来源，不存 schema。
- `activations` 是触发绑定；不属于 BodyClass。

---

## 7. 包布局

```text
body.external-access-1.0.0.body
  ├── manifest.json
  ├── payload/
  │     ├── flows/
  │     │     ├── flow.open-external-site.flow.json
  │     │     └── flow.ensure-vpn.flow.json
  │     ├── surfaces/
  │     │     ├── surface.site-launcher.surface.json
  │     │     ├── surface.settings.vpn.surface.json
  │     │     └── surface.dialog.vpn-approval.surface.json
  │     ├── assets/
  │     │     ├── icon.png
  │     │     └── screenshot.png
  │     ├── models/
  │     ├── migrations/
  │     └── tests/
  ├── blockmap.json
  └── signature.p7s
```

**为什么需要 blockmap**：

- 完整性校验（每个文件/块哈希）。
- 差分更新（只下载变化块）。
- 安装前发现损坏，而不是运行到一半才报错。

**为什么需要 signature**：

- 发布者身份 + 包完整性。
- 企业策略可以要求“只装签名体”。
- 卸载/更新时验证同一个 publisher，防止替换攻击。

---

## 8. 生命周期

```text
resolve dependencies
  → verify signature + digest + blockmap
  → validate manifest / permissions / migrations
  → show permission consent
  → stage package
  → run migrations
  → bind FlowInstance / SurfaceInstance / SettingValue
  → activate entrypoint
  → health check
  → record BodyInstance + BodyInstallation
```

更新：

```text
download delta
  → stage new package
  → run migrations
  → atomic switch
  → health check
  → keep previous digest for rollback
```

卸载：

```text
deactivate
  → remove body-owned files (hash match)
  → keep user data / modified files
  → archive BodyInstance
  → keep run history / audit
```

---

## 9. 权限与信任

| 权限 | 例子 | 声明位置 |
|---|---|---|
| `network` | HTTP / WebSocket | BodyManifest.permissions |
| `process` | 启动应用 / 读进程 | BodyManifest.permissions |
| `uia` | UI 自动化 | BodyManifest.permissions |
| `fs` | 读写文件 | BodyManifest.permissions |
| `screen` | 截屏/OCR | BodyManifest.permissions |
| `clipboard` | 读写剪贴板 | BodyManifest.permissions |
| `secrets` | 密钥库 | BodyManifest.permissions |
| `ai` | LLM/模型调用 | BodyManifest.permissions |

规则：

- 权限是 **BodyClass 的并集**，安装前必须展示。
- BodyInstance 只能使用已授予的权限；新增权限 → 重新 consent。
- L2/L3 能力在体内仍需运行时确认，不能因为“体已经授权”就静默执行。
- 签名 publisher 变化 → 阻止更新，除非用户显式信任新 publisher。
- 企业策略可以锁定 publisher/权限/更新通道。

---

## 10. 当前项目发现

### 10.1 `Pack` 是 BodyPackage 的雏形

`crates/core-dsl/src/pack.rs`：

```rust
pub struct Pack {
    pub id, name, version, min_app_version,
    pub permissions: Vec<String>,
    pub dependencies: Vec<Requirement>,
    pub actions: Vec<Action>,
    pub subprograms: Vec<Subprogram>,
    pub scenes: Vec<Scene>,
}
```

已经有：id/version/name、min_app_version、permissions、dependencies、actions、subprograms、scenes。

缺：

- 没有 `BodyManifest`（entrypoints/contributes/assets/models/tests/migrations/signature）。
- 没有 SurfaceClass / UI / 面层资源。
- 没有 install record / BodyInstance / BodyInstallation。
- 没有 package digest / blockmap / signature。
- 没有依赖解析器（`dependencies` 字段未使用）。
- 没有子程序注册（只装 actions）。
- 没有每包独立目录 + 资源文件。

### 10.2 安装器已经有好的安全习惯

`crates/core-store/src/pack.rs`：

- 先 `pack.validate()`，失败一个字节不写。
- 同名动作默认拒绝覆盖，`--force` 才覆盖。
- 卸载只移除“内容与 Pack 一致”的文件；用户改过的保留。
- 安装/卸载走同一份实现（CLI 与壳共用）。

这些习惯应该保留到 BodyPackage 安装器。

### 10.3 `Pack` 更接近 BodyPackage，而不是 BodyClass

- `Pack` 是静态 JSON，包含动作/场景；它更像“分发包 manifest + payload”。
- 没有“BodyClass 版本 → 多个 BodyInstance”的分离。
- `is_installed` 只是检查动作文件是否存在，不是安装记录。
- `update_pack` 用 `force=true` 覆盖同名动作，没有迁移/回滚/健康检查。

### 10.4 `Step.call` 不是完整的体层

`crates/core-dsl/src/action.rs` 注释说 `Step.call` 是“体层落地：让一段线重新变成一个点”。

这只解决了“子程序复用”，不等于 Body：

- 没有面、设置、权限、资产、测试、安装、更新。
- 体是产品，子程序是线层复用。

---

## 11. 从 Pack 迁移到 Body

### P0：兼容迁移

```text
Pack (旧)
  → BodyPackageManifest (新)
      id/version/name/minAppVersion/permissions/dependencies
      payload.actions = Pack.actions
      payload.subprograms = Pack.subprograms
      payload.scenes = Pack.scenes
  → BodyInstance (安装后)
      bodyClassId = pack.id
      bodyClassVersion = pack.version
      flows = installed actions
      surfaces = []（P0 还没有面）
```

- 旧 Pack 继续可装；安装时生成 `BodyInstance` + `BodyInstallation`。
- 旧 `action_id` 保持兼容；新体逐步引入 flows/surfaces 引用。
- 旧 `Pack.actions` 映射为 legacy FlowInstance（revision=0），不参与自动升级。

### P1：BodyManifest + 面 + 设置

- `Pack` 增加 `manifest` 字段（或新格式 `body.json`）。
- 支持 `surfaces`、`settings`、`assets`、`tests`、`migrations`。
- 安装器写 `BodyInstallation` 记录，不再靠文件存在判断。

### P2：签名 + 市场 + 更新

- blockmap + signature + digest。
- 差分更新、原子切换、回滚。
- 市场发布、评分、企业策略。

---

## 12. 规则与反模式

### 规则

1. **类管蓝图，包管分发，实例管配置，安装管物理记录。**
2. **BodyClass 版本 ≠ BodyInstance revision**：蓝图变了升 class version；配置/绑定变了升 instance revision。
3. **BodyPackage 不可变**：同一 digest 的包不能改；更新 = 新包。
4. **BodyInstance 引用实例，不内联定义**：FlowInstanceRef / SurfaceInstanceRef + revision。
5. **权限是类的并集**：安装前展示，运行时仍按能力门禁。
6. **卸载只删体拥有的文件**：用户改过的、用户数据、运行历史保留。
7. **依赖必须解析**：Body 依赖 Body / PointPack / FlowPack / Runtime，不能只存字段。
8. **签名与 digest 是安装门槛**，不是可选项。

### 反模式

- ❌ 把 `body.github`、`body.youtube` 做成体类；它们是 `body.external-access` 的实例/配置。
- ❌ 把 BodyInstance 当成“安装目录”；安装目录只是物理落点。
- ❌ BodyClass 内联复制 FlowClass/SurfaceClass 定义，而不是引用。
- ❌ BodyInstance 不锁 flow/surface revision。
- ❌ 安装只写文件，不写 installation/instance 记录。
- ❌ 更新直接覆盖，不迁移、不健康检查、不回滚。
- ❌ 卸载删除用户改过的文件。
- ❌ 用 `Pack` 直接充当市场条目；市场条目是发布元数据，不是包本身。

---

## 13. 优先级

### P0

- `BodyManifest` schema（id/version/name/minAppVersion/permissions/dependencies/entrypoints/contributes）
- `BodyClass` / `BodyPackage` / `BodyInstance` / `BodyInstallation` 类型
- 旧 Pack → BodyPackage 兼容迁移
- 3 个体：external-access、screenshot-translate、system-monitor
- install / update / uninstall / rollback 最小闭环
- 安装记录 + package digest

### P1

- Signature + blockmap + digest 验证
- 依赖解析（Body / PointPack / FlowPack / Runtime）
- migrations / tests / assets / models
- BodyClass 的 surfaces/settings/activations
- 权限 consent UI
- 每包独立目录
- 安装健康检查

### P2

- 市场发布/评分/审核
- 差分更新 / 自动更新通道
- 企业策略 / 私有市场
- Body suite / 多体组合
- 沙箱执行 / 供应链安全
- AI 生成 BodyClass（AI 提议，schema 校验，用户批准）

---

## 14. 开放问题

1. `BodyClass` 和 `BodyPackage` 是否合并？  
   建议分开：类是可编辑蓝图，包是不可变产物。
2. `BodyInstance` 是否允许多个 per class？  
   建议允许：工作/个人、桌面/笔记本、不同站点策略。
3. Body 是否需要自己的运行历史？  
   建议 P1 加 `BodySession`：记录入口、FlowRun、Surface 交互、错误。
4. Body 的 UI 是 SurfaceClass 还是独立 Body UI DSL？  
   建议复用 SurfaceClass/SurfaceInstance，体只做绑定和入口。
5. Body 能否包含原生 exe/脚本？  
   P0 不；P2 走签名 + 沙箱 + 权限白名单。
6. 依赖是 semver 还是精确 digest？  
   建议 manifest 用 semver range，安装锁 digest。
7. 体是否允许修改 FlowClass？  
   不建议；体引用 FlowClass 版本，用户改图 → 新 FlowClass/新体版本。

---

## 15. 参考

- MSIX overview: https://learn.microsoft.com/en-us/windows/msix/overview
- MSIX packaging: https://learn.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps
- VS Code Extension Manifest: https://code.visualstudio.com/api/references/extension-manifest
- 本仓库：`crates/core-dsl/src/pack.rs`、`crates/core-store/src/pack.rs`、`crates/shell-tauri/src/packs.rs`、`packages/README.md`、`docs/PIPELINE.md`

> 说明：MSIX/VS Code 的具体字段以官方文档当前版本为准；本文只提炼设计模式，不作为 API 契约。

---

## 16. 一句话总结

**体层 = BodyClass（蓝图）+ BodyPackage（签名包）+ BodyInstance（配置实例）+ BodyInstallation（安装记录）。**

当前 `Pack` 只是 BodyPackage 的雏形；下一步不是继续加 `actions`，而是补 **manifest、签名、安装记录、实例绑定、迁移/回滚**。
