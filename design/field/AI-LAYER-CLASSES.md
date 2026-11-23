# AI 层功能类与实例：跨产品调研与参考设计（v0.1）

> 先忽略现有项目，只看“已有 AI 产品/框架的 AI 层到底有哪些功能”，再把它们抽象成可复用的类与实例。
>
> 管理页原型：`field-management.html` 的 AI 视图（AIClass / AIInstance / AI substrate）。
>
> 结论：AI 层不是“一个 Agent”，也不是“一个聊天框”。它至少由 **模型与提示、上下文与知识、推理与行动、输出与信任、运维与学习** 五组能力构成。
>
> 建议对象：
>
> **AIClass（能力契约） → AIInstance（模型+提示+上下文+工具+策略的配置） → AIRun（一次可追踪执行）**
>
> 在此之上，用 **AIAppPattern（应用配方） → AIAppInstance（租户/产品部署）** 组合出 Chat、Copilot、RAG、Agent、Workflow、Batch、Voice。

---

## 0. 一句话结论

```text
AIClass
  = 输入/输出契约 + 状态 + 策略 + 遥测 + 可组合关系

AIInstance
  = AIClass + provider/model + prompt + context + tools + memory
    + guardrails + routing + params + revision

AIRun
  = execute(AIInstance, input)
  = steps[] + output + citations + usage + cost + latency + traceId

AIAppPattern
  = 标准组合配方（chat / copilot / rag / agent / workflow / batch / voice）

AIAppInstance
  = AIAppPattern + tenant + instances[] + policies + deployment
```

- **类**：`ai.agent`、`ai.tool`、`ai.retriever`、`ai.guardrail`、`ai.evaluator`……
- **实例**：`ai.agent.researcher`、`ai.tool.web-search`、`ai.retriever.docs`、`ai.guardrail.pii`……
- **应用**：`ai.app.research-agent`、`ai.app.support-chat`、`ai.app.invoice-workflow`……

---

## 1. 调研范围：已有的 AI 层功能

### 1.1 OpenAI Agents SDK

官方 primitives：

- **Agent**：模型 + instructions + tools + guardrails + handoffs + 内置循环。
- **Handoff**：把任务委派给另一个 agent；对模型表现为 `transfer_to_<agent>` 工具。
- **Guardrail**：输入/输出/工具调用校验；失败可 tripwire。
- **Session**：跨轮次保存对话状态。
- **Tracing**：默认记录模型调用、工具调用、handoff、guardrail、自定义 span。
- **Sandbox Agent**：在隔离工作区里运行 specialist；支持 manifest 文件、sandbox client、可恢复会话。
- **Realtime/Voice Agent**：实时语音、打断检测、上下文管理、guardrails。
- **Evals**：用 grader 对 trace/工作流做评估，反推 prompt/tool/routing。

映射：`ai.agent`、`ai.handoff`、`ai.guardrail`、`ai.memory/session`、`ai.tracer`、`ai.tool`、`ai.sandbox`、`ai.voice`、`ai.evaluator`。

### 1.2 LangGraph

官方定位：低层、有状态、长时运行的 agent orchestration。

能力：

- Graph / State / Node / Edge。
- Persistence / Checkpointer；长时运行可恢复。
- Human-in-the-loop / interrupt；暂停、审批、恢复。
- Memory；短期/长期。
- Subgraph；子图复用。
- Streaming；事件流。
- Time travel；回到某个 checkpoint。
- LangSmith observability / Studio / deployment。

映射：`ai.workflow`、`ai.memory`、`ai.human-approval`、`ai.tracer`、`ai.agent`。

### 1.3 Dify

官方定位：AI agent management platform / LLM app platform。

能力：

- Workflow Studio：可视化 agentic workflow。
- Knowledge Pipeline：extract / clean / chunk / index / test retrieval。
- Model providers：多模型管理，换 provider 不改代码。
- Tools / Plugins / MCP：50+ built-in tools、插件市场、MCP 集成。
- Prompt IDE。
- Observability / logs / monitoring。
- Publish as web app / API / tool。
- Enterprise：SSO/SAML、RBAC、audit logs、私有化部署。

映射：`ai.workflow`、`ai.knowledge-base`、`ai.retriever`、`ai.model`、`ai.tool`、`ai.mcp`、`ai.prompt`、`ai.tracer`、`ai.policy`、`ai.audit`。

### 1.4 MCP（Model Context Protocol）

官方 server features：

