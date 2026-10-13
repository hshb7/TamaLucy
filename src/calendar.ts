// Her calendar and the app, both ways: exams and deadlines come in (so she
// never types a date twice), and finished sessions go out (a record of the
// work). On the iPhone and the Mac it's the device's own calendar (EventKit);
// on the web it's Google Calendar, if a key was set up.
import { fromCalendar, importEvents } from './game/external.ts'
import type { FocusSession } from './game/state.ts'
import { getGame, setGame } from './game/store.ts'
import { formatMinutes } from './hooks.ts'
import { getLinks, patchLinks } from './links.ts'
import { isNativeApp, native, type CalendarAccess, type CalendarInfo, type NativeEvent } from './native.ts'
import { googleAdd, googleCalendars, googleConnected, googleEvents, googleForget, googleToken, hasGoogle } from './google.ts'

export type CalendarWay = 'device' | 'google' | null

/** How this device can reach a calendar, if at all. */
export const calendarWay = (): CalendarWay => (isNativeApp ? 'device' : hasGoogle() ? 'google' : null)

const DAY = 86_400_000

/** Ask for access (the first time) and list her calendars. */
export async function connectCalendar(): Promise<CalendarAccess> {
  const way = calendarWay()
  if (way === 'device') return native.calendars()
  if (way === 'google') {
    const t = await googleToken(true)
    if (!t) return { available: true, authorized: false, calendars: [] }
    return { available: true, authorized: true, calendars: await googleCalendars() }
  }
  return { available: false, authorized: false, calendars: [] }
}

/** Her calendars, without asking anything (empty if not connected). */
export async function listCalendars(): Promise<CalendarInfo[]> {
  const way = calendarWay()
  try {
    if (way === 'device') return (await native.calendars()).calendars
    if (way === 'google' && googleConnected()) return await googleCalendars()
  } catch {
    // offline: the settings screen shows what it remembers
  }
  return []
}

async function events(ids: string[], from: number, to: number): Promise<NativeEvent[]> {
  const way = calendarWay()
  if (way === 'device') return native.calendarEvents(ids, from, to)
  if (way === 'google') return googleEvents(ids, from, to)
  return []
}

let syncing: Promise<number> | null = null

/** Read exams and deadlines from the calendars she picked. Resolves to how many are on the list now. */
export function syncCalendar(): Promise<number> {
  if (syncing) return syncing
  syncing = (async () => {
    const { calendar } = getLinks()
    if (!calendar.on || !calendar.calendars.length) return 0
    const now = Date.now()
    const found = await events(calendar.calendars, now - DAY, now + 181 * DAY)
    const items = found.map((e) => fromCalendar({ ...e, calendar: e.calendar })).filter((e): e is NonNullable<typeof e> => !!e)
    setGame((s) => importEvents(s, 'calendar', items, now))
    patchLinks('calendar', { lastSync: now })
    return getGame().exams.filter((e) => e.source === 'calendar').length
  })().finally(() => {
    syncing = null
  })
  return syncing
}

/** Sync in the background if it's been a while (every time the app opens). */
export function syncCalendarIfStale(hours = 6) {
  const { calendar } = getLinks()
  if (!calendar.on || Date.now() - calendar.lastSync < hours * 3_600_000) return
  syncCalendar().catch(() => {})
}

/** A finished session, written to the calendar she chose. */
export async function logSession(ses: Pick<FocusSession, 'startedAt' | 'endsAt' | 'label'>, fox: string): Promise<boolean> {
  const { calendar } = getLinks()
  if (!calendar.on || !calendar.logSessions) return false
  const minutes = Math.round((ses.endsAt - ses.startedAt) / 60_000)
  const e = {
    calendar: calendar.logCalendar,
    title: ses.label ? `studied ${ses.label}` : `studied with ${fox}`,
    start: ses.startedAt,
    end: ses.endsAt,
    notes: `${formatMinutes(minutes)} of focus with ${fox} ✿ (TamaLucy)`,
  }
  try {
    const way = calendarWay()
    if (way === 'device') return await native.calendarAdd(e)
    if (way === 'google') return await googleAdd(e)
  } catch {
    // offline, or she revoked access: the session still counts in the app
  }
  return false
}

export function disconnectCalendar() {
  patchLinks('calendar', { on: false, calendars: [], logSessions: false, logCalendar: '', lastSync: 0 })
  if (calendarWay() === 'google') googleForget()
}
