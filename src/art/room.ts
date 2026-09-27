import { ellipse, type Painter } from './painter.ts'
import { GIFT_ART, LAW_ART, ROOM_ART, SPECIAL_ART } from './items.ts'
import { sprite, type Sprite } from './sprite.ts'
import type { Season } from '../game/time.ts'

/** The whole room is wider than the screen; the camera pans across it. */
export const ROOM_W = 208
export const VIEW_W = 128
export const ROOM_H = 104

/** Top of the sitting/walking fox sprites, so their feet land on the floor. */
export const FOX_Y = 64
/** Where the sitting fox (42x32 sprite) is drawn in the living room. */
export const FOX_SPOT = { x: 47, y: FOX_Y }
/** Where the curled fox (40x22 sprite) lies in its basket. */
export const BED_SPOT = { x: 2, y: 70 }
/** Where the curled fox sulks on the rug when it's down. */
export const RUG_SPOT = { x: 44, y: 72 }

// Furniture positions (top-left of each sprite).
export const DESK = { x: 132, y: 57 }
export const TUB = { x: 176, y: 60 }
export const BOWL = { x: 186, y: 90 }
export const BALL = { x: 118, y: 95 }
export const CLOCK = { x: 186, y: 12 }

/**
 * Places the fox can go. `x` is the centre of the fox's head on the floor.
 * Hit boxes (for tapping furniture) are in room coordinates.
 */
export const SPOTS = {
  rug: { x: 63 },
  window: { x: 27 },
  teddy: { x: 52 },
  yarn: { x: 102 },
  ball: { x: 110 },
  cushion: { x: 109 },
  desk: { x: 152 },
  bowl: { x: 177 },
  tub: { x: 191 },
  bed: { x: 20 },
}

export interface Decor {
  wall: string
  floor: string
}

export interface RoomOptions {
  hour: number // 0-24, fractional
  gifts: readonly string[]
  t: number // ms, for animation
  gloom: number // 0 (fine) .. 1 (depressed): greys out the room
  decor?: Decor
  /** Career-unlocked law decor (diploma, gavel, scales). */
  law?: readonly string[]
  /** Food portions in the bowl (0-3). */
  bowl?: number
  /** Objects the fox is currently holding/playing with (drawn by the scene instead). */
  hide?: readonly string[]
  season?: Season
  october?: boolean
  birthday?: boolean
  /** Her photo, pixelated, for the frame on the study wall. */
  photo?: Sprite | null
}

export const PHOTO_SPOT = { x: 158, y: 13 }
export const CAKE_SPOT = { x: 84, y: 84 }

type Wallpaper = { name: string; base: string; a: string; b?: string; kind: 'stripes' | 'gingham' | 'hearts' | 'dots' | 'pinstripe' | 'damask'; trim: string }
type Floor = { name: string; a: string; b: string; c: string; kind: 'planks' | 'checker' | 'carpet' }

export const WALLPAPERS: Record<string, Wallpaper> = {
  stripes: { name: 'strawberry milk', base: '#f8e0d6', a: '#f3d3c7', b: '#edc2b6', kind: 'stripes', trim: '#c4966f' },
  hearts: { name: 'butter hearts', base: '#fff2cf', a: '#f7c3cc', kind: 'hearts', trim: '#d9a86a' },
  gingham: { name: 'mint gingham', base: '#e6f2e2', a: '#d2e7cd', b: '#bfdcb9', kind: 'gingham', trim: '#9dbb8f' },
  dots: { name: 'lavender dots', base: '#eee4f9', a: '#d9c7f1', kind: 'dots', trim: '#a996c9' },
  library: { name: 'law library', base: '#3f5c4a', a: '#486a55', b: '#c9a45a', kind: 'pinstripe', trim: '#6b4a33' },
  damask: { name: 'justice gold', base: '#f7eed8', a: '#e8d19b', b: '#d9b86c', kind: 'damask', trim: '#a57a3a' },
}

