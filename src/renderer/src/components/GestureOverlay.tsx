import { useEffect, useRef, useState } from 'react'

/**
 * 手势浮层：轨迹 + 动作提示。
 *
 * 数据来自两个面层类：
 *   surface.gesture_trail → gesture:trail（实时折线、是否识别、当前笔）
 *   surface.gesture_hint  → gesture:hint（意图名 + modifier 助记符）
 *
 * 样式照 WGestures CanvasWindowGestureView：
 *   轨迹识别成功后换笔（_pathPen = _tempMainPen）
 *   提示是白字 + rgba(0,0,0,120) 底
 *
 * 已知限制：现在画在应用窗口内，不是全屏透明浮层。
 * WGestures 用独立的全屏透明 canvas 窗口，在别的程序里画也能看见；
 * 这里必须先让应用窗口可见。下一步要做独立透明窗口。
 */

interface TrailPoint { x: number; y: number }
interface TrailStroke { color: string; width: number; opacity: number }
interface Trail {
  polyline: TrailPoint[]
  recognized: boolean
  pen: { color: string; width: number; opacity: number }
  /** 阴影 → 白边 → 主笔，按顺序画 */
  layers: TrailStroke[]
  directions: string
  visible: boolean
}
interface Hint {
  text: string
  color: string
  background: string
  visible: boolean
}

const HINT_HOLD_MS = 1200

export function GestureOverlay(): React.JSX.Element | null {
  const [trail, setTrail] = useState<Trail | null>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const api = window.baiying
    if (!api?.onGestureTrail || !api?.onGestureHint) return

    const offTrail = api.onGestureTrail((raw) => {
      const next = raw as Trail
      setTrail(next && next.visible ? next : null)
    })

    const offHint = api.onGestureHint((raw) => {
      const next = raw as Hint
      if (!next || !next.visible) { setHint(null); return }
      setHint(next)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(null), HINT_HOLD_MS)
    })

    return () => {
      offTrail?.()
      offHint?.()
      if (hintTimer.current) clearTimeout(hintTimer.current)
    }
  }, [])

  if (!trail && !hint) return null

  const points = trail?.polyline.map((p) => `${p.x},${p.y}`).join(' ') ?? ''
  const last = trail?.polyline[trail.polyline.length - 1]

  return (
    <div className="gesture-overlay" aria-hidden>
      {trail && trail.polyline.length > 0 && (
        <svg className="gesture-overlay-trail">
          {/* 三层：阴影 → 白边 → 主笔（照 _shadowPen/_borderPen/_mainPen） */}
          {(trail.layers ?? [{ color: trail.pen.color, width: trail.pen.width, opacity: trail.pen.opacity }]).map((layer, i) => (
            <polyline
              key={`stroke-${i}`}
              points={points}
              fill="none"
              stroke={layer.color}
              strokeWidth={layer.width}
              strokeOpacity={layer.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {last && <circle cx={last.x} cy={last.y} r={trail.pen.width} fill={trail.pen.color} fillOpacity={trail.pen.opacity} />}
        </svg>
      )}

      {trail?.directions && (
        <div className={`gesture-overlay-dirs${trail.recognized ? ' is-recognized' : ''}`}>{trail.directions}</div>
      )}

      {hint && (
        <div className="gesture-overlay-hint" style={{ color: hint.color, background: hint.background }}>
          {hint.text}
        </div>
      )}
    </div>
  )
}
