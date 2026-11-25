import { defineClassImpl } from '../../../shared/classImpl'
import { planRender, type RenderResult, type SurfaceClassInput } from '../../surfaceRuntime'
import { MODIFIER_MNEMONIC } from '../../../shared/gestureNotation'

/**
 * surface.gesture_hint —— 手势动作提示浮层
 *
 * 对应 WGestures 的 GestureViewShowCommandName（CanvasWindowGestureView.ShowCommandName）。
 *
 * ## 原码行为（HandleIntentRecognized）
 *
 *   var modifierText = intent.Gesture.Modifier.ToMnemonic();
 *   var newLabelText = intent.Name + (modifierText == "" ? "" : (" " + modifierText));
 *   ShowLabel(Color.White, newLabelText, Color.FromArgb(120, 0, 0, 0));
 *
 * 三个要点：
 *   1. 文本 = **意图名 + 空格 + modifier 助记符**（没有 modifier 就不加空格）
 *   2. 字色纯白
 *   3. 底色 rgba(0,0,0,120) —— 半透明黑，不是纯黑
 */

export const classId = 'surface.gesture_hint'
export const summary = '手势动作提示浮层：意图名 + modifier 助记符'
export const specialized = true

/** 原码用的就是这两个颜色，不改 */
export const DEFAULT_HINT_STYLE = {
  color: '#ffffff',
  background: 'rgba(0, 0, 0, 0.47)' // Color.FromArgb(120,0,0,0)：120/255 ≈ 0.47
}

export interface HintRender {
  /** 要显示的文本；空串 = 不显示 */
  text: string
  /** 拆开给渲染层，便于分别排版 */
  intentName: string
  modifierText: string
  color: string
  background: string
  visible: boolean
}

export interface HintInput extends SurfaceClassInput {
  /** 命中的意图名 */
  name?: string
  /** modifier（'wheel-forward' 等），可空 */
  modifier?: string
  style?: Partial<typeof DEFAULT_HINT_STYLE>
}

/** 按 WGestures 的拼法生成提示文本（纯函数，单独导出便于测） */
export function formatHintText(name: string, modifier?: string): { text: string; modifierText: string } {
  const modifierText = modifier ? modifierMnemonic(modifier) : ''
  const base = String(name ?? '').trim()
  if (!base) return { text: '', modifierText }
  return { text: modifierText ? `${base} ${modifierText}` : base, modifierText }
}

function modifierMnemonic(modifier: string): string {
  const table = MODIFIER_MNEMONIC as Record<string, string>
  return table[modifier] ?? modifier
}

export function computeHint(input: HintInput): HintRender {
  const style = { ...DEFAULT_HINT_STYLE, ...(input.style ?? {}) }
  const { text, modifierText } = formatHintText(input.name ?? '', input.modifier)
  return {
    text,
    intentName: String(input.name ?? '').trim(),
    modifierText,
    color: style.color,
    background: style.background,
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