export const FLOORS: Record<string, Floor> = {
  honey: { name: 'honey wood', a: '#e2b58a', b: '#cc9b70', c: '#d4a67c', kind: 'planks' },
  walnut: { name: 'walnut', a: '#a27353', b: '#855a3e', c: '#93664a', kind: 'planks' },
  checker: { name: 'milk checker', a: '#fff4e6', b: '#f6c9d2', c: '#ead9c8', kind: 'checker' },
  carpet: { name: 'cloud carpet', a: '#dccfee', b: '#cdbfe3', c: '#e8def5', kind: 'carpet' },
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
  // hills far away, dressed for the season
  const night = o.hour >= 19 || o.hour < 6
  const hill = { winter: night ? '#8e97b0' : '#f3f6fb', spring: night ? '#2f4a4a' : '#a9d39a', summer: night ? '#2f4a4a' : '#8cc47f', autumn: night ? '#4a3f33' : '#d9a066' }[o.season ?? 'summer']
  for (let x = 0; x < W; x++) {
    const hh = Math.round(3 + 2 * Math.sin(x / 5) + Math.sin(x / 2.3))
    p.rect(X + x, Y + H - hh, 1, hh, hill)
    if (o.season === 'spring' && !night && x % 5 === 2) p.rect(X + x, Y + H - hh, 1, 1, '#f7b6c6')
  }
  drawWeather(p, o, X, Y, W, H)
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

export /** Snow, blossom petals, falling leaves or fireflies drifting past the window. */
function drawWeather(p: Painter, o: RoomOptions, X: number, Y: number, W: number, H: number) {
  const night = isNight(o.hour)
  const kind = o.season === 'winter' ? 'snow' : o.season === 'spring' ? 'petal' : o.season === 'autumn' ? 'leaf' : night ? 'firefly' : null
  if (!kind) return
  const n = kind === 'snow' ? 14 : kind === 'firefly' ? 6 : 7
  const colours = { snow: ['#ffffff'], petal: ['#f7b6c6', '#fbd3dd'], leaf: ['#e8844f', '#d95b43', '#e5ab3d'], firefly: ['#fff3a0'] }[kind]
  for (let i = 0; i < n; i++) {
    let x: number
    let y: number
    if (kind === 'firefly') {
      if (Math.sin(o.t / 400 + i * 2.1) < 0.2) continue
      x = X + ((i * 9 + Math.sin(o.t / 1700 + i) * 6 + 40) % W)
      y = Y + H - 6 - ((i * 5 + Math.cos(o.t / 1300 + i) * 3 + 12) % 12)
    } else {
      const speed = kind === 'snow' ? 90 : 70
      y = Y - 2 + ((o.t / speed + i * 13) % (H + 4))
      x = X + ((i * 11 + Math.sin(o.t / 700 + i) * 2 + (kind === 'snow' ? 0 : o.t / 180)) % W)
    }
    x = Math.round(x)
    y = Math.round(y)
    if (x >= X && x < X + W && y >= Y && y < Y + H) p.rect(x, y, 1, 1, colours[i % colours.length])
  }
}

export function drawWallAndFloor(p: Painter, decor: Decor) {
  const w = WALLPAPERS[decor.wall] ?? WALLPAPERS.stripes
  const f = FLOORS[decor.floor] ?? FLOORS.honey
  p.rect(0, 0, ROOM_W, 68, w.base)
  switch (w.kind) {
    case 'stripes':
      for (let x = 3; x < ROOM_W; x += 10) p.rect(x, 0, 2, 68, w.a)
      for (let y = 6; y < 64; y += 10)
        for (let x = (y / 10) % 2 === 0 ? 8 : 13; x < ROOM_W; x += 10) p.rect(x, y, 1, 1, w.b!)
      break
    case 'gingham':
      for (let x = 0; x < ROOM_W; x += 8) p.rect(x, 0, 4, 68, w.a)
      for (let y = 0; y < 68; y += 8) p.rect(0, y, ROOM_W, 4, w.a)
      for (let y = 0; y < 68; y += 8) for (let x = 0; x < ROOM_W; x += 8) p.rect(x, y, 4, 4, w.b!)
      break
    case 'hearts': {
      const H = sprite(['a.a', 'aaa', '.a.'], { a: w.a })
      for (let y = 5, r = 0; y < 62; y += 11, r++) for (let x = r % 2 ? 9 : 3; x < ROOM_W; x += 12) p.sprite(H, x, y)
      break
    }
    case 'dots':
      for (let y = 4, r = 0; y < 64; y += 8, r++) for (let x = r % 2 ? 6 : 2; x < ROOM_W; x += 8) p.rect(x, y, 2, 2, w.a)
      break
    case 'pinstripe':
      for (let x = 2; x < ROOM_W; x += 6) p.rect(x, 0, 1, 68, w.a)
      p.rect(0, 40, ROOM_W, 1, w.b!)
      p.rect(0, 42, ROOM_W, 22, w.a)
      break
    case 'damask': {
      const D = sprite(['..a..', '.aba.', 'ab.ba', '.aba.', '..a..'], { a: w.a, b: w.b! })
      for (let y = 3, r = 0; y < 60; y += 10, r++) for (let x = r % 2 ? 7 : 1; x < ROOM_W; x += 12) p.sprite(D, x, y)
      break
    }
  }
  p.rect(0, 0, ROOM_W, 2, w.trim)
  // baseboard
  p.rect(0, 64, ROOM_W, 5, w.trim)
  p.rect(0, 64, ROOM_W, 1, '#8a6a55')
  // floor
  p.rect(0, 69, ROOM_W, ROOM_H - 69, f.a)
  if (f.kind === 'planks') {
    for (let y = 69, row = 0; y < ROOM_H; y += 7, row++) {
      p.rect(0, y, ROOM_W, 1, f.b)
      for (let x = (row % 2) * 17 + 6; x < ROOM_W; x += 34) p.rect(x, y + 1, 1, 6, f.c)
    }
  } else if (f.kind === 'checker') {
    for (let y = 69, r = 0; y < ROOM_H; y += 6, r++) for (let x = (r % 2) * 8; x < ROOM_W; x += 16) p.rect(x, y, 8, 6, f.b)
    p.rect(0, 69, ROOM_W, 1, f.c)
  } else {
    for (let y = 71; y < ROOM_H; y += 3) for (let x = (y % 2) * 2; x < ROOM_W; x += 5) p.rect(x, y, 1, 1, f.b)
    for (let y = 72; y < ROOM_H; y += 6) for (let x = (y % 4) + 3; x < ROOM_W; x += 11) p.rect(x, y, 1, 1, f.c)
  }
}

function drawClock(p: Painter) {
  const { x, y } = CLOCK
  ellipse(p, x + 6, y + 6, 7, 7, '#7b523d')
  ellipse(p, x + 6, y + 6, 6, 6, '#fffaf0')
  for (const [dx, dy] of [[6, 1], [11, 6], [6, 11], [1, 6]]) p.rect(x + dx, y + dy, 1, 1, '#9b7667')
  const d = new Date()
  const hand = (turns: number, len: number, col: string) => {
    const a = turns * Math.PI * 2 - Math.PI / 2
    for (let i = 0; i <= len; i++) p.rect(Math.round(x + 6 + Math.cos(a) * i), Math.round(y + 6 + Math.sin(a) * i), 1, 1, col)
  }
  hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12, 3, '#4a2a22')
  hand(d.getMinutes() / 60, 5, '#e4819a')
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
  if (o.october) ellipse(p, 38, 40, 9, 6, '#ffb36b', 0.18 * dark)
  // banker's lamp on the desk
  ellipse(p, DESK.x + 33, DESK.y - 4, 20, 13, '#ffe3a0', 0.11 * dark)
  ellipse(p, DESK.x + 33, DESK.y - 4, 10, 7, '#fff0c0', 0.13 * dark)
  // window moonlight
  p.rect(12, 12, 30, 30, '#c9d6ff', 0.06 * dark)
}