- **Resources**：上下文和数据，供用户或模型使用。
- **Prompts**：模板化消息/工作流，供用户使用。
- **Tools**：模型可执行的函数。
- Client features：Roots、Sampling、Elicitation（随版本演进）。

映射：`ai.mcp`、`ai.tool`、`ai.prompt`、`ai.context`、`ai.clarify`。

### 1.5 常见产品功能

从 ChatGPT / Claude / Copilot / Cursor / Notion AI / Microsoft 365 Copilot 等产品可观察到：

- Chat / Copilot / Agent / Workflow / Batch / Voice 等交互形态。
- RAG、引用、知识库、连接器。
- 工具调用、代码解释器、浏览器/电脑操作。
- 记忆、项目、工作区。
- 结构化输出、澄清问题、拒答。
- 安全、权限、审计、数据驻留。
- 评估、反馈、A/B、成本/配额。

---

## 2. 对象模型

### 2.1 AIClass

```ts
type AIClass = {
  id: string;                    // ai.agent
  version: string;               // 1.0.0
  name: string;
  family: "model" | "context" | "reasoning" | "action" | "output" | "trust" | "ops";
  purpose: string;

  inputs: IOSpec[];
  outputs: IOSpec[];
  state: StateSpec[];            // messages / plan / toolCalls / checkpoint
  policy: PolicySpec[];          // maxSteps / toolAllowlist / approval / retention
  telemetry: TelemetrySpec[];    // llmCall / toolCall / handoff / guardrail
  composition: string[];         // 可组合的 AIClass id
};
```

### 2.2 AIInstance

```ts
type AIInstance = {
  id: string;                    // ai.agent.researcher
  aiClassId: string;
  aiClassVersion: string;

  provider?: string;             // openai / anthropic / local
  model?: string;                // ai.model.reasoning@r2
  prompt?: string;               // ai.prompt.researcher@r3
  context?: string;              // ai.context.agent@r1
  retriever?: string;            // ai.retriever.docs@r1
  memory?: string;               // ai.memory.project@r1
  tools?: string[];              // ai.tool.web-search@r1
  mcp?: string[];                // ai.mcp.github@r1
  guards?: string[];             // ai.guardrail.pii@r1
  handoffs?: string[];           // ai.handoff.researcher-to-writer@r1
  tracer?: string;               // ai.tracer.otel@r1

  params: Record<string, unknown>;
  routing?: string;              // ai.router.reasoning@r1
  cache?: string;               // ai.cache.prompt@r1
  quota?: string;               // ai.quota.tenant@r1
  revision: number;
  enabled: boolean;
};
```

### 2.3 AIRun

```ts
type AIRun = {
  id: string;
  appInstanceId?: string;
  aiInstanceId: string;
  aiInstanceRevision: number;

  inputHash: string;
  model: string;
  prompt: string;
  tools: string[];
  handoffs: string[];
  guards: string[];

  steps: AIStep[];               // llm / tool / retrieval / handoff / guardrail / approval
  output: unknown;
  citations?: Citation[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  latencyMs: number;
  status: "ok" | "blocked" | "failed" | "needs_approval";
  traceId: string;
  createdAt: string;
};
```

### 2.4 AISession

```ts
type AISession = {
  id: string;
  appInstanceId: string;
  messages: Message[];
  state: Record<string, unknown>;
  checkpointId?: string;
  approvals: Approval[];
  memoryRefs: string[];
  createdAt: string;
  updatedAt: string;
};
```

### 2.5 AIAppPattern / AIAppInstance

```ts
type AIAppPattern = {
  id: string;                    // ai.app.agent
  name: string;
  composition: string[];         // 必选/可选 AIClass
  defaultInstances: string[];
};

type AIAppInstance = {
  id: string;                    // ai.app.research-agent
  patternId: string;
  tenant: string;
  instances: string[];           // AIInstance refs + revision
  policies: string[];            // ai.policy.tenant@r1
  deployment: "chat" | "api" | "embedded" | "workflow" | "batch" | "voice";
  revision: number;
};
```

---

## 3. AI 层功能类目录（29 个）

### 3.1 模型与提示

