# 开发循环

> 状态：**已落地**（`npm run try` 2026-11）
> 依据：实测耗时，不是估算

四条循环，各自有各自的快路径。**用错循环是最大的时间浪费。**

| 你在改 | 用哪条 | 命令 | 实测 |
|---|---|---|---|
| 能力逻辑（`.ts`） | **能力循环** | `npm run try -- <id>` | **86 ms** |
| UI（`.tsx`） | UI 循环 | `npm run dev` → HMR | 即时 |
| 数据（catalog JSON） | 数据循环 | `npm run data:gen && npm run validate` | ~5 s |
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
