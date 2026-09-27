// Renders the app icons (public/icons/*.png) from the fox sprite.
// Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { Raster } from './png.ts'
import { foxSitting } from '../src/art/fox.ts'
import type { Sprite } from '../src/art/sprite.ts'

const out = new URL('../public/icons/', import.meta.url)
mkdirSync(out, { recursive: true })

// Crop the head (ears to chin) out of the sitting fox, with happy eyes.
function head(): Sprite {
  const s = foxSitting('happy', 0)
  const w = 32
  const h = 19
  const data: (string | null)[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.push(s.data[y * s.w + x])
  // close the chin with an outline row (in the full sprite it flows into the chest)
  const outline = s.data[1 * s.w + 4]
  for (let x = 0; x < w; x++) data.push(data[(h - 1) * w + x] ? outline : null)
  return { w, h: h + 1, data }
}

function icon(size: number, scale: number, bg: string, pattern: boolean) {
  const r = new Raster(size, size, bg)
  if (pattern) {
    const step = Math.max(8, Math.round(size / 12))
    const dot = Math.max(2, Math.round(size / 96))
    for (let y = step / 2; y < size; y += step)
      for (let x = ((y / step) % 2) * (step / 2); x < size; x += step) r.fill(Math.round(x), Math.round(y), dot, dot, '#fbc7d2')
  }
  const s = head()
  const x = Math.round((size - s.w * scale) / 2)
  const y = Math.round((size - s.h * scale) / 2 + scale)
  r.sprite(s, x, y, scale)
  return r.png()
}

const BG = '#fde0e7'
writeFileSync(new URL('icon-512.png', out), icon(512, 13, BG, true))
writeFileSync(new URL('icon-192.png', out), icon(192, 5, BG, true))
writeFileSync(new URL('icon-maskable-512.png', out), icon(512, 9, BG, true))
writeFileSync(new URL('apple-touch-icon.png', out), icon(180, 5, BG, true))
writeFileSync(new URL('favicon.png', out), icon(64, 2, BG, false))
console.log('icons written to public/icons/')
