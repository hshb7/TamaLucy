// The big bookcase in the fox's room: a shelf for each year of law school and
// one for work. Every class she adds is a book that fills in, bottom up, as she
// studies for it; a finished one gets gold bands and twinkles now and then.
import type { Painter } from './painter.ts'

export interface BookColor {
  name: string
  spine: string
  dark: string
  light: string
}

/** Spine colours she can pick for a class (casebook colours, plus a few cute ones). */
export const BOOK_COLORS: Record<string, BookColor> = {
  cherry: { name: 'cherry', spine: '#e5566a', dark: '#b63b4f', light: '#f28b98' },
  navy: { name: 'navy', spine: '#5f7fb8', dark: '#3f5a8f', light: '#8fa9d6' },
  forest: { name: 'forest', spine: '#6fa86f', dark: '#4c8052', light: '#9bc98f' },
  honey: { name: 'honey', spine: '#e5ab3d', dark: '#b98428', light: '#ffd76e' },
  plum: { name: 'plum', spine: '#9a7cc4', dark: '#735a9e', light: '#cbb0ea' },
  rose: { name: 'rose', spine: '#ef7fa0', dark: '#cc5f80', light: '#f9c4cf' },
  sky: { name: 'sky', spine: '#7fbde6', dark: '#5f93cb', light: '#c9e7f5' },
  cocoa: { name: 'cocoa', spine: '#9b6b4d', dark: '#6b4a33', light: '#c49a74' },
  mint: { name: 'mint', spine: '#8fd1b5', dark: '#5fa889', light: '#c4ecd9' },
  peach: { name: 'peach', spine: '#ffa77a', dark: '#e8844f', light: '#ffd1b5' },
}

export interface ShelfBook {
  id: string
  /** 0 and 1: the class shelves (2L, 3L); 2: work. */
  shelf: number
  color: string
  /** 0-1, how much of it is filled in. */
  progress: number
  /** Finished: on the shelf for good. */
  done: boolean
  work: boolean
  /** For the height of the book (a stable little variety). */
  seed: number
}

export interface PlacedBook extends ShelfBook {
  x: number
  y: number
  w: number
  h: number
}

/** Where the bookcase stands in the room (top-left), and its size. */
export const BOOKCASE = { x: 72, y: 22, w: 44, h: 49 }
/** The carved panel on the left with each shelf's brass plate. */
const PANEL = 9
const INNER_X = BOOKCASE.x + PANEL
const INNER_W = BOOKCASE.w - PANEL - 3
const ROW_H = 12
/** Top of each shelf's space (2L, 3L, work). */
export const ROW_TOP = [BOOKCASE.y + 3, BOOKCASE.y + 17, BOOKCASE.y + 31]

const WOOD = '#a57a5a'
const WOOD_DARK = '#7b523d'
const WOOD_DEEP = '#553628'
const WOOD_LIGHT = '#c49a74'
const BACK = '#6e4a36'
const BRASS = '#ffd76e'
const BRASS_DARK = '#b98428'
const INK = '#5b3a31'
const OUTLINE = '#4a2a22'
const GOLD = '#e5ab3d'
const GOLD_LIGHT = '#ffd76e'

