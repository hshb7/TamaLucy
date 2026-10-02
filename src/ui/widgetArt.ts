// The pictures for her iPhone widget: the fox (in her outfit and the pose she
// picked) in front of the wallpaper or colour she chose. The app draws them here
// so the widget looks exactly like the game; the iPhone adds the words on top.
import { SPECIAL_ART } from '../art/items.ts'
import { canvasPainter, ellipse, type Painter } from '../art/painter.ts'
import { drawWallAndFloor } from '../art/room.ts'
import { sprite } from '../art/sprite.ts'
import type { Face } from '../art/fox.ts'
import { WIDGET_BACKGROUNDS } from '../game/widget.ts'
import { foxMood } from '../game/needs.ts'
import type { GameState, WidgetPose } from '../game/state.ts'
import { drawFox } from './foxDraw.ts'

/** Sizes in art pixels; about 3 points each on the phone. */
export const WIDGET_SIZES = { small: { w: 56, h: 56 }, medium: { w: 120, h: 56 } } as const
export type WidgetSize = keyof typeof WIDGET_SIZES

/** Where the floor starts, in widget pixels (the fox sits in front of it). */
const FLOOR_Y = 44

const Z = sprite(['ooo', '..o', '.o.', 'o..', 'ooo'], { o: '#9a7cc4' })

const shiftY = (p: Painter, dy: number): Painter => ({
  rect: (x, y, w, h, c, a) => p.rect(x, y - dy, w, h, c, a),
  sprite: (s, x, y, a) => p.sprite(s, x, y - dy, a),
})

function faceFor(s: GameState): Face {
  const mood = foxMood(s)
  return mood === 'joyful' ? 'happy' : mood === 'sad' || mood === 'depressed' ? 'sad' : 'open'
}

/** Just the fox (and its book or blanket), with its feet/bottom at y = bottom. */
export function drawWidgetFox(p: Painter, s: GameState, pose: WidgetPose, x: number, bottom: number, face?: Face) {
  if (pose === 'nap') {
    drawFox(p, x + 1, bottom - 22, { pose: 'curl', face: 'sleep', tail: 0, equipped: s.equipped })
    p.sprite(Z, x + 33, bottom - 25)
    p.sprite(Z, x + 37, bottom - 30)
    return
  }
  drawFox(p, x, bottom - 32, { pose: 'sit', face: face ?? faceFor(s), tail: 0, equipped: s.equipped })
  if (pose === 'study') p.sprite(SPECIAL_ART.openBook, x + 12, bottom - 6)
}

/** The whole widget picture, minus the words. */
export function drawWidgetScene(p: Painter, s: GameState, size: WidgetSize) {
  const { w, h } = WIDGET_SIZES[size]
  const bg = WIDGET_BACKGROUNDS[s.widget.bg] ?? WIDGET_BACKGROUNDS.stripes
  const foxX = size === 'small' ? 7 : 6
  if (bg.wall) {
    // a slice of her room: the wallpaper down to the floor
    drawWallAndFloor(shiftY(p, 69 - FLOOR_Y), { wall: bg.wall, floor: s.decor.floor })
    ellipse(p, foxX + 21, h - 4, 22, 4, '#8fb482')
    ellipse(p, foxX + 21, h - 4, 21, 3, '#b9d3a8')
  } else {
    p.rect(0, 0, w, h, bg.color!)
    for (let y = 3, r = 0; y < h; y += 7, r++) for (let x = r % 2 ? 6 : 2; x < w; x += 8) p.rect(x, y, 1, 1, bg.ink, 0.07)
    ellipse(p, foxX + 21, h - 3, 20, 3, bg.ink, 0.12)
  }
  drawWidgetFox(p, s, s.widget.pose, foxX, h - 2)
}

function png(w: number, h: number, draw: (p: Painter) => void): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(canvasPainter(ctx))
  return c.toDataURL('image/png')
}

export interface WidgetImages {
  small: string
  medium: string
  /** For the Dynamic Island and lock screen: the fox studying, then happy when time's up. */
  foxStudy: string
  foxHappy: string
}

/** PNGs (data: URLs, one pixel per art pixel) for the iPhone to scale up. */
export function widgetImages(s: GameState): WidgetImages {
  return {
    small: png(WIDGET_SIZES.small.w, WIDGET_SIZES.small.h, (p) => drawWidgetScene(p, s, 'small')),
    medium: png(WIDGET_SIZES.medium.w, WIDGET_SIZES.medium.h, (p) => drawWidgetScene(p, s, 'medium')),
    foxStudy: png(44, 34, (p) => drawWidgetFox(p, s, 'study', 1, 33, 'open')),
    foxHappy: png(44, 34, (p) => drawWidgetFox(p, s, 'sit', 1, 33, 'happy')),
  }
}

/** What changes the pictures: redraw them only when one of these does. */
export function widgetLook(s: GameState): string {
  return JSON.stringify([s.widget.bg, s.widget.pose, s.equipped, s.decor.floor, faceFor(s)])
}
