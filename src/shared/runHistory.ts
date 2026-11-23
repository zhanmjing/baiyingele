export interface RunHistoryItem {
  id: string
  layer: 'point' | 'line' | 'surface' | 'body' | 'field'
  classId: string
  instanceId: string
  status: 'ok' | 'warn'
  output: string
  elapsedMs: number
  createdAt: number
}
