// Sign in once, fox everywhere. Her Google account (through Supabase Auth) is
// bound to her mailbox, so a new device only needs "sign in with Google": the
// mailbox code comes down with it, and with the code her fox, her letters and
// all the rest. The code stays the fallback for a device without an account.
// Nothing here needs a key in the app: Supabase holds the Google client for
// its own sign-in.
import { useSyncExternalStore } from 'react'
import { clearCalendarEvents } from './calendar.ts'
import { SUPABASE_KEY, SUPABASE_URL } from './game/remote.ts'
import { freshState } from './game/state.ts'
import { getGame, setGame } from './game/store.ts'
import { googleForget } from './google.ts'
import { resetLinks } from './links.ts'
import { connectMailbox } from './mail.ts'
import { microsoftForget } from './microsoft.ts'
import { startAuth, tokenStore, tokensFrom, type AuthReturn, type TokenReply } from './oauth.ts'
import { disconnectSpotify } from './spotify.ts'
import { resetSync, syncFor, syncNow } from './sync.ts'

const AUTH = `${SUPABASE_URL}/auth/v1`
const store = tokenStore('tamalucy:account')
const USER_KEY = 'tamalucy:account-user'

export interface AccountUser {
  email: string
  name: string
  picture: string
}

let user: AccountUser | null = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null
    return raw ? (JSON.parse(raw) as AccountUser) : null
  } catch {
    return null
  }
})()
const watchers = new Set<() => void>()
function setUser(u: AccountUser | null) {
  user = u
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // private mode: signed in for this visit only
  }
  watchers.forEach((fn) => fn())
}

/** Who's signed in on this device, if anyone. */
export const accountUser = (): AccountUser | null => (store.get()?.refresh ? user : null)
export function useAccount(): AccountUser | null {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    accountUser,
    accountUser,
  )
}

export type AccountProblem = 'signed-out' | 'offline' | 'server'
export class AccountError extends Error {
  readonly problem: AccountProblem
  constructor(problem: AccountProblem) {
    super(problem)
    this.problem = problem
  }
}

// ── Email and password, for anyone without a Google account ──
export type EmailAuthProblem = 'wrong' | 'unconfirmed' | 'exists' | 'weak' | 'invalid-email' | 'rate' | 'mail' | 'offline' | 'server'
export class EmailAuthError extends Error {
  readonly problem: EmailAuthProblem
  constructor(problem: EmailAuthProblem) {
    super(problem)
    this.problem = problem
  }
}

/** What to tell her when an email sign-in or sign-up didn't go through. */
export function emailProblem(e: unknown): string {
  const p = e instanceof EmailAuthError ? e.problem : 'server'
  if (p === 'wrong') return 'that email and password don’t match.'
  if (p === 'unconfirmed') return 'check your email first: there’s a confirmation link waiting. then sign in here.'
  if (p === 'exists') return 'there’s already an account with that email. sign in instead?'
  if (p === 'weak') return 'pick a longer password (8 characters or more).'
  if (p === 'invalid-email') return 'that doesn’t look like an email address.'
  if (p === 'rate') return 'too many tries in a row. give it a minute?'
  if (p === 'mail') return 'the app couldn’t send you an email just now. whoever set it up needs to check its mail settings; signing in with Google works meanwhile.'
  if (p === 'offline') return 'couldn’t reach the sign-in just now. are you online?'
  return 'the sign-in had a problem. try again in a bit?'
}

async function authPost<T>(path: string, body: Record<string, unknown>, bearer?: string, method = 'POST'): Promise<{ ok: boolean; status: number; json: T | null }> {
  let res: Response
  try {
    res = await fetch(`${AUTH}${path}`, {
      method,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new EmailAuthError('offline')
  }
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => null)) as T | null }
}

function problemFrom(status: number, json: { msg?: string; message?: string; error_description?: string; error_code?: string; code?: string } | null): EmailAuthProblem {
  const text = `${json?.error_code ?? json?.code ?? ''} ${json?.msg ?? json?.message ?? json?.error_description ?? ''}`.toLowerCase()
  if (status === 429 || /rate/.test(text)) return 'rate'
  if (/not authorized|error sending|sending.*(email|mail)|smtp/.test(text)) return 'mail'
  if (/not confirmed|email_not_confirmed/.test(text)) return 'unconfirmed'
  if (/already|exists|user_already/.test(text)) return 'exists'
  if (/password.*(short|weak|at least)|weak_password|password should/.test(text)) return 'weak'
  if (/invalid.*email|email_address_invalid|validate email/.test(text)) return 'invalid-email'
  if (/invalid.*credentials|invalid_grant|invalid login/.test(text) || status === 400 || status === 401) return 'wrong'
  return 'server'
}

