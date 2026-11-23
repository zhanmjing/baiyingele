import defaults from './generatedSurface.json'
import type { DockTab, DockTile, GestureBinding, PanelClass } from './surfaceData'

export interface SurfaceResources {
  panelClasses: PanelClass[]
  gestures: GestureBinding[]
  dockTabs: DockTab[]
  dockTiles: DockTile[]
}

const STORAGE_KEY = 'baiying.surface.resources.v1'

const defaultResources = defaults as unknown as SurfaceResources

export function loadSurfaceResources(): SurfaceResources {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<SurfaceResources> | null
    if (!saved) return structuredClone(defaultResources)
    return {
      panelClasses: Array.isArray(saved.panelClasses) && saved.panelClasses.length ? saved.panelClasses : structuredClone(defaultResources.panelClasses),
      gestures: Array.isArray(saved.gestures) && saved.gestures.length ? saved.gestures : structuredClone(defaultResources.gestures),
      dockTabs: Array.isArray(saved.dockTabs) && saved.dockTabs.length ? saved.dockTabs : structuredClone(defaultResources.dockTabs),
      dockTiles: Array.isArray(saved.dockTiles) ? saved.dockTiles : structuredClone(defaultResources.dockTiles)
    }
  } catch {
    return structuredClone(defaultResources)
  }
}

export function saveSurfaceResources(resources: SurfaceResources): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resources))
}

export function resetSurfaceResources(): SurfaceResources {
  localStorage.removeItem(STORAGE_KEY)
  return structuredClone(defaultResources)
}
