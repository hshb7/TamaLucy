import type { Photo } from '../game/state.ts'

export const PHOTO_W = 22
export const PHOTO_H = 17

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file isn’t a photo this browser can open. Try a JPG or PNG.'))
    img.src = url
  })
}

/**
 * Centre-crop a photo to the frame, shrink it to a few hundred pixels and
 * soften the colours so it looks at home in the pixel-art room.
 */
export async function pixelatePhoto(file: File, w = PHOTO_W, h = PHOTO_H): Promise<Photo> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const target = w / h
    const aspect = img.naturalWidth / img.naturalHeight
    const sw = aspect > target ? img.naturalHeight * target : img.naturalWidth
    const sh = aspect > target ? img.naturalHeight : img.naturalWidth / target
    const sx = (img.naturalWidth - sw) / 2
    const sy = (img.naturalHeight - sh) / 2
    // shrink in two steps so the colours average nicely instead of aliasing
    const mid = document.createElement('canvas')
    mid.width = w * 4
    mid.height = h * 4
    const mctx = mid.getContext('2d')!
    mctx.imageSmoothingQuality = 'high'
    mctx.drawImage(img, sx, sy, sw, sh, 0, 0, mid.width, mid.height)
    const small = document.createElement('canvas')
    small.width = w
    small.height = h
    const ctx = small.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(mid, 0, 0, w, h)
    const px = ctx.getImageData(0, 0, w, h).data
    let data = ''
    const levels = 6
    const warm = [255, 214, 176]
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) {
        let v = px[i * 4 + c]
        v = Math.round((v / 255) * (levels - 1)) * (255 / (levels - 1)) // posterise
        v = v * 0.88 + warm[c] * 0.12 // a little warmth
        data += Math.round(v).toString(16).padStart(2, '0')
      }
    }
    return { w, h, data }
  } finally {
    URL.revokeObjectURL(url)
  }
}
