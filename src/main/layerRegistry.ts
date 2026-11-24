/**
 * 层的唯一注册表（主进程侧）。
 *
 * 新增一层 = 在这里加一条 def，store / IPC / preload / 运行全部自动生效。
 * 这是替代原先 5 份复制粘贴 store 的单一事实源。
 */
import { bodyClassesSeed } from '../shared/bodyCatalog'
import { fieldClassesSeed } from '../shared/fieldCatalog'
import { lineClassesSeed } from '../shared/lineCatalog'
import { pointClassesSeed, type PointClassSeed } from '../shared/pointCatalog'
import { surfaceClassesSeed } from '../shared/surfaceCatalog'
import { LAYER_KEYS, type LayerKey } from '../shared/layerKeys'

export interface LayerDef {
  key: LayerKey
  /** 错误信息里用的类名：PointClass / LineClass / ... */
  classLabel: string
  classes: PointClassSeed[]
  /** 类 -> 人类可读的输出摘要；未命中的类走模拟输出 */
  outputs: Record<string, string>
}

export const LAYER_DEFS: Record<LayerKey, LayerDef> = {
  point: {
    key: 'point',
    classLabel: 'PointClass',
    classes: pointClassesSeed,
    outputs: {
      'point.key_send': '已发送组合键',
      'point.clipboard_get': '已读取剪贴板',
      'point.http_request': 'HTTP 请求完成',
      'point.screen_capture': '已捕获屏幕源'
    }
  },
  line: {
    key: 'line',
    classLabel: 'LineClass',
    classes: lineClassesSeed,
    outputs: {
      'line.open_external_site': '外部站点流程完成 · 已打开目标页面',
      'flow.file-rename': '批量重命名完成 · 12 个文件',
      'flow.daily-report': '日报已生成 · daily-report.md'
    }
  },
  surface: {
    key: 'surface',
    classLabel: 'SurfaceClass',
    classes: surfaceClassesSeed,
    outputs: {
      'surface.command_palette': '命令面板已唤起 · 全局搜索就绪',
      'surface.launch-dock': '启动坞已展开 · 5 个标签',
      'surface.settings': '设置页已打开 · 98 项设置'
    }
  },
  body: {
    key: 'body',
    classLabel: 'BodyClass',
    classes: bodyClassesSeed,
    outputs: {
      'body.file_preview': '文件预览已加载 · 3 个文件',
      'body.ocr': 'OCR 识别完成 · confidence 0.91',
      'body.batch_rename': '批量重命名预览完成 · 12 个文件'
    }
  },
  field: {
    key: 'field',
    classLabel: 'FieldClass',
    classes: fieldClassesSeed,
    outputs: {
      'field.prefill': 'ocr.language = zh · confidence 0.84',
      'field.rank': '候选已排序 · 12 items · reason: recent-use',
      'field.guard': '风险检查通过 · L1 · privacy ok'
    }
  }
}

export function layerDef(key: LayerKey): LayerDef {
  return LAYER_DEFS[key]
}

export { LAYER_KEYS }
