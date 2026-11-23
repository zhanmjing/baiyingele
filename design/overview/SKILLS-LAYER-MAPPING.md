# Skills 与点 / 线 / 面 / 体 / 场：类与实例映射（v0.1）

> 问题：Skills 实例到底属于点、线、面、体，还是第六层？
>
> 结论：**Skills 不是第六层，而是“可复用能力包/投影”。**
>
> 一个 `SkillClass` 可以声明它提供哪些运行时投影：
>
> ```text
> SkillClass
>   ├── provides.point   → PointClass / PointInstance
>   ├── provides.flow    → FlowClass / FlowInstance
>   ├── provides.surface → SurfaceClass / SurfaceInstance
>   ├── provides.body    → BodyClass / BodyInstance
>   └── provides.field   → FieldClass / FieldInstance
> ```
>
> `SkillInstance` = 技能包 + 参数 + 作用域 + 绑定到的点/线/面/体/场实例 + revision。  
> 它本身不是点实例，也不是线实例；它**投影**成哪一个，由 `provides` 和绑定决定。

---

## 0. 一句话结论

```text
SkillClass
  = instructions + resources + scripts + metadata
    + provides(point/flow/surface/body/field)
    + permissions + tests + version

SkillInstance
  = SkillClass@version
    + params
    + scope(workspace/agent/session/body)
    + bindings(point/flow/surface/body/field refs)
    + activation(mode/triggers/priority)
    + revision

SkillRun
  = execute(SkillInstance, input)
  = used resources + steps + output + trace
```

- **Skill 是“能力包”，不是“层”。**
- 它可以只投影成点，也可以投影成线/面/体/场。
- 一个 Skill 可以同时提供多个投影，但每个投影仍是独立的运行时实例。
- 纯 `SKILL.md` 指令型 Skill，默认投影为 **场实例**（指导模型如何做事），不是点/线/面/体。
- 带脚本/流程/面/权限/资产的 Skill，才投影为点/线/面/体。

---

## 1. 为什么不是第六层

点/线/面/体/场回答的是“运行时形态”：

| 层 | 回答的问题 |
|---|---|
| 点 | 一个原子能力是什么？ |
| 线 | 多个能力如何组合？ |
| 面 | 用户如何交互？ |
| 体 | 如何打包成产品？ |
| 场 | AI 如何理解/建议/生成/修复？ |

Skill 回答的是另一个问题：

> **“一段可复用的知识/过程/脚本，应该如何被加载、组合、授权、版本化？”**

所以 Skill 是**打包与投影机制**，不是运行时层。

---

## 2. 已有 Agent Skills 的形态

以 Anthropic Agent Skills / Claude Code Skills 为代表：

```text
skill-name/
  ├── SKILL.md          # YAML frontmatter + 指令正文
  ├── scripts/          # 可执行代码
  ├── references/       # 参考资料
  └── assets/           # 模板/素材
```

关键机制：**progressive disclosure（渐进披露）**

1. **L0 元数据**：启动时只加载 name/description（约几十 token）。
2. **L1 指令**：命中触发时才加载 `SKILL.md` 正文（通常 <5k token）。
3. **L2 资源/脚本**：真正需要时才读取 references 或执行 scripts。

这正好对应：

| Skill 部分 | 运行时投影 |
|---|---|
| frontmatter name/description | `field.route.skill` / `field.rank.skill` 的索引 |
| SKILL.md 正文 | `field.context` / `ai.prompt` 的指令 |
| scripts/ | `point.tool` / `point.script` |
| references/ | `ai.knowledge-base` / `ai.context` 资源 |
| assets/ | `body.asset` |
| manifest/permissions/tests | `body.manifest` |

---

## 3. SkillClass

```ts
type SkillClass = {
  schemaVersion: "1.0";
  id: string;                    // skill.pr-review
  version: string;               // 1.0.0
  name: string;
  description: string;

  instructions: string;          // SKILL.md 正文
  resources: ResourceRef[];      // references / templates
  scripts: ScriptRef[];          // 可执行脚本
  metadata: {
    tags: string[];
    triggers: string[];          // 何时加载
    priority: number;
  };

  provides: {
    point?: PointClassRef;
    flow?: FlowClassRef;
    surface?: SurfaceClassRef;
    body?: BodyClassRef;
    field?: FieldClassRef;
  };

  permissions: PermissionSpec[];
  dependencies: SkillDependency[];
  tests: SkillTest[];
  signature?: SignatureRef;
};
```

