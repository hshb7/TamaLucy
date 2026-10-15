// One round trip to a sign-in page and back, shared by Spotify, Google and
// Microsoft: Authorization Code with PKCE. The app leaves for the provider's
// page, she taps "allow", and the provider sends her back here with a code.
// No secret lives in the app; a public client id is all it carries.
import { isNativeApp, native } from './native.ts'

export type OAuthProvider = 'spotify' | 'google' | 'microsoft' | 'account'

const TRIP_KEY = 'tamalucy:oauth'

interface Trip {
  provider: OAuthProvider
  verifier: string
  state: string
  at: number
  /** Supabase's own authorize endpoint: it keeps no state of ours and sends back only ?code. */
  plain?: boolean
}

export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const randomString = (bytes = 48) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))

/** The S256 challenge for a verifier (RFC 7636). */
export async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest))
}

/** Where a sign-in page sends her back: this very page. It has to be listed, exactly, in each provider's dashboard. */
export const returnUrl = () => location.origin + location.pathname.replace(/index\.html$/, '')

export interface StartOptions {
  /** Supabase's authorize endpoint: `redirect_to`, a lowercase method, no state of ours. */
  plain?: boolean
}

/**
 * Off to the provider's sign-in page. On the web this leaves the page and
 * resolves to null: `takeAuthReturn` picks the trip up when she's back. In the
 * iPhone and Mac apps the page opens in the system's sign-in sheet and the
 * answer comes straight back here, so this resolves to it.
 */
export async function startAuth(provider: OAuthProvider, authorizeUrl: string, params: Record<string, string>, opts: StartOptions = {}): Promise<AuthReturn | null> {
  const verifier = randomString(48)
  const state = randomString(12)
  const trip: Trip = { provider, verifier, state, at: Date.now(), plain: !!opts.plain }
  const code_challenge = await challenge(verifier)
  const u = new URL(authorizeUrl)
  u.search = new URLSearchParams(
    opts.plain
      ? { ...params, redirect_to: returnUrl(), code_challenge, code_challenge_method: 's256' }
      : { ...params, response_type: 'code', redirect_uri: returnUrl(), state, code_challenge_method: 'S256', code_challenge },
  ).toString()
  if (isNativeApp) return fromCallback(await native.authOpen(u.toString()), trip)
  localStorage.setItem(TRIP_KEY, JSON.stringify(trip))
  location.assign(u.toString())
  return null
}

export interface AuthReturn {
  provider: OAuthProvider
  /** The code to trade for tokens, or null when she said no (or something went wrong). */
  code: string | null
  verifier: string
}

/** What a callback URL (tamalucy://app/?code=…&state=…) brought back, checked against the trip. */
function fromCallback(url: string, trip: Trip): AuthReturn {
  let code: string | null = null
  let state: string | null = null
  try {
    const u = new URL(url)
    code = u.searchParams.get('code')
    state = u.searchParams.get('state')
  } catch {
    // she closed the sheet
  }
  const ok = !!code && (trip.plain || state === trip.state)
  return { provider: trip.provider, code: ok ? code : null, verifier: trip.verifier }
}

/** On load: if a sign-in page just sent her back, what it brought (and the address bar is tidy again). */
export function takeAuthReturn(): AuthReturn | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search)
  const code = q.get('code')
  const state = q.get('state')
  if (!code && !q.get('error')) return null
  const raw = localStorage.getItem(TRIP_KEY)
  localStorage.removeItem(TRIP_KEY)
  history.replaceState(null, '', returnUrl() + location.hash)
  if (!raw) return null
  const trip = JSON.parse(raw) as Trip
  const fresh = Date.now() - trip.at < 30 * 60_000
  const ok = !!code && fresh && (trip.plain || state === trip.state)
  return { provider: trip.provider, code: ok ? code : null, verifier: trip.verifier }
}

// ── Tokens, kept on this device ──
export interface Tokens {
  access: string
  refresh: string
  /** When `access` stops working (ms). */
  exp: number
}

export function tokenStore(key: string) {
  let tokens: Tokens | null = (() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      return raw ? (JSON.parse(raw) as Tokens) : null
    } catch {
      return null
    }
  })()
  return {
    get: () => tokens,
    set(next: Tokens | null) {
      tokens = next
      try {
        if (next) localStorage.setItem(key, JSON.stringify(next))
        else localStorage.removeItem(key)
      } catch {
        // private mode: linked for this visit only
      }
    },
  }
}

/** What a token endpoint answers, in the shape every provider shares. */
export interface TokenReply {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export const tokensFrom = (r: TokenReply, oldRefresh = ''): Tokens => ({ access: r.access_token, refresh: r.refresh_token ?? oldRefresh, exp: Date.now() + r.expires_in * 1000 })
