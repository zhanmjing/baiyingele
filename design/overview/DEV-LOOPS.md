# 开发循环

> 状态：**已落地**（`npm run try` 2026-11）
> 依据：实测耗时，不是估算

四条循环，各自有各自的快路径。**用错循环是最大的时间浪费。**

| 你在改 | 用哪条 | 命令 | 实测 |
|---|---|---|---|
| 能力逻辑（`.ts`） | **能力循环** | `npm run try -- <id>` | **86 ms** |
| UI（`.tsx`） | UI 循环 | `npm run dev` → HMR | 即时 |
| 数据（catalog JSON） | 数据循环 | `npm run data:gen && npm run validate` | ~5 s |
| 单元测试 | **测试循环** | `npm run test` / `test:only -- <片段>` | **~0.3 s** |
| 提交前 | 门禁 | `npm run check:full` | ~30 s |

## 能力循环：`npm run try`

**不进 Electron 就能跑一个能力。** 编译结果缓存在 `.tmp/try/`，源码没变就跳过编译。

```bash
npm run try -- --list                                   # 列出 28 个能力
npm run try -- field.rank --from classes                # 从当前层目录取条目排序
npm run try -- field.detect --mode anomaly              # 找异常信号
npm run try -- point.clipboard_get                      # 会真的读剪贴板
npm run try -- field.rank --items @.tmp/items.json      # JSON 从文件读
npm run try -- field.rank --items @.tmp/items.json --json   # 只出 JSON
```

### 为什么用 `@文件` 传 JSON

Windows 命令行会把含空格的 JSON 切碎：

```bash
# ❌ 在 Windows 上会变成 'C:\Program' is not recognized
npm run try -- field.rank --items '[{"id":"a","priority":"P0"}]'

# ✅ 写进文件再引用
echo '[{"id":"a"}]' > .tmp/items.json
npm run try -- field.rank --items @.tmp/items.json
```

### 退出码

| 码 | 含义 |
|---|---|
| `0` | `status: 'ok'` |
| `2` | `status: 'warn'` —— **不是失败，是能力如实报缺口** |
| `1` | 抛异常 / 找不到能力 |

## 速度对比（实测）

```
npm run try -- field.rank      86 ms     ← 只做一件事
npm run smoke                3,183 ms    ← 编译 20 个文件 + 466 个断言
npm run typecheck              467 ms
npm run build                  647 ms
```

能力循环比冒烟快 **35 倍**。写能力时用它，提交前再用 `check:full`。

## 什么不该用这条循环

- **需要真实运行历史的能力**（`field.detect` / `field.observe`）——
  CLI 里没有注入 `setRunHistorySource`，它们会如实报「取不到运行历史」。
  这是**正确行为**，不是 bug。要验证这类能力得走冒烟测试（那里有注入）。
- **需要窗口 / COM / 全局钩子的点层能力**——CLI 能跑，但会真的操作你的电脑。

## 测试循环：`npm run test`（node:test，零依赖）

Node 24 自带测试运行器，不需要 vitest。

```bash
npm run test                        # 全部，独立进程，~0.3s
npm run test:only -- critique       # 只跑名字含 critique 的
npm run test:watch                  # 监听模式
```

### 为什么不用 vitest

`node:test` 已经给了需要的三件事：**独立进程隔离**、`--test-name-pattern` 选择性运行、
断言失败定位到用例。装 vitest 要多一个依赖、一套配置、一个转换层，而这个项目
的测试对象是**已经编译好的 JS**，不需要转换。

### 为什么要从 smoke 搬出来

`scripts/smoke-flow.cjs` 是 1692 行单文件，所有用例共享一个闭包作用域。
后果是变量名会撞车 —— 一天内撞了 4 次（`warnOut` / `realDeps` / `mockCtx` / `noImpl`），
批量改名还误伤过字符串常量（`'dangling-edge'` 被改成 `'critDangling-edge'`）。

`tests/` 下每个文件是独立进程，作用域天然隔离。

### 迁移是增量的，不是一次全搬

已搬（`tests/runtime.test.mjs`）：bodyRuntime / surfaceRuntime / field.rank /
field.detect / field.critique / field.route —— 12 个用例。

**还在 `scripts/smoke-flow.cjs` 里的 23 节**：线层执行器、真实能力（file / clipboard /
win.*）、存储增量补齐等。它们共享 electron 假桩 + 临时工作目录 + fixtures，
一次性搬风险高，按主题分批搬。

`npm run smoke` 继续作为端到端门禁，两条并存。

### 一个 Node 的坑

`node --test --test-name-pattern X tests/`（传目录）会失败并报 `test at tests:1:1`。
必须传**显式文件路径**，而 Windows 的 shell 又不展开 glob。
所以有了 `scripts/test-only.mjs` 自己展开 `tests/*.test.mjs`。
