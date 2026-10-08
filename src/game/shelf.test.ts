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
import { addCard, addExam, cardCourse, cardLabel, cardPiles, dueCards, updateCard } from './study.ts'
import { adoptCards, deleteCourse } from './shelf.ts'
import { LEGACY_STUDY } from './studySetup.ts'

const MIN = 60_000
const T0 = new Date(2026, 9, 1, 9, 0, 0).getTime()
const base = (): GameState => ({ ...freshState(T0), onboarded: true, study: LEGACY_STUDY })

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

  it('puts work on the work shelf by default', () => {
    let s = base()
    s = addCourse(s, { ...draftCourse(s, 'work'), name: 'Law Review' }, T0)
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

  it('files flashcards and exams by class', () => {
    let s = withClasses('Evidence', 'Tax')
    const [ev, tax] = s.courses
    s = addCard(s, { front: 'hearsay', back: 'an out-of-court statement…', courseId: ev.id }, T0)
    s = addCard(s, { front: 'basis', back: 'what you paid', courseId: tax.id }, T0 + 1)
    s = addCard(s, { front: 'loose', back: 'no class' }, T0 + 2)
    // a card from before classes, named after one, is adopted by the class when the save loads
    s = adoptCards({ ...s, cards: [...s.cards, { id: 'old', front: 'relevance', back: '401', subject: 'evidence', box: 1, due: T0, created: T0 }] })
    expect(s.cards[0]).toMatchObject({ courseId: ev.id, subject: 'Evidence' })
    expect(cardCourse(s, s.cards[3])?.name).toBe('Evidence')
    expect(cardLabel(s, s.cards[2])).toBe('general')
    expect(cardPiles(s, T0).map((p) => `${p.label}:${p.cards.length}`)).toEqual(['Evidence:2', 'Tax:1', 'general:1'])
    expect(dueCards(s, T0, { courseId: ev.id })).toHaveLength(2)
    // renaming the class keeps the cards; moving a card re-files it
    s = updateCourse(s, ev.id, { name: 'Evidence II' })
    expect(cardLabel(s, s.cards[0])).toBe('Evidence II')
    s = updateCard(s, s.cards[2].id, { courseId: tax.id })
    expect(cardPiles(s, T0).map((p) => `${p.label}:${p.cards.length}`)).toEqual(['Evidence II:2', 'Tax:2'])
    // an exam for the class
    s = addExam(s, { name: '', date: '2026-12-10', courseId: tax.id }, T0)
    expect(s.exams).toEqual([]) // needs a name
    s = addExam(s, { name: 'Tax final', date: '2026-12-10', courseId: tax.id }, T0)
    expect(s.exams[0]).toMatchObject({ courseId: tax.id, subject: 'Tax' })
    // deleting a class keeps its cards and exams, filed under its name
    s = deleteCourse(s, tax.id)
    expect(s.cards.filter((c) => c.subject === 'Tax')).toHaveLength(2)
    expect(s.cards.some((c) => c.courseId === tax.id)).toBe(false)
    expect(s.exams[0]).toMatchObject({ subject: 'Tax' })
    expect(s.exams[0].courseId).toBeUndefined()
    expect(cardPiles(s, T0).map((p) => p.label)).toEqual(['Evidence II', 'Tax'])
    // adding the class back adopts them again
    s = addCourse(s, { ...draftCourse(s, 'class'), name: 'tax' }, T0 + 9)
    expect(cardPiles(s, T0).map((p) => `${p.label}:${p.cards.length}`)).toEqual(['Evidence II:2', 'tax:2'])
    expect(s.exams[0].courseId).toBe(s.courses[1].id)
  })
})
