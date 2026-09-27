import { ellipse, type Painter } from './painter.ts'
import { GIFT_ART } from './items.ts'
import { sprite } from './sprite.ts'

export const ROOM_W = 128
export const ROOM_H = 104

/** Where the sitting fox (42x32 sprite) is drawn. */
export const FOX_SPOT = { x: 47, y: 64 }
/** Where the curled fox (40x22 sprite) lies in its basket. */
export const BED_SPOT = { x: 2, y: 70 }
/** Where the curled fox sulks on the rug when it's down. */
export const RUG_SPOT = { x: 44, y: 72 }

export interface RoomOptions {
  hour: number // 0-24, fractional
  gifts: readonly string[]
  t: number // ms, for animation
  gloom: number // 0 (fine) .. 1 (depressed): greys out the room
}

type Sky = { bands: string[]; sun?: 'sun' | 'moon'; stars: boolean; clouds: string | null }

function skyFor(h: number): Sky {
  if (h >= 5 && h < 7) return { bands: ['#f3b7c6', '#f9cdbf', '#ffe0b8', '#fff0cf'], sun: 'sun', stars: false, clouds: '#fff6f0' }
  if (h >= 7 && h < 17) return { bands: ['#9fd3f0', '#b3dcf2', '#c7e6f4', '#dcf0f7'], sun: 'sun', stars: false, clouds: '#ffffff' }
  if (h >= 17 && h < 19) return { bands: ['#a58bd0', '#e79bb4', '#f7b39a', '#ffd18f'], sun: 'sun', stars: false, clouds: '#ffd9e0' }
  if (h >= 19 && h < 21) return { bands: ['#3f3a78', '#5d4f95', '#8a67a8', '#c587ad'], sun: 'moon', stars: true, clouds: null }
  return { bands: ['#1c1f4a', '#232a5c', '#2b3468', '#353f75'], sun: 'moon', stars: true, clouds: null }
}

export function isNight(h: number) {
  return h >= 21 || h < 6
}

const MOON = sprite(['.ooo.', 'oyyyo', 'oyyYo', 'oyyyo', '.ooo.'], { o: '#fff4c9' })
const SUN = sprite(['.yyy.', 'yyyyy', 'yyyyy', 'yyyyy', '.yyy.'])

