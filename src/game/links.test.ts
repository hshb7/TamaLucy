import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './state.ts'
import { cleanCourseName, fromCalendar, fromCanvas, importEvents, matchCourse, removeExam } from './external.ts'
import { addExam } from './study.ts'
import { addCourse, draftCourse } from './shelf.ts'
import { DEFAULT_REMINDERS, reminderPlan } from './reminders.ts'
import { usesFahrenheit, weatherKind, weatherLine } from './weather.ts'
import { spotifyUri } from './music.ts'
import { merge3 } from './merge.ts'
import { dayKey } from './time.ts'

const DAY = 86_400_000
const T0 = new Date(2026, 9, 13, 9, 0, 0).getTime() // a Tuesday morning
const day = (n: number) => dayKey(T0 + n * DAY)

function withClasses(): GameState {
  let s = { ...freshState(T0), onboarded: true }
  s = addCourse(s, { ...draftCourse(s, 'class'), name: 'Contracts' }, T0)
  s = addCourse(s, { ...draftCourse(s, 'class'), name: 'Torts' }, T0 + 1)
  s = addCourse(s, { ...draftCourse(s, 'work'), name: 'Work' }, T0 + 2)
  return s
}

describe('exams and deadlines from her calendar and Canvas', () => {
  it('only takes what reads like an exam or a deadline, never a weekly lecture', () => {
    const base = { start: T0 + 3 * DAY, allDay: false, recurring: false, calendar: 'Law School' }
    expect(fromCalendar({ ...base, id: 'a', title: 'Contracts final' })).toMatchObject({ kind: 'exam', date: day(3), course: 'Law School' })
    expect(fromCalendar({ ...base, id: 'b', title: 'Torts memo due' })).toMatchObject({ kind: 'due' })
    expect(fromCalendar({ ...base, id: 'c', title: 'Contracts 9am', recurring: true })).toBeNull()
    expect(fromCalendar({ ...base, id: 'd', title: 'Weekly quiz', recurring: true })?.kind).toBe('exam')
    expect(fromCalendar({ ...base, id: 'e', title: 'Coffee with Sam' })).toBeNull()
    expect(fromCalendar({ ...base, id: 'f', title: '   ' })).toBeNull()
  })

  it('reads Canvas assignments with a due date she has not handed in', () => {
    expect(fromCanvas({ id: 7, name: 'Problem set 3', due_at: new Date(T0 + 5 * DAY).toISOString(), course: 'LAW 2010 - Contracts' })).toMatchObject({ id: '7', kind: 'due', date: day(5), course: 'LAW 2010 - Contracts' })
    expect(fromCanvas({ id: 8, name: 'Midterm', due_at: new Date(T0 + 5 * DAY).toISOString(), course: 'Torts' })?.kind).toBe('exam')
    expect(fromCanvas({ id: 9, name: 'Reading', due_at: null, course: 'Torts' })).toBeNull()
    expect(fromCanvas({ id: 10, name: 'Memo', due_at: new Date(T0 + 5 * DAY).toISOString(), course: 'Torts', submitted: true })).toBeNull()
  })

  it('files imported items under her classes, matching whole words only', () => {
    const s = withClasses()
    expect(matchCourse(s, 'LAW 2010 - Contracts')?.name).toBe('Contracts')
    expect(matchCourse(s, undefined, 'Torts memo due')?.name).toBe('Torts')
    expect(matchCourse(s, 'Homework due')).toBeUndefined() // not "Work"
    expect(matchCourse(s, 'Law School', 'Civ Pro final')).toBeUndefined()
  })

  it('adds, renames, moves and removes with each sync, leaving her own exams alone', () => {
    let s = addExam(withClasses(), { name: 'Evidence final', date: day(30) }, T0)
    const contracts = s.courses[0]
    s = importEvents(s, 'canvas', [{ id: '1', title: 'Problem set 3', date: day(5), kind: 'due', course: 'LAW 2010 - Contracts' }, { id: '2', title: 'Torts midterm', date: day(12), kind: 'exam', course: 'Torts' }], T0)
    expect(s.exams.map((e) => `${e.name}@${e.date}`)).toEqual([`Problem set 3@${day(5)}`, `Torts midterm@${day(12)}`, `Evidence final@${day(30)}`])
    expect(s.exams[0]).toMatchObject({ id: 'canvas:1', source: 'canvas', externalId: '1', kind: 'due', courseId: contracts.id, subject: 'Contracts' })
    // the same list again changes nothing (so nothing gets saved to the cloud for no reason)
    expect(importEvents(s, 'canvas', [{ id: '1', title: 'Problem set 3', date: day(5), kind: 'due', course: 'LAW 2010 - Contracts' }, { id: '2', title: 'Torts midterm', date: day(12), kind: 'exam', course: 'Torts' }], T0)).toBe(s)
    // moved and renamed there, the midterm handed in: moved and renamed here, the midterm gone
    s = importEvents(s, 'canvas', [{ id: '1', title: 'Problem set 3 (revised)', date: day(6), kind: 'due', course: 'LAW 2010 - Contracts' }], T0)
    expect(s.exams.map((e) => e.name)).toEqual(['Problem set 3 (revised)', 'Evidence final'])
    expect(s.exams[0]).toMatchObject({ id: 'canvas:1', date: day(6), courseId: contracts.id })
    // a different source doesn't touch Canvas's items
    s = importEvents(s, 'calendar', [{ id: 'cal-9', title: 'Contracts final', date: day(40), kind: 'exam', course: 'Law School' }], T0)
    expect(s.exams.map((e) => e.id)).toEqual(['canvas:1', expect.any(String), 'calendar:cal-9'])
    // past, too far ahead, or malformed: skipped
    const far = importEvents(s, 'calendar', [{ id: 'x', title: 'Old exam', date: day(-2), kind: 'exam' }, { id: 'y', title: 'Far exam', date: day(300), kind: 'exam' }, { id: 'z', title: 'Bad', date: 'soon', kind: 'exam' }], T0)
    expect(far.exams.some((e) => e.source === 'calendar')).toBe(false)
  })

  it('one she takes off the list stays off', () => {
    let s = importEvents(withClasses(), 'canvas', [{ id: '1', title: 'Problem set 3', date: day(5), kind: 'due', course: 'Contracts' }], T0)
    s = removeExam(s, 'canvas:1')
    expect(s.exams).toEqual([])
    expect(s.examsHidden).toEqual(['canvas:1'])
    s = importEvents(s, 'canvas', [{ id: '1', title: 'Problem set 3', date: day(5), kind: 'due', course: 'Contracts' }], T0)
    expect(s.exams).toEqual([])
    // and both devices agree on that
    const other = { ...s, examsHidden: ['calendar:q'] }
    expect(merge3({ ...s, examsHidden: [] }, s, other).examsHidden.sort()).toEqual(['calendar:q', 'canvas:1'])
  })

  it('a past imported item stays as history when it disappears on the other side', () => {
    let s = importEvents(withClasses(), 'canvas', [{ id: '1', title: 'Memo', date: day(0), kind: 'due', course: 'Torts' }], T0)
    s = importEvents(s, 'canvas', [], T0 + 2 * DAY)
    expect(s.exams.map((e) => e.name)).toEqual(['Memo'])
  })

  it('tidies Canvas course names', () => {
    expect(cleanCourseName('LAW 2010-01: Contracts (Fall 2026)')).toBe('Contracts')
    expect(cleanCourseName('LAW101 Civil Procedure')).toBe('Civil Procedure')
    expect(cleanCourseName('Torts')).toBe('Torts')
    expect(cleanCourseName('Evidence - Section 2')).toBe('Evidence - Section 2')
    expect(cleanCourseName('BIO 1A')).toBe('BIO 1A')
  })
})

