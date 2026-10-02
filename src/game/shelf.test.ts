import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './state.ts'
import { completeFocus, startFocus } from './logic.ts'
import { merge3 } from './merge.ts'
import {
  activeCourses,
  addCourse,
  bookProgress,
  celebrateBook,
  courseForLabel,
  courseMinutes,
  courseNames,
  draftCourse,
  finishCourse,
  isShelved,
  lastCourse,
  pendingBook,
  shelfBooks,
  updateCourse,
} from './shelf.ts'
import { placeBooks } from '../art/bookcase.ts'

const MIN = 60_000
const T0 = new Date(2026, 9, 1, 9, 0, 0).getTime()
const base = (): GameState => ({ ...freshState(T0), onboarded: true })

function withClasses(...names: string[]): GameState {
  let s = base()
  names.forEach((name, i) => (s = addCourse(s, { ...draftCourse(s, 'class'), name }, T0 + i)))
  return s
}

const focus = (s: GameState, label: string, minutes: number, at = T0) => completeFocus(startFocus(s, at, minutes, label), at + minutes * MIN)

describe('her classes and work', () => {
  it('adds a class with sensible defaults and ignores an empty name', () => {
    let s = withClasses('Evidence')
    const c = s.courses[0]
    expect(c).toMatchObject({ name: 'Evidence', kind: 'class', year: '2L', goalHours: 100, priorHours: 0, doneAt: 0 })
    s = addCourse(s, { ...draftCourse(s, 'class'), name: '   ' }, T0)
    expect(s.courses).toHaveLength(1)
    // a new class gets a colour not already on its shelf
    const next = draftCourse(s, 'class')
    expect(next.color).not.toBe(c.color)
  })

  it('puts work on its own shelf', () => {
    let s = base()
    s = addCourse(s, { ...draftCourse(s, 'work'), name: 'Law Review', year: '3L' }, T0)
    expect(s.courses[0]).toMatchObject({ kind: 'work', year: 'work', goalHours: 50 })
    expect(shelfBooks(s)[0]).toMatchObject({ shelf: 2, work: true })
  })

  it('counts focus time towards the class it was for', () => {
    let s = withClasses('Evidence', 'Con Law')
    s = focus(s, 'Evidence', 25)
    s = focus(s, 'con law outline', 50, T0 + 3_600_000)
    s = focus(s, 'Torts', 10, T0 + 7_200_000)
    const [ev, con] = s.courses
    expect(s.stats.courses).toEqual({ [ev.id]: 25, [con.id]: 50 })
    expect(s.stats.subjects).toEqual({ Evidence: 25, 'con law outline': 50, Torts: 10 })
    expect(lastCourse(s)?.name).toBe('Con Law')
  })

  it('matches the longest class name a label starts with', () => {
    const s = withClasses('Con', 'Con Law', 'Evidence')
    expect(courseForLabel(s, 'Con Law: outline')?.name).toBe('Con Law')
    expect(courseForLabel(s, 'con reading')?.name).toBe('Con')
    expect(courseForLabel(s, 'Evidenced')).toBeNull()
    expect(courseForLabel(s, '')).toBeNull()
  })

  it('remembers the class even if she renames it mid-session', () => {
    let s = withClasses('Evidence')
    const id = s.courses[0].id
    s = startFocus(s, T0, 25, 'Evidence')
    s = updateCourse(s, id, { name: 'Evidence (Prof. Kim)' })
    s = completeFocus(s, T0 + 25 * MIN)
    expect(s.stats.courses[id]).toBe(25)
    expect(s.pending?.courseId).toBe(id)
  })

  it('fills the book as she studies and shelves it at the hours goal', () => {
    let s = withClasses('Evidence')
    s = updateCourse(s, s.courses[0].id, { goalHours: 1, priorHours: 0 })
    s = focus(s, 'Evidence', 30)
    expect(bookProgress(s, s.courses[0])).toBe(0.5)
    expect(pendingBook(s)).toBeNull()
    s = focus(s, 'Evidence', 30, T0 + 3_600_000)
    expect(isShelved(s, s.courses[0])).toBe(true)
    expect(pendingBook(s)?.name).toBe('Evidence')
    s = celebrateBook(s, s.courses[0].id)
    expect(pendingBook(s)).toBeNull()
  })

  it('counts hours from before TamaLucy, and finishing a class shelves it whatever the hours', () => {
    let s = withClasses('Evidence', 'Tax')
    s = updateCourse(s, s.courses[0].id, { priorHours: 12 })
    expect(courseMinutes(s, s.courses[0])).toBe(720)
    s = finishCourse(s, s.courses[1].id, true, T0)
    expect(isShelved(s, s.courses[1])).toBe(true)
    expect(activeCourses(s).map((c) => c.name)).toEqual(['Evidence'])
    expect(courseNames(s, ['Torts'])).toEqual(['Evidence', 'Tax'])
    expect(courseNames(base(), ['Torts'])).toEqual(['Torts'])
  })

  it('adds up time on the same class from her iPhone and her Mac', () => {
    const b = withClasses('Evidence')
    const id = b.courses[0].id
    const phone = focus(b, 'Evidence', 25)
    const mac = addCourse(focus(b, 'Evidence', 50, T0 + 3_600_000), { ...draftCourse(b, 'work'), name: 'Clinic' }, T0)
    const m = merge3(b, mac, celebrateBook(phone, 'x'))
    expect(m.stats.courses[id]).toBe(75)
    expect(m.courses.map((c) => c.name).sort()).toEqual(['Clinic', 'Evidence'])
    expect(m.booksSeen).toEqual(['x'])
  })

  it('lays books out on their shelves, thinner when a shelf fills up', () => {
    const few = placeBooks(shelfBooks(withClasses('A', 'B')))
    expect(few.map((b) => b.w)).toEqual([5, 5])
    const many = placeBooks(shelfBooks(withClasses(...'ABCDEFGHIJ'.split(''))))
    expect(many).toHaveLength(10)
    expect(new Set(many.map((b) => b.w))).toEqual(new Set([4]))
    // never past the end of the shelf
    const lots = placeBooks(shelfBooks(withClasses(...'ABCDEFGHIJKLMNOP'.split(''))))
    expect(lots.length).toBeLessThan(16)
  })
})
