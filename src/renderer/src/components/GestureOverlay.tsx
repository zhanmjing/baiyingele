import { useEffect, useRef, useState } from 'react'

/**
 * 手势浮层：轨迹 + 动作提示。
 *
 * ## 为什么用 canvas 逐点流式，而不是 React 画 SVG
 *
 * WGestures 的 HandlePathGrow（CanvasWindowGestureView.cs:224）是这么做的：
 *
 *   _gPath.AddLine(pA, pB);            // 线段累加到持久 GraphicsPath
 *   _gPathDirty.Reset();
 *   _gPathDirty.AddLine(pA, pB);       // 脏区只有这一条新线段
 *   _gPathDirty.Widen(_dirtyMarkerPen); // 加宽覆盖线宽
 *   DrawAndUpdate();                   // 只重画脏区
 *
 * 三个要点：线段累加、脏区只含新线段、进程内绘制零 IPC。
 *
 * 第一版我反着做：每帧把整个 points 数组过 IPC，React 重建整条 polyline
 * 的 points 字符串，识别还每帧全量跑一遍。结果就是不跟手 + 卡顿。
 *
 * 现在：canvas 的 path 本身就是累加的，每来一个点只 lineTo 一次（O(1)），
 * 用 requestAnimationFrame 合并成每帧一次绘制，React 只在提示变化时重渲染。
 */

interface Hint {
  text: string
  color: string
  background: string
  visible: boolean
}

interface TrailPen {
  color: string
  width: number
  opacity: number
}

const HINT_HOLD_MS = 1200

export function GestureOverlay(): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // 笔迹层：阴影 → 白边 → 主笔，三层同一个 path，只是宽度/颜色不同
  const penRef = useRef<{ layers: TrailPen[] }>({ layers: [] })
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const dirty = useRef(false)
  const raf = useRef<number | null>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /** 画布尺寸跟随窗口；用 devicePixelRatio 保证高分屏不糊 */
    /**
     * canvas 后备缓冲 = **物理像素**，并且不做 dpr 变换。
     *
     * uiohook 给的是物理屏幕坐标，浮层窗口也铺满物理屏幕，
     * 所以两者在同一坐标系里，直接画就行。
     *
     * 第一版设了 setTransform(dpr,…) 让绘制走 CSS 坐标，
     * 结果 DPI 1.25 时整条轨迹向左上偏 —— 鼠标在 (1200,700)，
     * 笔迹画到了 (960,560)。
     */
    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      // 单位矩阵：后续所有坐标都按物理像素解释，和 uiohook 一致
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      clear()
    }

    const clear = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      lastPoint.current = null
    }

    /**
     * 一帧只画一次。
     *
     * 每来一个点都重画整条路径 —— 那是 O(n²)。canvas 的 path 在 ctx 里是
     * 累加的，所以「重画」= 用当前 path 重新 stroke 三层，路径本身不用重建。
     * 代价是每帧 O(点数)，和 WGestures 的脏区重画同阶；在 512 点上限下足够。
     */
    const paint = (): void => {
      raf.current = null
      if (!dirty.current) return
      dirty.current = false
      const layers = penRef.current.layers
      if (!layers.length) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // 先宽后窄：阴影 → 白边 → 主笔，否则细笔被粗笔盖住
      for (const layer of layers) {
        ctx.beginPath()
        const path = pathRef.current
        if (path.length < 2) continue
        ctx.moveTo(path[0].x, path[0].y)
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
        ctx.strokeStyle = layer.color
        ctx.globalAlpha = layer.opacity
        ctx.lineWidth = layer.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // 路径点：单独存一份，避免每帧从 IPC 重建
    const pathRef = { current: [] as Array<{ x: number; y: number }> }

    const schedule = (): void => {
      dirty.current = true
      if (raf.current === null) raf.current = requestAnimationFrame(paint)
    }

    resize()
    window.addEventListener('resize', resize)

    const api = window.baiying
    if (!api?.onGestureTrailStart) return

    const offStart = api.onGestureTrailStart((payload) => {
      const p = payload as { layers?: TrailPen[] }
      penRef.current.layers = p?.layers ?? []
      pathRef.current = []
      lastPoint.current = null
      clear()
      setActive(true)
      dirty.current = true
      schedule()
    })

    const offPoint = api.onGestureTrailPoint((payload) => {
      const p = payload as { x: number; y: number }
      if (!p || typeof p.x !== 'number') return
      // 与上一点重合就丢掉（WGestures 也是 pA != pB 才 AddLine）
      if (lastPoint.current && lastPoint.current.x === p.x && lastPoint.current.y === p.y) return
      lastPoint.current = { x: p.x, y: p.y }
      pathRef.current.push({ x: p.x, y: p.y })
      schedule()
    })

    /** 识别成功：只换笔，不重发点 */
    const offPen = api.onGestureTrailPen?.((payload) => {
      const p = payload as { layers?: TrailPen[] }
      if (p?.layers?.length) {
        penRef.current.layers = p.layers
        schedule()
      }
    })

    const offEnd = api.onGestureTrailEnd?.(() => {
      pathRef.current = []
      lastPoint.current = null
      clear()
      setActive(false)
    })

    const offHint = api.onGestureHint?.((payload) => {
      const next = payload as Hint
      if (!next || !next.visible) { setHint(null); return }
      setHint(next)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(null), HINT_HOLD_MS)
    })

    return () => {
      window.removeEventListener('resize', resize)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      offStart?.(); offPoint?.(); offPen?.(); offEnd?.(); offHint?.()
    }
  }, [])

  return (
    <div className="gesture-overlay" aria-hidden>
      <canvas ref={canvasRef} className="gesture-overlay-canvas" />
      {active && hint && (
        <div className="gesture-overlay-hint" style={{ color: hint.color, background: hint.background }}>
          {hint.text}
        </div>
      )}
      {!active && hint && (
        <div className="gesture-overlay-hint" style={{ color: hint.color, background: hint.background }}>
          {hint.text}
        </div>
      )}
    </div>
  )
}
