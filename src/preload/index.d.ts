import type { AppInfo } from './index'
import type { RunResult, LayerApi } from '../shared/layerApi'
import type { RunHistoryItem } from '../shared/runHistory'

declare global {
  interface Window {
    baiying: LayerApi & {
      getAppInfo: () => Promise<AppInfo>
      openDataDir: () => Promise<boolean>
      getRunHistory: (limit?: number) => Promise<RunHistoryItem[]>
    }
  }
}

export type { RunResult }
export {}
