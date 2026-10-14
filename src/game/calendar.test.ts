import { describe, expect, it } from 'vitest'
import { dayInfo, daysInMonth, dayTitle, keyOf, monthGrid, monthSummary, monthTitle, parseKey, shiftMonth, weekdayLetters } from './calendar.ts'
import { freshState } from './state.ts'
import { addExam } from './study.ts'

describe('month grid', () => {
  it('starts on the Sunday before the 1st and always has six full weeks', () => {
    const g = monthGrid(2026, 9) // October 2026 starts on a Thursday
    expect(g).toHaveLength(6)
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g[0].map((d) => d.day)).toEqual([27, 28, 29, 30, 1, 2, 3])
    expect(g[0].slice(0, 4).every((d) => !d.inMonth)).toBe(true)
    expect(g[0][4]).toEqual({ key: '2026-10-01', day: 1, inMonth: true })
    expect(g[4][6]).toEqual({ key: '2026-10-31', day: 31, inMonth: true })
    expect(g[5].every((d) => !d.inMonth)).toBe(true) // November's first week pads the end
  })
  it('can start the week on Monday', () => {
    const g = monthGrid(2026, 9, 1)
    expect(g[0].map((d) => d.day)).toEqual([28, 29, 30, 1, 2, 3, 4])
  })
  it('handles a month that starts on the week start and February in a leap year', () => {
    expect(monthGrid(2026, 1)[0][0]).toEqual({ key: '2026-02-01', day: 1, inMonth: true })
    expect(daysInMonth(2028, 1)).toBe(29)
    expect(daysInMonth(2026, 1)).toBe(28)
  })
  it('shifts months across years', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth(2026, 9, 14)).toEqual({ year: 2027, month: 11 })
  })
  it('round-trips keys', () => {
    expect(keyOf(2026, 0, 5)).toBe('2026-01-05')
    expect(parseKey('2026-01-05')).toEqual({ year: 2026, month: 0, day: 5 })
  })
  it('names things in English by default', () => {
    expect(weekdayLetters(0, 'en-US')).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
    expect(weekdayLetters(1, 'en-US')[0]).toBe('Mo')
    expect(monthTitle(2026, 9, 'en-US')).toBe('October 2026')
    expect(dayTitle('2026-10-14', 'en-US')).toBe('Wednesday, October 14')
  })
})

describe('what a day holds', () => {
  const now = new Date(2026, 9, 14, 12).getTime()
  let s = freshState(now)
  s = addExam(s, { name: 'Evidence final', date: '2026-10-20' }, now)
  s = addExam(s, { name: 'memo', date: '2026-10-20', kind: 'due' }, now)
  s = addExam(s, { name: 'Torts midterm', date: '2026-11-02' }, now)
  s = { ...s, birthday: '10-14', stats: { ...s.stats, days: { '2026-10-13': 50, '2026-10-14': 25, '2026-09-30': 100 }, daySessions: { '2026-10-13': 2, '2026-10-14': 1, '2026-09-30': 4 } } }

  it('lists the exams, the deadlines, the minutes and her birthday', () => {
    expect(dayInfo(s, '2026-10-20').exams.map((e) => [e.name, e.kind ?? 'exam'])).toEqual([
      ['Evidence final', 'exam'],
      ['memo', 'due'],
    ])
    expect(dayInfo(s, '2026-10-13')).toMatchObject({ minutes: 50, sessions: 2, birthday: false, exams: [] })
    expect(dayInfo(s, '2026-10-14').birthday).toBe(true)
    expect(dayInfo(s, '2026-10-21')).toEqual({ exams: [], minutes: 0, sessions: 0, birthday: false })
  })
  it('adds a deadline when asked, and an exam by default', () => {
    expect(s.exams.find((e) => e.name === 'memo')?.kind).toBe('due')
    expect(s.exams.find((e) => e.name === 'Evidence final')?.kind).toBeUndefined()
  })
  it('sums the month, leaving the others out', () => {
    expect(monthSummary(s, 2026, 9)).toEqual({ minutes: 75, sessions: 3, studyDays: 2, exams: 1, due: 1 })
    expect(monthSummary(s, 2026, 10)).toEqual({ minutes: 0, sessions: 0, studyDays: 0, exams: 1, due: 0 })
    expect(monthSummary(s, 2026, 8).minutes).toBe(100)
  })
})
