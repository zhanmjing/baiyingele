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
      getTriggers: () => Promise<{
        bindings: unknown[]
        firings: unknown[]
        combos: string[]
        failures: string[]
      }>
      addTrigger: (input: unknown) => Promise<unknown>
      removeTrigger: (id: string) => Promise<boolean>
      simulateTrigger: (combo: string) => Promise<unknown[]>
      dispatchGesture: (points: { x: number; y: number; t?: number }[]) => Promise<unknown>
    }
  }
}

export type { RunResult }
export {}
