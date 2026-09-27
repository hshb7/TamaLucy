import { dayKey } from './time.ts'
import type { Exam, GameState, StudyCard } from './state.ts'

// Her own flashcards, scheduled with a simple Leitner system: a card she
// knows moves up a box and comes back later; one she misses goes back to box 1.

const DAY = 86_400_000
/** Days until a card in each box is due again (box 1 = review again now). */
export const BOX_DAYS = [0, 0, 1, 3, 7, 21]

const uid = (now: number, n: number) => `${now.toString(36)}${n.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

export function addCard(s: GameState, card: { front: string; back: string; subject: string }, now: number): GameState {
  const front = card.front.trim()
  const back = card.back.trim()
  if (!front || !back) return s
  const c: StudyCard = { id: uid(now, s.cards.length), front, back, subject: card.subject.trim() || 'General', box: 1, due: now, created: now }
  return { ...s, cards: [...s.cards, c] }
}

export function updateCard(s: GameState, id: string, patch: Partial<Pick<StudyCard, 'front' | 'back' | 'subject'>>): GameState {
  return { ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
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

export function dueCards(s: GameState, now: number, subject?: string): StudyCard[] {
  return s.cards.filter((c) => c.due <= now && (!subject || c.subject === subject)).sort((a, b) => a.due - b.due)
}

export function cardSubjects(s: GameState): string[] {
  return [...new Set(s.cards.map((c) => c.subject))].sort()
}

// ─── exams ──────────────────────────────────────────────────────────────────

export function addExam(s: GameState, exam: { name: string; date: string; subject: string }, now: number): GameState {
  const name = exam.name.trim()
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(exam.date)) return s
  const e: Exam = { id: uid(now, s.exams.length), name, date: exam.date, subject: exam.subject }
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
