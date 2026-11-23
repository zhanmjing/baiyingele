import type { AppInfo } from './index'
import type { RunResult, LayerApi } from '../shared/layerApi'
import type { RunHistoryItem } from '../shared/runHistory'

declare global {
  interface Window {
    baiying: LayerApi & {
      getAppInfo: () => Promise<AppInfo>
      openDataDir: () => Promise<boolean>
      getRunHistory: (limit?: number) => Promise<RunHistoryItem[]>
      undoFieldLanding: (token: string) => Promise<{ ok: boolean; message: string }>
      getRecentTriggers: (
        limit?: number
      ) => Promise<{ combos: string[]; firings: { at: number; combo: string }[] }>
    }
  }
}

export type { RunResult }
export {}
