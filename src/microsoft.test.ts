import { describe, expect, it } from 'vitest'
import { graphEvent } from './microsoft.ts'

describe('events from Microsoft Graph', () => {
  it('reads UTC times, all-day dates, series and cancellations', () => {
    const t = graphEvent({ id: 'x', subject: 'Tax seminar', start: { dateTime: '2026-10-14T14:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-14T16:00:00.0000000', timeZone: 'UTC' } }, 'cal')!
    expect(t.start).toBe(Date.UTC(2026, 9, 14, 14))
    expect(t.end - t.start).toBe(2 * 3_600_000)
    expect(t).toMatchObject({ id: 'x', title: 'Tax seminar', allDay: false, recurring: false, calendar: 'cal' })
    const a = graphEvent({ id: 'y', subject: 'reading week', isAllDay: true, start: { dateTime: '2026-10-19T00:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-20T00:00:00.0000000', timeZone: 'UTC' } }, 'cal')!
    expect(a.allDay).toBe(true)
    expect(new Date(a.start).getDate()).toBe(19)
    expect(a.end - a.start).toBe(86_400_000)
    expect(graphEvent({ id: 'o', seriesMasterId: 'm', subject: 'lecture', start: { dateTime: '2026-10-14T10:00:00', timeZone: 'UTC' } }, 'cal')).toMatchObject({ id: 'm', recurring: true })
    expect(graphEvent({ id: 'c', isCancelled: true, start: { dateTime: '2026-10-14T10:00:00', timeZone: 'UTC' } }, 'cal')).toBeNull()
    expect(graphEvent({ id: 'n' }, 'cal')).toBeNull()
  })
})
