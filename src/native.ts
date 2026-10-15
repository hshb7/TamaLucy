// The bridge to the native iPhone and Mac apps (ios/). In a browser none of
// this exists and every call quietly does nothing, so the web app is unchanged.
//
// JS → native: window.webkit.messageHandlers.tamalucy.postMessage({ id, cmd, ...args })
// native → JS: window.__tamalucyNative.reply(id, result) and .emit(event)

import type { WidgetData } from './game/widget.ts'
import type { WidgetImages } from './ui/widgetArt.ts'

interface Handler {
  postMessage(msg: unknown): void
}

const handler = (): Handler | undefined =>
  (window as unknown as { webkit?: { messageHandlers?: { tamalucy?: Handler } } }).webkit?.messageHandlers?.tamalucy

/** Running inside the native iPhone or Mac app. */
export const isNativeApp = typeof window !== 'undefined' && !!handler()

/** Which native app (the Mac app says so before the page loads). */
export const nativePlatform: 'ios' | 'mac' | null = !isNativeApp
  ? null
  : (window as unknown as { __tamalucyPlatform?: string }).__tamalucyPlatform === 'mac'
    ? 'mac'
    : 'ios'

let nextId = 1
const waiting = new Map<number, (result: unknown) => void>()
const listeners = new Map<string, Set<() => void>>()

if (isNativeApp) {
  ;(window as unknown as { __tamalucyNative: unknown }).__tamalucyNative = {
    reply(id: number, result: unknown) {
      waiting.get(id)?.(result)
      waiting.delete(id)
    },
    emit(event: string) {
      listeners.get(event)?.forEach((fn) => fn())
    },
  }
}

/** Something happened on the native side ("broke": she gave in to a distracting app). */
export function onNative(event: 'broke', fn: () => void) {
  const set = listeners.get(event) ?? new Set()
  set.add(fn)
  listeners.set(event, set)
  return () => {
    set.delete(fn)
  }
}

function call<T>(cmd: string, args: Record<string, unknown> = {}, fallback: T, patience = 60_000): Promise<T> {
  const h = handler()
  if (!h) return Promise.resolve(fallback)
  const id = nextId++
  return new Promise<T>((resolve) => {
    waiting.set(id, (r) => resolve((r ?? fallback) as T))
    // a native side that never answers shouldn't hang the game
    setTimeout(() => {
      if (waiting.delete(id)) resolve(fallback)
    }, patience)
    h.postMessage({ id, cmd, ...args })
  })
}

export interface BlockingStatus {
  /** Screen Time is available (native app, iOS 16+). */
  available: boolean
  /** She allowed Screen Time access. */
  authorized: boolean
  /** How many apps, categories and websites she chose to block. */
  count: number
}

const NONE: BlockingStatus = { available: false, authorized: false, count: 0 }

export interface CalendarInfo {
  id: string
  title: string
  /** #rrggbb */
  color?: string
  writable: boolean
}

export interface CalendarAccess {
  /** This app can read her calendar (the native apps, or the web with a Google key). */
  available: boolean
  authorized: boolean
  calendars: CalendarInfo[]
}

export interface NativeEvent {
  id: string
  title: string
  /** ms */
  start: number
  end: number
  allDay: boolean
  recurring: boolean
  /** Calendar id. */
  calendar: string
}

export type Player = 'apple' | 'spotify'

export interface MusicStatus {
  available: boolean
  /** Which players this device has: Apple Music on an iPhone; Music and/or Spotify on a Mac. */
  players: Player[]
  authorized: boolean
}

export interface Playlist {
  id: string
  name: string
  count?: number
}

export type NotifyState = 'granted' | 'denied' | 'notasked'

export interface NotifyStatus {
  available: boolean
  state: NotifyState
}

export interface ScheduledNote {
  id: string
  title: string
  body: string
  /** ms */
  at: number
}

const NO_CAL: CalendarAccess = { available: false, authorized: false, calendars: [] }
const NO_MUSIC: MusicStatus = { available: false, players: [], authorized: false }
const NO_NOTIFY: NotifyStatus = { available: false, state: 'notasked' }

export const native = {
  /** Open a sign-in page in the system's sheet; resolves to the callback URL (tamalucy://app/?code=…), or '' if she closed it. */
  authOpen(url: string) {
    return call<string>('auth.open', { url }, '', 10 * 60_000)
  },
  /**
   * A focus session is running (or its end time moved): show it in the
   * Dynamic Island, block her chosen apps until it ends, and schedule the
   * "time's up" notification. Safe to call again with the same session.
   */
  focusStarted(s: { startedAt: number; endsAt: number; label: string; fox: string }) {
    return call<boolean>('focus.start', s, false)
  },
  /** The session is over: done, given up, or failed. */
  focusEnded(reason: 'done' | 'gaveUp' | 'failed') {
    return call<boolean>('focus.end', { reason }, false)
  },
  /** When she last gave in to a blocked/watched app (ms), or 0. Clears it. */
  brokeFocusAt() {
    return call<number>('focus.broke', {}, 0)
  },
  blockingStatus() {
    return call<BlockingStatus>('blocking.status', {}, NONE)
  },
  /** iPhone: Screen Time access + Apple's app picker. Mac: pick apps from /Applications. */
  chooseBlockedApps() {
    return call<BlockingStatus>('blocking.choose', {}, NONE)
  },
  /** iPhone: redraw her home screen widget (and the Dynamic Island's fox) with these words and pictures. */
  updateWidget(card: WidgetData & WidgetImages) {
    return call<boolean>('widget.update', { card }, false)
  },
  haptic(style: 'light' | 'success' | 'warning') {
    void call<boolean>('haptic', { style }, false)
  },

  // ─── her calendar (EventKit) ─────────────────────────────────────────────
  /** Ask for calendar access (once) and list her calendars. */
  calendars() {
    return call<CalendarAccess>('calendar.list', {}, NO_CAL)
  },
  /** Events in those calendars between two times. */
  calendarEvents(calendars: string[], from: number, to: number) {
    return call<NativeEvent[]>('calendar.events', { calendars, from, to }, [])
  },
  /** Put a finished session on her calendar. */
  calendarAdd(e: { calendar: string; title: string; start: number; end: number; notes: string }) {
    return call<boolean>('calendar.add', e, false)
  },

  // ─── music that starts with the timer ────────────────────────────────────
  musicStatus() {
    return call<MusicStatus>('music.status', {}, NO_MUSIC)
  },
  /** Her playlists (asks for music library access on the iPhone). */
  musicPlaylists(player: Player) {
    return call<Playlist[]>('music.playlists', { player }, [])
  },
  musicPlay(player: Player, playlist: string) {
    return call<boolean>('music.play', { player, playlist }, false)
  },
  musicPause(player: Player) {
    return call<boolean>('music.pause', { player }, false)
  },

  // ─── notifications when she's away ───────────────────────────────────────
  notifyStatus() {
    return call<NotifyStatus>('notify.status', {}, NO_NOTIFY)
  },
  notifyAsk() {
    return call<NotifyStatus>('notify.ask', {}, NO_NOTIFY)
  },
  /** Replace every scheduled reminder with these. */
  notifySync(items: ScheduledNote[]) {
    return call<boolean>('notify.sync', { items }, false)
  },
}