| # | AIClass | 职责 | 实例示例 |
|---|---|---|---|
| 1 | `ai.model` | 模型/provider/上下文窗口/价格/能力 | fast / reasoning / vision / embedding / rerank / local |
| 2 | `ai.prompt` | 系统指令、模板、few-shot、输出风格 | system / researcher / coder / support / extractor / critic |
| 3 | `ai.router` | 按任务/成本/延迟/隐私选模型或工具 | fast / reasoning / private / cheap |
| 4 | `ai.fallback` | 模型/工具/检索失败降级 | model / tool / retrieval |
| 5 | `ai.cache` | 提示/检索/工具结果缓存 | prompt / retrieval / tool |
| 6 | `ai.quota` | 用户/租户/模型/工具配额 | user / tenant / model / tool |

### 3.2 上下文与知识

| # | AIClass | 职责 | 实例示例 |
|---|---|---|---|
| 7 | `ai.context` | 组装任务上下文 | chat / copilot / agent / rag |
| 8 | `ai.retriever` | 检索证据 | docs / code / web / database |
| 9 | `ai.knowledge-base` | 知识库/索引/版本 | product / policy / code / support |
| 10 | `ai.memory` | 短期/长期/项目/情景记忆 | session / user / project / episodic / semantic |
| 11 | `ai.multimodal` | 图像/音频/视频/文档输入输出 | image / audio / video / document |

### 3.3 推理与行动

| # | AIClass | 职责 | 实例示例 |
|---|---|---|---|
| 12 | `ai.agent` | 角色 + 指令 + 工具 + 循环 | researcher / coder / reviewer / support / planner / ops |
| 13 | `ai.handoff` | 任务委派/转交 | triage-to-specialist / coder-to-reviewer / support-to-billing |
| 14 | `ai.workflow` | 有状态图/节点/边/检查点 | invoice / support / content / research / etl |
| 15 | `ai.planner` | 任务分解/计划 | task / multi-step / multi-agent |
| 16 | `ai.critic` | 反思/审查/评分 | factuality / code / style / security |
| 17 | `ai.tool` | 函数调用/外部动作 | web-search / http / sql / python / files / calendar / email |
| 18 | `ai.mcp` | MCP server/client 连接 | github / slack / notion / database / filesystem |
| 19 | `ai.sandbox` | 隔离执行环境 | python / shell / browser |

### 3.4 输出与信任

| # | AIClass | 职责 | 实例示例 |
|---|---|---|---|
| 20 | `ai.structured-output` | schema 约束输出 | invoice / ticket / contract / resume / event |
| 21 | `ai.citation` | 引用/归因/来源 | docs / web / database |
| 22 | `ai.clarify` | 澄清/确认/消歧 | missing-slot / ambiguous-intent / risky-action |
| 23 | `ai.guardrail` | 输入/输出/工具护栏 | pii / prompt-injection / toxicity / tool-permission / output-schema |
| 24 | `ai.human-approval` | 人工审批/中断/恢复 | high-risk / tool-call / publish / payment |
| 25 | `ai.policy` | 租户/数据驻留/模型白名单/保留 | tenant / data-residency / model-allowlist / retention |

### 3.5 运维与学习

| # | AIClass | 职责 | 实例示例 |
|---|---|---|---|
| 26 | `ai.tracer` | LLM/工具/agent 调用追踪 | llm / tool / agent / otel |
| 27 | `ai.evaluator` | 数据集/grader/指标 | answer-quality / tool-correctness / safety / cost / latency |
| 28 | `ai.feedback` | 点赞/纠正/排序/标注 | thumbs / correction / ranking / annotation |
| 29 | `ai.experiment` | prompt/model/retriever A/B | prompt-ab / model-ab / retriever-ab |

---

## 4. 实例目录（100+ 候选）

### 4.1 模型与提示

```text
ai.model.fast@r1
ai.model.reasoning@r1
ai.model.vision@r1
ai.model.embedding@r1
ai.model.rerank@r1
ai.model.local@r1

ai.prompt.system@r1
ai.prompt.researcher@r1
ai.prompt.coder@r1
ai.prompt.support@r1
ai.prompt.extractor@r1
ai.prompt.critic@r1

ai.router.fast@r1
ai.router.reasoning@r1
ai.router.private@r1
ai.router.cheap@r1

ai.fallback.model@r1
ai.fallback.tool@r1
ai.fallback.retrieval@r1

ai.cache.prompt@r1
ai.cache.retrieval@r1
ai.cache.tool@r1

ai.quota.user@r1
ai.quota.tenant@r1
ai.quota.model@r1
ai.quota.tool@r1
```

### 4.2 上下文与知识

