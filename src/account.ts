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

export type AttachOutcome = 'claimed' | 'fetched' | 'connected' | 'empty'

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
  if (!code || !(await connectMailbox(code))) return 'empty'
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
  try {
    localStorage.removeItem('tamalucy:weather')
    localStorage.removeItem('tamalucy:oauth')
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