**关键**：`provides` 是投影声明，不是实现。  
`SkillClass` 可以只声明 `provides.field`，也可以同时声明 `provides.flow + provides.surface + provides.body`。

---

## 4. SkillInstance

```ts
type SkillInstance = {
  id: string;                    // skill.pr-review.default
  skillId: string;
  skillVersion: string;

  scope: {
    workspace?: string;
    agentInstanceId?: string;
    sessionId?: string;
    bodyInstanceId?: string;
  };

  params: Record<string, unknown>;

  bindings: {
    point?: PointInstanceRef;
    flow?: FlowInstanceRef;
    surface?: SurfaceInstanceRef;
    body?: BodyInstanceRef;
    field?: FieldInstanceRef;
  };

  activation: {
    mode: "always" | "auto" | "manual" | "pinned";
    triggers?: string[];
    priority?: number;
  };

  permissions: GrantedPermission[];
  revision: number;
  enabled: boolean;
};
```

**注意**：

- `bindings` 是实例引用，必须带 revision。
- `activation` 是加载/触发策略，不是业务逻辑。
- 同一个 SkillClass 可以有多个 SkillInstance：工作区/个人、严格/宽松、不同模型/参数。

---

## 5. 五层投影表

| 层 | Skill 投影 | 使用 Skill 的哪部分 | 运行时对象 | 例子 |
|---|---|---|---|---|
| 点 | `PointInstance` | 一个原子脚本/工具调用 + 类型化输入输出 | `point.*@rN` | `skill.color-convert` → `point.color.convert@r1` |
| 线 | `FlowInstance` | 多步骤过程/分支/循环/错误策略 | `flow.*@rN` | `skill.pr-review` → `flow.pr-review@r1` |
| 面 | `SurfaceInstance` | 交互面/向导/面板/命令入口 | `surface.*@rN` | `skill.vpn-setup` → `surface.wizard.vpn@r1` |
| 体 | `BodyInstance` | 安装/更新/权限/资产/模型/测试 | `body.*@rN` | `skill.invoice` → `body.invoice-archive@r2` |
| 场 | `FieldInstance` | 路由/选择/指令注入/建议/诊断 | `field.*@rN` | `skill.ocr-mode-select` → `field.classify.ocr-mode@r1` |

---

## 6. 判定树

```text
这个 Skill 主要是什么？

1. 只有一个确定性操作 + 类型化 I/O
   → 投影为 PointClass / PointInstance

2. 多个步骤/分支/循环/重试
   → 投影为 FlowClass / FlowInstance

3. 拥有用户交互/布局/向导/面板
   → 投影为 SurfaceClass / SurfaceInstance

4. 需要安装/更新/权限/资产/模型/测试/签名
   → 投影为 BodyClass / BodyInstance

5. 主要指导模型如何理解/选择/生成/修复
   → 投影为 FieldClass / FieldInstance

6. 同时具备多种形态
   → SkillClass.provides 声明多个投影
   → SkillInstance.bindings 分别绑定多个运行时实例
```

**不要**：

- 把纯指令 Skill 硬塞成点实例。
- 把多步 Skill 塞进一个点，假装它是原子的。
- 把 Skill 当第六层。
- 让 Skill 直接执行脚本，绕过点/线运行时。
- 让 Skill 绕过场/体权限。

---

## 7. 例子：纯指令 Skill → 场实例

```text
skill.code-review/
  SKILL.md
```

SKILL.md：

```markdown
---
name: code-review
description: Review a pull request for correctness, security, and test coverage.
---

1. Read the diff.
2. Check correctness and edge cases.
3. Check security and permissions.
4. Check tests.
5. Produce findings with file/line references.
```

投影：

```json
{
  "id": "skill.code-review.default",
  "skillId": "skill.code-review",
  "skillVersion": "1.0.0",
  "scope": { "workspace": "repo-x" },
  "bindings": {
    "field": "field.explain.suggestion@r1"
  },
  "activation": {
    "mode": "auto",
    "triggers": ["review-pr", "diff"],
    "priority": 50
  },
  "revision": 1,
  "enabled": true
}
```

它不是点/线/面/体；它是**场实例**：告诉模型如何审查，并绑定到场的解释/建议能力。

---

## 8. 例子：脚本 Skill → 点实例

```text
skill.color-convert/
  SKILL.md
  scripts/hex_to_rgb.py
```

```json
{
  "id": "skill.color-convert.default",
  "skillId": "skill.color-convert",
  "skillVersion": "1.0.0",
  "bindings": {
    "point": "point.color.convert@r1"
  },
  "params": {
    "inputFormat": "hex",
    "outputFormat": "rgb"
  },
  "activation": { "mode": "manual" },
  "revision": 1,
  "enabled": true
}
```

