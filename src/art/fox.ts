import { blank, mirror, sprite, stamp, type Sprite } from './sprite.ts'

// The fox is drawn as a symmetric left half (head + body), mirrored, then
// layered: tail (behind) -> body -> face -> clothes. Coordinates below are in
// the 42x32 fox canvas; the body occupies columns 0..31, the tail sticks out right.
export const FOX_W = 42
export const FOX_H = 32

const BODY_HALF = [
  '................',
  '....oo..........',
  '...obbo.........',
  '...obkbo........',
  '..obkkbbo.......',
  '..obkkkbbo......',
  '..obkkkbbboooooo',
  '.obkkkbbbbbbbbbb',
  '.obkkbbbbbbbbbbb',
  '.obbkbbbbbbbbbbb',
  '.obbbbbbbbbbbbbb',
  '.obbbbbbbbbbbbbb',
  '.obbbbbbbbbbbbbb',
  'obcbbbbbbbbbbbbb',
  'occcbbbbbbbbbbbb',
  'occcccccccccccbb',
  '.occcccccccccccc',
  '..occcccccccccccc'.slice(0, 16),
  '...ooccccccccccc',
  '.....oooccccccc c'.replace(' ', '').slice(0, 16),
  '.......obbbccccc',
  '......obbbbbcccc',
  '......obbbbbcccc',
  '.....obbbbbbbccc',
  '.....obbbbobbbcc',
  '....obbbbbobbbcc',
  '....obbbbbobbbcc',
  '....obbbbbobbboo',
  '....obbbbboccco.',
  '.....oooooooooo.',
  '................',
  '................',
]

const TAIL_ROWS = [
  '..........oo.....',
  '.........occo....',
  '........occcco...',
  '........occccco..',
  '.......occcccco..',
  '.......obcccccbo.',
  '.......obbcccblo.',
  '.......obbbbbbllo',
  '.......odbbbbbblo',
  '.......odbbbbbbbo',
  '......odbbbbbbbbo',
  '.....odbbbbbbbbbo',
  '....odbbbbbbbbbo.',
  '...odbbbbbbbbbbo.',
  '..odbbbbbbbbbbo..',
  '.odbbbbbbbbbbo...',
  'odbbbbbbbbbbo....',
  'obbbbbbbbbbo.....',
  'obbbbbbbbboo.....',
  'ooooooooooo......',
]

function shiftRows(rows: string[], upto: number, by: number): string[] {
  return rows.map((r, i) => {
    if (i > upto) return r
    return by < 0 ? r.slice(-by) + '.'.repeat(-by) : '.'.repeat(by) + r.slice(0, r.length - by)
  })
}

const TAIL = [sprite(TAIL_ROWS), sprite(shiftRows(TAIL_ROWS, 6, -1))]
const BODY = sprite(mirror(BODY_HALF))

export type Face = 'open' | 'blink' | 'happy' | 'sad' | 'eat' | 'shock' | 'love' | 'sleep'

// Face parts are absolute pixels [x, y, paletteChar].
type Px = [number, number, string]
const EYE_L = 9
const EYE_R = 21
const EYE_Y = 12

