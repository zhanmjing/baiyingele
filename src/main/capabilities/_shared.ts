/**
 * 能力模块的公共契约与小工具。
 *
 * 每个能力一个文件，导出 id / summary / run 三样东西；
 * index.ts 与 src/shared/implemented.generated.ts 由 scripts/gen-impl-manifest.mjs 生成。
 */
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RunContext, RunOutcome } from '../layerStore'

export type Capability = (context: RunContext) => Promise<RunOutcome>

export interface CapabilityModule {
  id: string
  summary: string
  run: Capability
}

export function elapsed(startedAt: number): number {
  return Date.now() - startedAt
}

/** `~` 展开为主目录；空串原样返回（调用方自己判断缺参数） */
export function expandPath(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('~')) return join(homedir(), value.slice(1).replace(/^[\\/]+/, ''))
  return value
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
