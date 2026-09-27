import { useRef } from 'react'
import type { Face } from '../art/fox.ts'
import type { Slot } from '../art/clothes.ts'
import { TREAT_ART } from '../art/items.ts'
import type { Painter } from '../art/painter.ts'
import { PixelCanvas } from './PixelCanvas.tsx'
import { drawFox, idleFace, idleTail, spawn, stepParticles, type Particle } from './foxDraw.ts'

interface Props {
  equipped: Partial<Record<Slot, string>>
  face?: Face
  /** Treat id: plays a munching animation. */
  eating?: string | null
  /** Bounce + sparkles (celebrations). */
  cheer?: boolean
  hearts?: boolean
  className?: string
  label?: string
  onTap?: () => void
}

const W = 50
const H = 44

/** Just the fox (plus outfit), for menus and celebrations. */
export function FoxPortrait({ equipped, face, eating, cheer, hearts, className = '', label = 'your fox', onTap }: Props) {
  const parts = useRef<Particle[]>([])
  const last = useRef(0)
  const draw = (p: Painter, t: number) => {
    const list = parts.current
    let f: Face = face ?? idleFace(t)
    let dy = 0
    if (eating) {
      f = Math.floor(t / 260) % 2 ? 'eat' : 'happy'
      if (t - last.current > 520) {
        last.current = t
        spawn(list, 'crumb', 20, 26, t, 2)
      }
    }
    if (cheer) {
      dy = -Math.abs(Math.round(Math.sin(t / 180) * 3))
      if (!face) f = 'happy'
      if (t - last.current > 500) {
        last.current = t
        spawn(list, 'spark', 4 + Math.random() * 38, 12, t)
      }
    }
    if (hearts && t - last.current > 700) {
      last.current = t
      spawn(list, 'heart', 18, 8, t)
    }
    drawFox(p, 4, 9 + dy, { pose: 'sit', face: f, tail: idleTail(t, cheer ? 2.5 : 1), equipped })
    if (eating && TREAT_ART[eating]) p.sprite(TREAT_ART[eating], 14, 26 + dy)
    stepParticles(p, list, t)
  }
  return <PixelCanvas w={W} h={H} draw={draw} className={`portrait ${className}`} label={label} onTap={onTap && (() => onTap())} />
}