function eyes(kind: Face): Px[] {
  const out: Px[] = []
  for (const ex of [EYE_L, EYE_R]) {
    switch (kind) {
      case 'open':
      case 'eat':
        out.push(
          [ex, EYE_Y, 'e'], [ex + 1, EYE_Y, 'e'],
          [ex - 1, EYE_Y + 1, 'e'], [ex, EYE_Y + 1, 'w'], [ex + 1, EYE_Y + 1, 'e'], [ex + 2, EYE_Y + 1, 'e'],
          [ex - 1, EYE_Y + 2, 'e'], [ex, EYE_Y + 2, 'e'], [ex + 1, EYE_Y + 2, 'e'], [ex + 2, EYE_Y + 2, 'e'],
          [ex, EYE_Y + 3, 'e'], [ex + 1, EYE_Y + 3, 'e'],
        )
        break
      case 'shock':
        out.push([ex, EYE_Y, 'e'], [ex + 1, EYE_Y, 'e'], [ex, EYE_Y + 1, 'w'], [ex + 1, EYE_Y + 1, 'e'], [ex, EYE_Y + 2, 'e'], [ex + 1, EYE_Y + 2, 'e'])
        break
      case 'blink':
      case 'sleep':
        out.push([ex - 1, EYE_Y + 2, 'e'], [ex, EYE_Y + 2, 'e'], [ex + 1, EYE_Y + 2, 'e'], [ex + 2, EYE_Y + 2, 'e'])
        break
      case 'happy':
        // ^ ^
        out.push([ex - 1, EYE_Y + 2, 'e'], [ex, EYE_Y + 1, 'e'], [ex + 1, EYE_Y + 1, 'e'], [ex + 2, EYE_Y + 2, 'e'])
        break
      case 'love':
        out.push([ex - 1, EYE_Y, 'r'], [ex + 2, EYE_Y, 'r'], [ex - 1, EYE_Y + 1, 'r'], [ex, EYE_Y + 1, 'r'], [ex + 1, EYE_Y + 1, 'r'], [ex + 2, EYE_Y + 1, 'r'])
        out.push([ex, EYE_Y, 'P'], [ex, EYE_Y + 2, 'r'], [ex + 1, EYE_Y + 2, 'r'], [ex - 1, EYE_Y, 'r'])
        break
      case 'sad': {
        // droopy eyes with a tear
        const inner = ex === EYE_L ? ex + 1 : ex
        const outer = ex === EYE_L ? ex : ex + 1
        out.push([inner, EYE_Y, 'e'], [outer, EYE_Y + 1, 'e'], [inner, EYE_Y + 1, 'e'], [outer, EYE_Y + 2, 'e'], [inner, EYE_Y + 2, 'e'])
        out.push([outer, EYE_Y + 3, 'u'])
        break
      }
    }
  }
  return out
}

function mouth(kind: Face): Px[] {
  const nose: Px[] = [[15, 15, 'e'], [16, 15, 'e']]
  switch (kind) {
    case 'eat':
      return [...nose, [14, 16, 'o'], [15, 16, 'r'], [16, 16, 'r'], [17, 16, 'o'], [15, 17, 'o'], [16, 17, 'o']]
    case 'shock':
      return [...nose, [15, 17, 'o'], [16, 17, 'o']]
    case 'sad':
      return [...nose, [14, 17, 'o'], [15, 16, 'o'], [16, 16, 'o'], [17, 17, 'o']]
    default:
      return [...nose, [14, 16, 'o'], [17, 16, 'o']]
  }
}

function blush(kind: Face): Px[] {
  if (kind === 'sad') return []
  const px: Px[] = []
  for (const x of [6, 7, 8, 23, 24, 25]) px.push([x, 15, 'p'])
  return px
}

function paint(base: Sprite, px: Px[]): Sprite {
  const parts = blank(base.w, base.h)
  for (const [x, y, ch] of px) parts.data[y * base.w + x] = sprite([ch]).data[0]
  return stamp(base, parts, 0, 0)
}

const cache = new Map<string, Sprite>()

/** The sitting fox, fully assembled (without clothes). */
export function foxSitting(face: Face = 'open', tailFrame = 0): Sprite {
  const key = `${face}:${tailFrame}`
  const hit = cache.get(key)
  if (hit) return hit
  let s = blank(FOX_W, FOX_H)
  s = stamp(s, TAIL[tailFrame % 2], 25, 9)
  s = stamp(s, BODY, 0, 0)
  s = paint(s, [...eyes(face), ...mouth(face), ...blush(face)])
  cache.set(key, s)
  return s
}

// ---------------------------------------------------------------------------
// Curled-up pose (sleeping / sulking). Side view, facing left.
export const CURL_W = 40
export const CURL_H = 22