/** A stable number from an id, so a book keeps its height. */
export function seedOf(id: string) {
  let h = 7
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** Lay the books out along their shelves. Books that don't fit aren't drawn (the bookshelf screen lists them all). */
export function placeBooks(books: readonly ShelfBook[]): PlacedBook[] {
  const out: PlacedBook[] = []
  for (let shelf = 0; shelf < 3; shelf++) {
    const row = books.filter((b) => b.shelf === shelf)
    // thinner spines when the shelf gets full
    const widths = shelf === 2 ? [4, 3, 2] : [3, 2]
    const body = widths.find((w) => row.length * (w + 1) + 1 <= INNER_W) ?? 2
    row.forEach((b, i) => {
      const x = INNER_X + i * (body + 1)
      if (x + body + 2 > INNER_X + INNER_W) return
      const h = b.work ? 11 : 8 + (b.seed % 4)
      out.push({ ...b, x, y: ROW_TOP[shelf] + ROW_H - h, w: body + 2, h })
    })
  }
  return out
}

/** Mix a colour towards cream: the part of a book she hasn't studied yet. */
function pale(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number, to: number) => Math.round(c + (to - c) * 0.6)
  const r = mix((n >> 16) & 255, 0xf4)
  const g = mix((n >> 8) & 255, 0xe4)
  const b = mix(n & 255, 0xd2)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function drawBook(p: Painter, b: PlacedBook, t: number) {
  const c = BOOK_COLORS[b.color] ?? BOOK_COLORS.cherry
  const bw = b.w - 2
  const bh = b.h - 2
  const filled = b.done ? bh : Math.max(b.progress > 0 ? 1 : 0, Math.round(bh * b.progress))
  p.rect(b.x, b.y, b.w, b.h, OUTLINE)
  // spine columns: shade, colour, (highlight)
  const cols = bw >= 3 ? [c.dark, c.spine, ...Array(bw - 3).fill(c.spine), c.light] : [c.dark, c.spine]
  cols.forEach((col, i) => {
    const x = b.x + 1 + i
    if (bh - filled > 0) p.rect(x, b.y + 1, 1, bh - filled, pale(col))
    if (filled > 0) p.rect(x, b.y + 1 + bh - filled, 1, filled, col)
  })
  if (b.work) {
    // a binder: a label on the spine and a finger hole
    const lx = b.x + (bw >= 3 ? 2 : 1)
    const lw = bw >= 3 ? bw - 2 : bw
    p.rect(lx, b.y + 2, lw, 3, b.done ? GOLD_LIGHT : '#fffaf0')
    p.rect(b.x + 1 + Math.floor(bw / 2), b.y + b.h - 4, 1, 1, OUTLINE)
  } else if (b.done) {
    // gold bands, like a proper casebook
    for (const y of [b.y + 2, b.y + b.h - 3]) {
      p.rect(b.x + 1, y, 1, 1, GOLD)
      p.rect(b.x + 2, y, bw - 1, 1, GOLD_LIGHT)
    }
  }
  if (b.done && Math.sin(t / 900 + (b.seed % 97)) > 0.985) {
    const sx = b.x + 1 + (b.seed % bw)
    p.rect(sx, b.y - 2, 1, 3, '#fffbe6')
    p.rect(sx - 1, b.y - 1, 3, 1, '#fffbe6')
  }
}

// 3x5 letters for the brass plates
const GLYPHS: Record<string, string[]> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  L: ['#..', '#..', '#..', '#..', '###'],
}
const BRIEFCASE = ['..#..', '#####', '#...#', '#####', '#####']

function drawPlate(p: Painter, x: number, y: number, label: string) {
  p.rect(x, y, 9, 7, BRASS_DARK)
  p.rect(x + 1, y + 1, 7, 5, BRASS)
  const glyphs = label === 'work' ? [BRIEFCASE] : [...label.slice(0, 2)].map((ch) => GLYPHS[ch.toUpperCase()] ?? GLYPHS.L)
  let gx = label === 'work' ? x + 2 : x + 1
  for (const g of glyphs) {
    g.forEach((row, dy) => [...row].forEach((ch, dx) => ch === '#' && p.rect(gx + dx, y + 1 + dy, 1, 1, INK)))
    gx += g[0].length + 1
  }
}

/**
 * The bookcase with her books. `labels` are the brass plates (e.g. 2L, 3L, work).
 * Things standing on top of it (her gifts) are drawn by the room.
 */
export function drawBookcase(p: Painter, books: readonly PlacedBook[], labels: readonly string[], t: number) {
  const { x, y, w, h } = BOOKCASE
  // body and back panel
  p.rect(x, y, w, h, WOOD)
  p.rect(INNER_X, y + 3, INNER_W, h - 7, BACK)
  for (let gx = INNER_X + 4; gx < INNER_X + INNER_W; gx += 8) p.rect(gx, y + 3, 1, h - 7, '#654332')
  // crown, overhanging a little
  p.rect(x - 1, y, w + 2, 1, WOOD_LIGHT)
  p.rect(x - 1, y + 1, w + 2, 1, WOOD)
  p.rect(x - 1, y + 2, w + 2, 1, WOOD_DARK)
  // carved side panel, right side
  p.rect(x, y + 3, 1, h - 7, WOOD_LIGHT)
  p.rect(x + PANEL - 1, y + 3, 1, h - 7, WOOD_DARK)
  p.rect(x + w - 3, y + 3, 1, h - 7, WOOD_DARK)
  p.rect(x + w - 1, y + 3, 1, h - 7, WOOD_DEEP)
  // shelves and their plates
  ROW_TOP.forEach((top, i) => {
    p.rect(INNER_X, top + ROW_H, INNER_W, 1, WOOD_LIGHT)
    p.rect(INNER_X, top + ROW_H + 1, INNER_W, 1, WOOD_DARK)
    if (labels[i]) drawPlate(p, x, top + 2, labels[i])
  })
  // plinth and feet
  p.rect(x, y + h - 4, w, 3, WOOD_DARK)
  p.rect(x, y + h - 4, w, 1, WOOD)
  p.rect(x + 1, y + h - 1, 3, 1, WOOD_DEEP)
  p.rect(x + w - 4, y + h - 1, 3, 1, WOOD_DEEP)
  for (const b of books) drawBook(p, b, t)
}