describe('what the fox would say if it could tap her on the shoulder', () => {
  const at = (dayOffset: number, hh: number, mm = 0) => {
    const d = new Date(T0)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hh, mm, 0, 0)
    return d.getTime()
  }
  it('misses her after two quiet days, counts down to exams and deadlines, guards a streak, and nudges', () => {
    let s = addExam(withClasses(), { name: 'Contracts final', date: day(10) }, T0)
    s = importEvents(s, 'canvas', [{ id: '1', title: 'Torts memo', date: day(3), kind: 'due', course: 'Torts' }], T0)
    s = { ...s, stats: { ...s.stats, days: { [day(-1)]: 30, [day(-2)]: 25 } } }
    const plan = reminderPlan(s, { ...DEFAULT_REMINDERS, nudge: '17:30' }, T0)
    const byId = Object.fromEntries(plan.map((r) => [r.id, r]))
    expect(byId.lonely).toMatchObject({ title: 'Mochi misses you', at: at(2, 18) })
    expect(byId['due:canvas:1']).toMatchObject({ title: 'due tomorrow: Torts memo', at: at(2, 18) })
    expect(byId[`exam7:${s.exams[1].id}`].at).toBe(at(3, 18))
    expect(byId[`exam1:${s.exams[1].id}`]).toMatchObject({ title: 'tomorrow: Contracts final', at: at(9, 19) })
    expect(byId.streak).toMatchObject({ title: 'don’t lose your 2-day streak', at: at(0, 20) })
    expect(plan.filter((r) => r.id.startsWith('nudge:')).map((r) => r.at)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => at(i, 17, 30)))
    expect(plan.every((r) => r.at > T0)).toBe(true)
    expect(plan.map((r) => r.at)).toEqual([...plan.map((r) => r.at)].sort((a, b) => a - b))
  })

  it('skips today’s nudge and the streak warning once she has studied, and everything she turned off', () => {
    const s = { ...withClasses(), stats: { ...freshState(T0).stats, days: { [day(0)]: 25, [day(-1)]: 30 } } }
    const plan = reminderPlan(s, { lonely: false, exams: false, streak: true, nudge: '17:30' }, T0)
    expect(plan.find((r) => r.id === 'streak')).toBeUndefined()
    expect(plan.filter((r) => r.id.startsWith('nudge:'))).toHaveLength(6)
    expect(reminderPlan(s, { lonely: false, exams: false, streak: false, nudge: '' }, T0)).toEqual([])
  })
})

