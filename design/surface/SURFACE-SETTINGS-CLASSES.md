# 面层设置功能类与实例（v0.1）

> 问题：面层里的“设置”应该怎么拆成功能类与实例？
>
> 结论：**设置不是一个类，而是一组面层组合。** 核心是三层：`surface.settings-page`（页面壳）→ `surface.settings-section`（分组）→ `surface.setting-item`（单项）。外围再加搜索、差异、导入导出、权限矩阵、密钥字段等专用类。
>
> 关联：`SURFACE-LAYER-CLASSES.md`、`ATOM-UNIFIED-MODEL.md`、`LINE-REQ-OPEN-EXTERNAL-WITH-VPN.md`。

---

## 0. 一句话结论

```text
SettingsPageInstance
  └── SettingsSectionInstance[]
        └── SettingItemInstance[]
              ├── SettingSpec（契约）
              └── SettingValue（值 + 来源 + revision）
```

- **类管结构**：页面壳、分组、单项控件、搜索、差异、导入导出。
- **实例管绑定**：具体哪个页面、哪些分组、哪些设置项、值从哪个 SettingsStore 来、保存/重置/测试动作指向哪里。

---

## 1. 为什么设置不是一个类

设置页面看起来相似，但内部至少有三种不同粒度：

| 粒度 | 例子 | 不能混为一类的原因 |
|---|---|---|
| 页面 | 通用设置、VPN 设置、权限设置 | 页面有导航、搜索、保存栏 |
| 分组 | “连接”“行为”“诊断” | 分组有标题、说明、独立重置 |
| 单项 | “自动打开 VPN”开关 | 单项有 schema、默认值、作用域、重启要求 |

如果把“VPN 设置”做成一个类，就会得到：

- `surface.vpn-settings`、`surface.general-settings`、`surface.permission-settings`……类爆炸；
- 每个类都要重复字段、校验、保存、重置逻辑；
- 新增一个设置项就要改类，而不是加实例；
- 无法复用搜索、差异、导入导出。

正确做法：

- `surface.settings.vpn` 是 **`surface.settings-page` 的实例**；
- `section.vpn.connection` 是 **`surface.settings-section` 的实例**；
- `setting.vpn.autoOpenApp` 是 **`surface.setting-item` 的实例**。

---

## 2. 对象模型

### 2.1 SettingsPageClass

```ts
type SettingsPageClass = {
  id: string;
  version: string;
  name: string;
  family: "settings";
  regions: ["header", "search", "nav", "content", "savebar"];
  slots: {
    sections: SettingsSectionSlot[];
    search: SettingsSearchSlot;
    actions: SettingsActionSlot[];
  };
  states: ["loading", "ready", "dirty", "validating", "saving", "error", "saved"];
  actions: ["save", "reset", "resetAll", "test", "import", "export"];
  permissions: PermissionSpec[];
};
```

### 2.2 SettingsPageInstance

```ts
type SettingsPageInstance = {
  id: string;                         // surface.settings.vpn
  surfaceClassId: "surface.settings-page";
  surfaceClassVersion: "1.0.0";

  sections: SurfaceInstanceRef[];     // section.vpn.connection@r2 ...
  data: {
    schema: "SettingsRegistry.vpn";
    values: "SettingsStore.vpn";
  };
  actions: {
    save: "settings.saveVpn";
    reset: "settings.resetVpn";
    test: "runFlow:inst.ensure-vpn-ask@r2";
  };

  placement: "settings";
  theme: ThemeRef;
  revision: number;
  status: "draft" | "active" | "archived";
};
```

### 2.3 SettingsSectionClass / Instance

```ts
type SettingsSectionClass = {
  id: "surface.settings-section";
  version: "1.0.0";
  regions: ["header", "body", "footer"];
  slots: {
    items: SettingItemSlot[];
    actions: ["resetSection"];
  };
  states: ["ready", "dirty", "error", "disabled"];
};

type SettingsSectionInstance = {
  id: string;                         // section.vpn.connection
  surfaceClassId: "surface.settings-section";
  surfaceClassVersion: "1.0.0";
  items: SurfaceInstanceRef[];        // setting.vpn.defaultApp@r1 ...
  data: {
    schema: "SettingsRegistry.vpn.connection";
    values: "SettingsStore.vpn";
  };
  actions: {
    reset: "settings.resetVpnSection";
  };
  revision: number;
};
```

### 2.4 SettingItemClass / Instance