function remember(s: Session) {
  store.set(tokensFrom(s))
  const m = s.user?.user_metadata ?? {}
  setUser({ email: s.user?.email ?? '', name: m.full_name ?? m.name ?? '', picture: m.avatar_url ?? m.picture ?? '' })
}

/** Sign in with an email and password. Throws an EmailAuthError saying why not. */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const r = await authPost<Session>('/token?grant_type=password', { email: email.trim(), password })
  if (!r.ok || !r.json?.access_token) throw new EmailAuthError(problemFrom(r.status, r.json as never))
  remember(r.json)
}

/**
 * Make an account. Resolves to 'signed-in' when the project lets new accounts
 * straight in, or 'confirm' when a confirmation link was emailed first (the
 * link brings her back signed in: see takeEmailLink).
 */
export async function registerWithEmail(email: string, password: string): Promise<'signed-in' | 'confirm'> {
  if (password.length < 8) throw new EmailAuthError('weak')
  const r = await authPost<Session & { id?: string; identities?: unknown[] }>('/signup', { email: email.trim(), password, data: {}, options: { email_redirect_to: siteUrl() } })
  if (!r.ok) throw new EmailAuthError(problemFrom(r.status, r.json as never))
  if (r.json?.access_token) {
    remember(r.json)
    return 'signed-in'
  }
  // an existing, confirmed address comes back as a user with no identities (Supabase doesn't say outright)
  if (r.json && Array.isArray(r.json.identities) && r.json.identities.length === 0) throw new EmailAuthError('exists')
  return 'confirm'
}

/** Email a password-reset link that comes back here. */
export async function sendPasswordReset(email: string): Promise<void> {
  const r = await authPost('/recover', { email: email.trim(), redirect_to: siteUrl() })
  if (!r.ok) throw new EmailAuthError(problemFrom(r.status, r.json as never))
}

/** A new password, for the account signed in right now (after a reset link). */
export async function setPassword(password: string): Promise<void> {
  if (password.length < 8) throw new EmailAuthError('weak')
  const t = await token()
  if (!t) throw new EmailAuthError('wrong')
  const r = await authPost('/user', { password }, t, 'PUT')
  if (!r.ok) throw new EmailAuthError(problemFrom(r.status, r.json as never))
}

const siteUrl = () => location.origin + location.pathname.replace(/index\.html$/, '')

export type EmailLink = 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change' | 'other'

/**
 * On load: a confirmation or reset link from an email brings tokens in the
 * address bar's hash. Keep the session, tidy the bar, say which kind it was.
 */
export async function takeEmailLink(): Promise<EmailLink | null> {
  if (typeof location === 'undefined' || !location.hash.includes('access_token=')) return null
  const h = new URLSearchParams(location.hash.slice(1))
  const access = h.get('access_token')
  const refresh = h.get('refresh_token') ?? ''
  const type = (h.get('type') ?? 'other') as EmailLink
  history.replaceState(null, '', siteUrl())
  if (!access) return null
  store.set({ access, refresh, exp: Date.now() + Number(h.get('expires_in') ?? 3600) * 1000 })
  try {
    const me = await authPost<{ email?: string; user_metadata?: { full_name?: string; name?: string } }>('/user', {}, access, 'GET')
    setUser({ email: me.json?.email ?? '', name: me.json?.user_metadata?.full_name ?? me.json?.user_metadata?.name ?? '', picture: '' })
  } catch {
    setUser({ email: '', name: '', picture: '' })
  }
  return type
}

/** Off to Google, through Supabase; App (or the sheet, in the apps) finishes the trip. */
export function signInWithGoogle(): Promise<AuthReturn | null> {
  return startAuth('account', `${AUTH}/authorize`, { provider: 'google' }, { plain: true })
}

interface Session extends TokenReply {
  user?: { email?: string; user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string } }
}

