/**
 * 实现登记表查询层。
 *
 * ## 两份清单，两个不同的问题
 *
 *   IMPLEMENTED_CLASS_IDS  这个类**有实现单元**吗？（有文件就能跑）
 *   SPECIALIZED_CLASS_IDS  这个类**有自己的逻辑**吗？（不是只调通用实现）
 *
 * 迁移前两者是同一份（36 个真实现）。迁移后分开了：95 个类有实现单元，
 * 但只有 39 个有自己的逻辑，其余 56 个是骨架 —— 有位置、有 summary，
 * run 走 planRender / assessComposition / runLineInstance。
 *
 * 混用会造成假成功：把 IMPLEMENTED 当「真实实现」用，界面会把 56 个骨架
 * 标成「真实实现」，用户以为功能在。
 */
import { IMPLEMENTED_CLASS_IDS, SPECIALIZED_CLASS_IDS, IMPL_SUMMARY } from './implemented.generated'

export type ImplementedClassId = (typeof IMPLEMENTED_CLASS_IDS)[number]

export { IMPL_SUMMARY }

const IMPLEMENTED = new Set<string>(IMPLEMENTED_CLASS_IDS)
const SPECIALIZED = new Set<string>(SPECIALIZED_CLASS_IDS)

/** 这个类有实现单元（有文件、能跑） */
export function hasImplUnit(classId: string): boolean {
  return IMPLEMENTED.has(classId)
}

/** 这个类有自己的逻辑，不是只调通用实现 */
export function hasSpecialized(classId: string): boolean {
  return SPECIALIZED.has(classId)
}

/** 实现状态三态，界面用它显示徽章 */
export type ImplState = 'real' | 'skeleton' | 'missing'

export function implStateOf(classId: string): ImplState {
  if (SPECIALIZED.has(classId)) return 'real'
  if (IMPLEMENTED.has(classId)) return 'skeleton'
  return 'missing'
}

/** 一句话说清状态，避免各处自己拼文案 */
export function implStateLabel(classId: string): string {
  switch (implStateOf(classId)) {
    case 'real':
      return '真实实现'
    case 'skeleton':
      return '骨架（走通用实现）'
    default:
      return '未实现'
  }
}

/**
 * @deprecated 语义已从「有真实行为」漂移成「有实现单元」。
 * 新代码用 hasImplUnit（有文件）或 hasSpecialized（有自己逻辑）。
 */
export function hasRealImpl(classId: string): boolean {
  return SPECIALIZED.has(classId)
}
