// Her connections to the outside world, kept on this device only: which
// calendars to read, the playlist that starts with the timer, her school's
// Canvas token, which reminders she wants. None of it goes to the cloud save
// (a token is a secret, and a playlist on the Mac means nothing to the phone).
import { useSyncExternalStore } from 'react'
import { DEFAULT_REMINDERS, type ReminderPrefs } from './game/reminders.ts'

/** A calendar linked by its subscription address (iCloud, Google, Outlook, Canvas, a school's feed). */
export interface Feed {
  id: string
  name: string
  /** https://… (webcal:// is read as https). It's a private address: it stays on this device. */
  url: string
  /** #rrggbb, hers to pick. */
  color: string
  on: boolean
}

export interface Links {
  calendar: {
    /** The device's own calendar (the apps) or Google Calendar (the web) is connected. */
    on: boolean
    /** Calendar ids to read exams and deadlines from. */
    calendars: string[]
    /** Write each finished session to her calendar. */
    logSessions: boolean
    /** The calendar they go to ('' = the default one). */
    logCalendar: string
    /** Calendars linked by address. */
    feeds: Feed[]
    /** Outlook, signed in on the web. */
    microsoft: {
      on: boolean
      calendars: string[]
      /** Her name there, to show. */
      account: string
    }
    lastSync: number
  }
  music: {
    player: 'none' | 'apple' | 'spotify'
    /** A playlist id (Apple Music) or a spotify: URI. */
    playlist: string
    /** Its name, to show. */
    name: string
    /** Start it when a focus session starts. */
    autoplay: boolean
    /** Pause it when the session ends. */
    pauseAtEnd: boolean
    /** Her Spotify display name, once the account is linked ('' = not linked). */
    account: string
    /** Spotify Premium can be started from outside; free can't (the playlist opens in Spotify instead). */
    premium: boolean
  }
  canvas: {
    /** e.g. https://canvas.myschool.edu */
    base: string
    /** Her own access token (Canvas → Account → Settings → New Access Token). */
    token: string
    /** Her name there, once connected. */
    user: string
    lastSync: number
  }
  reminders: ReminderPrefs & { on: boolean }
}

const KEY = 'tamalucy:links'

const DEFAULTS: Links = {
  calendar: { on: false, calendars: [], logSessions: false, logCalendar: '', feeds: [], microsoft: { on: false, calendars: [], account: '' }, lastSync: 0 },
  music: { player: 'none', playlist: '', name: '', autoplay: true, pauseAtEnd: true, account: '', premium: true },
  canvas: { base: '', token: '', user: '', lastSync: 0 },
  reminders: { on: false, ...DEFAULT_REMINDERS },
}

function read(): Links {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (raw) {
      const p = JSON.parse(raw) as Partial<Links>
      return {
        calendar: { ...DEFAULTS.calendar, ...p.calendar, microsoft: { ...DEFAULTS.calendar.microsoft, ...p.calendar?.microsoft } },
        music: { ...DEFAULTS.music, ...p.music },
        canvas: { ...DEFAULTS.canvas, ...p.canvas },
        reminders: { ...DEFAULTS.reminders, ...p.reminders },
      }
    }
  } catch {
    // unreadable: start from nothing
  }
  return DEFAULTS
}

let links = read()
const listeners = new Set<() => void>()

export const getLinks = () => links

export function setLinks(next: Links | ((l: Links) => Links)) {
  const value = typeof next === 'function' ? next(links) : next
  if (value === links) return
  links = value
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // storage full / private mode
  }
  listeners.forEach((l) => l())
}

/** Change one connection. */
export function patchLinks<K extends keyof Links>(key: K, patch: Partial<Links[K]>) {
  setLinks((l) => ({ ...l, [key]: { ...l[key], ...patch } }))
}

export function useLinks(): Links {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => links,
  )
}

export function ago(t: number, now = Date.now()) {
  if (!t) return 'not yet'
  const min = Math.floor((now - t) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}
