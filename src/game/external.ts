// Exams and deadlines that come from somewhere else: her calendar (EventKit on
// the iPhone and Mac, Google Calendar on the web) or her school's Canvas. They
// land in the exams list next to the ones she typed, remember where they came
// from, and are refreshed on every sync: renamed or moved there, renamed or
// moved here; gone there (handed in, deleted), gone here. One she takes off
// the list herself stays off.
import { same } from './merge.ts'
import type { Course, Exam, GameState } from './state.ts'
import { dayKey } from './time.ts'

export type ExternalSource = 'calendar' | 'canvas'

export interface ExternalEvent {
  /** Its id on the other side (a calendar item, a Canvas assignment). */
  id: string
  title: string
  /** Local YYYY-MM-DD. */
  date: string
  kind: 'exam' | 'due'
  /** The class it belongs to, in the other system's words (a calendar's name, a Canvas course). */
  course?: string
}

const DAY = 86_400_000
/** How far ahead imported items reach. */
export const HORIZON_DAYS = 180

const EXAM_WORDS = /\b(exams?|finals?|midterms?|mid-terms?|quiz(?:zes)?|tests?|moot|orals?|viva|boards?|bar exam|mpre|mbe|osce|practical)\b/i
const DUE_WORDS =
  /\b(due|deadline|submit|submission|hand[- ]in|memo|brief|paper|essay|outline|problem set|pset|assignment|homework|hw|project|presentation|response|reflection|draft|lab report)\b/i

export const looksLikeExam = (title: string) => EXAM_WORDS.test(title)
export const looksLikeDeadline = (title: string) => DUE_WORDS.test(title)

export interface CalendarItem {
  id: string
  title: string
  /** ms */
  start: number
  allDay: boolean
  recurring: boolean
  /** The calendar's name. */
  calendar?: string
}

/** From a calendar, only what reads like an exam or a deadline, never every lecture. A weekly thing is a class, not a deadline. */
export function fromCalendar(e: CalendarItem): ExternalEvent | null {
  const title = e.title.trim()
  if (!title) return null
  const exam = looksLikeExam(title)
  if (!exam && !looksLikeDeadline(title)) return null
  if (e.recurring && !exam) return null
  return { id: e.id, title: title.slice(0, 60), date: dayKey(e.start), kind: exam ? 'exam' : 'due', course: e.calendar }
}

export interface CanvasAssignment {
  id: number | string
  name: string
  due_at: string | null
  /** The Canvas course's name. */
  course: string
  submitted?: boolean
}

/** A Canvas assignment with a due date; ones she already handed in don't count. */
export function fromCanvas(a: CanvasAssignment): ExternalEvent | null {
  if (!a.due_at || a.submitted) return null
  const t = Date.parse(a.due_at)
  if (!isFinite(t)) return null
  const title = a.name.trim().slice(0, 60)
  if (!title) return null
  return { id: String(a.id), title, date: dayKey(t), kind: looksLikeExam(title) ? 'exam' : 'due', course: a.course }
}

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `

/** Which of her classes an outside name (a calendar, a Canvas course, a title) is talking about: whole words only, so "work" isn't "homework". */
export function matchCourse(s: Pick<GameState, 'courses'>, ...names: (string | undefined)[]): Course | undefined {
  for (const raw of names) {
    const n = raw ? words(raw) : ''
    if (n.trim().length < 3) continue
    const hit = s.courses.find((c) => {
      const cn = words(c.name)
      return cn.trim().length >= 3 && (n.includes(cn) || cn.includes(n))
    })
    if (hit) return hit
  }
  return undefined
}

export const examId = (source: ExternalSource, id: string) => `${source}:${id}`

/** Bring in the latest from one source. Everything she typed herself is untouched. */
export function importEvents(s: GameState, source: ExternalSource, events: readonly ExternalEvent[], now: number): GameState {
  const today = dayKey(now)
  const horizon = dayKey(now + HORIZON_DAYS * DAY)
  const incoming = new Map<string, ExternalEvent>()
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date < today || e.date > horizon) continue
    if (s.examsHidden.includes(examId(source, e.id)) || incoming.has(e.id)) continue
    incoming.set(e.id, e)
  }
  const next: Exam[] = []
  const seen = new Set<string>()
  for (const x of s.exams) {
    if (x.source !== source) {
      next.push(x)
      continue
    }
    const theirs = x.externalId ? incoming.get(x.externalId) : undefined
    if (theirs) {
      seen.add(theirs.id)
      next.push(refresh(s, x, theirs))
    } else if (x.date < today) next.push(x) // over and done: stays as history
    // otherwise it's gone on the other side (handed in, deleted): gone here too
  }
  for (const e of incoming.values()) {
    if (seen.has(e.id)) continue
    const course = matchCourse(s, e.course, e.title)
    next.push({
      id: examId(source, e.id),
      name: e.title,
      date: e.date,
      kind: e.kind,
      source,
      externalId: e.id,
      subject: course?.name ?? e.course ?? '',
      ...(course && { courseId: course.id }),
    })
  }
  next.sort((a, b) => a.date.localeCompare(b.date))
  return same(next, s.exams) ? s : { ...s, exams: next }
}

function refresh(s: GameState, x: Exam, e: ExternalEvent): Exam {
  const out: Exam = { ...x, name: e.title, date: e.date, kind: e.kind }
  // a class she assigned herself stays; otherwise keep trying to find one
  const keep = x.courseId && s.courses.some((c) => c.id === x.courseId)
  const course = keep ? undefined : matchCourse(s, e.course, e.title)
  if (course) {
    out.courseId = course.id
    out.subject = course.name
  }
  return same(out, x) ? x : out
}

/** She took one off the list. An imported one stays off, even after the next sync. */
export function removeExam(s: GameState, id: string): GameState {
  const x = s.exams.find((e) => e.id === id)
  const hidden = x?.source && x.externalId ? [...s.examsHidden, examId(x.source, x.externalId)] : s.examsHidden
  return { ...s, exams: s.exams.filter((e) => e.id !== id), examsHidden: hidden.slice(-200) }
}

/** "LAW 2010-01: Contracts (Fall 2026)" → "Contracts". */
export function cleanCourseName(name: string): string {
  let n = name.trim().replace(/\s*[([][^()[\]]*[)\]]\s*$/g, '').trim()
  const m = /^[A-Za-z]{2,6}\s?\d{2,4}[A-Za-z]?(?:[-.][0-9A-Za-z]{1,3})?\s*(?:[:\-–—]\s*)?(.+)$/.exec(n)
  if (m && m[1].trim().length >= 3) n = m[1].trim()
  return n.slice(0, 40) || name.trim().slice(0, 40)
}

export const upcomingDeadlines = (s: GameState, now: number) => s.exams.filter((e) => e.date >= dayKey(now))
