import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'
import { MODIFIER_MNEMONIC } from '../../../shared/gestureNotation'

/**
 * surface.gesture_hint —— 手势动作提示浮层
 *
 * 对应 WGestures 的 GestureViewShowCommandName（CanvasWindowGestureView.ShowLabel）。
 *
 * ## 原码有两个不同的文本格式，不能合成一个
 *
 * ① HandleIntentRecognized（识别到时）
 *      var modifierText = intent.Gesture.Modifier.ToMnemonic();
 *      var newLabelText = intent.Name + (modifierText == "" ? "" : (" " + modifierText));
 *    → 「音量 ▲」  名字在前
 *
 * ② HandleCommandReportStatus（命令回报状态时）
 *      var newLabelText = (modifierText == "" ? "" : (modifierText + " "))
 *                       + intent.Name + status;
 *    → 「▲ 音量+」 modifier 在前，名字后面接状态后缀
 *
 * ChangeAudioVolumeCommand 在每次滚轮时 ReportStatus("+"/"-")，
 * 中键时 ReportStatus("x") —— 所以这个后缀是**实时变**的。
 *
 * ## 位置与内边距
 *
 *   var msgPos = new PointF(W / 2, (H / 2) + W / 8);
 *   _labelRect = RectangleF.Inflate(bounds, 25 * dpi, 15 * dpi);
 *   _labelFont.Size * _dpiFactor
 */

export const classId = 'surface.gesture_hint'
export const summary = '手势动作提示浮层：意图名 + modifier 助记符 + 状态后缀'
export const specialized = true

/** 原码用的就是这两个颜色 */
export const DEFAULT_HINT_STYLE = {
  color: '#ffffff',
  background: 'rgba(0, 0, 0, 0.47)' // Color.FromArgb(120,0,0,0)：120/255 ≈ 0.47
}

/** 原码内边距：Inflate(25 * dpi, 15 * dpi) */
export const HINT_PADDING = { x: 25, y: 15 }
/** 原码字号基准（_labelFont.Size），按 dpi 放大 */
export const HINT_FONT_SIZE = 15

export type HintMode = 'recognized' | 'status'

export interface HintRender {
  /** 要显示的文本；空串 = 不显示 */
  text: string
  intentName: string
  modifierText: string
  /** 状态后缀（只有 status 模式有） */
  status: string
  mode: HintMode
  color: string
  background: string
  /** 屏幕坐标（左上角由渲染层按宽度居中） */
  position: { x: number; y: number }
  fontSize: number
  padding: { x: number; y: number }
  visible: boolean
}

export interface HintInput extends SurfaceClassInput {
  name?: string
  modifier?: string
  /** 命令回报的状态后缀（'+' / '-' / 'x' …） */
  status?: string
  /** 'recognized'（默认识别时）/ 'status'（命令回报时） */
  mode?: HintMode
  /** 屏幕尺寸，用于算位置；不传就退化成 (0,0) 由渲染层居中兜底 */
  screen?: { width: number; height: number }
  dpiFactor?: number
  style?: Partial<typeof DEFAULT_HINT_STYLE>
}

function modifierMnemonic(modifier?: string): string {
  if (!modifier) return ''
  const table = MODIFIER_MNEMONIC as Record<string, string>
  return table[modifier] ?? modifier
}

/**
 * 拼文本。两种格式严格按原码，不合并。
 */
export function formatHintText(
  name: string,
  modifier?: string,
  status = '',
  mode: HintMode = 'recognized'
): { text: string; modifierText: string } {
  const modifierText = modifierMnemonic(modifier)
  const base = String(name ?? '').trim()
  if (!base) return { text: '', modifierText }

  if (mode === 'status') {
    // ② (modifier + " ") + name + status
    return { text: `${modifierText ? `${modifierText} ` : ''}${base}${status}`, modifierText }
  }
  // ① name + (" " + modifier)
  return { text: modifierText ? `${base} ${modifierText}` : base, modifierText }
}

export function computeHint(input: HintInput): HintRender {
  const style = { ...DEFAULT_HINT_STYLE, ...(input.style ?? {}) }
  const mode: HintMode = input.mode === 'status' ? 'status' : 'recognized'
  const { text, modifierText } = formatHintText(input.name ?? '', input.modifier, input.status ?? '', mode)

  // 原码：非正数一律当 1，避免字号/内边距算成 0
  const rawDpi = Number(input.dpiFactor)
  const dpi = Number.isFinite(rawDpi) && rawDpi > 0 ? Math.min(Math.max(rawDpi, 0.5), 4) : 1

  // 原码位置：x = W/2，y = H/2 + W/8（屏幕中心偏下）
  const w = Number(input.screen?.width) || 0
  const h = Number(input.screen?.height) || 0

  return {
    text,
    intentName: String(input.name ?? '').trim(),
    modifierText,
    status: mode === 'status' ? String(input.status ?? '') : '',
    mode,
    color: style.color,
    background: style.background,
    position: { x: Math.round(w / 2), y: Math.round(h / 2 + w / 8) },
    fontSize: Math.round(HINT_FONT_SIZE * dpi),
    padding: { x: Math.round(HINT_PADDING.x * dpi), y: Math.round(HINT_PADDING.y * dpi) },
    visible: text.length > 0
  }
}

export interface HintSurfaceRender extends RenderResult {
  hint?: HintRender
}

export const run = defineClassImpl<HintInput, HintSurfaceRender>({
  classId,
  summary,
  run: (input) => {
    const base = planRender(classId, input.instanceId, input.params, input.deps)
    return { ...base, blocks: [], hint: computeHint(input), intents: [], gaps: base.gaps }
  }
}).run
