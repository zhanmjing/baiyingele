# 线层功能类与实例调研备忘录（v0.1）

> 范围：Atom 模型中的线层，不绑定当前项目实现；用当前项目作为“线层使用证据”的参照。
>
> 关联文档：`ATOM-LINE-LAYER.md`（线层设计）、`ATOM-UNIFIED-MODEL.md`（点/线统一模型）、`LINE-LAYER-CLASSES.md`（当前项目线层调研与分组讨论）。
>
> 研究问题：线层的“功能类”和“实例”到底是什么？它们如何由点层实例组合出来？哪些变化应归为类，哪些应归为实例？

---

## 0. 五条结论

1. **线层功能类不是“业务动作”，而是“点实例槽位的组合模式”。**
2. **线层实例不是“另一份代码”，而是“槽位绑定到具体点实例的组合结果”。**
3. **线层的真正变化轴有五个**：flow args、slot binding、gate/graph、point instance params、subflow binding；必须分别归属，不能都塞进“实例参数”。
4. **当前项目（以及多数工作流系统）容易把“动作类型”误当线层类**；`CommandKind` 是模板/预设，不是类。
5. **P0 应先把线性管道 + if + foreach + slot binding 做扎实**；parallel/join、市场、AI 生成后置。

---

## 1. 概念边界

### 1.1 线层类

```text
FlowClass = 点实例槽位 + 默认点实例 + 门 + 类型化边 + 版本
```

- 每个节点是 `PointInstanceSlot`，不是 `PointClass`。
- 槽位声明 `accepts: PointClass`（类型约束）和 `default?: PointInstance`（默认实现）。
- 门是组合子，不是点实例。
- 子流程也是槽位（`SubflowSlot`），绑定 `FlowInstanceRef`。
- FlowClass 发布后不可变；改图/槽位/门/参数 → 新版本。

### 1.2 线层实例

```text
FlowInstance = FlowClass.bind(slotId -> PointInstanceRef, args)
```

- `args` 填 FlowClass 的线层参数。
- `bindings` 把每个槽位绑定到具体 PointInstance revision。
- 不允许在 FlowInstance 内联改点参数；要不同参数 → 新建 PointInstance。
- 不允许在 FlowInstance 改图；要改图 → 派生草稿 → 新 FlowClass。

### 1.3 运行实例

```text
FlowRun = execute(FlowInstance)
  └── slotRuns: slotId -> PointRun
```

- FlowRun 记录 FlowClass 版本、FlowInstance revision、每个 slot 的 PointInstanceRef。
- PointRun 记录点实例参数、输入哈希、输出、耗时、错误。
- 回放必须锁所有版本。

---

## 2. 线层功能类的分类

### 2.1 按组合形状分

| 类型 | 图形状 | 典型场景 | 研究判断 |
|---|---|---|---|
| **线性管道** | `p1 → p2 → p3` | 截图翻译、剪贴板存文件 | P0 主战场，覆盖大多数需求 |
| **条件分支** | `if/switch` | 发票命中/未命中、语言选择 | P0 只做 if；switch P1 |
| **遍历** | `foreach` | 批量文件、批量订单 | P0 做 foreach + append |
| **循环** | `while` | 轮询、重试直到成功 | P0 可保留但示例少；P1 加 break/continue |
| **子流程** | `subflow` | 复用“订单渲染”“通知发送” | P1 做，必须锁 revision |
| **并行/汇合** | `parallel/join` | 多 HTTP、多窗口 | P2，调度器成本高 |
| **人工审批** | `approval` | 高危操作、发布确认 | P1，门不是点 |
| **监控/反应** | trigger → condition → action | 文件监听、服务告警 | 触发层 + 线层组合，不混 |
| **AI 辅助** | context → LLM → validate → apply | 改写、摘要、邮件草稿 | P2，先做文本点 |

### 2.2 按业务家族分

| 家族 | 典型槽位 | 典型实例 |
|---|---|---|
| 采集 → 转换 → 输出 | capture, ocr, translate, render | 截图翻译；录音转纪要 |
| 输入 → 处理 → 保存 | clipboard, template, file.write | 剪贴板存文件；选中文字归档 |
| 窗口/工作区编排 | open, layout, focus, notify | 写代码工作区；会议工作区 |
| 批量/文件处理 | watch, foreach, ocr, validate, move | 发票归档；日志清理 |
| 网络/API | request, parse, validate, write | 拉取订单；Webhook |
| 人机协同 | form/approval, apply, notify | 发布确认；高危审批 |
| 定时/维护 | schedule, check, cleanup, report | 每日清理；磁盘巡检 |
| 监控/告警 | watch, condition, notify, action | 文件变更告警；服务重启 |
| AI 辅助 | context, llm, validate, apply | 选中文字改写；邮件草稿 |
| 系统设置 | get, set, readback, notify | 音量/亮度/主题批量设置 |

