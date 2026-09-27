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
      // a little smile: corners up, curving under the nose
      return [...nose, [13, 16, 'o'], [18, 16, 'o'], [14, 17, 'o'], [15, 17, 'o'], [16, 17, 'o'], [17, 17, 'o']]
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

// ---------------------------------------------------------------------------
// Walking pose: the front-facing head (chibi style) on a side-on body with
// four little legs, tail trailing behind. Faces right; flip for left.
export const WALK_W = 50
export const WALK_H = 31
/** Where the head (and so hats/glasses) sits inside the walking canvas. */
export const WALK_HEAD = { x: 17, y: 0 }

function headOnly(face: Face): Sprite {
  const s = foxSitting(face, 0)
  const w = 32
  const h = 19
  const data: (string | null)[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.push(s.data[y * s.w + x])
  const outline = s.data[1 * s.w + 4]
  for (let x = 0; x < w; x++) data.push(data[(h - 1) * w + x] ? outline : null)
  return { w, h: h + 1, data }
}

const WALK_BODY = sprite([
  '......oooooooooooooooo......',
  '....oobbbbbbbbbbbbbbbboo....',
  '...obbbbbbbbbbbbbbbbbbbbo...',
  '..olbbbbbbbbbbbbbbbbbbbbbo..',
  '.olbbbbbbbbbbbbbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbbbbbbbbbbbbbo.',
  'obbbbbbbbbbbbbbbbbbbbbbbbbbo',
  'odbbbbbbbbbbbbbbbbbbbbbbbbbo',
  '.odbbbbbcccccccccccccbbbbbo.',
  '..oddbbcccccccccccccccbbdo..',
  '....oooooooooooooooooooo....',
])
const LEG_NEAR = sprite(['obbo', 'obbo', 'obbo', 'obbo', 'occo', 'oooo'])
const LEG_FAR = sprite(['oddo', 'oddo', 'oddo', 'oddo', 'osso', 'oooo'])
const WALK_TAIL = sprite(TAIL_ROWS.map((r) => [...r].reverse().join('')))

// [hindNear, hindFar, frontFar, frontNear] x-positions per frame
const STRIDE = [
  [9, 14, 27, 32],
  [11, 12, 29, 30],
  [14, 9, 32, 27],
  [12, 11, 30, 29],
]

/** One frame (0-3) of the walk cycle, facing right. */
export function foxWalking(frame: number, face: Face = 'open'): Sprite {
  const f = ((frame % 4) + 4) % 4
  const key = `walk:${f}:${face}`
  const hit = cache.get(key)
  if (hit) return hit
  const bob = f % 2 // body lifts on the passing frames
  const [hn, hf, ff, fn] = STRIDE[f]
  let s = blank(WALK_W, WALK_H)
  s = stamp(s, WALK_TAIL, 0, 4 - bob)
  s = stamp(s, LEG_FAR, hf, 24)
  s = stamp(s, LEG_FAR, ff, 24)
  s = stamp(s, WALK_BODY, 8, 15 - bob)
  s = stamp(s, LEG_NEAR, hn, 24)
  s = stamp(s, LEG_NEAR, fn, 24)
  s = stamp(s, headOnly(face), WALK_HEAD.x, WALK_HEAD.y - bob)
  cache.set(key, s)
  return s
}
