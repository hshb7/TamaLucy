import { describe, expect, it } from 'vitest'
import { feedUrl, occurrences, parseDuration, parseIcs, parseRule, parseStamp, unfold } from './ics.ts'

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime()
const DAY = 86_400_000

describe('feed addresses', () => {
  it('turns webcal into https and refuses the rest', () => {
    expect(feedUrl('webcal://p12-caldav.icloud.com/published/2/abc')).toBe('https://p12-caldav.icloud.com/published/2/abc')
    expect(feedUrl('  https://canvas.school.edu/feeds/calendars/user_x.ics ')).toBe('https://canvas.school.edu/feeds/calendars/user_x.ics')
    expect(feedUrl('http://example.com/a.ics')).toBeNull()
    expect(feedUrl('https://user:pw@example.com/a.ics')).toBeNull()
    expect(feedUrl('https://localhost/a.ics')).toBeNull()
    expect(feedUrl('not a link')).toBeNull()
  })
})

describe('reading the lines', () => {
  it('unfolds continuation lines', () => {
    expect(unfold('SUMMARY:Evidence lec\r\n ture\r\nUID:1\n\tx')).toEqual(['SUMMARY:Evidence lecture', 'UID:1x'])
  })
  it('reads dates, date-times, UTC and named zones', () => {
    expect(parseStamp('20261014')).toEqual({ t: at(2026, 10, 14), allDay: true })
    expect(parseStamp('20261014T130000')).toEqual({ t: at(2026, 10, 14, 13), allDay: false })
    expect(parseStamp('20261014T130000Z')).toEqual({ t: Date.UTC(2026, 9, 14, 13), allDay: false })
    // 9:00 in New York on an October day is 13:00 UTC
    expect(parseStamp('20261014T090000', { TZID: 'America/New_York' })).toEqual({ t: Date.UTC(2026, 9, 14, 13), allDay: false })
    expect(parseStamp('20261014T090000', { TZID: 'Nowhere/Made-Up' })).toEqual({ t: at(2026, 10, 14, 9), allDay: false })
    expect(parseStamp('garbage')).toBeNull()
  })
  it('reads durations', () => {
    expect(parseDuration('PT1H30M')).toBe(90 * 60_000)
    expect(parseDuration('P1DT2H')).toBe(DAY + 2 * 3_600_000)
    expect(parseDuration('P2W')).toBe(14 * DAY)
    expect(parseDuration('nope')).toBeNull()
  })
})

describe('repeating events', () => {
  it('weekly on given days until a date', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261031T000000Z')!
    const starts = occurrences(at(2026, 10, 5, 10), rule, at(2026, 10, 1), at(2026, 12, 31))
    expect(starts.map((t) => new Date(t).toLocaleDateString('sv'))).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28'])
    expect(new Date(starts[0]).getHours()).toBe(10)
  })
  it('counts from the first occurrence, even before the window', () => {
    const rule = parseRule('FREQ=DAILY;COUNT=5')!
    expect(occurrences(at(2026, 10, 1, 9), rule, at(2026, 10, 4), at(2026, 10, 31)).map((t) => new Date(t).getDate())).toEqual([4, 5])
  })
  it('every other week, monthly by day, yearly, and an interval', () => {
    expect(occurrences(at(2026, 10, 1), parseRule('FREQ=WEEKLY;INTERVAL=2')!, at(2026, 10, 1), at(2026, 11, 30)).map((t) => new Date(t).toLocaleDateString('sv'))).toEqual([
      '2026-10-01',
      '2026-10-15',
      '2026-10-29',
      '2026-11-12',
      '2026-11-26',
    ])
    expect(occurrences(at(2026, 1, 31), parseRule('FREQ=MONTHLY')!, at(2026, 1, 1), at(2026, 5, 31)).map((t) => new Date(t).toLocaleDateString('sv'))).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
    expect(occurrences(at(2024, 3, 14), parseRule('FREQ=YEARLY')!, at(2026, 1, 1), at(2027, 12, 31)).map((t) => new Date(t).toLocaleDateString('sv'))).toEqual(['2026-03-14', '2027-03-14'])
  })
  it('never runs away', () => {
    expect(occurrences(at(2026, 1, 1), parseRule('FREQ=DAILY')!, at(2026, 1, 1), at(2036, 1, 1)).length).toBe(1000)
  })
})

