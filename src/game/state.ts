import type { Slot } from '../art/clothes.ts'
import type { RewardKind } from './content.ts'
import { GIFT } from '../gift.ts'

export interface Note {
  id: string
  text: string
  at: number
  kind: 'fox' | 'secret' | 'missed'
  read: boolean
}

export interface Postcard {
  adventure: string
  story: string
  at: number
}

export interface FocusSession {
  startedAt: number
  durationMs: number
  endsAt: number
  label: string
  /** When the app went to the background (null while visible). */
  hiddenAt: number | null
  /** Last time the running app confirmed it was alive (for reloads/kills). */
  lastBeat: number
  /** Total time spent away (gentle mode pauses the timer). */
  awayMs: number
}

export interface Offer {
  kind: RewardKind
  options: string[]
}

export interface PendingReward {
  minutes: number
  label: string
  picksLeft: number
  choices: number
  offer: Offer | null
  taken: RewardKind[]
  /** A secret letter was found this session (milestone). */
  foundLetter?: boolean
}

export interface Settings {
  focusMinutes: number
  breakMinutes: number
  sound: boolean
  graceSeconds: number
  leaveMode: 'strict' | 'gentle'
}

export interface Stats {
  totalMinutes: number
  sessions: number
  gaveUp: number
  left: number
  /** local YYYY-MM-DD -> focused minutes */
  days: Record<string, number>
  /** local YYYY-MM-DD -> completed sessions */
  daySessions: Record<string, number>
  bestStreak: number
}

export interface GameState {
  v: 1
  createdAt: number
  onboarded: boolean
  owner: string
  foxName: string
  happiness: number
  tummy: number
  lastTick: number
  lastVisit: number
  favoriteTreats: string[]
  session: FocusSession | null
  breakEndsAt: number | null
  pending: PendingReward | null
  adventure: { id: string; startedAt: number; returnsAt: number } | null
  postcardToShow: Postcard | null
  wardrobe: string[]
  equipped: Partial<Record<Slot, string>>
  gifts: string[]
  treatsFed: Record<string, number>
  notes: Note[]
  postcards: Postcard[]
  usedNotes: string[]
  secretsDelivered: number
  pets: { windowStart: number; count: number }
  stats: Stats
  settings: Settings
}

export function freshState(now: number, rng: () => number = Math.random): GameState {
  const treats = ['strawberry', 'onigiri', 'dango', 'cookie', 'cupcake', 'cocoa', 'taiyaki', 'peach']
  const favs: string[] = []
  while (favs.length < 2) {
    const t = treats[Math.floor(rng() * treats.length)]
    if (!favs.includes(t)) favs.push(t)
  }
  return {
    v: 1,
    createdAt: now,
    onboarded: false,
    owner: GIFT.recipientName,
    foxName: GIFT.foxName,
    happiness: 75,
    tummy: 70,
    lastTick: now,
    lastVisit: now,
    favoriteTreats: favs,
    session: null,
    breakEndsAt: null,
    pending: null,
    adventure: null,
    postcardToShow: null,
    wardrobe: [],
    equipped: {},
    gifts: [],
    treatsFed: {},
    notes: [],
    postcards: [],
    usedNotes: [],
    secretsDelivered: 0,
    pets: { windowStart: now, count: 0 },
    stats: { totalMinutes: 0, sessions: 0, gaveUp: 0, left: 0, days: {}, daySessions: {}, bestStreak: 0 },
    settings: { focusMinutes: 25, breakMinutes: 5, sound: true, graceSeconds: 10, leaveMode: 'strict' },
  }
}

const KEY = 'tamalucy:v1'

export function loadState(now: number): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GameState
      const base = freshState(now)
      // forward-compatible merge: new fields get defaults
      return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings }, stats: { ...base.stats, ...parsed.stats } }
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return freshState(now)
}

export function saveState(s: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage full / private mode: nothing we can do
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
