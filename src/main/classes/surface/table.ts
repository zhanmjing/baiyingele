import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'

/**
 * surface.table —— 表格
 *
 * 特化点：槽位是**列定义**，行数据来自 registry。
 *
 * 通用 planRender 只会把槽位列成「块」—— 对表格来说那是错的：
 * 槽位描述的是「有哪些列」，不是「有哪几块内容」。
 * 所以这里把块改写成列 + 行，并给出总数与截断标记。
 *
 * 截断标记不能省：只显示前 N 行而不说还有多少，用户会以为数据就这么多。
 */

/** 表格最多渲染多少行 */
const MAX_ROWS = 200

export interface TableColumn {
  id: string
  label: string
  order: number
}

export interface TableRender extends RenderResult {
  table?: {
    columns: TableColumn[]
    rows: Array<{ id: string; cells: Record<string, unknown> }>
    total: number
    truncated: boolean
  }
}

export const classId = 'surface.table'
export const summary = '表格：槽位是列定义，行数据来自 registry；要能排序与分页'

export const run = defineClassImpl<SurfaceClassInput, TableRender>({
  classId,
  summary,
  run: async (input) => {
    const base = planRender(classId, input.instanceId, input.params, input.deps)

    const columns: TableColumn[] = base.slots.map((slot, index) => ({
      id: slot.id,
      label: slot.label,
      order: slot.order ?? index + 1
    }))

    const dataSource = base.slots.find((slot) => slot.source?.kind === 'registry')?.source
    if (!dataSource) {
      return {
        ...base,
        gaps: [...base.gaps, { slot: 'rows', reason: '表格没有声明 registry 来源，无法取行数据' }]
      }
    }

    let rows: Array<{ id: string; cells: Record<string, unknown> }> = []
    let total = 0
    let readFailed: string | null = null

    try {
      const read = await input.deps.read?.(dataSource)
      if (!read) {
        readFailed = '没有注入取数器'
      } else if (read.status === 'error' || read.status === 'missing') {
        readFailed = read.reason ?? read.status
      } else if (Array.isArray(read.value)) {
        const all = read.value as Array<Record<string, unknown>>
        total = all.length
        rows = all.slice(0, MAX_ROWS).map((item, index) => ({
          id: String(item.id ?? item.classId ?? index),
          cells: item as Record<string, unknown>
        }))
      } else if (read.status === 'empty') {
        total = 0
      }
    } catch (error) {
      readFailed = error instanceof Error ? error.message : String(error)
    }

    if (readFailed) {
      return {
        ...base,
        gaps: [...base.gaps, { slot: 'rows', reason: `取行数据失败：${readFailed}` }]
      }
    }

    return {
      ...base,
      // 块改写成「列 + 行」后，原来那些占位块就没有意义了
      blocks: [],
      table: { columns, rows, total, truncated: total > rows.length },
      intents: [`sort:${columns.length} 列`, ...(total > MAX_ROWS ? [`page:${Math.ceil(total / MAX_ROWS)} 页`] : [])]
    }
  }
}).run