describe('little helpers', () => {
  it('reads the weather codes', () => {
    expect([0, 1, 2, 3, 45, 51, 61, 80, 71, 85, 95].map(weatherKind)).toEqual(['clear', 'clear', 'cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'rain', 'snow', 'snow', 'storm'])
    expect(weatherLine('rain', 12.4, false)).toBe('raining · 12°')
    expect(weatherLine('rain', 12.4, true)).toBe('raining · 54°')
    expect(usesFahrenheit('en-US')).toBe(true)
    expect(usesFahrenheit('en-GB')).toBe(false)
  })
  it('reads Spotify links', () => {
    expect(spotifyUri('https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn?si=abc')).toBe('spotify:playlist:37i9dQZF1DWWQRwui0ExPn')
    expect(spotifyUri('https://open.spotify.com/intl-fr/album/4aawyAB9vmqN3uQ7FjRGTy')).toBe('spotify:album:4aawyAB9vmqN3uQ7FjRGTy')
    expect(spotifyUri('spotify:playlist:37i9dQZF1DWWQRwui0ExPn')).toBe('spotify:playlist:37i9dQZF1DWWQRwui0ExPn')
    expect(spotifyUri('lofi beats')).toBeNull()
  })
  it('keeps her weather place across devices', () => {
    const base = freshState(T0)
    const local = { ...base, weather: { place: 'Boston', lat: 42.36, lon: -71.06 } }
    expect(merge3(base, local, base).weather).toEqual(local.weather)
    expect(merge3(base, base, local).weather).toEqual(local.weather)
  })
})
