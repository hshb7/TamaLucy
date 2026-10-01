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
  return iconRaster(size, scale, bg, pattern).png()
}

function iconRaster(size: number, scale: number, bg: string, pattern: boolean) {
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
  return r
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

// ─── the Mac app (ios/Mac) ──────────────────────────────────────────────────
// Mac icons are a rounded square with a margin around it (Apple's 1024 grid: an
// 824px square, corner radius ~185), and come in sizes from 16 to 1024 px.
function macIcon(): Raster {
  const size = 1024
  const inner = 824
  const off = (size - inner) / 2
  const radius = 185
  const art = iconRaster(inner, 18, BG, true)
  const r = new Raster(size, size)
  for (let y = 0; y < inner; y++)
    for (let x = 0; x < inner; x++) {
      const cx = Math.max(radius - x, 0, x - (inner - 1 - radius))
      const cy = Math.max(radius - y, 0, y - (inner - 1 - radius))
      if (cx * cx + cy * cy > radius * radius) continue
      const i = (y * inner + x) * 4
      const j = ((y + off) * size + x + off) * 4
      for (let k = 0; k < 4; k++) r.data[j + k] = art.data[i + k]
    }
  return r
}
/** Shrink by averaging (with alpha), for the small icon sizes. */
function shrink(src: Raster, size: number): Raster {
  const r = new Raster(size, size)
  const f = src.w / size
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let a = 0
      const c = [0, 0, 0]
      for (let sy = Math.floor(y * f); sy < Math.floor((y + 1) * f); sy++)
        for (let sx = Math.floor(x * f); sx < Math.floor((x + 1) * f); sx++) {
          const i = (sy * src.w + sx) * 4
          const al = src.data[i + 3] / 255
          a += al
          for (let k = 0; k < 3; k++) c[k] += src.data[i + k] * al
        }
      const n = Math.floor(f) * Math.floor(f)
      const j = (y * size + x) * 4
      if (a > 0) for (let k = 0; k < 3; k++) r.data[j + k] = Math.round(c[k] / a)
      r.data[j + 3] = Math.round((a / n) * 255)
    }
  return r
}
const master = macIcon()
const macSet = new URL('Mac/Assets.xcassets/AppIcon.appiconset/', ios)
catalog(new URL('Mac/Assets.xcassets/', ios))
mkdirSync(macSet, { recursive: true })
const macImages: object[] = []
for (const pt of [16, 32, 128, 256, 512])
  for (const scale of [1, 2]) {
    const px = pt * scale
    const file = `icon-${px}.png`
    writeFileSync(new URL(file, macSet), (px === 1024 ? master : shrink(master, px)).png())
    macImages.push({ filename: file, idiom: 'mac', scale: `${scale}x`, size: `${pt}x${pt}` })
  }
writeFileSync(new URL('Contents.json', macSet), JSON.stringify({ images: macImages, info: { author: 'xcode', version: 1 } }, null, 2) + '\n')
// the fox in the menu bar: pixel-exact at 1x and 2x
const menuSet = new URL('Shared/Fox.xcassets/FoxMenu.imageset/', ios)
mkdirSync(menuSet, { recursive: true })
const menuFox = head('open')
for (const scale of [1, 2]) {
  const r = new Raster(menuFox.w * scale, menuFox.h * scale)
  r.sprite(menuFox, 0, 0, scale)
  writeFileSync(new URL(`fox-menu@${scale}x.png`, menuSet), r.png())
}
writeFileSync(
  new URL('Contents.json', menuSet),
  JSON.stringify({ images: [1, 2].map((scale) => ({ filename: `fox-menu@${scale}x.png`, idiom: 'universal', scale: `${scale}x` })), info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
)
console.log('Mac app icon and menu bar fox written to ios/')
