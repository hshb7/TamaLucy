// Merging two copies of the same fox, e.g. her iPhone's and her Mac's.
//
// Both copies started from `base`, the last save they agreed on. `remote` is
// the newer save from the cloud and `local` is this device's copy. The rules
// make sure nothing she earned is lost when both devices changed things:
//
//   - earnings add up (acorns, focus minutes, treats in the pantry...)
//   - collections are combined (letters, postcards, clothes, flashcards...)
//     keeping deletions made on either side
//   - the fox's needs come from the cloud copy; the game clock then simulates
//     from its timestamp, so time away is never counted twice
//   - a running focus session and "what happens when I leave the app" belong
//     to this device and never travel
//   - anything else: whichever side changed it wins
import type { GameState, Note, Postcard, StudyCard, Exam } from './state.ts'

type Merger = (b: unknown, l: unknown, r: unknown) => unknown
type Rule = 'local' | 'remote' | 'sum' | 'max' | 'set' | 'deep' | 'lww' | Merger

const byId =
  <T>(key: (x: T) => string, both?: (pick: T, l: T, r: T) => T, sort?: (a: T, b: T) => number): Merger =>
  (b, l, r) => {
    const out = mergeById(arr<T>(b), arr<T>(l), arr<T>(r), key, both)
    return sort ? out.sort(sort) : out
  }

const newestFirst = (a: { at: number }, b: { at: number }) => b.at - a.at

const RULES: Record<string, Rule> = {
  // this device only
  session: 'local',
  'settings.leaveMode': 'local',
  'settings.graceSeconds': 'local',

  // earned on either device: both sides' changes add up
  acorns: 'sum',
  'stats.totalMinutes': 'sum',
  'stats.sessions': 'sum',
  'stats.gaveUp': 'sum',
  'stats.left': 'sum',
  'stats.days.*': 'sum',
  'stats.daySessions.*': 'sum',
  'stats.subjects.*': 'sum',
  'quiz.rounds': 'sum',
  'quiz.correct': 'sum',
  'quiz.answered': 'sum',
  'pantry.*': 'sum',
  'treatsFed.*': 'sum',

  // only ever go up
  'stats.bestStreak': 'max',
  'quiz.best': 'max',
  secretsDelivered: 'max',
  birthdayYear: 'max',
  rankSeen: 'max',
  lastBackupAt: 'max',
  lastMailCheck: 'max',
  lastVisit: 'max',

  // the simulation: needs + the clock they were simulated to
  needs: 'remote',
  lastTick: 'remote',
  lastUse: 'remote',
  napUntil: 'remote',
  pets: 'remote',

  // collections
  wardrobe: 'set',
  gifts: 'set',
  examsWished: 'set',
  usedNotes: 'set',
  notes: byId<Note>((n) => n.id, (pick, l, r) => ({ ...pick, read: l.read || r.read }), newestFirst),
  postcards: byId<Postcard>((p) => `${p.at}:${p.adventure}`, undefined, newestFirst),
  cards: byId<StudyCard>((c) => c.id),
  exams: byId<Exam>((e) => e.id),

  // objects merged field by field
  stats: 'deep',
  'stats.days': 'deep',
  'stats.daySessions': 'deep',
  'stats.subjects': 'deep',
  quiz: 'deep',
  pantry: 'deep',
  treatsFed: 'deep',
  settings: 'deep',
  decor: 'deep',
  equipped: 'deep',
}

export function merge3(base: GameState, local: GameState, remote: GameState): GameState {
  const merged = mergeAt('', base, local, remote) as GameState
  // eaten treats leave no empty jar behind
  for (const [k, v] of Object.entries(merged.pantry)) if (v <= 0) delete merged.pantry[k]
  merged.usedNotes = merged.usedNotes.slice(0, 24)
  return merged
}

function ruleFor(path: string): Rule {
  if (!path) return 'deep'
  return RULES[path] ?? RULES[path.replace(/\.[^.]+$/, '.*')] ?? 'lww'
}

function mergeAt(path: string, b: unknown, l: unknown, r: unknown): unknown {
  const rule = ruleFor(path)
  if (typeof rule === 'function') return rule(b, l, r)
  switch (rule) {
    case 'local':
      return l
    case 'remote':
      return r === undefined ? l : r
    case 'sum':
      return Math.max(0, num(r) + num(l) - num(b))
    case 'max':
      return Math.max(num(l), num(r))
    case 'set':
      return mergeById(arr<string>(b), arr<string>(l), arr<string>(r), (x) => x)
    case 'deep': {
      if (!isObj(l) || !isObj(r)) return lww(b, l, r)
      const bo = isObj(b) ? b : {}
      const out: Record<string, unknown> = {}
      for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
        const v = mergeAt(path ? `${path}.${k}` : k, bo[k], l[k], r[k])
        if (v !== undefined) out[k] = v
      }
      return out
    }
    case 'lww':
      return lww(b, l, r)
  }
}

/** Whichever side changed it wins (ours, if both did). */
function lww(b: unknown, l: unknown, r: unknown) {
  return same(l, b) ? r : l
}

/**
 * Three-way merge of a list by key: the cloud's items, plus ones added here,
 * minus ones deleted here (or in the cloud). An item changed here wins.
 */
function mergeById<T>(b: T[], l: T[], r: T[], key: (x: T) => string, both?: (pick: T, l: T, r: T) => T): T[] {
  const B = new Map(b.map((x) => [key(x), x]))
  const L = new Map(l.map((x) => [key(x), x]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const rv of r) {
    const k = key(rv)
    if (seen.has(k)) continue
    seen.add(k)
    const lv = L.get(k)
    if (lv === undefined) {
      if (!B.has(k)) out.push(rv) // new in the cloud (deleted here otherwise)
      continue
    }
    const bv = B.get(k)
    const pick = bv !== undefined && same(lv, bv) ? rv : lv
    out.push(both ? both(pick, lv, rv) : pick)
  }
  // new here; these go first, like a new note on top
  const added = l.filter((lv) => !seen.has(key(lv)) && !B.has(key(lv)))
  return [...added, ...out]
}

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Deep equality that ignores key order and undefined fields (the cloud reorders keys). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined)
    const kb = Object.keys(b).filter((k) => b[k] !== undefined)
    return ka.length === kb.length && ka.every((k) => same(a[k], b[k]))
  }
  return false
}

/** Fields that change by themselves as time passes; changing only these doesn't need a save. */
const VOLATILE = ['needs', 'lastTick', 'lastVisit', 'lastUse', 'napUntil', 'pets', 'bowl', 'session', 'lastMailCheck'] as const

/** Has she done anything worth saving to the cloud since `base`? */
export function meaningfulChange(base: GameState, local: GameState): boolean {
  const strip = (s: GameState) => {
    const copy: Record<string, unknown> = { ...s }
    for (const k of VOLATILE) delete copy[k]
    return copy
  }
  return !same(strip(base), strip(local))
}