```text
ai.context.chat@r1
ai.context.copilot@r1
ai.context.agent@r1
ai.context.rag@r1

ai.retriever.docs@r1
ai.retriever.code@r1
ai.retriever.web@r1
ai.retriever.database@r1

ai.knowledge-base.product@r1
ai.knowledge-base.policy@r1
ai.knowledge-base.code@r1
ai.knowledge-base.support@r1

ai.memory.session@r1
ai.memory.user@r1
ai.memory.project@r1
ai.memory.episodic@r1
ai.memory.semantic@r1

ai.multimodal.image@r1
ai.multimodal.audio@r1
ai.multimodal.video@r1
ai.multimodal.document@r1
```

### 4.3 推理与行动

```text
ai.agent.researcher@r1
ai.agent.coder@r1
ai.agent.reviewer@r1
ai.agent.support@r1
ai.agent.planner@r1
ai.agent.ops@r1

ai.handoff.triage-to-specialist@r1
ai.handoff.coder-to-reviewer@r1
ai.handoff.support-to-billing@r1
ai.handoff.researcher-to-writer@r1

ai.workflow.invoice@r1
ai.workflow.support@r1
ai.workflow.content@r1
ai.workflow.research@r1
ai.workflow.etl@r1

ai.planner.task@r1
ai.planner.multi-step@r1
ai.planner.multi-agent@r1

ai.critic.factuality@r1
ai.critic.code@r1
ai.critic.style@r1
ai.critic.security@r1

ai.tool.web-search@r1
ai.tool.http@r1
ai.tool.sql@r1
ai.tool.python@r1
ai.tool.files@r1
ai.tool.calendar@r1
ai.tool.email@r1

ai.mcp.github@r1
ai.mcp.slack@r1
ai.mcp.notion@r1
ai.mcp.database@r1
ai.mcp.filesystem@r1

ai.sandbox.python@r1
ai.sandbox.shell@r1
ai.sandbox.browser@r1
```

### 4.4 输出与信任

```text
ai.structured-output.invoice@r1
ai.structured-output.ticket@r1
ai.structured-output.contract@r1
ai.structured-output.resume@r1
ai.structured-output.event@r1

ai.citation.docs@r1
ai.citation.web@r1
ai.citation.database@r1

ai.clarify.missing-slot@r1
ai.clarify.ambiguous-intent@r1
ai.clarify.risky-action@r1

ai.guardrail.pii@r1
ai.guardrail.prompt-injection@r1
ai.guardrail.toxicity@r1
ai.guardrail.tool-permission@r1
ai.guardrail.output-schema@r1

ai.human-approval.high-risk@r1
ai.human-approval.tool-call@r1
ai.human-approval.publish@r1
ai.human-approval.payment@r1

ai.policy.tenant@r1
ai.policy.data-residency@r1
ai.policy.model-allowlist@r1
ai.policy.retention@r1
```

### 4.5 运维与学习

```text
ai.tracer.llm@r1
ai.tracer.tool@r1
ai.tracer.agent@r1
ai.tracer.otel@r1

ai.evaluator.answer-quality@r1
ai.evaluator.tool-correctness@r1
ai.evaluator.safety@r1
ai.evaluator.cost@r1
ai.evaluator.latency@r1

ai.feedback.thumbs@r1
ai.feedback.correction@r1
ai.feedback.ranking@r1
ai.feedback.annotation@r1

ai.experiment.prompt-ab@r1
ai.experiment.model-ab@r1
ai.experiment.retriever-ab@r1
```

---

## 5. AI 应用配方（7 个）

应用不是新的底层类，而是标准组合。

| 应用配方 | 组合 | 实例 |
|---|---|---|
| `ai.app.chat` | prompt + model + context + memory + guardrail + tracer | `ai.app.support-chat`、`ai.app.tutor-chat` |
| `ai.app.copilot` | context + retriever + model + tool + guardrail + tracer | `ai.app.ide-copilot`、`ai.app.docs-copilot` |
| `ai.app.rag` | retriever + knowledge-base + citation + model + guardrail | `ai.app.docs-rag`、`ai.app.policy-rag` |
| `ai.app.agent` | agent + tool + memory + planner + handoff + approval + tracer | `ai.app.research-agent`、`ai.app.ops-agent` |
| `ai.app.workflow` | workflow + model + tool + structured-output + approval + tracer | `ai.app.invoice-workflow`、`ai.app.support-workflow` |
| `ai.app.batch` | workflow + structured-output + evaluator + quota | `ai.app.batch-classify`、`ai.app.batch-extract` |
| `ai.app.voice` | multimodal + agent + tracer | `ai.app.voice-support`、`ai.app.voice-notes` |