function drawWindow(p: Painter, o: RoomOptions) {
  const X = 12
  const Y = 12
  const W = 30
  const H = 30
  const sky = skyFor(o.hour)
  const bandH = H / sky.bands.length
  sky.bands.forEach((c, i) => p.rect(X, Y + i * bandH, W, Math.ceil(bandH), c))
  // dither between bands
  for (let i = 1; i < sky.bands.length; i++)
    for (let x = 0; x < W; x += 2) p.rect(X + x + (i % 2), Y + i * bandH - 1, 1, 1, sky.bands[i])
  if (sky.stars) {
    const stars = [[4, 3], [20, 5], [9, 11], [25, 14], [14, 4], [3, 18], [22, 22], [11, 20]]
    stars.forEach(([sx, sy], i) => {
      const tw = Math.sin(o.t / 600 + i * 1.7) > -0.3
      if (tw) p.rect(X + sx, Y + sy, 1, 1, '#fff6d8')
    })
  }
  if (sky.sun === 'moon') p.sprite(MOON, X + 20, Y + 4)
  else if (sky.sun === 'sun') {
    const sy = o.hour < 12 ? Y + 14 - (o.hour - 5) : Y + 7 + (o.hour - 12)
    p.sprite(SUN, X + 5, Math.max(Y + 3, Math.min(Y + 20, sy)))
  }
  if (sky.clouds) {
    const drift = ((o.t / 1200) % (W + 16)) - 8
    for (const [cx, cy, s] of [[drift, 8, 1], [drift - 18, 17, 0]] as const) {
      const x0 = X + ((cx + W + 16) % (W + 16)) - 8
      for (const [dx, dy, w] of [[1, 0, 5], [0, 1, 8 + s * 2], [2, 2, 6]])
        for (let i = 0; i < w; i++) {
          const px = x0 + dx + i
          if (px >= X && px < X + W) p.rect(px, Y + cy + dy, 1, 1, sky.clouds)
        }
    }
  }
  // hills far away
  for (let x = 0; x < W; x++) {
    const hh = Math.round(3 + 2 * Math.sin(x / 5) + Math.sin(x / 2.3))
    p.rect(X + x, Y + H - hh, 1, hh, o.hour >= 19 || o.hour < 6 ? '#2f4a4a' : '#9cc48f')
  }
  // frame
  const F = '#fff7ec'
  const FO = '#c9a58a'
  p.rect(X - 3, Y - 3, W + 6, 3, F)
  p.rect(X - 3, Y + H, W + 6, 3, F)
  p.rect(X - 3, Y, 3, H, F)
  p.rect(X + W, Y, 3, H, F)
  p.rect(X + W / 2 - 1, Y, 2, H, F)
  p.rect(X, Y + H / 2 - 1, W, 2, F)
  p.rect(X - 4, Y - 4, W + 8, 1, FO)
  p.rect(X - 4, Y + H + 3, W + 8, 1, FO)
  p.rect(X - 4, Y - 4, 1, H + 8, FO)
  p.rect(X + W + 3, Y - 4, 1, H + 8, FO)
  // sill
  p.rect(X - 6, Y + H + 3, W + 12, 3, '#e9cbb0')
  p.rect(X - 6, Y + H + 6, W + 12, 1, '#b99478')
  // curtains
  const C = '#f5aebd'
  const CS = '#e48fa3'
  for (const [cx, dir] of [[X - 8, 1], [X + W + 2, -1]] as const) {
    for (let y = 0; y < 40; y++) {
      const sway = Math.round(Math.sin(y / 4 + o.t / 1500) * 0.6)
      const w = y < 26 ? 7 : 7 - Math.min(4, Math.floor((y - 26) / 3))
      const x0 = dir > 0 ? cx + sway : cx + 7 - w + sway
      p.rect(x0, Y - 6 + y, w, 1, C)
      p.rect(x0 + (dir > 0 ? w - 2 : 1), Y - 6 + y, 1, 1, CS)
    }
  }
  // tie-backs + rod
  p.rect(X - 9, Y + 20, 8, 2, '#f2d27a')
  p.rect(X + W + 1, Y + 20, 8, 2, '#f2d27a')
  p.rect(X - 11, Y - 7, W + 22, 2, '#9b6b4d')
  p.rect(X - 12, Y - 8, 3, 4, '#7b523d')
  p.rect(X + W + 9, Y - 8, 3, 4, '#7b523d')
}

function drawWallAndFloor(p: Painter) {
  // wallpaper
  p.rect(0, 0, ROOM_W, 68, '#f8e0d6')
  for (let x = 3; x < ROOM_W; x += 10) p.rect(x, 0, 2, 68, '#f3d3c7')
  for (let y = 6; y < 64; y += 10)
    for (let x = (y / 10) % 2 === 0 ? 8 : 13; x < ROOM_W; x += 10) p.rect(x, y, 1, 1, '#edc2b6')
  p.rect(0, 0, ROOM_W, 2, '#e9c3b4')
  // baseboard
  p.rect(0, 64, ROOM_W, 5, '#c4966f')
  p.rect(0, 64, ROOM_W, 1, '#a57a5a')
  // floor planks
  p.rect(0, 69, ROOM_W, ROOM_H - 69, '#e2b58a')
  for (let y = 69, row = 0; y < ROOM_H; y += 7, row++) {
    p.rect(0, y, ROOM_W, 1, '#cc9b70')
    for (let x = (row % 2) * 17 + 6; x < ROOM_W; x += 34) p.rect(x, y + 1, 1, 6, '#d4a67c')
  }
}

const BASKET_BLANKET = '#fff0e3'

function drawBed(p: Painter) {
  ellipse(p, 21, 88, 19, 8, '#4a2a22')
  ellipse(p, 21, 88, 18, 7, '#c48a58')
  ellipse(p, 21, 86, 15, 4, '#9e6a42')
  ellipse(p, 21, 86, 14, 3, BASKET_BLANKET)
  // weave
  for (let x = 5; x < 38; x += 3) p.rect(x, 91, 1, 2, '#a8703f')
}

