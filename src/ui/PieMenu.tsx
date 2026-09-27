import type { Sprite } from '../art/sprite.ts'
import { PixelIcon } from './PixelIcon.tsx'

export interface PieOption {
  id: string
  label: string
  icon?: Sprite
  disabled?: boolean
}

interface Props {
  /** Tap point in CSS pixels, relative to the room box. */
  x: number
  y: number
  width: number
  height: number
  title: string
  options: PieOption[]
  onPick: (id: string) => void
  onClose: () => void
}

const ROW = 38

/** A Sims-style pie menu: options fan out in two columns around the tap. */
export function PieMenu({ x, y, width, height, title, options, onPick, onClose }: Props) {
  const right = options.filter((_, i) => i % 2 === 0)
  const left = options.filter((_, i) => i % 2 === 1)
  const rows = Math.max(right.length, left.length)
  const halfH = (rows * ROW) / 2 + 18
  const side = Math.min(128, width / 2 - 8)
  const cx = Math.max(side + 8, Math.min(width - side - 8, x))
  const cy = Math.max(halfH, Math.min(height - halfH + 8, y))

  const place = (col: PieOption[], dir: 1 | -1) =>
    col.map((o, i) => {
      const off = i - (col.length - 1) / 2
      const bend = Math.abs(off) * 6 // gentle arc, like the Sims
      return (
        <button
          key={o.id}
          className={`pie-item ${dir < 0 ? 'pie-left' : ''}`}
          style={{ left: cx + dir * (22 - bend), top: cy + off * ROW, animationDelay: `${i * 30}ms` }}
          disabled={o.disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onPick(o.id)
          }}
        >
          {o.icon && <PixelIcon sprite={o.icon} scale={2} />}
          <span>{o.label}</span>
        </button>
      )
    })

  return (
    <div className="pie" onPointerDown={(e) => (e.stopPropagation(), onClose())}>
      <div className="pie-title" style={{ left: cx, top: cy - halfH + 2 }}>
        {title}
      </div>
      <button
        className="pie-center"
        style={{ left: cx, top: cy }}
        aria-label="close menu"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => (e.stopPropagation(), onClose())}
      >
        ×
      </button>
      {place(right, 1)}
      {place(left, -1)}
    </div>
  )
}