---

## 6. 具体实例：`ai.agent.researcher`

```json
{
  "id": "ai.agent.researcher",
  "aiClassId": "ai.agent",
  "aiClassVersion": "1.0.0",
  "provider": "openai",
  "model": "ai.model.reasoning@r2",
  "prompt": "ai.prompt.researcher@r3",
  "context": "ai.context.agent@r1",
  "retriever": "ai.retriever.web@r1",
  "memory": "ai.memory.project@r1",
  "tools": [
    "ai.tool.web-search@r1",
    "ai.tool.http@r1"
  ],
  "mcp": ["ai.mcp.github@r1"],
  "guards": [
    "ai.guardrail.pii@r1",
    "ai.guardrail.prompt-injection@r1",
    "ai.guardrail.tool-permission@r1"
  ],
  "handoffs": ["ai.handoff.researcher-to-writer@r1"],
  "tracer": "ai.tracer.otel@r1",
  "params": {
    "maxSteps": 12,
    "maxCostUsd": 0.5,
    "requireCitations": true
  },
  "routing": "ai.router.reasoning@r1",
  "revision": 1,
  "enabled": true
}
```

行为：

```text
任务
  → context 组装（任务 + 项目记忆 + 检索证据 + 工具描述）
  → model 推理
  → tool 调用（web-search / http / github）
  → guardrail 检查（PII / prompt injection / tool permission）
  → citation 归因
  → 输出报告 + trace
  → 需要发布/高风险动作 → human-approval
```

---

## 7. 具体应用：`ai.app.research-agent`

```json
{
  "id": "ai.app.research-agent",
  "patternId": "ai.app.agent",
  "tenant": "acme",
  "instances": [
    "ai.agent.researcher@r1",
    "ai.tool.web-search@r1",
    "ai.tool.http@r1",
    "ai.mcp.github@r1",
    "ai.guardrail.pii@r1",
    "ai.human-approval.publish@r1",
    "ai.tracer.otel@r1",
    "ai.evaluator.answer-quality@r1"
  ],
  "policies": [
    "ai.policy.tenant@r1",
    "ai.policy.data-residency@r1"
  ],
  "deployment": "api",
  "revision": 1
}
```

---

## 8. 类与实例的判定规则

| 变化 | 应该改什么 | 例子 |
|---|---|---|
| 换模型/provider/上下文窗口 | 新增或修改 `ai.model` 实例 | GPT → Claude / 本地模型 |
| 换人设/指令/输出风格 | 新增 `ai.prompt` 实例 | researcher / coder / support |
| 换知识库/语料 | 新增 `ai.knowledge-base` 实例 | product / policy / code |
| 换检索方式 | 新增 `ai.retriever` 实例 | docs / code / web / database |
| 换工具端点 | 新增 `ai.tool` 或 `ai.mcp` 实例 | GitHub / Slack / SQL |
| 换角色/职责 | 新增 `ai.agent` 实例 | researcher / reviewer / support |
| 换流程图形状 | 新 `ai.workflow` 类版本 | 发票流 → 多级审批流 |
| 换安全策略 | 新增 `ai.guardrail` / `ai.policy` 实例 | PII / prompt injection / 租户策略 |
| 换应用/租户 | 新增 `ai.app` 实例 | 客服 chat / 研究 agent |
| 换评估标准 | 新增 `ai.evaluator` 实例 | 答案质量 / 工具正确性 |

**不要**：

- 每个 prompt 建一个 AIClass。
- 每个 agent 角色建一个 AIClass。
- 每个应用建一套底层类。
- 把模型名写死在业务代码里。
- 把 guardrail 当可选装饰。
- 没有 trace 就上线 agent。

---

## 9. 安全与治理

### 9.1 三层护栏

```text
输入护栏：PII / prompt injection / 恶意内容 / 越权请求
输出护栏：毒性 / 泄漏 / schema / 引用缺失 / 事实性
工具护栏：allowlist / 参数校验 / 权限 / 审批 / 沙箱
```

### 9.2 人类审批

- 高风险动作：支付、发布、删除、发送邮件、执行命令。
- 工具调用：外部副作用工具。
- 内容发布：面向客户/公众的内容。
- 审批必须可中断、可恢复、可审计。

### 9.3 权限与数据

- 租户隔离 / RBAC / SSO。
- 数据驻留 / 保留期 / 删除权。
- 模型白名单 / provider 白名单。
- 密钥不进入 prompt / trace。
- 工具权限最小化。
- 审计日志独立于 agent 自身。

