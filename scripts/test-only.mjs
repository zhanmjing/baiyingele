#!/usr/bin/env node
/**
 * 选择性跑测试：npm run test:only -- critique
 *
 * Node 的 --test-name-pattern 有个坑：它只认**显式文件路径**，
 * 传目录会报 "test at tests:1:1" 失败。Windows 的 shell 又不会展开 glob。
 * 所以这里自己展开。
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const pattern = process.argv[2]
// 不传 pattern 就跑全部（Node 的 --test-name-pattern 不认目录，所以统一走这里）
const files = readdirSync(join(ROOT, 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => join('tests', name))

if (!files.length) {
  console.error('tests/ 下没有 *.test.mjs')
  process.exit(1)
}
try {
  /**
   * --test-force-exit：测试全绿但进程不退。
   *
   * 原因是有未释放的句柄（koffi / uiohook 这类 native 模块会留线程）。
   * 测试本身跑完了、结论也是对的，卡在退出阶段没意义。
   * 注意这**不会**掩盖失败：断言失败仍然是非零退出码。
   */
  const base = ['--test', '--test-force-exit']
  const args = pattern ? [...base, '--test-name-pattern', pattern, ...files] : [...base, ...files]
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
} catch {
  process.exit(1)
}