async function tokenCall(grant: string, body: Record<string, string>): Promise<Session | null> {
  const res = await fetch(`${AUTH}/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const j = (await res.json().catch(() => null)) as Session | null
  return res.ok && j?.access_token ? j : null
}

/** Back from Google: trade the code for a session and remember who she is. */
export async function finishAccountLogin(r: AuthReturn): Promise<boolean> {
  if (!r.code) return false
  let s: Session | null
  try {
    s = await tokenCall('pkce', { auth_code: r.code, code_verifier: r.verifier })
  } catch {
    return false
  }
  if (!s) return false
  store.set(tokensFrom(s))
  const m = s.user?.user_metadata ?? {}
  setUser({ email: s.user?.email ?? '', name: m.full_name ?? m.name ?? '', picture: m.avatar_url ?? m.picture ?? '' })
  return true
}

async function token(): Promise<string | null> {
  const t = store.get()
  if (!t) return null
  if (t.exp > Date.now() + 30_000) return t.access
  let s: Session | null
  try {
    s = await tokenCall('refresh_token', { refresh_token: t.refresh })
  } catch {
    throw new AccountError('offline')
  }
  if (!s) {
    // the session was revoked or expired for good: signed out here
    store.set(null)
    setUser(null)
    return null
  }
  store.set(tokensFrom(s, t.refresh))
  return s.access_token
}

/** A database function, as the signed-in account. */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const t = await token()
  if (!t) throw new AccountError('signed-out')
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new AccountError('offline')
  }
  if (!res.ok) throw new AccountError(res.status === 401 ? 'signed-out' : 'server')
  return (await res.json()) as T
}

export type AttachOutcome = 'claimed' | 'fetched' | 'connected' | 'new'

// ── "just looking": the preview (and ?debug) can get past the front door without an account ──
const GUEST_KEY = 'tamalucy:guest'
export function isGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}
export function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1')
    else localStorage.removeItem(GUEST_KEY)
  } catch {
    // fine
  }
}

const WRITER_KEY = 'tamalucy:writer-key'
/** The key whoever writes her letters needs (only a mailbox made here has one to show). */
export function writerKey(): string {
  try {
    return localStorage.getItem(WRITER_KEY) ?? ''
  } catch {
    return ''
  }
}

/** First time here: a mailbox of her own, made on the spot and bound to the account. */
export async function startFreshMailbox(): Promise<boolean> {
  const r = await rpc<{ code?: string; writer?: string }>('tl_claim_new_mailbox')
  if (!r?.code || !(await connectMailbox(r.code))) return false
  if (r.writer) {
    try {
      localStorage.setItem(WRITER_KEY, r.writer)
    } catch {
      // fine
    }
  }
  return true
}

/**
 * Right after signing in: a device that has her mailbox attaches it to the
 * account; a device without one asks the account for it, and with the code
 * comes the fox.
 */
export async function attachAccount(): Promise<AttachOutcome> {
  const local = getGame().mailbox
  if (local) {
    await rpc('tl_claim_mailbox', { p_code: local })
    return 'claimed'
  }
  const code = await rpc<string | null>('tl_my_mailbox')
  if (!code) {
    // nothing behind this account yet: a mailbox of her own, made now. a fox that
    // already lives here is saved under it; otherwise the intro meets a new one
    if (!(await startFreshMailbox())) throw new AccountError('server')
    if (!getGame().onboarded) return 'new'
    await syncNow()
    return 'claimed'
  }
  if (!(await connectMailbox(code))) throw new AccountError('server')
  await syncNow()
  // the mailbox is hers now; whether a fox came down with it is another matter
  return getGame().onboarded ? 'fetched' : 'connected'
}

/** Attach this device's mailbox to the account later (she connected a code after signing in). */
export async function claimMailbox(): Promise<boolean> {
  if (!accountUser() || !getGame().mailbox) return false
  await rpc('tl_claim_mailbox', { p_code: getGame().mailbox })
  return true
}

/**
 * Sign out of this device, like any app: the fox is saved to the cloud first,
 * then the device is left as blank as a new one, first screen and all. The
 * fox, the letters and the account's binding are all still there in the cloud
 * and come back with the next sign-in, here or anywhere.
 */
export async function signOutDevice(): Promise<void> {
  if (getGame().mailbox) {
    try {
      await syncFor(8000)
    } catch {
      // offline: the cloud has the last sync's copy
    }
  }
  await signOut()
  try {
    googleForget()
    microsoftForget()
    disconnectSpotify()
  } catch {
    // nothing linked
  }
  clearCalendarEvents()
  resetLinks()
  resetSync()
  setGuest(false)
  try {
    localStorage.removeItem('tamalucy:weather')
    localStorage.removeItem('tamalucy:oauth')
    localStorage.removeItem(WRITER_KEY)
  } catch {
    // fine
  }
  setGame(freshState(Date.now()))
}

/** Drop the account on this device only. The mailbox, the fox and the account's binding all stay. */
export async function signOut(): Promise<void> {
  const t = store.get()
  store.set(null)
  setUser(null)
  if (!t) return
  try {
    await fetch(`${AUTH}/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t.access}` }, signal: AbortSignal.timeout(8000) })
  } catch {
    // the session will expire on its own
  }
}