export function drawRoom(p: Painter, o: RoomOptions) {
  const has = (id: string) => o.gifts.includes(id)
  const law = (id: string) => o.law?.includes(id) ?? false
  drawWallAndFloor(p, o.decor ?? { wall: 'stripes', floor: 'honey' })
  drawWindow(p, o)
  drawShelf(p)
  if (has('painting')) p.sprite(GIFT_ART.painting, 92, 12)
  if (has('fairyLights')) drawFairyLights(p, o.t)
  if (has('books')) p.sprite(GIFT_ART.books, 83, 27)
  if (has('mushroomLamp')) p.sprite(GIFT_ART.mushroomLamp, 97, 26)
  if (has('snowGlobe')) p.sprite(GIFT_ART.snowGlobe, 109, 26)
  if (has('cactus')) p.sprite(GIFT_ART.cactus, 23, 34)
  if (o.october) p.sprite(SPECIAL_ART.jackOLantern, 33, 36)
  if (o.photo) {
    const { x, y } = PHOTO_SPOT
    const w = o.photo.w + 4
    const h = o.photo.h + 4
    p.rect(x, y, w, h, '#4a2a22')
    p.rect(x + 1, y + 1, w - 2, h - 2, '#c48a58')
    p.rect(x + 2, y + 2, w - 4, h - 4, '#4a2a22')
    p.sprite(o.photo, x + 2, y + 2)
    p.rect(x + w / 2 - 1, y - 3, 2, 3, '#7b523d') // the nail it hangs from
  }
  if (has('plant')) p.sprite(GIFT_ART.plant, 108, 58)
  // study + bath corner
  if (law('diploma')) p.sprite(LAW_ART.diploma, 140, 18)
  drawClock(p)
  p.sprite(ROOM_ART.desk, DESK.x, DESK.y)
  p.sprite(ROOM_ART.casebooks, DESK.x + 3, DESK.y - 10)
  if (law('scales')) p.sprite(LAW_ART.scales, DESK.x + 16, DESK.y - 11)
  if (law('gavel')) p.sprite(LAW_ART.gavel, DESK.x + 4, DESK.y - 7)
  p.sprite(ROOM_ART.lamp, DESK.x + 28, DESK.y - 11)
  p.sprite(ROOM_ART.tub, TUB.x, TUB.y)
  drawRug(p, has('heartRug'))
  drawBed(p)
  if (has('teddy')) p.sprite(GIFT_ART.teddy, 34, 66)
  if (has('cushion')) p.sprite(GIFT_ART.cushion, 100, 88)
  const hidden = (id: string) => o.hide?.includes(id) ?? false
  if (has('yarn') && !hidden('yarn')) p.sprite(GIFT_ART.yarn, 88, 93)
  if (!hidden('ball')) p.sprite(ROOM_ART.ball, BALL.x, BALL.y)
  p.sprite((o.bowl ?? 0) > 0 ? ROOM_ART.bowlFull : ROOM_ART.bowlEmpty, BOWL.x, BOWL.y)
  if (o.birthday) {
    p.sprite(SPECIAL_ART.cake, CAKE_SPOT.x, CAKE_SPOT.y)
    for (const [i, cx] of [CAKE_SPOT.x + 3, CAKE_SPOT.x + 6, CAKE_SPOT.x + 9].entries())
      p.rect(cx, CAKE_SPOT.y - (Math.sin(o.t / 120 + i) > 0 ? 1 : 0), 1, 1, '#fff3a0')
  }
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