**研究判断**：业务家族是“实例目录”的组织方式，不是“类”的划分依据。同一个 FlowClass 可以服务多个业务实例；不同业务家族也可能复用同一个组合模式。

---

## 3. 线层实例的分类

### 3.1 五种实例

| 实例类型 | 变化是什么 | 例子 | 是否允许 |
|---|---|---|---|
| **参数实例** | 只改 flow args，槽位绑定不变 | 截图翻译改 targetLang | ✅ 最常见 |
| **绑定实例** | 改某些槽位的 PointInstance | en→zh 用 ocr.en，ja→zh 用 ocr.ja | ✅ 统一模型的核心 |
| **子流程实例** | 某个槽位绑定不同 FlowInstance | 通知槽位换“邮件通知”子流程 | ✅ P1 |
| **派生实例** | 改了图结构，但还没发布 | 用户在实例里加了一个节点 | ⚠️ 只能作为 DerivedFlowDraft |
| **独立实例** | 没有 FlowClass，直接写 Action | 旧系统迁移 | ✅ 兼容，不推荐新写 |

### 3.2 实例的“变化轴”矩阵

| 变化 | 应归到 | 产生什么新版本 |
|---|---|---|
| 改 flow args | FlowInstance | FlowInstance revision |
| 换槽位绑定的点实例 | FlowInstance | FlowInstance revision |
| 改点实例参数 | PointInstance | PointInstance revision |
| 加点/删点/改边/改门 | FlowClass | FlowClass version |
| 换子流程 | FlowInstance（绑定） | FlowInstance revision |
| 升级子流程版本 | FlowInstance（绑定） | FlowInstance revision |
| 改点类契约 | PointClass | PointClass version |

**关键判断**：如果变化只影响“这次用哪个叶子/参数”，归实例；如果影响“组合形状”，归类版本。

### 3.3 实例的生命周期

```text
draft → active → archived
   │        │
   │        └── 可复制为新实例
   └── 从 FlowClass + bindings 创建
```

- `draft`：可以改 bindings/args；不可被 Trigger 绑定。
- `active`：绑定 Trigger/Body；编辑产生新 revision。
- `archived`：不再运行；保留引用与运行历史。
- 删除前查 Trigger/Body/Subflow 引用。

---

## 4. 当前项目证据（参照）

> 仅作为“线层使用形态”的证据，不代表 Atom 目标模型。

| 指标 | 数值 | 研究含义 |
|---|---|---|
| Action 数 | 33 | 线层实例数量 |
| Step 节点 | 79 | 其中 76 个模块步骤、1 call、1 if、1 while |
| for_each | 2 | 遍历使用很少 |
| on_error 示例 | 0 | 错误策略未被真实使用 |
| 声明 params 的 Action | 3 | 参数契约极弱（Vec<String>） |
| CommandKind | 11 | 用户动作类型，最接近线层模板，但硬编码 |
| Subprogram | 1 个示例 | 最接近线层类，但 inputs/outputs 只是字符串 |
| Scene | 3 | 面层绑定，不属于线层 |

**发现**：

1. 当前线层几乎是线性管道；控制流覆盖率低。
2. `Action` 被当成“类”在用，但它是实例。
3. `Subprogram` 是最接近线层类的东西，但契约不完整。
4. `CommandKind` 是模板/预设，不是点层类，也不应维护第二套参数 schema。
5. 没有统一的“槽位绑定”概念；相同结构在不同 Action 里重复。

---

## 5. 关键争议

### 5.1 槽位默认值：一个还是多个？

- **一个默认**：简单，类=一种推荐组合；实例可覆盖。
- **多个默认（变体）**：一个类可以带 `variants`，但容易变成“实例目录”。
- **研究建议**：P0 一个默认；P1 允许 `variants`，但 variants 仍是实例，不是类。

### 5.2 FlowInstance 能不能覆盖点参数？

- 允许：灵活，但点实例边界消失，无法复用/审计。
- 不允许：不同参数 → 新建 PointInstance；边界清晰。
- **研究建议**：不允许内联覆盖。UI 可以提供“基于当前点实例新建一个”的快捷操作。

