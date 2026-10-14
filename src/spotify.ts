// Spotify, linked to her account, so a playlist can start with the timer
// anywhere Spotify is open: the web app, the iPhone, the Mac. Authorization
// Code with PKCE: there's no secret anywhere, only a public client id, set at
// build time as VITE_SPOTIFY_CLIENT_ID (see the README). Without one this
// whole file is inert and the music card just explains itself.
import { patchLinks } from './links.ts'
import { isNativeApp, type Playlist } from './native.ts'

const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() ?? ''
const SCOPE = 'playlist-read-private playlist-read-collaborative user-read-private user-read-playback-state user-modify-playback-state'
const ACCOUNTS = 'https://accounts.spotify.com'
const API = 'https://api.spotify.com/v1'
const KEY = 'tamalucy:spotify'
const ROUND_TRIP = 'tamalucy:spotify-login'

export const hasSpotify = () => !!CLIENT_ID

interface Tokens {
  access: string
  refresh: string
  /** When `access` stops working (ms). */
  exp: number
}

let tokens: Tokens | null = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
})()

function save(t: Tokens | null) {
  tokens = t
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  } catch {
    // private mode: linked for this visit only
  }
}

export const spotifyConnected = () => !!tokens?.refresh

/** Where Spotify sends her back: this very page. It has to be listed, exactly, in the Spotify dashboard. */
export const spotifyRedirect = () => location.origin + location.pathname.replace(/index\.html$/, '')

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest))
}

/** Send her to Spotify to sign in; `finishSpotifyLogin` picks it up when she's back. */
export async function connectSpotify(): Promise<void> {
  if (!CLIENT_ID) throw new Error('no spotify client id')
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)))
  localStorage.setItem(ROUND_TRIP, JSON.stringify({ verifier, state }))
  const u = new URL(`${ACCOUNTS}/authorize`)
  u.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: spotifyRedirect(),
    scope: SCOPE,
    state,
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
  }).toString()
  location.assign(u.toString())
}

async function tokenCall(body: Record<string, string>): Promise<Tokens | null> {
  const r = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  })
  if (!r.ok) return null
  const j = (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  return { access: j.access_token, refresh: j.refresh_token ?? body.refresh_token ?? '', exp: Date.now() + j.expires_in * 1000 }
}

/** On load: if Spotify just sent her back here, finish signing in. */
export async function finishSpotifyLogin(): Promise<'linked' | 'failed' | null> {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search)
  const code = q.get('code')
  const state = q.get('state')
  if (!code && !q.get('error')) return null
  const raw = localStorage.getItem(ROUND_TRIP)
  localStorage.removeItem(ROUND_TRIP)
  // the address bar is tidy again either way
  history.replaceState(null, '', spotifyRedirect() + location.hash)
  if (!raw || !code) return 'failed'
  const trip = JSON.parse(raw) as { verifier: string; state: string }
  if (!state || state !== trip.state) return 'failed'
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: spotifyRedirect(), code_verifier: trip.verifier })
  if (!t) return 'failed'
  save(t)
  try {
    const me = await spotifyMe()
    patchLinks('music', { player: 'spotify', account: me.name, premium: me.premium })
  } catch {
    patchLinks('music', { player: 'spotify' })
  }
  return 'linked'
}

export function disconnectSpotify() {
  save(null)
  patchLinks('music', { account: '', premium: true })
}

export class SpotifyError extends Error {
  constructor(public problem: 'not-linked' | 'offline' | 'failed') {
    super(problem)
  }
}

/** A working access token, refreshed quietly when the old one runs out. */
async function token(): Promise<string> {
  if (!tokens) throw new SpotifyError('not-linked')
  if (tokens.exp > Date.now() + 30_000) return tokens.access
  let fresh: Tokens | null
  try {
    fresh = await tokenCall({ grant_type: 'refresh_token', refresh_token: tokens.refresh })
  } catch {
    throw new SpotifyError('offline')
  }
  if (!fresh) {
    // she took the app's access away in her Spotify account
    save(null)
    throw new SpotifyError('not-linked')
  }
  save(fresh)
  return fresh.access
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const t = await token()
  try {
    return await fetch(`${API}${path}`, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } })
  } catch {
    throw new SpotifyError('offline')
  }
}

export async function spotifyMe(): Promise<{ name: string; premium: boolean }> {
  const r = await api('/me')
  if (!r.ok) throw new SpotifyError('failed')
  const j = (await r.json()) as { display_name?: string; id: string; product?: string }
  return { name: j.display_name || j.id, premium: j.product === 'premium' }
}

/** Her playlists (her own and the ones she follows), newest first as Spotify lists them. */
export async function spotifyPlaylists(): Promise<Playlist[]> {
  const out: Playlist[] = []
  let next: string | null = '/me/playlists?limit=50'
  for (let page = 0; next && page < 4; page++) {
    const r: Response = await api(next)
    if (!r.ok) throw new SpotifyError('failed')
    const j = (await r.json()) as { items: ({ uri: string; name: string; tracks?: { total?: number } } | null)[]; next: string | null }
    for (const p of j.items) if (p) out.push({ id: p.uri, name: p.name, count: p.tracks?.total })
    next = j.next ? j.next.replace(API, '') : null
  }
  return out
}

export type PlayOutcome = 'playing' | 'no-device' | 'not-premium' | 'not-linked' | 'failed'

interface Device {
  id: string | null
  is_active: boolean
  is_restricted: boolean
}

const body = (uri: string) => JSON.stringify(uri.startsWith('spotify:track:') ? { uris: [uri] } : { context_uri: uri })

/** Start a playlist (or album, or track) wherever her Spotify is open. */
export async function spotifyPlay(uri: string): Promise<PlayOutcome> {
  try {
    let r = await api('/me/player/play', { method: 'PUT', body: body(uri) })
    if (r.status === 404) {
      // nothing is playing anywhere right now: pick one of her devices (this Mac, her phone...)
      const d = await api('/me/player/devices')
      const list = d.ok ? ((await d.json()) as { devices: Device[] }).devices : []
      const pick = list.find((x) => x.is_active && x.id) ?? list.find((x) => !x.is_restricted && x.id)
      if (!pick?.id) return 'no-device'
      r = await api(`/me/player/play?device_id=${encodeURIComponent(pick.id)}`, { method: 'PUT', body: body(uri) })
    }
    if (r.status === 403) return 'not-premium'
    if (r.status === 404) return 'no-device'
    return r.ok ? 'playing' : 'failed'
  } catch (e) {
    return e instanceof SpotifyError && e.problem === 'not-linked' ? 'not-linked' : 'failed'
  }
}

export async function spotifyPause(): Promise<boolean> {
  try {
    const r = await api('/me/player/pause', { method: 'PUT' })
    return r.ok
  } catch {
    return false
  }
}

/** The playlist's page on Spotify, for when it can't be started from here (she presses play there). */
export function spotifyLink(uri: string): string {
  const [, type, id] = uri.split(':')
  return `https://open.spotify.com/${type}/${id}`
}

/** Open the playlist in Spotify itself, without leaving the app behind. Never during a session. */
export function openInSpotify(uri: string) {
  const url = spotifyLink(uri)
  if (isNativeApp) {
    // the native shells hand https links to the system, which opens the Spotify app
    const a = document.createElement('a')
    a.href = url
    a.click()
  } else window.open(url, '_blank', 'noopener')
}
