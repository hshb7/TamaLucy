// What she's studying, in her own words: the fox's career track, the shelves on
// the bookcase, the built-in quiz decks she wants. Set up when the app is new
// (with presets to start from) and changeable any time in settings. Nothing
// here is assumed: a save that predates this screen gets the law school setup
// the app shipped with.
import type { Course, GameState, Shelf, Study, Track } from './state.ts'

export const MAX_SHELVES = 3

export interface StudyPreset {
  id: string
  label: string
  program: string
  track: Track
  shelves: string[]
  decks: string[]
}

/** Starting points for the setup screen. She can change every field. */
export const STUDY_PRESETS: StudyPreset[] = [
  { id: 'law', label: 'law school', program: 'law school', track: 'law', shelves: ['1L', '2L', '3L'], decks: ['legalLatin'] },
  { id: 'college', label: 'college', program: 'college', track: 'general', shelves: ['year 1', 'year 2', 'year 3'], decks: [] },
  { id: 'grad', label: 'grad school', program: 'grad school', track: 'general', shelves: ['year 1', 'year 2', 'research'], decks: [] },
  { id: 'med', label: 'med / nursing', program: 'med school', track: 'general', shelves: ['year 1', 'year 2', 'clinicals'], decks: [] },
  { id: 'exam', label: 'exam prep', program: 'exam prep', track: 'general', shelves: ['review', 'practice', 'work'], decks: [] },
  { id: 'other', label: 'something else', program: '', track: 'general', shelves: ['this term', 'next term', 'work'], decks: [] },
]

/** The shelves the app shipped with, before she could name them. */
const SHIPPED_SHELVES: Shelf[] = [
  { id: '2L', name: '2L', tag: '2L' },
  { id: '3L', name: '3L', tag: '3L' },
  { id: 'work', name: 'work', tag: 'WK' },
]

/** The full law school setup the app shipped with (the law preset's old shape; tests use it). */
export const LEGACY_STUDY: Study = { program: 'law school', track: 'law', shelves: SHIPPED_SHELVES, decks: ['legalLatin'], asked: false }

/**
 * A save made before there was a choice gets nothing assumed: the general
 * track, no law jokes, no decks. The shipped shelves stay only where her books
 * already stand on them, and the home screen asks her to set it up.
 */
export function legacyStudy(courses: readonly Pick<Course, 'year'>[]): Study {
  const used = new Set(courses.map((c) => c.year))
  return { program: '', track: 'general', shelves: SHIPPED_SHELVES.filter((sh) => used.has(sh.id)), decks: [], asked: false }
}

/** The two letters on a shelf's brass plate: "2L" stays "2L", "Fall 2026" becomes "F2", "clinicals" "CL". */
export function tagFor(name: string): string {
  const n = name.trim()
  const year = /^(\d)\s*l$/i.exec(n)
  if (year) return `${year[1]}L`
  const words = n.split(/[\s\-_/]+/).filter(Boolean)
  const raw = words.length >= 2 ? words[0][0] + words[1][0] : n.replace(/\s+/g, '').slice(0, 2)
  const tag = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return tag || '··'
}

const uid = (now: number, n: number) => `s${now.toString(36)}${n.toString(36)}`

/** Shelves from names typed on the setup screen. */
export function shelvesFromNames(names: readonly string[], now: number): Shelf[] {
  const seen = new Set<string>()
  const out: Shelf[] = []
  for (const raw of names) {
    const name = raw.trim().slice(0, 24)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ id: uid(now, out.length), name, tag: tagFor(name) })
    if (out.length === MAX_SHELVES) break
  }
  return out
}

/** Apply a preset wholesale (the setup screen's starting point). */
export function applyPreset(s: GameState, preset: StudyPreset, now: number): GameState {
  return { ...s, study: { program: preset.program, track: preset.track, shelves: shelvesFromNames(preset.shelves, now), decks: [...preset.decks], asked: true } }
}

export function setStudy(s: GameState, patch: Partial<Pick<Study, 'program' | 'track' | 'decks'>>): GameState {
  const next = { ...s.study, ...patch, asked: true }
  next.program = next.program.trim().slice(0, 30)
  return { ...s, study: next }
}

/**
 * Replace the shelves (rename, add, remove; up to 3, at least 1). Books on a
 * shelf that went away move to the first shelf rather than disappearing.
 */
export function setShelves(s: GameState, shelves: readonly Shelf[]): GameState {
  const clean: Shelf[] = []
  const seen = new Set<string>()
  for (const sh of shelves) {
    const name = sh.name.trim().slice(0, 24)
    if (!name || seen.has(sh.id)) continue
    seen.add(sh.id)
    const tag = sh.tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2)
    clean.push({ id: sh.id, name, tag: tag || tagFor(name) })
    if (clean.length === MAX_SHELVES) break
  }
  if (!clean.length) return s
  const ids = new Set(clean.map((x) => x.id))
  const courses: Course[] = s.courses.map((c) => (ids.has(c.year) ? c : { ...c, year: clean[0].id }))
  return { ...s, courses, study: { ...s.study, shelves: clean, asked: true } }
}

export function newShelf(name: string, now: number): Shelf {
  return { id: uid(now, Math.floor(Math.random() * 1296)), name: name.trim().slice(0, 24), tag: tagFor(name) }
}

/** The study setup is done when she has at least one shelf. */
export const studyReady = (s: GameState) => s.study.shelves.length > 0