const CURL_BODY = sprite([
  '.........oooooooooooo.........',
  '......ooollllllllbbbbooo......',
  '....oolllbbbbbbbbbbbbbbboo....',
  '...olbbbbbbbbbbbbbbbbbbbbbo...',
  '..olbbbbbbbbbbbbbbbbbbbbbbbo..',
  '.obbbbbbbbbbbbbbbbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbbbbbbbbbbbbbbbo.',
  'obbbbbbbbbbbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbbbbbbbbbbdo',
  '.obbbbbbbbbbbbbbbbbbbbbbbbbddo',
  '.odbbbbbbbbbbbbbbbbbbbbbbbddo.',
  '..oddbbbbbbbbbbbbbbbbbbbdddo..',
  '...ooodddddddddddddddddooo....',
  '......oooooooooooooooooo......',
])

const CURL_TAIL = sprite([
  '...........................oooo...',
  '.........................oobbbbo..',
  '........................obbbbbbbo.',
  '.......................obbbbbbbbo.',
  '......................obbbbbbbbbo.',
  '....................oobbbbbbbbbbo.',
  '..oooooo.......ooooobbbbbbbbbbbo..',
  '.occcccco..oooobbbbbbbbbbbbbbbo...',
  'occcccccccobbbbbbbbbbbbbbbbbdo....',
  'occcccccccbbbbbbbbbbbbbbbbddo.....',
  '.occcccccbbbbbbbbbbbbbbddddo......',
  '..ooocccsbbbbbbbbbdddddooo........',
  '.....oooooooooooooooooo...........',
])

const CURL_HEAD_ROWS = [
  '.......oo...oo....',
  '......obo..obko...',
  '.....obkbo.obkbo..',
  '....obkkboobkkbo..',
  '...obbbbbbbbbbbbo.',
  '..obbbbbbbbbbbbbbo',
  '.obbbbbbbbbbbbbbbo',
  '.obbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbo',
  'occcccbbbbbbbbbbo.',
  'occcccccccbbbbbbo.',
  'occcccccccccbbbo..',
  '.oooocccccccooo...',
  '.....ooooooo......',
]
const CURL_HEAD = sprite(CURL_HEAD_ROWS)

const HEAD_X = 1
const HEAD_Y = 3

function curlFace(face: Face): Px[] {
  const X = HEAD_X
  const Y = HEAD_Y
  const px: Px[] = [[X, Y + 10, 'e']] // nose
  if (face === 'sleep' || face === 'blink') {
    px.push([X + 3, Y + 8, 'e'], [X + 4, Y + 9, 'e'], [X + 5, Y + 9, 'e'], [X + 6, Y + 8, 'e'])
  } else if (face === 'sad') {
    px.push([X + 4, Y + 7, 'e'], [X + 5, Y + 7, 'e'], [X + 4, Y + 8, 'e'], [X + 5, Y + 8, 'e'], [X + 3, Y + 8, 'e'], [X + 3, Y + 9, 'u'])
  } else {
    px.push([X + 4, Y + 7, 'e'], [X + 5, Y + 7, 'e'], [X + 3, Y + 8, 'e'], [X + 4, Y + 8, 'w'], [X + 5, Y + 8, 'e'], [X + 4, Y + 9, 'e'])
  }
  if (face !== 'sad') px.push([X + 6, Y + 10, 'p'], [X + 7, Y + 10, 'p'])
  return px
}

/** The curled-up fox. */
export function foxCurled(face: Face = 'sleep', breath = 0): Sprite {
  const key = `curl:${face}:${breath}`
  const hit = cache.get(key)
  if (hit) return hit
  let s = blank(CURL_W, CURL_H)
  s = stamp(s, CURL_BODY, 8, 5 - breath)
  s = stamp(s, CURL_TAIL, 4, 9)
  s = stamp(s, CURL_HEAD, HEAD_X, HEAD_Y)
  s = paint(s, curlFace(face))
  cache.set(key, s)
  return s
}
