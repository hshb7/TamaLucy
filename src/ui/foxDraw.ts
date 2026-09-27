import { CLOTHING_ART, type Slot } from '../art/clothes.ts'
import { foxCurled, foxSitting, type Face } from '../art/fox.ts'
import type { Painter } from '../art/painter.ts'
import { sprite, type Sprite } from '../art/sprite.ts'

export interface FoxLook {
  pose: 'sit' | 'curl'
  face: Face
  tail: number
  breath?: number
  equipped: Partial<Record<Slot, string>>
}

const ORDER: Slot[] = ['neck', 'face', 'head']

export function drawFox(p: Painter, x: number, y: number, look: FoxLook) {
  if (look.pose === 'sit') {
    p.sprite(foxSitting(look.face, look.tail), x, y)
    for (const slot of ORDER) {
      const id = look.equipped[slot]
      if (!id) continue
      const c = CLOTHING_ART[id]
      if (c) p.sprite(c.sprite, x + c.x, y + c.y)
    }
    return
  }
  p.sprite(foxCurled(look.face, look.breath ?? 0), x, y)
  // only hats stay on while curled up
  const hat = look.equipped.head && CLOTHING_ART[look.equipped.head]
  if (hat) p.sprite(hat.sprite, x + hat.x - 6, y + hat.y + 1)
}

/** Natural idle animation: blinking and a lazy tail swish. */
export function idleFace(t: number, base: Face = 'open'): Face {
  if (base !== 'open') return base
  const cycle = t % 4200
  return cycle < 140 || (cycle > 380 && cycle < 500 && Math.floor(t / 4200) % 3 === 0) ? 'blink' : 'open'
}

export function idleTail(t: number, speed = 1): number {
  return Math.floor((t * speed) / 700) % 2
}

// ─── particles ────────────────────────────────────────────────────────────
export type ParticleKind = 'heart' | 'spark' | 'z' | 'drop' | 'crumb'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
}

const PARTICLE_ART: Record<ParticleKind, Sprite> = {
  heart: sprite(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#f27a93' }),
  spark: sprite(['.y.', 'ywy', '.y.']),
  z: sprite(['zzz', '..z', '.z.', 'zzz'], { z: '#f3eefc' }),
  drop: sprite(['u', 'u', 'U']),
  crumb: sprite(['t']),
}

export function spawn(list: Particle[], kind: ParticleKind, x: number, y: number, t: number, n = 1) {
  for (let i = 0; i < n; i++) {
    list.push({
      kind,
      x: x + (Math.random() - 0.5) * (kind === 'drop' ? 12 : 8),
      y,
      vx: kind === 'z' ? 3 : (Math.random() - 0.5) * (kind === 'crumb' ? 14 : 6),
      vy: kind === 'drop' ? 30 : kind === 'crumb' ? -8 : -8 - Math.random() * 6,
      born: t,
      life: kind === 'drop' ? 700 : kind === 'z' ? 2200 : 1400,
    })
  }
}

export function stepParticles(p: Painter, list: Particle[], t: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i]
    const age = t - q.born
    if (age > q.life || age < 0) {
      list.splice(i, 1)
      continue
    }
    const s = age / 1000
    const x = q.x + q.vx * s + (q.kind === 'z' ? Math.sin(s * 3) * 2 : 0)
    const y = q.y + q.vy * s + (q.kind === 'crumb' ? 40 * s * s : 0)
    const fade = age > q.life * 0.7 ? 1 - (age - q.life * 0.7) / (q.life * 0.3) : 1
    p.sprite(PARTICLE_ART[q.kind], x, y, fade)
  }
}

export const RAIN_CLOUD = sprite([
  '.....oooo.......',
  '...oozzzzoooo...',
  '..ozzzzzzzzzzo..',
  '.ozzwzzzzzzzzzo.',
  'ozzzzzzzzzzzzzzo',
  'oZZZZZZZZZZZZZZo',
  '.oooooooooooooo.',
])

export const THOUGHT = sprite([
  '...oooooooooo...',
  '..owwwwwwwwwwo..',
  '.owwwwwwwwwwwwo.',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  '.owwwwwwwwwwwwo.',
  '..owwwwwwwwwwo..',
  '...oooooooooo...',
  '..ooo...........',
  '.owwo...........',
  '..oo............',
])