### 9.4 沙箱

- Python / Shell / Browser 在隔离环境执行。
- 文件系统、网络、进程权限显式声明。
- 输出 artifacts 可追溯。
- 沙箱不是权限边界，仍需外层 policy。

---

## 10. 评估与可观测性

### 10.1 一次 AIRun 应该记录

```text
输入 hash
模型 / prompt / 工具 / handoff / guardrail
每一步的耗时与 token
工具参数 hash / 结果 hash
引用来源
成本
最终状态
traceId
```

不记录：

- 密码 / token / 密钥。
- 未脱敏的 PII。
- 完整系统提示（按策略）。
- 用户未授权的原始文件。

### 10.2 评估闭环

```text
生产 trace
  → 采样
  → 数据集
  → grader（规则/模型/人工）
  → 指标（质量/安全/成本/延迟）
  → prompt/model/retriever/tool 调整
  → A/B
  → 上线
```

核心指标：

- 任务成功率。
- 答案正确率/引用覆盖率。
- 工具调用正确率。
- 安全拦截率/误杀率。
- P95 延迟。
- 每次成功任务成本。
- 人工接管率。
- 用户采纳/纠正率。

---

## 11. 优先级

### P0（最小可用 AI 层）

- `ai.model`
- `ai.prompt`
- `ai.context`
- `ai.retriever`
- `ai.memory`
- `ai.tool`
- `ai.agent`
- `ai.workflow`
- `ai.guardrail`
- `ai.tracer`
- `ai.structured-output`
- `ai.human-approval`

### P1（生产化）

- `ai.router`
- `ai.fallback`
- `ai.cache`
- `ai.mcp`
- `ai.sandbox`
- `ai.handoff`
- `ai.planner`
- `ai.critic`
- `ai.citation`
- `ai.clarify`
- `ai.evaluator`
- `ai.quota`

### P2（平台化）

- `ai.knowledge-base`
- `ai.multimodal`
- `ai.policy`
- `ai.feedback`
- `ai.experiment`
- 应用配方：chat / copilot / rag / agent / workflow / batch / voice
- 多租户、市场、连接器生态

---

## 12. 反模式

- ❌ 把 AI 层做成一个全局聊天框。
- ❌ 把 prompt 当 AIClass。
- ❌ 一个 agent 包打天下。
- ❌ 没有工具 schema / 权限 / 审批。
- ❌ 没有 trace / eval 就上线。
- ❌ RAG 没有引用/归因。
- ❌ 记忆没有 TTL / 同意 / 删除。
- ❌ 模型路由散落在业务代码。
- ❌ Agent 循环没有 maxSteps / maxCost。
- ❌ Guardrail 只在输入做，输出/工具不做。
- ❌ 人类审批放在不可逆动作之后。
- ❌ 把“Agent”当营销词，实际只是单次 prompt。

---

## 13. 参考

- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
- OpenAI Agents SDK tracing/observability: https://developers.openai.com/api/docs/guides/agents/integrations-observability
- OpenAI agent evals: https://developers.openai.com/api/docs/guides/agent-evals
- LangGraph: https://www.langchain.com/langgraph
- LangGraph docs（persistence / memory / interrupt / subgraph / streaming / time travel）: https://langchain-doc.cn/v1/python/langgraph/
- Dify: https://dify.ai/
- Dify observability integration: https://langfuse.com/integrations/no-code/dify
- MCP specification: https://modelcontextprotocol.io/specification/2025-11-25
- MCP tools/resources/prompts: https://restfulapi.net/mcp-tools-resources-prompts
- Context engineering lecture: http://scalable-ai.eecs.berkeley.edu/S2026/assets/lecture_slides/lecture_21.pdf

> 说明：以上为跨产品/框架的功能抽象，不是任何一家 API 的等价映射。外部资料证据强度有限，落地时以目标框架的官方文档和实际版本为准。

---

## 14. 一句话总结

**AI 层 = 模型与提示 + 上下文与知识 + 推理与行动 + 输出与信任 + 运维与学习。**

类要稳定（model/prompt/context/retriever/memory/tool/agent/workflow/guardrail/tracer/evaluator），实例要具体（researcher/coder/support、web-search/sql/github、pii/prompt-injection、answer-quality……）。

应用（Chat/Copilot/RAG/Agent/Workflow/Batch/Voice）不是新底层类，而是这些类的标准组合。