const FEED = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Lucy's school
BEGIN:VEVENT
UID:lec-1
SUMMARY:Evidence lecture
DTSTART;TZID=America/New_York:20261005T100000
DTEND;TZID=America/New_York:20261005T113000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261216T050000Z
EXDATE;TZID=America/New_York:20261012T100000
END:VEVENT
BEGIN:VEVENT
UID:lec-1
RECURRENCE-ID;TZID=America/New_York:20261014T100000
SUMMARY:Evidence lecture (moved)
DTSTART;TZID=America/New_York:20261014T140000
DTEND;TZID=America/New_York:20261014T153000
END:VEVENT
BEGIN:VEVENT
UID:final
SUMMARY:Evidence final exam
DTSTART;VALUE=DATE:20261210
DTEND;VALUE=DATE:20261211
BEGIN:VALARM
TRIGGER:-PT15M
DESCRIPTION:ring
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:gone
SUMMARY:cancelled thing
STATUS:CANCELLED
DTSTART:20261020T090000Z
END:VEVENT
BEGIN:VEVENT
UID:memo
SUMMARY:Tax memo due\\, really
DTSTART:20261101T235900Z
DURATION:PT1M
END:VEVENT
BEGIN:VEVENT
UID:old
SUMMARY:last year
DTSTART;VALUE=DATE:20250101
END:VEVENT
END:VCALENDAR`

describe('a whole feed', () => {
  const cal = parseIcs(FEED, at(2026, 10, 1), at(2026, 12, 31))
  const day = (t: number) => new Date(t).toLocaleDateString('sv')
  it('names itself and unrolls the lectures, minus the skipped one, with the moved one in its place', () => {
    expect(cal.name).toBe("Lucy's school")
    const lectures = cal.events.filter((e) => e.id === 'lec-1')
    expect(lectures.filter((e) => day(e.start) === '2026-10-12')).toHaveLength(0) // EXDATE
    const moved = lectures.filter((e) => e.title === 'Evidence lecture (moved)')
    expect(moved).toHaveLength(1)
    expect(moved[0].start).toBe(Date.UTC(2026, 9, 14, 18)) // 14:00 New York, wherever she is
    expect(lectures.filter((e) => e.start === Date.UTC(2026, 9, 14, 14))).toHaveLength(0) // the 10:00 it replaced is gone
    expect(lectures.every((e) => e.recurring)).toBe(true)
    expect(lectures.filter((e) => day(e.start) === '2026-10-05')[0].end - lectures[0].start).toBe(90 * 60_000)
    expect(lectures.length).toBe(20) // Oct 5 → Dec 14, Mon+Wed (UNTIL is midnight before the last Wednesday), minus the skipped one; the moved one still counts
  })
  it('keeps all-day events, alarms ignored, drops cancelled and out-of-window ones, and unescapes text', () => {
    const final = cal.events.find((e) => e.id === 'final')!
    expect(final.allDay).toBe(true)
    expect(day(final.start)).toBe('2026-12-10')
    expect(final.end - final.start).toBe(DAY)
    expect(cal.events.find((e) => e.id === 'gone')).toBeUndefined()
    expect(cal.events.find((e) => e.id === 'old')).toBeUndefined()
    expect(cal.events.find((e) => e.id === 'memo')?.title).toBe('Tax memo due, really')
  })
  it('is sorted and copes with nonsense', () => {
    for (let i = 1; i < cal.events.length; i++) expect(cal.events[i].start).toBeGreaterThanOrEqual(cal.events[i - 1].start)
    expect(parseIcs('hello', 0, 1)).toEqual({ name: '', events: [] })
    expect(parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:no date\nEND:VEVENT\nEND:VCALENDAR', 0, Date.now()).events).toEqual([])
  })
})