```ts
type SettingItemClass = {
  id: "surface.setting-item";
  version: "1.0.0";
  regions: ["label", "description", "control", "source", "error"];
  slots: {
    control: "toggle" | "select" | "text" | "number" | "path" | "secret" | "radio" | "slider";
  };
  states: ["default", "dirty", "invalid", "disabled", "locked", "requiresRestart"];
};

type SettingItemInstance = {
  id: string;                         // setting.vpn.autoOpenApp
  surfaceClassId: "surface.setting-item";
  surfaceClassVersion: "1.0.0";
  spec: SettingSpec;
  valueBinding: "settings.vpn.autoOpenApp";
  actions: {
    change: "settings.setValue";
    reset: "settings.resetValue";
  };
  revision: number;
};
```

### 2.5 SettingSpec

```ts
type SettingSpec = {
  key: string;
  label: string;
  description?: string;
  type: "bool" | "enum" | "text" | "number" | "path" | "secret" | "json";
  default: Json;
  scope: "user" | "body" | "flow" | "point" | "device" | "system";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  requiresRestart?: boolean;
  permission?: string;
  secret?: boolean;
  deprecated?: boolean;
};
```

### 2.6 SettingValue

```ts
type SettingValue = {
  key: string;
  value: Json;
  source: "default" | "user" | "body" | "flow" | "point" | "system";
  locked: boolean;                    // 被上层策略锁定
  revision: number;
};
```

---

## 3. 层级关系

```text
surface.settings.vpn                       (SettingsPageInstance)
  ├── section.vpn.connection@r2            (SettingsSectionInstance)
  │     ├── setting.vpn.defaultApp@r1      (SettingItemInstance)
  │     ├── setting.vpn.autoOpenApp@r1
  │     ├── setting.vpn.autoConnect@r1
  │     └── setting.vpn.timeoutSec@r1
  ├── section.vpn.behavior@r1
  │     ├── setting.vpn.rememberChoice@r1
  │     └── setting.vpn.askWhenNotRunning@r1
  └── section.vpn.diagnostics@r1
        ├── setting.vpn.pollIntervalMs@r1
        └── setting.vpn.profile@r1
```

**注意**：

- `surface.settings.vpn` 不是 `surface.form` 的实例，而是 `surface.settings-page` 的实例。
- 每个 section 是独立的 `SurfaceInstance`，可以单独复用、单独迁移、单独控制权限。
- 每个 setting item 是独立的 `SurfaceInstance`，可以单独锁定、单独审计、单独 reset。
- 如果 P0 觉得三层实例太重，可以把 item 先作为 section 的内联 `SettingSpec[]`；但**模型上保留三层**，不要一开始就把页面写成一个巨大表单。

---

## 4. 设置类目录

| 类 | 作用 | 关键槽位 / 动作 | 典型实例 |
|---|---|---|---|
| `surface.settings-page` | 设置页面壳：导航、搜索、分组、保存栏 | sections[]、save/reset/test | `surface.settings.vpn`、`surface.settings.general`、`surface.settings.permissions` |
| `surface.settings-section` | 设置分组：标题、说明、字段、分组重置 | items[]、resetSection | `section.vpn.connection`、`section.vpn.behavior`、`section.general.appearance` |
| `surface.setting-item` | 单项设置：label、control、source、error | control、change/reset | `setting.vpn.defaultApp`、`setting.vpn.autoOpenApp`、`setting.general.theme` |
| `surface.settings-search` | 搜索设置项 / 跳转分组 | query、results、navigate | `surface.settings.search` |
| `surface.settings-diff` | 草稿 vs 已保存的差异 | left、right、accept/reject | `surface.settings.diff.vpn` |
| `surface.settings-import-export` | 设置导入/导出/重置 | file、preview、apply | `surface.settings.transfer.vpn` |
| `surface.permission-matrix` | 权限/能力矩阵 | rows、columns、toggle | `section.permissions.capabilities` |
| `surface.secret-field` | 密钥/凭据输入，默认掩码 | maskedValue、reveal、save | `setting.permissions.apiKey` |

> `surface.settings` 不作为类名；**settings 是家族，不是单个类**。页面用 `surface.settings-page`，分组用 `surface.settings-section`，单项用 `surface.setting-item`。

---

## 5. 设置实例目录

### 5.1 页面实例

| 页面实例 | 绑定的分组 | 保存/测试动作 |
|---|---|---|
| `surface.settings.vpn` | connection / behavior / diagnostics | saveVpn / testVpn |
| `surface.settings.general` | appearance / language / startup | saveGeneral |
| `surface.settings.permissions` | capabilities / secrets / audit | savePermissions |
| `surface.settings.advanced` | experimental / diagnostics / reset | saveAdvanced |

### 5.2 分组实例