点实例：

```json
{
  "id": "point.color.convert",
  "pointClassId": "point.color.convert",
  "pointClassVersion": "1.0.0",
  "params": {
    "script": "scripts/hex_to_rgb.py",
    "runtime": "python",
    "timeoutMs": 2000
  },
  "revision": 1
}
```

---

## 9. 例子：多步 Skill → 线实例

```text
skill.pr-review/
  SKILL.md
  scripts/get_diff.py
  references/checklist.md
```

```json
{
  "id": "skill.pr-review.default",
  "skillId": "skill.pr-review",
  "skillVersion": "1.0.0",
  "bindings": {
    "flow": "flow.pr-review@r1",
    "surface": "surface.run-history.review@r1"
  },
  "params": {
    "maxFiles": 50,
    "requireTests": true
  },
  "activation": { "mode": "auto", "triggers": ["pull_request"] },
  "revision": 1,
  "enabled": true
}
```

线实例：

```json
{
  "id": "flow.pr-review",
  "flowClassId": "flow.pr-review",
  "flowClassVersion": "1.0.0",
  "bindings": {
    "diff": "point.github.diff@r1",
    "review": "point.code.review@r1",
    "comment": "point.github.comment@r1"
  },
  "revision": 1
}
```

---

## 10. 例子：产品 Skill → 体实例

```text
skill.invoice/
  SKILL.md
  body.json
  flows/
  surfaces/
  scripts/
  assets/
  tests/
```

```json
{
  "id": "skill.invoice.company",
  "skillId": "skill.invoice",
  "skillVersion": "2.0.0",
  "bindings": {
    "body": "body.invoice-archive.company@r6",
    "field": "field.classify.document-type@r1",
    "flow": "flow.invoice.archive@r2",
    "surface": "surface.table.invoice@r2"
  },
  "params": {
    "ocrLanguage": "zh",
    "archiveRoot": "D:\\Archive\\Invoices"
  },
  "activation": { "mode": "manual", "priority": 100 },
  "revision": 1,
  "enabled": true
}
```

体实例：

```json
{
  "id": "body.invoice-archive.company",
  "bodyClassId": "body.invoice-archive",
  "bodyClassVersion": "2.0.0",
  "flows": ["flow.invoice.archive@r2"],
  "surfaces": ["surface.table.invoice@r2"],
  "settings": [
    { "key": "ocr.language", "value": "zh", "source": "user" }
  ],
  "permissions": ["fs.read", "fs.write", "ocr"],
  "revision": 6,
  "status": "active"
}
```

---

## 11. 一个 Skill 多个投影

```text
skill.invoice
  provides:
    field:   field.classify.document-type
    point:   point.ocr.extract
    flow:    flow.invoice.archive
    surface: surface.table.invoice
    body:    body.invoice-archive
```

```text
SkillInstance skill.invoice.company@r2
  binds:
    field:   field.classify.document-type@r1
    point:   point.ocr.extract@r3
    flow:    flow.invoice.archive@r2
    surface: surface.table.invoice@r2
    body:    body.invoice-archive.company@r6
```

这不是“一个 Skill 同时是五层”，而是：

> **一个 SkillClass 提供五个可独立实例化的投影；SkillInstance 把它们绑成一个使用配置。**

---

## 12. Skills 与 Agent Skills 的渐进披露

| 层级 | 加载内容 | 运行时用途 | 映射 |
|---|---|---|---|
| L0 | name + description | 判断是否相关；路由/排序 | `field.route.skill` / `field.rank.skill` |
| L1 | SKILL.md 正文 | 注入指令/步骤 | `field.context` / `ai.prompt` |
| L2 | references / scripts | 读取资料/执行脚本 | `ai.knowledge-base` / `point.tool` |
| L3 | assets / tests | 打包/验证 | `body.asset` / `body.test` |

**渐进披露不是优化，是契约**：

- L0 必须便宜：几十 token/skill。
- L1 必须有触发条件：不能全部常驻。
- L2 必须按需加载：不能把整个知识库塞进 prompt。
- L3 必须有版本/权限/签名：不能随便执行。

---

## 13. SkillInstance 的激活模式

| 模式 | 含义 | 适用 |
|---|---|---|
| `always` | 常驻上下文 | 极少数核心规范 |
| `auto` | 由 router/trigger 自动加载 | 大多数技能 |
| `manual` | 用户显式调用 | 高风险/低频技能 |
| `pinned` | 本会话强制加载 | 调试/教学/临时任务 |

