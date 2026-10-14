// Her calendars and the app, both ways: her events come in (lectures on the
// calendar page; exams and deadlines on the exams list, so she never types a
// date twice), and finished sessions go out (a record of the work). Three
// kinds of calendar: the device's own (EventKit, in the apps), Google Calendar
// (the web, if a key was set up), and any calendar by its subscription address
// (iCloud, Outlook, Canvas, a school's feed) through a small relay, since
// browsers can't read those addresses across origins.
import { useSyncExternalStore } from 'react'
import { fromCalendar, HORIZON_DAYS, importEvents } from './game/external.ts'
import { feedUrl, parseIcs } from './game/ics.ts'
import { FUNCTIONS_URL, SUPABASE_KEY } from './game/remote.ts'
import type { FocusSession } from './game/state.ts'
import { getGame, setGame } from './game/store.ts'
import { formatMinutes } from './hooks.ts'
import { getLinks, patchLinks, type Feed } from './links.ts'
import { isNativeApp, native, type CalendarAccess, type CalendarInfo, type NativeEvent } from './native.ts'
import { googleAdd, googleCalendars, googleConnected, googleEvents, googleForget, googleToken, hasGoogle } from './google.ts'
import { cantReach } from './preview.ts'

export type CalendarWay = 'device' | 'google' | null

/** How this device can reach a calendar of its own, if at all. */
export const calendarWay = (): CalendarWay => (isNativeApp ? 'device' : hasGoogle() ? 'google' : null)

const DAY = 86_400_000
/** How far back the calendar page keeps events. */
const BACK_DAYS = 31

/** An event from any of her calendars, as the calendar page shows it. */
export interface CalEvent extends NativeEvent {
  source: 'device' | 'google' | 'feed'
  /** The calendar's colour, if it has one. */
  color?: string
  /** The calendar's name, to show and to match classes by. */
  calendarName: string
}

// ── Her events, kept on this device so the calendar page has them offline ──
const EVENTS_KEY = 'tamalucy:calendar-events'
let cache: { at: number; events: CalEvent[] } = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(EVENTS_KEY) : null
    if (raw) {
      const p = JSON.parse(raw) as { at?: number; events?: CalEvent[] }
      if (Array.isArray(p.events)) return { at: p.at ?? 0, events: p.events }
    }
  } catch {
    // unreadable: start empty, the next sync fills it
  }
  return { at: 0, events: [] }
})()
const watchers = new Set<() => void>()
function writeCache(next: typeof cache) {
  cache = next
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(next))
  } catch {
    // full or private: the page still has them until reload
  }
  watchers.forEach((fn) => fn())
}
export const calendarEvents = () => cache.events
export function useCalendarEvents(): CalEvent[] {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => cache.events,
    () => cache.events,
  )
}

/** Something is linked: the device's calendar, Google, or a feed that's switched on. */
export const calendarLinked = () => {
  const { calendar } = getLinks()
  return calendar.on || calendar.feeds.some((f) => f.on)
}

// ── Calendars by address, through the relay ──
export type FeedProblem = 'no-mailbox' | 'bad-url' | 'not-a-calendar' | 'not-found' | 'too-big' | 'offline' | 'limit' | 'server'

export class FeedError extends Error {
  readonly problem: FeedProblem
  constructor(problem: FeedProblem) {
    super(problem)
    this.problem = problem
  }
}

/** What to tell her when a feed can't be read. */
export function feedProblem(e: unknown): string {
  const p = e instanceof FeedError ? e.problem : 'server'
  if (p === 'no-mailbox') return 'connect your mailbox first (settings → account): it’s what lets the relay know it’s you.'
  if (p === 'bad-url') return 'that doesn’t look like a calendar address. it should start with https:// or webcal://.'
  if (p === 'not-a-calendar') return 'that address doesn’t give back a calendar. look for a link that ends in .ics, or starts with webcal://.'
  if (p === 'not-found') return 'nothing there. a private address may have been reset: copy it again from the calendar?'
  if (p === 'too-big') return 'that calendar is too big to read (over 3 MB).'
  if (p === 'limit') return 'that’s a lot of calendar checks for one day. try again tomorrow?'
  if (p === 'offline') return cantReach('your calendar', 'couldn’t reach it just now. are you online?')
  return 'the relay had a problem reading it. try again in a bit?'
}

async function fetchFeed(url: string): Promise<string> {
  const code = getGame().mailbox
  if (!code) throw new FeedError('no-mailbox')
  let res: Response
  try {
    res = await fetch(`${FUNCTIONS_URL}/calendar-feed`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, url }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new FeedError('offline')
  }
  const body = (await res.json().catch(() => null)) as { status?: number; text?: string; error?: string } | null
  if (res.status === 429) throw new FeedError('limit')
  if (!res.ok || !body) {
    const p = body?.error
    throw new FeedError(p === 'bad-url' || p === 'not-a-calendar' || p === 'too-big' || p === 'no-mailbox' || p === 'offline' ? p : 'server')
  }
  if (body.status && body.status >= 400) throw new FeedError(body.status === 404 || body.status === 410 || body.status === 401 || body.status === 403 ? 'not-found' : 'server')
  return body.text ?? ''
}

