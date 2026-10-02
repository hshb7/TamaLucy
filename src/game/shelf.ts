// Her classes, and her work (a job, the journal, a clinic). Each one is a book
// on the bookcase in the fox's room: it fills in as she studies for it, and when
// she finishes the class (or reaches its hours goal) it stays on the shelf for
// good, with gold on the spine.

import { BOOK_COLORS, seedOf, type ShelfBook } from '../art/bookcase.ts'
import type { Course, GameState } from './state.ts'

/** The bookcase's two class shelves, one per year of law school. Work has the bottom shelf. */
export const SHELVES = ['2L', '3L'] as const
export const WORK_SHELF = 'work'
/** The brass plates on the bookcase, top to bottom. */
export const SHELF_LABELS = [...SHELVES, WORK_SHELF]
/** Her example: 100 hours of studying for a class puts its book on the shelf. */
export const DEFAULT_GOAL_HOURS = 100

const uid = (now: number, n: number) => `${now.toString(36)}${n.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

export type CourseDraft = Pick<Course, 'name' | 'kind' | 'year' | 'color' | 'goalHours' | 'priorHours'>

/** A sensible start for a new class: the shelf she used last and a colour not on it yet. */
export function draftCourse(s: GameState, kind: Course['kind']): CourseDraft {
  const last = [...s.courses].reverse().find((c) => c.kind === 'class')
  const year = kind === 'work' ? WORK_SHELF : (last?.year ?? SHELVES[0])
  const taken = new Set(s.courses.filter((c) => c.year === year).map((c) => c.color))
  const colors = Object.keys(BOOK_COLORS)
  const color = colors.find((c) => !taken.has(c)) ?? colors[s.courses.length % colors.length]
  return { name: '', kind, year, color, goalHours: kind === 'work' ? 50 : DEFAULT_GOAL_HOURS, priorHours: 0 }
}

const clean = (d: Partial<CourseDraft>): Partial<CourseDraft> => {
  const out: Partial<CourseDraft> = { ...d }
  if (d.name !== undefined) out.name = d.name.trim().slice(0, 40)
  if (d.goalHours !== undefined) out.goalHours = Math.max(1, Math.min(1000, Math.round(d.goalHours) || DEFAULT_GOAL_HOURS))
  if (d.priorHours !== undefined) out.priorHours = Math.max(0, Math.min(1000, Math.round(d.priorHours) || 0))
  if (d.kind === 'work') out.year = WORK_SHELF
  return out
}

export function addCourse(s: GameState, draft: CourseDraft, now: number): GameState {
  const d = clean(draft) as CourseDraft
  if (!d.name) return s
  const c: Course = { ...d, id: uid(now, s.courses.length), doneAt: 0, created: now }
  return { ...s, courses: [...s.courses, c] }
}

export function updateCourse(s: GameState, id: string, patch: Partial<CourseDraft>): GameState {
  const p = clean(patch)
  if (p.name === '') delete p.name
  return { ...s, courses: s.courses.map((c) => (c.id === id ? { ...c, ...p } : c)) }
}

export function deleteCourse(s: GameState, id: string): GameState {
  return { ...s, courses: s.courses.filter((c) => c.id !== id) }
}

/** She finished the class (or wrapped up the job): its book goes on the shelf, whatever the hours. */
export function finishCourse(s: GameState, id: string, done: boolean, now: number): GameState {
  return { ...s, courses: s.courses.map((c) => (c.id === id ? { ...c, doneAt: done ? now : 0 } : c)) }
}

/** Minutes she's put into a class, including the hours from before TamaLucy. */
export function courseMinutes(s: GameState, c: Course): number {
  return (s.stats.courses[c.id] ?? 0) + c.priorHours * 60
}

/** How full its book is (0-1). */
export function bookProgress(s: GameState, c: Course): number {
  return Math.min(1, courseMinutes(s, c) / (c.goalHours * 60))
}

/** Its book is on the shelf for good: finished, or the hours goal reached. */
export function isShelved(s: GameState, c: Course): boolean {
  return c.doneAt > 0 || courseMinutes(s, c) >= c.goalHours * 60
}

/** A book that just went on the shelf and hasn't been celebrated yet. */
export function pendingBook(s: GameState): Course | null {
  return s.courses.find((c) => isShelved(s, c) && !s.booksSeen.includes(c.id)) ?? null
}

export function celebrateBook(s: GameState, id: string): GameState {
  return s.booksSeen.includes(id) ? s : { ...s, booksSeen: [...s.booksSeen, id] }
}

/** Classes and work she's still doing, for the focus picker. Classes first. */
export function activeCourses(s: GameState): Course[] {
  return [...s.courses.filter((c) => c.kind === 'class' && !c.doneAt), ...s.courses.filter((c) => c.kind === 'work' && !c.doneAt)]
}

/** Names for subject pickers (flashcards, exams): her classes, or the defaults if she has none. */
export function courseNames(s: GameState, fallback: readonly string[]): string[] {
  const mine = [...activeCourses(s), ...s.courses.filter((c) => c.doneAt)].map((c) => c.name)
  return mine.length ? [...new Set(mine)] : [...fallback]
}

/**
 * The class a focus label is about: "Contracts", or "contracts outline" (it
 * starts with the class name). Classes still going win over finished ones.
 */
export function courseForLabel(s: GameState, label: string): Course | null {
  const l = label.trim().toLowerCase()
  if (!l) return null
  const ranked = [...s.courses].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || b.created - a.created)
  const exact = ranked.find((c) => c.name.toLowerCase() === l)
  if (exact) return exact
  const starts = ranked.filter((c) => {
    const n = c.name.toLowerCase()
    return l.startsWith(n) && /^[\s:,.\-–—]/.test(l.slice(n.length))
  })
  return starts.sort((a, b) => b.name.length - a.name.length)[0] ?? null
}

/** The class she focused on last, or her first one still going. */
export function lastCourse(s: GameState): Course | null {
  return s.courses.find((c) => c.id === s.lastCourse) ?? activeCourses(s)[0] ?? null
}

export function shelfName(year: string) {
  return year === WORK_SHELF ? 'work' : `${year} shelf`
}

/** Her classes and work as books for the bookcase, in the order she added them. */
export function shelfBooks(s: GameState): ShelfBook[] {
  return s.courses.map((c) => ({
    id: c.id,
    shelf: c.kind === 'work' ? 2 : Math.max(0, SHELVES.indexOf(c.year as (typeof SHELVES)[number])),
    color: c.color,
    progress: bookProgress(s, c),
    done: isShelved(s, c),
    work: c.kind === 'work',
    seed: seedOf(c.id),
  }))
}
