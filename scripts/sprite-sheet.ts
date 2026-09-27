// Dev helper: renders every sprite (fox faces, outfits, items) and a few room
// scenes into one PNG so you can eyeball pixel-art edits without the browser.
//   node scripts/sprite-sheet.ts sprites.png
import { writeFileSync } from 'node:fs'
import { Raster } from './png.ts'
import { foxCurled, foxSitting, type Face } from '../src/art/fox.ts'
import { CLOTHING_ART } from '../src/art/clothes.ts'
import { GIFT_ART, ICON_ART, SOUVENIR_ART, TREAT_ART } from '../src/art/items.ts'
import { BED_SPOT, FOX_SPOT, ROOM_H, ROOM_W, drawAtmosphere, drawRoom } from '../src/art/room.ts'
import { blank, stamp, type Sprite } from '../src/art/sprite.ts'
import type { Painter } from '../src/art/painter.ts'

const out = process.argv[2] ?? 'sprites.png'
const S = 4 // pixels per art pixel
const PAD = 4

function dressed(id: string): Sprite {
  const c = CLOTHING_ART[id]
  let s = blank(42, 38)
  s = stamp(s, foxSitting('open'), 0, 6)
  return stamp(s, c.sprite, c.x, c.y + 6)
}

const faces: Face[] = ['open', 'blink', 'happy', 'sad', 'eat', 'shock', 'love']
const rows: Sprite[][] = [
  [...faces.map((f) => foxSitting(f)), foxCurled('sleep'), foxCurled('sad')],
  Object.keys(CLOTHING_ART).map(dressed),
  [...Object.values(TREAT_ART), ...Object.values(SOUVENIR_ART)],
  [...Object.values(GIFT_ART), ...Object.values(ICON_ART)],
]

const scenes = [
  { hour: 10, gifts: [] as string[], gloom: 0, sleep: false },
  { hour: 18, gifts: Object.keys(GIFT_ART), gloom: 0, sleep: false },
  { hour: 23, gifts: Object.keys(GIFT_ART), gloom: 0, sleep: true },
  { hour: 14, gifts: [], gloom: 1, sleep: false },
]

const rowW = (r: Sprite[]) => r.reduce((w, s) => w + s.w + PAD, PAD)
const width = Math.max(...rows.map(rowW), 2 * (ROOM_W + PAD) + PAD) * S
const height = (rows.reduce((h, r) => h + Math.max(...r.map((s) => s.h)) + PAD, PAD) + 2 * (ROOM_H + PAD)) * S
const img = new Raster(width, height, '#fbe7d6')

let y = PAD
for (const r of rows) {
  let x = PAD
  for (const s of r) {
    img.sprite(s, x * S, y * S, S)
    x += s.w + PAD
  }
  y += Math.max(...r.map((s) => s.h)) + PAD
}

scenes.forEach((sc, i) => {
  const ox = (PAD + (i % 2) * (ROOM_W + PAD)) * S
  const oy = (y + Math.floor(i / 2) * (ROOM_H + PAD)) * S
  const p: Painter = {
    rect(rx, ry, w, h, c, a = 1) {
      const x0 = Math.max(0, Math.round(rx))
      const y0 = Math.max(0, Math.round(ry))
      const x1 = Math.min(ROOM_W, Math.round(rx) + w)
      const y1 = Math.min(ROOM_H, Math.round(ry) + h)
      if (x1 > x0 && y1 > y0) img.fill(ox + x0 * S, oy + y0 * S, (x1 - x0) * S, (y1 - y0) * S, c, a)
    },
    sprite(s, sx, sy) {
      for (let yy = 0; yy < s.h; yy++)
        for (let xx = 0; xx < s.w; xx++) {
          const c = s.data[yy * s.w + xx]
          if (c) p.rect(sx + xx, sy + yy, 1, 1, c)
        }
    },
  }
  const o = { hour: sc.hour, gifts: sc.gifts, t: 0, gloom: sc.gloom }
  drawRoom(p, o)
  if (sc.sleep) p.sprite(foxCurled('sleep'), BED_SPOT.x, BED_SPOT.y)
  else p.sprite(foxSitting(sc.gloom ? 'sad' : 'open'), FOX_SPOT.x, FOX_SPOT.y)
  drawAtmosphere(p, o)
})

writeFileSync(out, img.png())
console.log('wrote', out)
