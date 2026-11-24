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
  const args = pattern ? ['--test', '--test-name-pattern', pattern, ...files] : ['--test', ...files]
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
} catch {
  process.exit(1)
}