/** Try an address before linking it: what the calendar calls itself, and how much it holds around now. */
export async function previewFeed(address: string): Promise<{ url: string; name: string; count: number }> {
  const url = feedUrl(address)
  if (!url) throw new FeedError('bad-url')
  const now = Date.now()
  const cal = parseIcs(await fetchFeed(url), now - BACK_DAYS * DAY, now + HORIZON_DAYS * DAY)
  let name = cal.name
  if (!name) {
    try {
      name = new URL(url).hostname.replace(/^(www|p\d+-caldav)\./, '')
    } catch {
      name = 'calendar'
    }
  }
  return { url, name, count: cal.events.length }
}

export async function addFeed(f: { url: string; name: string; color: string }): Promise<Feed> {
  const feed: Feed = { id: `f${Date.now().toString(36)}`, name: f.name.trim().slice(0, 40) || 'calendar', url: f.url, color: f.color, on: true }
  patchLinks('calendar', { feeds: [...getLinks().calendar.feeds, feed] })
  await syncCalendar()
  return feed
}

export function updateFeed(id: string, patch: Partial<Pick<Feed, 'name' | 'color' | 'on'>>) {
  patchLinks('calendar', { feeds: getLinks().calendar.feeds.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  if (patch.on === false) writeCache({ at: cache.at, events: cache.events.filter((e) => e.calendar !== id) })
  else writeCache({ at: cache.at, events: cache.events.map((e) => (e.calendar === id ? { ...e, calendarName: patch.name ?? e.calendarName, color: patch.color ?? e.color } : e)) })
  syncCalendar().catch(() => {})
}

export function removeFeed(id: string) {
  patchLinks('calendar', { feeds: getLinks().calendar.feeds.filter((f) => f.id !== id) })
  writeCache({ at: cache.at, events: cache.events.filter((e) => e.calendar !== id) })
  syncCalendar().catch(() => {})
}

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

/**
 * Read every linked calendar: all events onto the calendar page, the ones that
 * read like exams or deadlines onto the exams list. A calendar that can't be
 * read right now keeps what it had. Resolves to how many exams and deadlines
 * came from calendars; rejects (after doing the rest) if any calendar failed.
 */
export function syncCalendar(): Promise<number> {
  if (syncing) return syncing
  syncing = (async () => {
    const { calendar } = getLinks()
    const now = Date.now()
    const from = now - BACK_DAYS * DAY
    const to = now + HORIZON_DAYS * DAY
    const fresh: CalEvent[] = []
    const failed = new Set<string>()
    if (calendar.on && calendar.calendars.length) {
      try {
        const cals = await listCalendars()
        const found = await events(calendar.calendars, from, to)
        const source = calendarWay() === 'google' ? 'google' : 'device'
        for (const e of found) {
          const c = cals.find((x) => x.id === e.calendar)
          fresh.push({ ...e, source, color: c?.color, calendarName: c?.title ?? '' })
        }
      } catch {
        for (const id of calendar.calendars) failed.add(id)
      }
    }
    for (const f of calendar.feeds) {
      if (!f.on) continue
      try {
        const cal = parseIcs(await fetchFeed(f.url), from, to)
        for (const e of cal.events) fresh.push({ ...e, calendar: f.id, source: 'feed', color: f.color, calendarName: f.name })
      } catch {
        failed.add(f.id)
      }
    }
    const kept = cache.events.filter((e) => failed.has(e.calendar) && e.end >= from)
    const all = [...fresh, ...kept].sort((a, b) => a.start - b.start)
    writeCache({ at: now, events: all })
    const items = all.map((e) => fromCalendar({ ...e, calendar: e.calendarName })).filter((e): e is NonNullable<typeof e> => !!e)
    setGame((s) => importEvents(s, 'calendar', items, now))
    patchLinks('calendar', { lastSync: now })
    if (failed.size) throw new FeedError('offline')
    return getGame().exams.filter((e) => e.source === 'calendar').length
  })().finally(() => {
    syncing = null
  })
  return syncing
}

/** Sync in the background if it's been a while (every time the app opens). */
export function syncCalendarIfStale(hours = 6) {
  const { calendar } = getLinks()
  if (!calendarLinked() || Date.now() - calendar.lastSync < hours * 3_600_000) return
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

/** Let go of the device's calendar (or Google). Calendars linked by address stay. */
export function disconnectCalendar() {
  patchLinks('calendar', { on: false, calendars: [], logSessions: false, logCalendar: '' })
  if (calendarWay() === 'google') googleForget()
  syncCalendar().catch(() => {})
}
