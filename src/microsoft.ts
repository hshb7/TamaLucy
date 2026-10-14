// Outlook (Microsoft 365 and personal Microsoft accounts) for the web app,
// signed in once: she taps "sign in with Microsoft", says yes, and comes back
// linked for good. Authorization Code with PKCE straight from the browser,
// which Microsoft allows for a "single-page application" registration, so no
// secret and no relay: just the public client id (VITE_MICROSOFT_CLIENT_ID).
// Without one this file is inert. The iPhone and Mac apps read the device's
// calendar instead, where her Outlook account can already be.
import type { CalendarInfo, NativeEvent } from './native.ts'
import { returnUrl, startAuth, tokenStore, tokensFrom, type AuthReturn, type TokenReply } from './oauth.ts'

const CLIENT_ID = (import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined)?.trim() ?? ''
const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH = 'https://graph.microsoft.com/v1.0'
const SCOPE = 'openid offline_access User.Read Calendars.ReadWrite'
const store = tokenStore('tamalucy:microsoft')

export const hasMicrosoft = () => !!CLIENT_ID
export const microsoftConnected = () => !!store.get()?.refresh

export function connectMicrosoft(): Promise<void> {
  return startAuth('microsoft', `${AUTH}/authorize`, { client_id: CLIENT_ID, scope: SCOPE, response_mode: 'query', prompt: 'select_account' })
}

async function tokenCall(body: Record<string, string>): Promise<TokenReply | null> {
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const j = (await res.json().catch(() => null)) as TokenReply | null
  return res.ok && j?.access_token ? j : null
}

/** Back from Microsoft: trade the code for tokens. */
export async function finishMicrosoftLogin(r: AuthReturn): Promise<boolean> {
  if (!r.code) return false
  const reply = await tokenCall({ grant_type: 'authorization_code', code: r.code, redirect_uri: returnUrl(), code_verifier: r.verifier })
  if (!reply) return false
  store.set(tokensFrom(reply))
  return true
}

export function microsoftForget() {
  store.set(null)
}

async function token(): Promise<string | null> {
  const t = store.get()
  if (!t) return null
  if (t.exp > Date.now() + 30_000) return t.access
  const reply = await tokenCall({ grant_type: 'refresh_token', refresh_token: t.refresh })
  if (!reply) {
    store.set(null)
    return null
  }
  store.set(tokensFrom(reply, t.refresh))
  return reply.access_token
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  if (!t) throw new Error('not signed in')
  const url = path.startsWith('https://') ? path : `${GRAPH}${path}`
  const res = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"' } })
  if (res.status === 401) {
    microsoftForget()
    throw new Error('not signed in')
  }
  if (!res.ok) throw new Error(`graph ${res.status}`)
  return (await res.json()) as T
}

/** Who she is there, to show. */
export async function microsoftMe(): Promise<string> {
  const me = await api<{ displayName?: string; mail?: string; userPrincipalName?: string }>('/me?$select=displayName,mail,userPrincipalName')
  return me.displayName || me.mail || me.userPrincipalName || 'Microsoft account'
}

interface MCal {
  id: string
  name: string
  hexColor?: string
  canEdit?: boolean
}

export async function microsoftCalendars(): Promise<CalendarInfo[]> {
  const r = await api<{ value?: MCal[] }>('/me/calendars?$select=id,name,hexColor,canEdit&$top=50')
  return (r.value ?? []).map((c) => ({ id: c.id, title: c.name, color: c.hexColor && /^#/.test(c.hexColor) ? c.hexColor : undefined, writable: c.canEdit !== false }))
}

export interface GraphEvent {
  id: string
  subject?: string
  isAllDay?: boolean
  isCancelled?: boolean
  seriesMasterId?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
}

/** Graph hands times back in the zone we asked for (UTC); an all-day event is a date at midnight. */
export function graphEvent(e: GraphEvent, calendar: string): NativeEvent | null {
  if (e.isCancelled || !e.start?.dateTime) return null
  const stamp = (t: { dateTime: string; timeZone?: string }) => {
    if (e.isAllDay) {
      const [y, m, d] = t.dateTime.slice(0, 10).split('-').map(Number)
      return new Date(y, m - 1, d).getTime()
    }
    const iso = t.dateTime.replace(/(\.\d{3})\d+$/, '$1')
    return Date.parse(t.timeZone === 'UTC' || !t.timeZone ? iso + 'Z' : iso)
  }
  const start = stamp(e.start)
  if (!isFinite(start)) return null
  const end = e.end?.dateTime ? stamp(e.end) : start
  return { id: e.seriesMasterId ?? e.id, title: e.subject ?? '', start, end: isFinite(end) ? end : start, allDay: !!e.isAllDay, recurring: !!e.seriesMasterId, calendar }
}

export async function microsoftEvents(calendars: string[], from: number, to: number): Promise<NativeEvent[]> {
  const out: NativeEvent[] = []
  for (const id of calendars) {
    const q = new URLSearchParams({ startDateTime: new Date(from).toISOString(), endDateTime: new Date(to).toISOString(), $select: 'id,subject,start,end,isAllDay,isCancelled,seriesMasterId', $top: '200' })
    let next: string | null = `/me/calendars/${encodeURIComponent(id)}/calendarView?${q}`
    for (let page = 0; next && page < 6; page++) {
      const r: { value?: GraphEvent[]; '@odata.nextLink'?: string } = await api(next)
      for (const e of r.value ?? []) {
        const ev = graphEvent(e, id)
        if (ev) out.push(ev)
      }
      next = r['@odata.nextLink'] ?? null
    }
  }
  return out
}

export async function microsoftAdd(e: { calendar: string; title: string; start: number; end: number; notes: string }): Promise<boolean> {
  await api(e.calendar ? `/me/calendars/${encodeURIComponent(e.calendar)}/events` : '/me/events', {
    method: 'POST',
    body: JSON.stringify({
      subject: e.title,
      body: { contentType: 'text', content: e.notes },
      start: { dateTime: new Date(e.start).toISOString().replace('Z', ''), timeZone: 'UTC' },
      end: { dateTime: new Date(e.end).toISOString().replace('Z', ''), timeZone: 'UTC' },
    }),
  })
  return true
}
