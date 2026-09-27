import { useEffect, useRef } from 'react'
import { canvasPainter, type Painter } from '../art/painter.ts'

interface Props {
  w: number
  h: number
  draw: (p: Painter, t: number) => void
  fps?: number
  className?: string
  label?: string
  /** Pointer position in logical (pixel-art) coordinates. */
  onTap?: (x: number, y: number) => void
}

/** A low-res canvas scaled up with crisp pixels, redrawn at a gentle frame rate. */
export function PixelCanvas({ w, h, draw, fps = 12, className = '', label, onTap }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const p = canvasPainter(ctx)
    let raf = 0
    let last = -Infinity
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 1000 / fps) return
      last = t
      ctx.clearRect(0, 0, w, h)
      drawRef.current(p, t)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [w, h, fps])

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={`pixel-canvas ${className}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      onPointerDown={
        onTap &&
        ((e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onTap(((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h)
        })
      }
    />
  )
}