| 分组实例 | 所属页面 | 设置项 |
|---|---|---|
| `section.vpn.connection` | VPN | defaultApp、autoOpenApp、autoConnect、timeoutSec |
| `section.vpn.behavior` | VPN | rememberChoice、askWhenNotRunning |
| `section.vpn.diagnostics` | VPN | pollIntervalMs、profile |
| `section.general.appearance` | 通用 | theme、density、fontSize |
| `section.general.startup` | 通用 | launchAtStartup、startMinimized |
| `section.permissions.capabilities` | 权限 | allowUiAutomation、allowNetwork、allowFileWrite |
| `section.permissions.secrets` | 权限 | apiKey、proxyPassword |

### 5.3 设置项实例

| 设置项实例 | 类型 | 默认 | 作用域 | 说明 |
|---|---|---|---|---|
| `setting.vpn.defaultApp` | path | 空 | user | 默认 VPN 软件 |
| `setting.vpn.autoOpenApp` | bool | false | user | VPN 未运行时自动打开 |
| `setting.vpn.autoConnect` | bool | false | user | 自动连接（需 UiAutomation） |
| `setting.vpn.timeoutSec` | number | 30 | user | 等待超时，clamp 5–120 |
| `setting.vpn.rememberChoice` | bool | true | user | 记住“以后自动打开” |
| `setting.vpn.pollIntervalMs` | number | 1000 | user | 轮询间隔，clamp 250–5000 |
| `setting.general.theme` | enum | dark | user | dark / light / system |
| `setting.general.launchAtStartup` | bool | false | device | 开机自启，requiresRestart |
| `setting.permissions.allowUiAutomation` | bool | false | system | 需要管理员/策略确认 |
| `setting.permissions.apiKey` | secret | 空 | user | 掩码显示，不写日志 |

---

## 6. VPN 设置页实例 JSON

```json
{
  "id": "surface.settings.vpn",
  "surfaceClassId": "surface.settings-page",
  "surfaceClassVersion": "1.0.0",
  "name": "VPN 设置",
  "sections": [
    "section.vpn.connection@r2",
    "section.vpn.behavior@r1",
    "section.vpn.diagnostics@r1"
  ],
  "data": {
    "schema": "SettingsRegistry.vpn",
    "values": "SettingsStore.vpn"
  },
  "actions": {
    "save": "settings.saveVpn",
    "reset": "settings.resetVpn",
    "test": "runFlow:inst.ensure-vpn-ask@r2"
  },
  "placement": "settings",
  "theme": "theme.system",
  "revision": 3,
  "status": "active"
}
```

分组实例：

```json
{
  "id": "section.vpn.connection",
  "surfaceClassId": "surface.settings-section",
  "surfaceClassVersion": "1.0.0",
  "name": "连接",
  "items": [
    "setting.vpn.defaultApp@r1",
    "setting.vpn.autoOpenApp@r1",
    "setting.vpn.autoConnect@r1",
    "setting.vpn.timeoutSec@r1"
  ],
  "data": {
    "schema": "SettingsRegistry.vpn.connection",
    "values": "SettingsStore.vpn"
  },
  "actions": {
    "reset": "settings.resetVpnSection"
  },
  "revision": 2
}
```

单项实例：

```json
{
  "id": "setting.vpn.autoOpenApp",
  "surfaceClassId": "surface.setting-item",
  "surfaceClassVersion": "1.0.0",
  "spec": {
    "key": "vpn.autoOpenApp",
    "label": "VPN 未运行时自动打开",
    "type": "bool",
    "default": false,
    "scope": "user",
    "requiresRestart": false
  },
  "valueBinding": "settings.vpn.autoOpenApp",
  "actions": {
    "change": "settings.setValue",
    "reset": "settings.resetValue"
  },
  "revision": 1
}
```

---

## 7. 作用域与优先级

设置值不是“一个值”，而是“一个有效值 + 来源”。

```text
default
  < user
  < body
  < flowInstance
  < pointInstance
  < systemPolicy（locked）
```

| 来源 | 例子 | 页面表现 |
|---|---|---|
| default | 代码默认 30s | 显示“默认” |
| user | 用户在设置页改成 45s | 显示“用户” |
| body | 某个 Body 强制 60s | 显示“Body” |
| flowInstance | 某个流程实例固定 10s | 显示“流程实例” |
| pointInstance | 某个点实例参数固定 5s | 显示“点实例” |
| systemPolicy | 企业策略锁定，不可改 | 显示“已锁定” + 锁图标 |

**页面必须显示**：

- 有效值；
- 来源；
- 是否被锁定；
- 是否 requiresRestart；
- 是否有未保存修改（dirty）。

---

## 8. 设置页面的状态与行为

```text
loading
  → ready
  → dirty（用户改了值）
  → validating（校验）
  → saving
  → saved
  → error（校验/保存失败）
```

必备能力：

