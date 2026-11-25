import type { AppInfo } from './index'
import type { RunResult, LayerApi } from '../shared/layerApi'
import type { RunHistoryItem } from '../shared/runHistory'

declare global {
  interface Window {
    baiying: LayerApi & {
      getAppInfo: () => Promise<AppInfo>
      openDataDir: () => Promise<boolean>
      /** 在文件管理器里定位并选中一个文件（只允许数据目录内） */
      reveal: (target: string) => Promise<boolean>
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
      /** 手势轨迹浮层（surface.gesture_trail） */
  onGestureTrail: (callback: (trail: unknown) => void) => () => void
  /** 手势动作提示（surface.gesture_hint） */
  onGestureHint: (callback: (hint: unknown) => void) => () => void
  onTriggerFired: (callback: (record: unknown) => void) => () => void
      onFormRequest: (callback: (request: unknown) => void) => () => void
      resolveForm: (requestId: string, answer: unknown) => Promise<{ ok: boolean; message: string }>
    }
  }
}

export type { RunResult }
export {}
