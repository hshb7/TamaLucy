// Renders the app icons (public/icons/*.png) from the fox sprite, plus the
// iPhone app's icon and the little fox heads for the Dynamic Island and the
// blocked-app screen (ios/).
// Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { Raster } from './png.ts'
import { foxSitting, type Face } from '../src/art/fox.ts'
import type { Sprite } from '../src/art/sprite.ts'

const out = new URL('../public/icons/', import.meta.url)
mkdirSync(out, { recursive: true })

// Crop the head (ears to chin) out of the sitting fox.
function head(face: Face = 'happy'): Sprite {
  const s = foxSitting(face, 0)
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

// ─── the iPhone app (ios/) ──────────────────────────────────────────────────
const ios = new URL('../ios/', import.meta.url)
const imageset = (dir: URL, file: string, png: Buffer, idiom = 'universal') => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL(file, dir), png)
  const images = idiom === 'icon' ? [{ filename: file, idiom: 'universal', platform: 'ios', size: '1024x1024' }] : [{ filename: file, idiom: 'universal' }]
  writeFileSync(new URL('Contents.json', dir), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n')
}
const catalog = (dir: URL) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('Contents.json', dir), JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n')
}
// app icon: one 1024px image, iOS makes the rest (no transparency allowed)
catalog(new URL('App/Assets.xcassets/', ios))
imageset(new URL('App/Assets.xcassets/AppIcon.appiconset/', ios), 'icon-1024.png', icon(1024, 26, BG, true), 'icon')
// fox heads on a transparent background, shown with pixel-sharp scaling
const foxHead = (face: Face) => {
  const s = head(face)
  const r = new Raster(s.w * 8, s.h * 8)
  r.sprite(s, 0, 0, 8)
  return r.png()
}
catalog(new URL('Shared/Fox.xcassets/', ios))
imageset(new URL('Shared/Fox.xcassets/FoxStudy.imageset/', ios), 'fox-study.png', foxHead('open'))
imageset(new URL('Shared/Fox.xcassets/FoxHappy.imageset/', ios), 'fox-happy.png', foxHead('happy'))
console.log('iPhone app icon and fox images written to ios/')
