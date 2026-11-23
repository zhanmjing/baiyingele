/**
 * 场层落地后的撤销日志。
 *
 * A2 允许自动应用，但设计要求「可撤销」，所以每次应用都记一条
 * {instanceId, param, previous, next}，撤销时一次性消费掉。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface UndoEntry {
  token: string
  at: number
  instanceId: string
  param: string
  previous: string | null
  next: string
  classId: string
}

interface JournalState {
  version: 1
  entries: UndoEntry[]
}

const MAX_ENTRIES = 200

export class UndoJournal {
  private readonly filePath: string
  private state: JournalState

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
  }

  private load(): JournalState {
    try {
      if (!existsSync(this.filePath)) return { version: 1, entries: [] }
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<JournalState>
      return { version: 1, entries: Array.isArray(parsed.entries) ? parsed.entries : [] }
    } catch {
      return { version: 1, entries: [] }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(temp, this.filePath)
  }

  record(entry: Omit<UndoEntry, 'token' | 'at'>): string {
    const token = `undo-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`
    this.state.entries = [{ ...entry, token, at: Date.now() }, ...this.state.entries].slice(0, MAX_ENTRIES)
    this.save()
    return token
  }

  /** 一次性消费：撤销过的令牌不能再用 */
  take(token: string): UndoEntry | undefined {
    const found = this.state.entries.find((entry) => entry.token === token)
    if (!found) return undefined
    this.state.entries = this.state.entries.filter((entry) => entry.token !== token)
    this.save()
    return found
  }

  list(): UndoEntry[] {
    return this.state.entries.slice()
  }
}