1. **dirty 检测**：只有修改了才启用保存。
2. **字段校验**：类型、范围、必填、互斥。
3. **值收敛/clamp**：前端传脏值、旧版本值、手改数据库，都要 clamp。
4. **reset**：单项 reset、分组 reset、整页 resetAll。
5. **restart badge**：需要重启的项明确标注“重启后生效”。
6. **search**：搜索设置项并跳转分组。
7. **diff**：保存前展示变更；保存后保留 revision。
8. **import/export**：导出脱敏 JSON；导入前校验 schema。
9. **secret**：默认掩码，显式 reveal，不写日志。
10. **permission**：无权限的项 disabled + 说明原因。
11. **只放会生效的设置**：不展示“改了也没用”的摆设。

---

## 9. 当前项目证据

来自现有设置界面落地经验：

- **只放会真正生效的设置**：摆设比没有更糟；用户改了没反应，会怀疑整个软件坏了。
- **需要重启才生效的项要明确标注**，例如动作目录/场景文件。
- **值要收敛**：保存时 clamp，前端脏值、手改数据库、旧版本遗留值都不能让面板不可用。
- **设置页要做渲染自检**：每页长度阈值，防某页 JS 报错却没人发现。
- **`FieldDef` 不要维护第二套参数 Schema**：面层应消费 `ParamSpec` / `SettingSpec`，否则字段、枚举、默认值会漂移。
- **feature 门控**：同一 crate 双构建时，Tauri command 必须 feature 门控；设置读写要放在共享 `Ctx`，不要跨作用域偷变量。

---

## 10. 规则与反模式

### 规则

1. **设置是家族，不是类**：`settings` 不做类名；用 page / section / item。
2. **页面实例不存值**：值绑定 `SettingsStore`；页面实例只存 sections/actions/revision。
3. **分组实例不写业务逻辑**：只组合 items + reset。
4. **单项实例不硬编码控件行为**：`SettingSpec.type` 决定控件；特殊控件用 `surface.setting-item` 的 `control` 变体。
5. **类管结构，实例管绑定**：新增一个设置项 = 新增 `SettingItemInstance`，不是新增类。
6. **所有设置都要有默认值、作用域、来源、校验规则**。

### 反模式

- ❌ `surface.vpn-settings`、`surface.github-settings` 这种“一个页面一个类”。
- ❌ 把设置值直接写进 `SurfaceInstance`，而不是绑定 `SettingsStore`。
- ❌ 用 `FieldDef` 维护第二套字段/枚举/默认值。
- ❌ 展示“改了不生效”的设置。
- ❌ 不 clamp、不校验，让脏值进入运行时。
- ❌ 密钥明文展示/写日志。
- ❌ 系统策略锁定的项仍然可编辑。
- ❌ 保存后不 bump revision，无法审计/回滚。

---

## 11. 优先级

### P0

- `surface.settings-page`
- `surface.settings-section`
- `surface.setting-item`
- 实例：`surface.settings.vpn` + `section.vpn.connection` + 4 个 setting item
- 保存/重置/测试、dirty、校验、clamp、restart badge

### P1

- `surface.settings-search`
- `surface.settings-diff`
- `surface.settings-import-export`
- `surface.permission-matrix`
- `surface.secret-field`
- 实例：通用设置、权限设置、密钥设置

### P2

- 多作用域继承（body/flow/point）
- 策略锁定与审计
- 设置 profile/批量部署
- 设置模板市场
- AI 生成设置页（AI 提议、schema 校验、用户批准）

---

## 12. 开放问题

1. `setting-item` 是否值得做成独立 `SurfaceInstance`？  
   P0 可以先内联为 section 的 `SettingSpec[]`；P1 再提升为独立实例，以便单项锁定/审计/复用。
2. `surface.settings-page` 是否继承 `surface.form`？  
   建议组合，不继承：page 管导航/搜索/保存栏，section 管字段，item 管单项。
3. 设置值的作用域优先级是否要支持 `body > flow > point`？  
   建议先支持 `default < user < body < systemPolicy`；flow/point 级覆盖放 P1。
4. `surface.settings` 是否作为导航类？  
   导航是 `surface.settings-page` 的区域，不单独做类；如果设置项很多，再加 `surface.tree` 实例。
5. 密钥字段是否单独类？  
   建议 `surface.secret-field` 作为 `surface.setting-item` 的专用变体/子类，不混在普通 text 中。

---

## 13. 一句话总结

**设置页 = SettingsPageInstance（页面壳）→ SettingsSectionInstance（分组）→ SettingItemInstance（单项）。**

类只有 page / section / item 三层；VPN、通用、权限、密钥都是实例。新增一个设置项，应该新增一个 `SettingItemInstance`，而不是新增一个 `surface.xxx-settings` 类。
