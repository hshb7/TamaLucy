// The month at a glance: her exams and deadlines on the days they fall, and
// the days she studied, so a term is something she can see.
import type { Exam, GameState } from './state.ts'
import { dayKey, monthDay } from './time.ts'

export interface MonthDay {
  /** local YYYY-MM-DD */
  key: string
  /** 1..31 */
  day: number
  /** Belongs to the month shown (the padding days around it don't). */
  inMonth: boolean
}

export interface DayInfo {
  exams: Exam[]
  /** Focused minutes that day. */
  minutes: number
  /** Completed sessions that day. */
  sessions: number
  birthday: boolean
}

export interface MonthSummary {
  minutes: number
  sessions: number
  /** Days with at least one finished session. */
  studyDays: number
  exams: number
  due: number
}

export const keyOf = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** The year, month (0-11) and day of a YYYY-MM-DD key. */
export function parseKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

/** The month `by` months away (negative for earlier), with the year rolled over. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const d = new Date(year, month + by, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/**
 * The weeks of a month as rows of seven, starting on `weekStart` (0 = Sunday),
 * padded with the neighbouring months' days so every row is full. Always six
 * rows, so the grid doesn't jump when the month changes.
 */
export function monthGrid(year: number, month: number, weekStart = 0): MonthDay[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const start = new Date(year, month, 1 - lead)
  const rows: MonthDay[][] = []
  for (let r = 0; r < 6; r++) {
    const row: MonthDay[] = []
    for (let c = 0; c < 7; c++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + r * 7 + c)
      row.push({ key: dayKey(d.getTime()), day: d.getDate(), inMonth: d.getMonth() === month })
    }
    rows.push(row)
  }
  return rows
}

/** Everything that happened, or will, on one day. */
export function dayInfo(s: GameState, key: string): DayInfo {
  const { year, month, day } = parseKey(key)
  return {
    exams: s.exams.filter((e) => e.date === key),
    minutes: s.stats.days[key] ?? 0,
    sessions: s.stats.daySessions[key] ?? 0,
    birthday: !!s.birthday && s.birthday === monthDay(new Date(year, month, day, 12).getTime()),
  }
}

export function monthSummary(s: GameState, year: number, month: number): MonthSummary {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const out: MonthSummary = { minutes: 0, sessions: 0, studyDays: 0, exams: 0, due: 0 }
  for (const [k, n] of Object.entries(s.stats.days)) {
    if (!k.startsWith(prefix)) continue
    out.minutes += n
    if ((s.stats.daySessions[k] ?? 0) > 0 || n > 0) out.studyDays++
  }
  for (const [k, n] of Object.entries(s.stats.daySessions)) if (k.startsWith(prefix)) out.sessions += n
  for (const e of s.exams) {
    if (!e.date.startsWith(prefix)) continue
    if (e.kind === 'due') out.due++
    else out.exams++
  }
  return out
}

/** Weekday initials in her language, starting on `weekStart`. */
export function weekdayLetters(weekStart = 0, locale?: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    // 2023-01-01 was a Sunday
    out.push(fmt.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))).slice(0, 2))
  }
  return out
}

/** The twelve months, short, in her language. */
export function monthNames(locale?: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2023, m, 1)))
}

/** "October 2026", in her language. */
export const monthTitle = (year: number, month: number, locale?: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

/** "Wednesday, October 14", in her language. */
export const dayTitle = (key: string, locale?: string) => {
  const { year, month, day } = parseKey(key)
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(year, month, day, 12))
}
