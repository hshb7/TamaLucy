import type { Sprite } from './sprite.ts'

/** Minimal drawing surface so scenes can render to a canvas or (in scripts) a PNG. */
export interface Painter {
  rect(x: number, y: number, w: number, h: number, color: string, alpha?: number): void
  sprite(s: Sprite, x: number, y: number, alpha?: number): void
}

/** Filled pixel ellipse drawn as horizontal spans. */
export function ellipse(p: Painter, cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1) {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))))
    if (half > 0) p.rect(Math.round(cx - half), Math.round(cy + y), half * 2, 1, color, alpha)
  }
}

const spriteCanvasCache = new WeakMap<Sprite, HTMLCanvasElement>()

function spriteCanvas(s: Sprite): HTMLCanvasElement {
  let c = spriteCanvasCache.get(s)
  if (c) return c
  c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(s.w, s.h)
  s.data.forEach((col, i) => {
    if (!col) return
    const n = parseInt(col.slice(1), 16)
    img.data[i * 4] = (n >> 16) & 255
    img.data[i * 4 + 1] = (n >> 8) & 255
    img.data[i * 4 + 2] = n & 255
    img.data[i * 4 + 3] = 255
  })
  ctx.putImageData(img, 0, 0)
  spriteCanvasCache.set(s, c)
  return c
}

export function canvasPainter(ctx: CanvasRenderingContext2D): Painter {
  ctx.imageSmoothingEnabled = false
  return {
    rect(x, y, w, h, color, alpha = 1) {
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), w, h)
      ctx.globalAlpha = 1
    },
    sprite(s, x, y, alpha = 1) {
      ctx.globalAlpha = alpha
      ctx.drawImage(spriteCanvas(s), Math.round(x), Math.round(y))
      ctx.globalAlpha = 1
    },
  }
}
