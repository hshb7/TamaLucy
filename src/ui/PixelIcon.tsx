import type { Sprite } from '../art/sprite.ts'

const urls = new WeakMap<Sprite, string>()

/** Render a sprite once to a data URL so it can be used as a plain <img>. */
export function spriteUrl(s: Sprite): string {
  let u = urls.get(s)
  if (u) return u
  const c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')!
  s.data.forEach((col, i) => {
    if (!col) return
    ctx.fillStyle = col
    ctx.fillRect(i % s.w, Math.floor(i / s.w), 1, 1)
  })
  u = c.toDataURL()
  urls.set(s, u)
  return u
}

export function PixelIcon({ sprite, scale = 3, className = '', alt = '' }: { sprite: Sprite; scale?: number; className?: string; alt?: string }) {
  return (
    <img
      src={spriteUrl(sprite)}
      width={sprite.w * scale}
      height={sprite.h * scale}
      className={`pixel-img ${className}`}
      alt={alt}
      draggable={false}
    />
  )
}