function drawRug(p: Painter, heart: boolean) {
  const [edge, base, inner] = heart ? ['#e27f98', '#f7b6c6', '#fbd3dd'] : ['#8fb482', '#b9d3a8', '#cfe2c1']
  ellipse(p, 66, 91, 34, 9, edge)
  ellipse(p, 66, 91, 32, 8, base)
  ellipse(p, 66, 91, 24, 5, inner)
  if (heart) {
    const H = sprite(['.mm.mm.', 'mmmmmmm', '.mmmmm.', '..mmm..', '...m...'], { m: '#e27f98' })
    p.sprite(H, 63, 89)
  } else {
    for (let x = 36; x < 96; x += 4) p.rect(x, 91, 2, 1, base)
  }
}

function drawShelf(p: Painter) {
  p.rect(80, 37, 40, 3, '#a57a5a')
  p.rect(80, 40, 40, 1, '#7b523d')
  p.rect(84, 41, 2, 4, '#7b523d')
  p.rect(114, 41, 2, 4, '#7b523d')
}

function drawFairyLights(p: Painter, t: number) {
  const colors = ['#ffd76e', '#f59aa6', '#9dcdee', '#c7a8e8', '#b6e0a0']
  for (let x = 0; x < ROOM_W; x++) {
    const y = 4 + Math.round(3 * Math.abs(Math.sin((x / ROOM_W) * Math.PI * 3)))
    p.rect(x, y, 1, 1, '#6b5a4f')
    if (x % 8 === 4) {
      const i = Math.floor(x / 8)
      const on = Math.sin(t / 400 + i) > -0.6
      p.rect(x, y + 1, 2, 2, on ? colors[i % colors.length] : '#d9c3b0')
    }
  }
}

/** Glowing light sources, drawn after the night tint. */
export function drawGlows(p: Painter, o: RoomOptions) {
  const dark = isNight(o.hour) ? 1 : o.hour >= 19 ? 0.6 : 0
  if (!dark) return
  if (o.gifts.includes('mushroomLamp')) {
    ellipse(p, 102, 30, 16, 12, '#ffd9a0', 0.12 * dark)
    ellipse(p, 102, 30, 9, 7, '#ffe6b8', 0.15 * dark)
  }
  if (o.gifts.includes('fairyLights')) for (let x = 4; x < ROOM_W; x += 8) ellipse(p, x, 8, 3, 3, '#fff0c0', 0.12 * dark)
  // window moonlight
  p.rect(12, 12, 30, 30, '#c9d6ff', 0.06 * dark)
}

export function drawRoom(p: Painter, o: RoomOptions) {
  const has = (id: string) => o.gifts.includes(id)
  drawWallAndFloor(p)
  drawWindow(p, o)
  drawShelf(p)
  if (has('painting')) p.sprite(GIFT_ART.painting, 92, 12)
  if (has('fairyLights')) drawFairyLights(p, o.t)
  if (has('books')) p.sprite(GIFT_ART.books, 83, 27)
  if (has('mushroomLamp')) p.sprite(GIFT_ART.mushroomLamp, 97, 26)
  if (has('snowGlobe')) p.sprite(GIFT_ART.snowGlobe, 109, 26)
  if (has('cactus')) p.sprite(GIFT_ART.cactus, 23, 34)
  if (has('plant')) p.sprite(GIFT_ART.plant, 108, 58)
  drawRug(p, has('heartRug'))
  drawBed(p)
  if (has('teddy')) p.sprite(GIFT_ART.teddy, 34, 66)
  if (has('cushion')) p.sprite(GIFT_ART.cushion, 100, 88)
  if (has('yarn')) p.sprite(GIFT_ART.yarn, 88, 93)
}

/** Time-of-day tint + gloom. Draw after the fox so everything shares the light. */
export function drawAtmosphere(p: Painter, o: RoomOptions) {
  const h = o.hour
  if (isNight(h)) p.rect(0, 0, ROOM_W, ROOM_H, '#1b2150', 0.34)
  else if (h >= 19) p.rect(0, 0, ROOM_W, ROOM_H, '#3a2a5c', 0.25)
  else if (h >= 17) p.rect(0, 0, ROOM_W, ROOM_H, '#ff9a5a', 0.1)
  else if (h < 7) p.rect(0, 0, ROOM_W, ROOM_H, '#ffb0c0', 0.08)
  if (o.gloom > 0) p.rect(0, 0, ROOM_W, ROOM_H, '#5e6378', 0.35 * o.gloom)
  drawGlows(p, o)
}

export { BASKET_BLANKET }
