// Google Calendar for the web app (the iPhone and Mac apps use the calendar
// built into the device instead). Needs a Google OAuth client id, set at build
// time as VITE_GOOGLE_CLIENT_ID; without one this whole file is inert.
import type { CalendarInfo, NativeEvent } from './native.ts'

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
const API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_KEY = 'tamalucy:gcal'

export const hasGoogle = () => !!CLIENT_ID

interface TokenClient {
  requestAccessToken(o: { prompt: string }): void
}
interface Gis {
  accounts: { oauth2: { initTokenClient(o: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void }): TokenClient } }
}

let token: { value: string; exp: number } | null = (() => {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as { value: string; exp: number }) : null
  } catch {
    return null
  }
})()

export const googleConnected = () => !!token && token.exp > Date.now()

function gis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis }
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error('no google')))
    s.onerror = () => reject(new Error('offline'))
    document.head.appendChild(s)
  })
}

/** A token, asking her to sign in if we don't have one (`interactive`) or quietly if we do. */
export async function googleToken(interactive: boolean): Promise<string | null> {
  if (!CLIENT_ID) return null
  if (token && token.exp > Date.now() + 60_000) return token.value
  if (!interactive && !token) return null
  const g = await gis()
  return new Promise((resolve) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return resolve(null)
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
        } catch {
          // fine
        }
        resolve(token.value)
      },
    })
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

export function googleForget() {
  token = null
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // fine
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await googleToken(false)
  if (!t) throw new Error('not signed in')
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } })
  if (res.status === 401) {
    googleForget()
    throw new Error('not signed in')
  }
  if (!res.ok) throw new Error(`google ${res.status}`)
  return (await res.json()) as T
}

interface GCal {
  id: string
  summary: string
  backgroundColor?: string
  accessRole: string
}
interface GEvent {
  id: string
  summary?: string
  status?: string
  recurringEventId?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

export async function googleCalendars(): Promise<CalendarInfo[]> {
  const r = await api<{ items?: GCal[] }>('/users/me/calendarList?minAccessRole=reader&maxResults=100')
  return (r.items ?? []).map((c) => ({ id: c.id, title: c.summary, color: c.backgroundColor, writable: c.accessRole === 'owner' || c.accessRole === 'writer' }))
}

const when = (t?: { date?: string; dateTime?: string }) => (t?.dateTime ? Date.parse(t.dateTime) : t?.date ? new Date(t.date + 'T12:00').getTime() : NaN)

export async function googleEvents(calendars: string[], from: number, to: number): Promise<NativeEvent[]> {
  const out: NativeEvent[] = []
  for (const id of calendars) {
    const q = new URLSearchParams({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })
    const r = await api<{ items?: GEvent[] }>(`/calendars/${encodeURIComponent(id)}/events?${q}`)
    for (const e of r.items ?? []) {
      if (e.status === 'cancelled') continue
      const start = when(e.start)
      if (!isFinite(start)) continue
      // occurrences of a repeating event share its id, like EventKit's
      out.push({ id: e.recurringEventId ?? e.id, title: e.summary ?? '', start, end: when(e.end) || start, allDay: !!e.start?.date, recurring: !!e.recurringEventId, calendar: id })
    }
  }
  return out
}

export async function googleAdd(e: { calendar: string; title: string; start: number; end: number; notes: string }): Promise<boolean> {
  await api(`/calendars/${encodeURIComponent(e.calendar || 'primary')}/events`, {
    method: 'POST',
    body: JSON.stringify({ summary: e.title, description: e.notes, start: { dateTime: new Date(e.start).toISOString() }, end: { dateTime: new Date(e.end).toISOString() } }),
  })
  return true
}
