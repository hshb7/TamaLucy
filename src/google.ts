// Google Calendar for the web app, signed in once: she taps "sign in with
// Google", says yes on Google's page, and comes back linked for good (a
// refresh token). The code is traded for tokens by a small Edge Function,
// google-auth, because Google wants the client secret at that step; the app
// itself only carries the public client id (VITE_GOOGLE_CLIENT_ID). Without
// one this whole file is inert. The iPhone and Mac apps read the device's
// calendar instead, where her Google account already is.
import { FUNCTIONS_URL, SUPABASE_KEY } from './game/remote.ts'
import { getGame } from './game/store.ts'
import type { CalendarInfo, NativeEvent } from './native.ts'
import { startAuth, tokenStore, tokensFrom, type AuthReturn, type TokenReply } from './oauth.ts'

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
const API = 'https://www.googleapis.com/calendar/v3'
const store = tokenStore('tamalucy:google')

export const hasGoogle = () => !!CLIENT_ID
export const googleConnected = () => !!store.get()?.refresh

/** Leave for Google's sign-in page. */
export function connectGoogle(): Promise<void> {
  return startAuth('google', 'https://accounts.google.com/o/oauth2/v2/auth', {
    client_id: CLIENT_ID,
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
}

/** The token step, through google-auth (which holds the client secret and needs her mailbox code). */
async function exchange(body: Record<string, string>): Promise<TokenReply | null> {
  const code = getGame().mailbox
  if (!code) return null
  const res = await fetch(`${FUNCTIONS_URL}/google-auth`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const j = (await res.json().catch(() => null)) as (TokenReply & { error?: string }) | null
  return res.ok && j?.access_token ? j : null
}

/** Back from Google: trade the code for tokens. */
export async function finishGoogleLogin(r: AuthReturn): Promise<boolean> {
  if (!r.code) return false
  const reply = await exchange({ grant: 'code', auth_code: r.code, verifier: r.verifier, redirect_uri: location.origin + location.pathname.replace(/index\.html$/, '') })
  if (!reply) return false
  store.set(tokensFrom(reply))
  return true
}

export function googleForget() {
  store.set(null)
}

async function token(): Promise<string | null> {
  const t = store.get()
  if (!t) return null
  if (t.exp > Date.now() + 30_000) return t.access
  const reply = await exchange({ grant: 'refresh', refresh_token: t.refresh })
  if (!reply) return null
  store.set(tokensFrom(reply, t.refresh))
  return reply.access_token
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
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

const when = (t?: { date?: string; dateTime?: string }) => (t?.dateTime ? Date.parse(t.dateTime) : t?.date ? new Date(t.date + 'T00:00').getTime() : NaN)

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
