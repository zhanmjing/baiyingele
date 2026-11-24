import raw from './generatedSurface.json'

import type { ClassRef, InstanceRef } from '../../shared/atomId'

export interface PanelInstance {
  label: string
  /** 承载的页面实例（可多个） */
  content: InstanceRef[]
  mode: string
  width: number
  state: string
  data: string
  actions: string[]
  rev: number
  status: string
}

export interface PanelClass {
  id: string
  name: string
  icon: string
  group: string
  desc: string
  modes: string[]
  regions: string[]
  /** 默认承载的页面类 */
  content: ClassRef[]
  states: string[]
  behaviors: string[]
  a11y: string[]
  version: string
  status?: string
  instances: PanelInstance[]
}

export interface GestureBinding {
  pattern: string
  name: string
  kind: 'flow' | 'point' | string
  target: string
  effect: string
  desc: string
  targetKind?: 'point' | 'line'
  targetId?: string
  targetLabel?: string
  href?: string
}

export interface DockTab {
  id: string
  name: string
}

export interface DockTile {
  id: string
  tab: string
  name: string
  sub: string
  kind: 'flow' | 'point' | string
  icon: string
  hotkey: string
  target: string
  effect: string
}

const data = raw as unknown as {
  panelClasses: PanelClass[]
  gestures: GestureBinding[]
  dockTabs: DockTab[]
  dockTiles: DockTile[]
}

export const panelClasses = data.panelClasses
export const gestureBindings = data.gestures
export const dockTabs = data.dockTabs
export const dockTiles = data.dockTiles

export const panelGroups = [...new Set(panelClasses.map((item) => item.group))]

export const panelInstances = panelClasses.flatMap((item) =>
  item.instances.map((instance) => ({ ...instance, classId: item.id, className: item.name }))
)

export const gesturePaths: Record<string, [number, number][]> = {
  LDR: [[320, 60], [70, 60], [70, 160], [320, 160]],
  UD: [[190, 220], [190, 55], [215, 220]],
  RL: [[65, 150], [330, 150], [65, 150]],
  DR: [[65, 65], [65, 225], [330, 225]],
  DLU: [[330, 60], [330, 225], [70, 225], [70, 60]]
}

export function gesturePath(pattern: string): [number, number][] {
  return gesturePaths[pattern] ?? gesturePaths.LDR
}
