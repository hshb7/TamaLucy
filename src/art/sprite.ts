import { PALETTE } from './palette.ts'

export interface Sprite {
  w: number
  h: number
  /** Row-major colour per pixel; null is transparent. */
  data: (string | null)[]
}

/** Build a sprite from a text grid. '.' and ' ' are transparent. */
export function sprite(rows: string[], extra: Record<string, string> = {}): Sprite {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  if (rows.some((r) => r.length !== w)) console.warn('ragged sprite rows:', rows.map((r) => r.length).join(','), rows[0])
  const data: (string | null)[] = []
  for (const row of rows) {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.'
      if (ch === '.' || ch === ' ') data.push(null)
      else {
        const col = extra[ch] ?? PALETTE[ch]
        if (!col) throw new Error(`Unknown palette char "${ch}"`)
        data.push(col)
      }
    }
  }
  return { w, h, data }
}

/** Mirror a left-half grid into a symmetric full grid. */
export function mirror(rows: string[]): string[] {
  return rows.map((r) => r + [...r].reverse().join(''))
}

/** Paint `top` over `base` at (dx, dy), growing nothing: pixels outside are dropped. */
export function stamp(base: Sprite, top: Sprite, dx: number, dy: number): Sprite {
  const data = base.data.slice()
  for (let y = 0; y < top.h; y++) {
    for (let x = 0; x < top.w; x++) {
      const c = top.data[y * top.w + x]
      const bx = x + dx
      const by = y + dy
      if (!c || bx < 0 || by < 0 || bx >= base.w || by >= base.h) continue
      data[by * base.w + bx] = c
    }
  }
  return { w: base.w, h: base.h, data }
}

/** Empty sprite of a given size. */
export function blank(w: number, h: number): Sprite {
  return { w, h, data: new Array(w * h).fill(null) }
}

export function flipX(s: Sprite): Sprite {
  const data: (string | null)[] = []
  for (let y = 0; y < s.h; y++) for (let x = s.w - 1; x >= 0; x--) data.push(s.data[y * s.w + x])
  return { w: s.w, h: s.h, data }
}
