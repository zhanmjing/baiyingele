/**
 * 五层的唯一层名清单。
 *
 * 刻意不 import 任何目录 JSON：preload 与渲染层都要用这份清单，
 * 但不能因此把 4,900 行目录数据打进 preload bundle。
 */
export const LAYER_KEYS = ['point', 'line', 'surface', 'body', 'field'] as const

export type LayerKey = (typeof LAYER_KEYS)[number]

/** 'point' -> 'Point'，用于生成 getPointCatalog / runPoint 这类方法名 */
export function layerMethodSuffix(key: LayerKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}
