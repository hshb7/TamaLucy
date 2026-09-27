import { CLOTHING_ART, type Slot } from '../art/clothes.ts'
import { WALK_HEAD, WALK_W, foxCurled, foxSitting, foxWalking, type Face } from '../art/fox.ts'
import type { Painter } from '../art/painter.ts'
import { flipX, sprite, type Sprite } from '../art/sprite.ts'

export interface FoxLook {
  pose: 'sit' | 'curl' | 'walk'
  face: Face
  tail: number
  breath?: number
  /** Walk-cycle frame (0-3). */
  frame?: number
  facing?: 1 | -1
  equipped: Partial<Record<Slot, string>>
}

const flipped = new WeakMap<Sprite, Sprite>()
export function mirrored(s: Sprite): Sprite {
  let m = flipped.get(s)
  if (!m) {
    m = flipX(s)
    flipped.set(s, m)
  }
  return m
}

const ORDER: Slot[] = ['neck', 'face', 'head']

export function drawFox(p: Painter, x: number, y: number, look: FoxLook) {
  if (look.pose === 'walk') {
    const f = look.frame ?? 0
    const right = (look.facing ?? 1) > 0
    const body = foxWalking(f, look.face)
    p.sprite(right ? body : mirrored(body), x, y)
    const hx = x + (right ? WALK_HEAD.x : WALK_W - WALK_HEAD.x - 32)
    const hy = y + WALK_HEAD.y - (f % 2)
    for (const slot of ORDER) {
      const id = look.equipped[slot]
      const c = id && CLOTHING_ART[id]
      if (!c) continue
      if (right) p.sprite(c.sprite, hx + c.x, hy + c.y)
      else p.sprite(mirrored(c.sprite), hx + 32 - c.x - c.sprite.w, hy + c.y)
    }
    return
  }
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
export type ParticleKind = 'heart' | 'spark' | 'z' | 'drop' | 'crumb' | 'note' | 'bubble' | 'stink' | 'icon'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  /** For 'icon' particles (chat pictograms). */
  art?: Sprite
}

const PARTICLE_ART: Record<ParticleKind, Sprite> = {
  heart: sprite(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#f27a93' }),
  spark: sprite(['.y.', 'ywy', '.y.']),
  z: sprite(['zzz', '..z', '.z.', 'zzz'], { z: '#f3eefc' }),
  drop: sprite(['u', 'u', 'U']),
  crumb: sprite(['t']),
  note: sprite(['..vv', '..v.', '..v.', 'vvv.', 'vv..'], { v: '#9a7cc4' }),
  bubble: sprite(['.qq.', 'qwqq', 'qqqq', '.qq.']),
  stink: sprite(['g.', '.g', 'g.', '.g'], { g: '#9bb56a' }),
  icon: sprite(['.']),
}

/** A little speech bubble with a pictogram, like the fox is chatting. */
export function chatBubble(icon: Sprite): Sprite {
  const w = Math.max(icon.w + 4, 9)
  const h = icon.h + 4
  const rows: string[] = []
  for (let y = 0; y < h + 2; y++) {
    let r = ''
    for (let x = 0; x < w; x++) {
      const edge = y === 0 || y === h - 1 || x === 0 || x === w - 1
      const corner = (y === 0 || y === h - 1) && (x === 0 || x === w - 1)
      if (y >= h) r += x === 2 && y === h ? 'o' : x === 1 && y === h + 1 ? 'o' : '.'
      else r += corner ? '.' : edge ? 'o' : 'w'
    }
    rows.push(r)
  }
  let s = sprite(rows)
  const data = s.data.slice()
  icon.data.forEach((c, i) => {
    if (c) data[(2 + Math.floor(i / icon.w)) * w + 2 + (i % icon.w)] = c
  })
  s = { ...s, data }
  return s
}

export function spawn(list: Particle[], kind: ParticleKind, x: number, y: number, t: number, n = 1) {
  for (let i = 0; i < n; i++) {
    list.push({
      kind,
      x: x + (Math.random() - 0.5) * (kind === 'drop' ? 12 : 8),
      y,
      vx: kind === 'z' ? 3 : kind === 'note' ? 4 : (Math.random() - 0.5) * (kind === 'crumb' ? 14 : 6),
      vy: kind === 'drop' ? 30 : kind === 'crumb' ? -8 : kind === 'icon' ? -5 : -8 - Math.random() * 6,
      born: t,
      life: kind === 'drop' ? 700 : kind === 'z' || kind === 'icon' ? 2200 : kind === 'stink' ? 1100 : 1400,
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
    const x = q.x + q.vx * s + (q.kind === 'z' || q.kind === 'stink' || q.kind === 'note' ? Math.sin(s * 3) * 2 : 0)
    const y = q.y + q.vy * s + (q.kind === 'crumb' ? 40 * s * s : 0)
    const fade = age > q.life * 0.7 ? 1 - (age - q.life * 0.7) / (q.life * 0.3) : 1
    p.sprite(q.art ?? PARTICLE_ART[q.kind], x, y, fade)
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