### 5.3 可选槽位 vs 门

- 可选槽位：图会变，实例形状不稳定。
- 门：图不变，运行时选择分支。
- **研究建议**：可选行为用门；不要用“可选节点”改变图。

### 5.4 一个槽位能不能接受多个 PointClass？

- 可以，用接口/能力标签（如 `TextExtractor` 接受 `ocr.read` / `pdf.text`）。
- 但 P0 先用单一 `accepts: PointClass`；P1 引入 `acceptsAny: PointClass[]` 或 capability trait。
- **研究建议**：P0 单类型，避免组合校验复杂化。

### 5.5 子流程是槽位还是节点？

- 子流程本质是“组合的叶子”，应作为 `SubflowSlot`，绑定 `FlowInstanceRef`。
- 不建议把子流程内联进父图；否则父图会膨胀，版本/权限/复用都变差。
- **研究建议**：P1 做 SubflowSlot；P0 先不支持子流程。

### 5.6 触发器放哪？

- 触发器不是线层类/实例的一部分；它是绑定。
- 同一个 FlowInstance 可以被热键、定时、面板、Body 复用。
- **研究建议**：Trigger 属于触发层；FlowInstance 只存 `triggers` 引用。

---

## 6. 组合正确性研究

### 6.1 静态校验

保存 FlowClass/FlowInstance 时必须检查：

1. 每个 `required` 槽位都有绑定或默认值。
2. 绑定的 PointInstance 的 PointClass 满足 `accepts`。
3. 边两端端口类型兼容。
4. 普通图无环；循环必须经过 loop 门。
5. 子流程版本存在且不形成环。
6. 权限/effect 聚合正确。
7. FlowInstance 的 `flowClassVersion` 存在。
8. 所有 bindings 带 revision。

### 6.2 运行时校验

1. 解析 FlowInstance → FlowClass → bindings。
2. 加载点实例所需 pack。
3. 运行前 dry-run/审批。
4. 每个 slot 产生 PointRun，记录版本。
5. 失败时定位到 slot + point instance + revision。

### 6.3 测试策略

- **类测试**：mock point instances，验证组合逻辑/分支/循环。
- **实例测试**：固定 bindings/args，验证端到端输出。
- **契约测试**：槽位 accepts 与绑定点类兼容。
- **升级测试**：旧 FlowInstance + 新 PointInstance/FlowClass 的兼容性。
- **回放测试**：FlowRun 锁版本后重放结果一致。

---

## 7. 研究建议（优先级）

### P0

- FlowClass：slots + defaults + edges + if + foreach。
- FlowInstance：bindings + args + revision。
- 槽位单类型 `accepts: PointClass`。
- 不允许内联点参数覆盖；不同参数 → 新 PointInstance。
- FlowRun + PointRun 双层记录。
- 3 个组合：截图翻译、剪贴板存文件、窗口工作区。

### P1

- SubflowSlot + revision 锁 + 环检测。
- `switch/timeout/fallback/approval`。
- 槽位兼容性校验（capability/interface）。
- 版本 diff / 影响分析 / 批量升级。
- 资源画像聚合。

### P2

- `parallel/join`。
- `cache/rate_limit`。
- 组合市场（FlowClass + 默认点实例包）。
- AI 生成组合（AI 提议槽位绑定，运行时校验，用户批准）。

---

## 8. 下一步研究任务

1. **形式化 Schema**：把 `FlowClass` / `FlowInstance` / `AtomRef` 写成 JSON Schema，做兼容性测试。
2. **做 3 个可运行组合原型**：截图翻译、剪贴板存文件、发票归档；每个至少 2 个实例。
3. **做槽位绑定 UI 原型**：拖点实例到槽位、类/实例视图切换、diff。
4. **定义升级规则**：点实例 revision、FlowClass version、FlowInstance revision 的迁移矩阵。
5. **补控制流**：先 `switch/timeout/fallback/approval`，再评估 `parallel/join`。
6. **验证“组合是否正确”**：静态校验 + mock 测试 + 运行回放。

---

## 9. 一句话总结

线层功能类研究的关键，不是“怎么把动作分类”，而是回答：

> **一个 FlowClass 由哪些点实例槽位组成、每个槽位默认用哪个点实例；一个 FlowInstance 又把每个槽位绑定到哪个具体点实例 revision。**

把“槽位、默认、绑定、版本”四件事说清，线层类/实例就不会退化成动作库或脚本集合。
