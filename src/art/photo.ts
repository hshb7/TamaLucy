import type { Photo } from '../game/state.ts'
import type { Sprite } from './sprite.ts'

const cache = new Map<string, Sprite>()

/** Turn a stored pixel photo into a sprite for the wall frame. */
export function photoSprite(photo: Photo): Sprite {
  let s = cache.get(photo.data)
  if (!s) {
    const data: string[] = []
    for (let i = 0; i < photo.w * photo.h; i++) data.push('#' + photo.data.slice(i * 6, i * 6 + 6))
    s = { w: photo.w, h: photo.h, data }
    cache.set(photo.data, s)
  }
  return s
}