规则：

- 同一触发器命中多个 Skill → 按 priority + specificity 选择；仍冲突 → 询问。
- `always` 必须有 token 预算上限。
- `pinned` 只影响当前会话，不写全局。
- `auto` 必须记录为什么加载（reason + evidence）。

---

## 14. SkillRun

```ts
type SkillRun = {
  id: string;
  skillInstanceId: string;
  skillInstanceRevision: number;
  inputHash: string;
  loadedLevel: "L0" | "L1" | "L2" | "L3";
  resourcesUsed: string[];
  scriptsUsed: string[];
  bindingsUsed: string[];
  steps: SkillStep[];
  output: unknown;
  status: "ok" | "failed" | "blocked" | "needs_approval";
  traceId: string;
  createdAt: string;
};
```

`SkillRun` 让技能可审计：

- 加载了哪一层？
- 用了哪些资源/脚本？
- 绑定了哪个点/线/面/体/场实例？
- 是否触发权限/审批？
- 输出是什么？

---

## 15. 反模式

- ❌ Skill 当第六层。
- ❌ 纯指令 Skill 硬塞成点实例。
- ❌ 多步 Skill 塞进一个点，假装原子。
- ❌ Skill 直接执行脚本，绕过点/线运行时。
- ❌ Skill 绕过场/体权限。
- ❌ 所有 SKILL.md 常驻上下文。
- ❌ 一个 Skill 一个 BodyClass，导致包爆炸。
- ❌ SkillInstance 不锁点/线/面/体/场 revision。
- ❌ 触发器重叠但无 priority/歧义处理。
- ❌ 没有 SkillRun，无法审计加载与执行。
- ❌ 把 Skill 市场当代码市场，不做签名/权限/测试。

---

## 16. 优先级

### P0

- `SkillClass` / `SkillInstance` / `SkillRun` 类型
- `provides.field` + `provides.point`
- 渐进披露 L0/L1
- 触发器 + priority + 歧义处理
- 纯指令 Skill → 场实例
- 脚本 Skill → 点实例

### P1

- `provides.flow` + `provides.surface`
- `provides.body`
- 多投影绑定
- 权限/测试/签名
- SkillRun 运行历史
- 技能市场/安装/更新

### P2

- 技能组合（Skill 引用 Skill）
- 自动生成 Skill（从重复操作/流程中提取）
- 技能评估/评分
- 跨工作区/多租户
- 技能版本迁移

---

## 17. 放到 DSH / Agent Skills 里

DSH 的技能目录（`SKILL.md` + 可选脚本/资源）可以这样映射：

| DSH 技能部分 | 映射 |
|---|---|
| `SKILL.md` frontmatter（name/description） | L0 元数据；`field.route.skill` / `field.rank.skill` 的索引 |
| `SKILL.md` 正文 | L1 指令；纯指令技能 → `FieldInstance` |
| `scripts/` | 脚本/工具 → `PointInstance` |
| `references/` | 资料 → `ai.knowledge-base` / `ai.context` |
| `assets/` | 素材 → `BodyAsset` |
| `skill_panel` 的 on/user-only/model-only/off | `SkillInstance.activation` / visibility |
| `skill_autoload` 的 strict/standard/loose/pin | `field.route.skill` 的相关度阈值/强制加载策略 |

**判断**：

- 只有 `SKILL.md`，没有脚本/流程/面/资产 → **场实例**。
- 有可执行脚本，且只有一个原子操作 → **点实例**。
- 有多个步骤/分支/循环 → **线实例**。
- 有自己的交互面/向导/面板 → **面实例**。
- 有安装/权限/资产/测试/升级 → **体实例**。
- 同时有多种 → `SkillClass.provides` 多投影，`SkillInstance` 分别绑定。

> 注意：DSH 的 `on/user-only/model-only/off` 是“激活/可见性”，不是层归属；`pin` 是当前会话的强制加载策略，不是新的技能类型。

---

## 18. 一句话总结

**Skill 不是第六层，而是可复用能力包；SkillClass 声明 provides，SkillInstance 把 provides 绑定到点/线/面/体/场的具体实例。**

- 纯指令 → 场实例
- 单脚本/单工具 → 点实例
- 多步骤 → 线实例
- 有交互 → 面实例
- 可安装/授权/升级 → 体实例

一个 Skill 可以同时提供多个投影，但每个投影都是独立的运行时实例。
