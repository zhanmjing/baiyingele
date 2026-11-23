/**
 * 真实实现登记表的读取层。
 *
 * 数据本体在 implemented.generated.ts（由 scripts/gen-impl-manifest.mjs 从
 * src/main/capabilities/ 生成），这里只做查询封装。
 * 渲染层不能 import electron，所以能力模块的摘要必须以产物形式带过来。
 */
import { IMPLEMENTED_CLASS_IDS, IMPL_SUMMARY } from './implemented.generated'

export type ImplementedClassId = (typeof IMPLEMENTED_CLASS_IDS)[number]

export { IMPL_SUMMARY }

const IMPLEMENTED = new Set<string>(IMPLEMENTED_CLASS_IDS)

export function hasRealImpl(classId: string): boolean {
  return IMPLEMENTED.has(classId)
}
