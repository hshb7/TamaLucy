import { dayKey } from './time.ts'
import { shelfIndex } from './shelf.ts'
import type { Course, Exam, GameState, StudyCard } from './state.ts'

// Her own flashcards, scheduled with a simple Leitner system: a card she
// knows moves up a box and comes back later; one she misses goes back to box 1.

const DAY = 86_400_000
/** Days until a card in each box is due again (box 1 = review again now). */
export const BOX_DAYS = [0, 0, 1, 3, 7, 21]

const uid = (now: number, n: number) => `${now.toString(36)}${n.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

/** A new card for a class (courseId), or a general one. */
export function addCard(s: GameState, card: { front: string; back: string; courseId?: string; subject?: string }, now: number): GameState {
  const front = card.front.trim()
  const back = card.back.trim()
  if (!front || !back) return s
  const course = s.courses.find((x) => x.id === card.courseId)
  const c: StudyCard = {
    id: uid(now, s.cards.length),
    front,
    back,
    ...(course && { courseId: course.id }),
    subject: course?.name ?? (card.subject?.trim() || 'General'),
    box: 1,
    due: now,
    created: now,
  }
  return { ...s, cards: [...s.cards, c] }
}

/** Which class a card is for. (Cards named after a class are adopted onto it: see adoptCards.) */
export function cardCourse(s: GameState, c: Pick<StudyCard, 'courseId' | 'subject'>): Course | undefined {
  return c.courseId ? s.courses.find((x) => x.id === c.courseId) : undefined
}

/** What to call the card's pile: its class, or the name it was given. */
export function cardLabel(s: GameState, c: Pick<StudyCard, 'courseId' | 'subject'>): string {
  return cardCourse(s, c)?.name ?? (c.subject && c.subject !== 'General' ? c.subject : 'general')
}

/** A pile of cards: one class, or cards with no class that share a name. `undefined` = all of them. */
export type CardGroup = { courseId: string } | { subject: string } | undefined

export function inGroup(s: GameState, c: StudyCard, g: CardGroup): boolean {
  if (!g) return true
  const course = cardCourse(s, c)
  if ('courseId' in g) return course?.id === g.courseId
  return !course && c.subject === g.subject
}

export const cardsIn = (s: GameState, g: CardGroup) => s.cards.filter((c) => inGroup(s, c, g))

export interface CardPile {
  key: string
  group: CardGroup
  course?: Course
  label: string
  cards: StudyCard[]
  due: number
}

/** Her cards by class, in bookcase order, then any piles with no class. Only piles with cards. */
export function cardPiles(s: GameState, now: number): CardPile[] {
  const ordered = [...s.courses].sort((a, b) => shelfIndex(s, a) - shelfIndex(s, b) || a.created - b.created)
  const piles: CardPile[] = []
  for (const course of ordered) {
    const cards = cardsIn(s, { courseId: course.id })
    if (cards.length) piles.push({ key: course.id, group: { courseId: course.id }, course, label: course.name, cards, due: cards.filter((c) => c.due <= now).length })
  }
  const loose = s.cards.filter((c) => !cardCourse(s, c))
  for (const subject of [...new Set(loose.map((c) => c.subject))].sort()) {
    const cards = loose.filter((c) => c.subject === subject)
    piles.push({ key: `name:${subject}`, group: { subject }, label: subject === 'General' ? 'general' : subject, cards, due: cards.filter((c) => c.due <= now).length })
  }
  return piles
}

/** Lines like "front — back", "front - back", "front: back" or "front<tab>back"; anything else is skipped. */
export function parseCardList(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^(.+?)\s*(?:\t|\s[—–-]\s|:\s|—)\s*(.+)$/.exec(line.trim())
    if (!m) continue
    const front = m[1].trim().slice(0, 120)
    const back = m[2].trim().slice(0, 400)
    if (front && back) out.push({ front, back })
  }
  return out
}

/** Several cards for one class (or general) at once. */
export function addCards(s: GameState, list: { front: string; back: string }[], courseId: string | undefined, now: number): GameState {
  return list.reduce((acc, c, i) => addCard(acc, { ...c, courseId }, now + i), s)
}

/** Edit a card; `courseId` moves it to another class ('' = general). */
export function updateCard(s: GameState, id: string, patch: Partial<Pick<StudyCard, 'front' | 'back'>> & { courseId?: string }): GameState {
  return {
    ...s,
    cards: s.cards.map((c) => {
      if (c.id !== id) return c
      const { courseId, ...rest } = patch
      if (courseId === undefined) return { ...c, ...rest }
      const course = s.courses.find((x) => x.id === courseId)
      const moved = { ...c, ...rest, subject: course?.name ?? 'General' }
      if (course) moved.courseId = course.id
      else delete moved.courseId
      return moved
    }),
  }
}

export function deleteCard(s: GameState, id: string): GameState {
  return { ...s, cards: s.cards.filter((c) => c.id !== id) }
}

export function reviewCard(s: GameState, id: string, knew: boolean, now: number): GameState {
  return {
    ...s,
    cards: s.cards.map((c) => {
      if (c.id !== id) return c
      const box = knew ? Math.min(5, c.box + 1) : 1
      return { ...c, box, due: now + BOX_DAYS[box] * DAY }
    }),
  }
}

export function dueCards(s: GameState, now: number, group?: CardGroup): StudyCard[] {
  return s.cards.filter((c) => c.due <= now && inGroup(s, c, group)).sort((a, b) => a.due - b.due)
}

// ─── exams ──────────────────────────────────────────────────────────────────

export function addExam(s: GameState, exam: { name: string; date: string; subject?: string; courseId?: string }, now: number): GameState {
  const name = exam.name.trim()
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(exam.date)) return s
  const course = s.courses.find((x) => x.id === exam.courseId)
  const e: Exam = { id: uid(now, s.exams.length), name, date: exam.date, ...(course && { courseId: course.id }), subject: course?.name ?? exam.subject ?? '' }
  return { ...s, exams: [...s.exams, e].sort((a, b) => a.date.localeCompare(b.date)) }
}

export function deleteExam(s: GameState, id: string): GameState {
  return { ...s, exams: s.exams.filter((e) => e.id !== id) }
}

/** Whole days from today (local) until a YYYY-MM-DD date. 0 = today, negative = past. */
export function daysUntil(date: string, now: number): number {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const today = new Date(now)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((target - start) / DAY)
}

export function upcomingExams(s: GameState, now: number): Exam[] {
  return s.exams.filter((e) => daysUntil(e.date, now) >= 0)
}

export function examsToday(s: GameState, now: number): Exam[] {
  const today = dayKey(now)
  return s.exams.filter((e) => e.date === today)
}

export function whenLabel(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 0) return days === -1 ? 'yesterday' : `${-days} days ago`
  return `in ${days} days`
}
