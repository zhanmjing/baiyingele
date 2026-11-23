# 场层管理页设计（Field Management v0.1）

> 参考：
> - `AI-LAYER-CLASSES.md`：AIClass / AIInstance / AI substrate（模型、prompt、context、tools、guardrails）。
> - `FIELD-LAYER-CLASSES.md`：FieldClass / FieldInstance / FieldRun / 自主度 / 落点 / 护栏。
>
> 目标：场层管理页不是聊天框，而是 **FieldClass / FieldInstance / FieldRun / Policy** 的管理工作台，并把 AI 基座、落点、自主度、证据/撤销/解释放在同一页。

---

## 0. 一句话结论

```text
field-management.html
  = FieldClass / FieldInstance
  + AIClass / AIInstance（AI substrate）
  + Field landing 可视化
  + FieldRun / AIRun
  + Policy（A0–A2）
```

场层是穿透点/线/面/体的智能介质：  
**FieldClass = 智能契约 + 输出类型 + 落点 + 自主度上限**。  
**FieldInstance = FieldClass + 作用域 + 模型配置 + 上下文策略 + 参数 + 输出绑定 + revision**。

---

## 1. 数据

### Field

```text
FieldClass       23
FieldInstance    78
families:
  perceive       5
  understand     1
  generate       5
  evolve         6
  govern         6
autonomy:
  A0             7
  A1            10
  A2             6
```

### AI substrate

```text
AIClass          29
AIInstance      124
```

AI 视图负责：

```text
provider / model
prompt
context
tools
guardrails
output
```

Field 视图负责：

```text
input/output contract
landing（点/线/面/体）
autonomy ceiling
evidence / undo / explain
```

---

