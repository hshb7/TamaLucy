// Tiny dependency-free PNG encoder used by the icon + preview scripts.
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/** Encode RGBA pixels (w*h*4) as a PNG file buffer. */
export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())])
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Simple RGBA canvas for scripts. */
export class Raster {
  data: Uint8Array
  w: number
  h: number
  constructor(w: number, h: number, bg?: string) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 4)
    if (bg) this.fill(0, 0, w, h, bg)
  }
  fill(x: number, y: number, w: number, h: number, hex: string, alpha = 1) {
    const [r, g, b] = hexToRgb(hex)
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const i = (yy * this.w + xx) * 4
        const a = this.data[i + 3] ? alpha : 1
        this.data[i] = Math.round(this.data[i] * (1 - a) + r * a)
        this.data[i + 1] = Math.round(this.data[i + 1] * (1 - a) + g * a)
        this.data[i + 2] = Math.round(this.data[i + 2] * (1 - a) + b * a)
        this.data[i + 3] = 255
      }
  }
  sprite(s: { w: number; h: number; data: (string | null)[] }, x: number, y: number, scale: number) {
    for (let sy = 0; sy < s.h; sy++)
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.data[sy * s.w + sx]
        if (c) this.fill(x + sx * scale, y + sy * scale, scale, scale, c)
      }
  }
  png() {
    return encodePng(this.w, this.h, this.data)
  }
}
