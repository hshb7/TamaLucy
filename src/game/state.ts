import type { Slot } from '../art/clothes.ts'
import type { RewardKind } from './content.ts'
import { GIFT } from '../gift.ts'
import type { Needs } from './needs.ts'
import { rankOf } from './career.ts'

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
  /** subject label -> focused minutes */
  subjects: Record<string, number>
  bestStreak: number
}

export interface QuizStats {
  rounds: number
  best: number
  correct: number
  answered: number
}

export interface GameState {
  v: 2
  createdAt: number
  onboarded: boolean
  owner: string
  foxName: string
  needs: Needs
  /** Food portions in the bowl (0-3). */
  bowl: number
  /** Treats saved for later: id -> count. */
  pantry: Record<string, number>
  decor: { wall: string; floor: string }
  /** The fox is napping until this time. */
  napUntil: number
  /** Last career rank the promotion screen was shown for. */
  rankSeen: number
  quiz: QuizStats
  /** When the fox last used things on its own (autonomy cooldowns). */
  lastUse: Record<string, number>
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
    v: 2,
    createdAt: now,
    onboarded: false,
    owner: GIFT.recipientName,
    foxName: GIFT.foxName,
    needs: { hunger: 75, energy: 90, fun: 75, hygiene: 90, social: 75 },
    bowl: 3,
    pantry: {},
    decor: { wall: 'stripes', floor: 'honey' },
    napUntil: 0,
    rankSeen: 0,
    quiz: { rounds: 0, best: 0, correct: 0, answered: 0 },
    lastUse: {},
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
    stats: { totalMinutes: 0, sessions: 0, gaveUp: 0, left: 0, days: {}, daySessions: {}, subjects: {}, bestStreak: 0 },
    settings: { focusMinutes: 25, breakMinutes: 5, sound: true, graceSeconds: 10, leaveMode: 'strict' },
  }
}

const KEY = 'tamalucy:v1'

export function loadState(now: number): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = migrate(JSON.parse(raw))
      const base = freshState(now)
      // forward-compatible merge: new fields get defaults
      return {
        ...base,
        ...parsed,
        needs: { ...base.needs, ...parsed.needs },
        quiz: { ...base.quiz, ...parsed.quiz },
        decor: { ...base.decor, ...parsed.decor },
        settings: { ...base.settings, ...parsed.settings },
        stats: { ...base.stats, ...parsed.stats },
      }
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return freshState(now)
}

/** Upgrade saves from older versions of the app. */
export function migrate(raw: Record<string, unknown>): GameState {
  if (raw.v === 1 || !raw.needs) {
    const happiness = typeof raw.happiness === 'number' ? raw.happiness : 75
    const tummy = typeof raw.tummy === 'number' ? raw.tummy : 70
    const total = (raw.stats as Stats | undefined)?.totalMinutes ?? 0
    const { happiness: _h, tummy: _t, ...rest } = raw
    return {
      ...(rest as unknown as GameState),
      v: 2,
      needs: { hunger: tummy, energy: 85, fun: happiness, hygiene: 85, social: happiness },
      rankSeen: rankOf(total),
    }
  }
  return raw as unknown as GameState
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