## 2. 页面结构

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Field Management  23 FieldClass 78 FieldInstance 29 AIClass 124 AIInstance  │
│                   7/10/6 A0/A1/A2                                    [设置]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Field 23/78] [AI 29/124] [Runs 4] [Policy A2]                              │
├──────────────────┬────────────────────────────────────────────┬──────────────┤
│ FieldClass       │ observe                                    │ Inspector    │
│ 搜索 / family    │ [编辑] [＋实例] [运行] [删除]               │ 契约          │
│ ▸ observe        │ Field visual: class → landing → output      │ 实例          │
│ ▸ classify       │ instances                                  │ 操作          │
│ ...              │                                            │              │
│ FieldInstance    │                                            │              │
└──────────────────┴────────────────────────────────────────────┴──────────────┘
```

---

## 3. View tabs

```text
[Field 23/78] [AI 29/124] [Runs N] [Policy A2]
```

- Field：FieldClass / FieldInstance / landing 可视化。
- AI：AIClass / AIInstance / AI substrate。
- Runs：FieldRun / AIRun 运行记录。
- Policy：自主度、阈值、隐私、回退、证据/撤销/解释。

---

## 4. Field 视图

### 4.1 左栏

FieldClass：

```text
icon / name
id
family
autonomy badge
priority
instance count
```

family chips：

```text
全部 / perceive / understand / generate / evolve / govern
```

FieldInstance：

```text
name / rev
detail
status
```

操作：

```text
＋ 新建 FieldClass
＋ 新建 FieldInstance
↺ 重置示例数据
```

### 4.2 中栏

Hero：

```text
FieldClass · family
name
summary
[✎编辑] [＋实例] [▶运行] [⌫删除]
```

Stats：

```text
autonomy / family / output / landing / instances / version
```

Field visual：

```text
┌──────────────────────┐
│ FieldClass core      │
│ observe · A0         │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ landing              │
│ [Point ↗] [Line ↗]   │
│ [Surface ↗] [Body ↗] │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ output               │
│ context snapshot     │
└──────────────────────┘
```

Landing chip：

- 绿色 `↗`：已接入对应管理页。
- 琥珀 `·ph`：占位。

深链：

```text
point    → atom-catalog-management.html
line     → line-management.html
surface  → surface-management.html
body     → body-management.html
```

### 4.3 实例

FieldInstance 卡片：

```text
name / rev
detail
status
family / autonomy
```

操作：

```text
点击 → 选中
▶ 运行
✎ 编辑
⧉ 复制
⌫ 删除
```

---

## 5. AI 视图

### 5.1 左栏

AIClass：

```text
icon / name
id
group
effect
priority
instance count
```

group chips：

```text
全部 / 模型与提示 / 上下文与知识 / 推理与行动 / 输出与信任 / 运维与学习
```

AIInstance：

```text
name / rev
detail
status
```

### 5.2 中栏

Hero：

```text
AIClass · group
name
summary
[✎编辑] [＋实例] [▶运行] [⌫删除]
```

AI substrate：

```text
┌────────────────────────────────────┐
│ Provider   local / fast             │
│ Prompt     ...                      │
│ Tools      web_search, file_read... │
│ Guardrails pii, permission, conf... │
│ Output     ...                      │
└────────────────────────────────────┘
```

AI 实例卡片：

```text
name / rev
detail
status
group / effect
```

---

## 6. Runs 视图

FieldRun / AIRun：

```text
Run ID
Mode: field / ai
Class / Instance
Decision: A0 ask / A1 draft / A2 apply + undo
Confidence
Latency
Status: ok / warn / error
Evidence[]
Model / provider
```

运行详情：

```text
output
confidence bar
decision
evidence chips
model
latency
```

操作：

```text
＋ 模拟运行
```

规则：

```text
confidence < threshold → A0 ask
A1 → draft + approve
A2 → apply + undoToken
A3 → forbidden
```

---

## 7. Policy 视图

可编辑：

```text
autonomy ceiling    A0 / A1 / A2
confidence threshold 0–1
privacy             redact / block / allow
fallback            rules / ask / off
require evidence    true / false
require undo        true / false
explain every suggestion true / false
```

Autonomy matrix：

```text
A0  suggest only
A1  draft + approve
A2  apply + undo
A3  forbidden
```

保存：

```text
Field Policy → localStorage
```

---

## 8. CRUD

### FieldClass / AIClass

| 操作 | 行为 |
|---|---|
| 新建 | modal：id/name/version/priority/summary + Field family/output/landing/autonomy 或 AI group/effect/provider/model/prompt/tools/guardrails |
| 编辑 | 同一 modal；保存更新 |
| 删除 | confirm；级联删除实例 |
| 查询 | 搜索 + family/group chips |
| 重置 | 恢复 23/78 + 29/124 |

### FieldInstance / AIInstance

| 操作 | 行为 |
|---|---|
| 新建 | modal：name/rev/status/detail + Field scope/output 或 AI provider/model |
| 编辑 | 保存后 rev +1 |
| 复制 | 深拷贝，新 id，rev=1，draft |
| 删除 | confirm |
| 运行 | 生成 FieldRun / AIRun |

### Runs

| 操作 | 行为 |
|---|---|
| 模拟运行 | 从当前 class/instance 生成 run |
| 选择 | 右侧 Run Inspector |
| 证据 | evidence chips |
| 置信度 | confidence bar |

### Policy

| 操作 | 行为 |
|---|---|
| 保存策略 | autonomy/threshold/privacy/fallback/evidence/undo/explain |

---

## 9. 持久化

```text
localStorage: baiying.fieldManager.v1
```

保存：

```json
{
  "fieldClasses": [...],
  "aiClasses": [...],
  "runs": [...],
  "policy": {...},
  "savedAt": "..."
}
```

正式版接：

```text
field registry
AI registry / router
run store / audit
policy store
```

---

## 10. 与设置页的关系

设置页 Field 的管理页路由：

```text
Field → field-management.html
```

设置页仍只保留“设置”；场层管理页独立。

---

## 11. 文件

| 文件 | 作用 |
|---|---|
| `field-management.html` | 场层管理页（本设计） |
| `field-management-v2.html` | 稳定快照 |
| `FIELD-MANAGEMENT.md` | 本文档 |
| `AI-LAYER-CLASSES.md` | AIClass / AIInstance 参考 |
| `FIELD-LAYER-CLASSES.md` | FieldClass / FieldInstance / FieldRun 参考 |
| `atom-catalog-management.html` | Point landing 深链 |
| `line-management.html` | Line landing 深链 |
| `surface-management.html` | Surface landing 深链 |
| `body-management.html` | Body landing 深链 |

---

## 12. 已做校验

- FieldClass 23 / FieldInstance 78
- AIClass 29 / AIInstance 124
- families：perceive 5 / understand 1 / generate 5 / evolve 6 / govern 6
- autonomy：A0 7 / A1 10 / A2 6
- 初始：`field.prefill / field.prefill.ocr-language@r1 / Field`
- 4 views runtime 渲染通过：
  - Field / AI / Runs / Policy
- Field visual + instance cards 渲染
- AI substrate 渲染
- Run simulation 4 → 5
- FieldClass modal 渲染与编辑保存通过
- `node --check` 通过
- HTMLParser 标签平衡通过
- mock DOM 运行时冒烟通过

---

## 13. 优先级

### P0

- FieldClass / FieldInstance 列表
- Field visual + landing 深链
- AIClass / AIInstance + AI substrate
- FieldRun / AIRun
- Policy 视图
- 新建 / 编辑 / 删除类与实例

### P1

- Run 模拟
- confidence / decision
- evidence
- localStorage 持久化
- family/group 过滤

### P2

- 真实模型路由
- FieldRun 审计/回放
- 采纳/拒绝/撤销反馈
- policy 版本 diff
- A2 auto-apply + undoToken
- multi-model fallback

---

## 14. 一句话总结

**场层管理页 = FieldClass / FieldInstance + AIClass / AIInstance + Field landing + FieldRun + Policy。**

```text
Field  → 智能契约、落点、自主度
AI     → model / prompt / tools / guardrails
Runs   → output / confidence / decision / evidence
Policy → A0–A2 / threshold / privacy / undo / explain
```

场不是聊天框；场是有落点、有自主度、有证据、有撤销的智能层。
