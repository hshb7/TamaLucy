import { ADVENTURES, CLOTHES, GIFTS, TREATS, byId, type RewardKind } from './content.ts'
import { GIFT } from '../gift.ts'
import {
  GENERAL_NOTES,
  LABEL_NOTES,
  LONG_NOTES,
  MISSED_NOTES,
  MORNING_NOTES,
  NIGHT_NOTES,
  STREAK_NOTES,
  fill,
} from './notes.ts'
import type { GameState, Note, Postcard } from './state.ts'

type Rng = () => number
const HOUR = 3_600_000
const MIN = 60_000
/** Completed-session counts at which a secret letter is guaranteed (if any are left). */
export const SECRET_MILESTONES = [1, 3, 7, 12, 20, 30, 50, 75, 100]

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── time helpers ───────────────────────────────────────────────────────────

export function dayKey(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function streak(days: Record<string, number>, now: number) {
  let n = 0
  let t = now
  // today counts if you've focused; otherwise the streak is still alive from yesterday
  if (!days[dayKey(t)]) t -= 24 * HOUR
  while (days[dayKey(t)]) {
    n++
    t -= 24 * HOUR
  }
  return n
}

export function bondLevel(totalMinutes: number) {
  return 1 + Math.floor(Math.sqrt(totalMinutes / 15))
}

export function minutesForLevel(level: number) {
  return (level - 1) ** 2 * 15
}

// ─── mood ───────────────────────────────────────────────────────────────────

export type Mood = 'joyful' | 'happy' | 'okay' | 'sad' | 'depressed'

export function moodOf(happiness: number): Mood {
  if (happiness < 15) return 'depressed'
  if (happiness < 35) return 'sad'
  if (happiness < 60) return 'okay'
  if (happiness < 85) return 'happy'
  return 'joyful'
}

export const HUNGRY = 30

/**
 * Apply the passage of time. Tummy empties over ~2 days; happiness drains
 * slowly, faster when hungry, slower at night. Roughly: fine after a day
 * away, sad after two, depressed after three.
 */
export function decay(s: GameState, now: number): GameState {
  let t = s.lastTick
  if (now <= t) return s
  let { happiness, tummy } = s
  const end = Math.min(now, t + 30 * 24 * HOUR)
  while (t < end) {
    const step = Math.min(30 * MIN, end - t)
    const h = step / HOUR
    const hour = new Date(t).getHours()
    const night = hour >= 23 || hour < 7
    tummy -= (night ? 1.2 : 2) * h
    happiness -= (night ? 0.4 : 0.8) * h + (tummy < 25 ? 1 : 0) * h
    t += step
  }
  return { ...s, happiness: clamp(happiness), tummy: clamp(tummy), lastTick: now }
}

/** Called when the app is opened / comes back into view. */
export function arrive(s: GameState, now: number, rng: Rng = Math.random): GameState {
  let next = decay(s, now)
  const away = now - s.lastVisit
  if (next.onboarded && away > 30 * HOUR) {
    next = addNote(next, { kind: 'missed', text: pickUnused(MISSED_NOTES, next, rng) }, now)
    next.happiness = clamp(next.happiness + 5) // a little reunion joy
  }
  next = resolveAdventure(next, now, rng)
  return { ...next, lastVisit: now }
}

// ─── focus sessions ────────────────────────────────────────────────────────

export function startFocus(s: GameState, now: number, minutes: number, label: string, rng: Rng = Math.random): GameState {
  // if the fox is out exploring, it hurries home to keep you company
  const next = s.adventure ? resolveAdventure(s, now, rng, true) : s
  return {
    ...next,
    session: { startedAt: now, durationMs: minutes * MIN, endsAt: now + minutes * MIN, label: label.trim(), hiddenAt: null, lastBeat: now, awayMs: 0 },
    breakEndsAt: null,
    settings: { ...next.settings, focusMinutes: minutes },
  }
}

export function heartbeat(s: GameState, now: number): GameState {
  if (!s.session || s.session.hiddenAt) return s
  return { ...s, session: { ...s.session, lastBeat: now } }
}

export function focusHidden(s: GameState, now: number): GameState {
  if (!s.session || s.session.hiddenAt) return s
  return { ...s, session: { ...s.session, hiddenAt: now, lastBeat: now } }
}

export type ReturnOutcome = 'none' | 'fine' | 'close-call' | 'paused' | 'failed'

/**
 * The app is visible again (or was reloaded). Decide what leaving cost.
 * Only time away *before the timer ended* counts.
 */
export function focusVisible(s: GameState, now: number): { state: GameState; outcome: ReturnOutcome; awayMs: number } {
  const ses = s.session
  if (!ses) return { state: s, outcome: 'none', awayMs: 0 }
  // no visibility event but the page was dead for a while (killed / reloaded)
  const since = ses.hiddenAt ?? (now - ses.lastBeat > 8000 ? ses.lastBeat : null)
  if (since == null) return { state: s, outcome: 'none', awayMs: 0 }
  const awayMs = Math.max(0, Math.min(now, ses.endsAt) - since)
  const grace = s.settings.graceSeconds * 1000
  if (awayMs <= 1500) {
    return { state: { ...s, session: { ...ses, hiddenAt: null, lastBeat: now } }, outcome: 'fine', awayMs }
  }
  if (s.settings.leaveMode === 'gentle') {
    const extra = Math.max(0, now - since)
    const endsAt = since >= ses.endsAt ? ses.endsAt : ses.endsAt + extra
    return {
      state: { ...s, happiness: clamp(s.happiness - 1), session: { ...ses, hiddenAt: null, lastBeat: now, endsAt, awayMs: ses.awayMs + extra } },
      outcome: 'paused',
      awayMs,
    }
  }
  if (awayMs <= grace) {
    return { state: { ...s, session: { ...ses, hiddenAt: null, lastBeat: now, awayMs: ses.awayMs + awayMs } }, outcome: 'close-call', awayMs }
  }
  const failed: GameState = {
    ...s,
    session: null,
    happiness: clamp(s.happiness - 12),
    stats: { ...s.stats, left: s.stats.left + 1 },
  }
  return { state: failed, outcome: 'failed', awayMs }
}

export function giveUp(s: GameState): GameState {
  if (!s.session) return s
  return { ...s, session: null, happiness: clamp(s.happiness - 5), stats: { ...s.stats, gaveUp: s.stats.gaveUp + 1 } }
}

export function remainingMs(s: GameState, now: number) {
  return s.session ? Math.max(0, s.session.endsAt - now) : 0
}

/** Finish a session whose timer has run out. */
export function completeFocus(s: GameState, now: number, rng: Rng = Math.random): GameState {
  const ses = s.session
  if (!ses || now < ses.endsAt) return s
  let next = s.adventure ? resolveAdventure(s, now, rng, true) : s
  const minutes = Math.round(ses.durationMs / MIN)
  const key = dayKey(now)
  const days = { ...next.stats.days, [key]: (next.stats.days[key] ?? 0) + minutes }
  const stats = {
    ...next.stats,
    totalMinutes: next.stats.totalMinutes + minutes,
    sessions: next.stats.sessions + 1,
    days,
    daySessions: { ...next.stats.daySessions, [key]: (next.stats.daySessions[key] ?? 0) + 1 },
  }
  stats.bestStreak = Math.max(stats.bestStreak, streak(days, now))
  const milestone = SECRET_MILESTONES.includes(stats.sessions) && next.secretsDelivered < GIFT.secretNotes.length
  if (milestone) next = deliverSecret(next, now)
  next = {
    ...next,
    session: null,
    happiness: clamp(next.happiness + Math.min(20, 6 + minutes / 3)),
    stats,
    pending: {
      minutes,
      label: ses.label,
      picksLeft: minutes >= 45 ? 2 : 1,
      choices: minutes >= 15 ? 3 : 2,
      offer: null,
      taken: [],
      foundLetter: milestone,
    },
  }
  return next
}

// ─── rewards ────────────────────────────────────────────────────────────────

export function available(s: GameState, kind: RewardKind): boolean {
  if (kind === 'gift') return GIFTS.some((g) => !s.gifts.includes(g.id))
  if (kind === 'clothes') return CLOTHES.some((c) => !s.wardrobe.includes(c.id))
  return true
}

/** Show the options for one reward kind (e.g. three treats to choose from). */
export function offer(s: GameState, kind: RewardKind, rng: Rng = Math.random): GameState {
  if (!s.pending) return s
  const n = s.pending.choices
  let options: string[] = []
  if (kind === 'treat') options = shuffle(TREATS, rng).slice(0, n).map((t) => t.id)
  if (kind === 'gift') options = shuffle(GIFTS.filter((g) => !s.gifts.includes(g.id)), rng).slice(0, n).map((g) => g.id)
  if (kind === 'clothes') options = shuffle(CLOTHES.filter((c) => !s.wardrobe.includes(c.id)), rng).slice(0, n).map((c) => c.id)
  if (kind === 'adventure') {
    // prefer places we haven't sent a postcard from yet
    const fresh = ADVENTURES.filter((a) => !s.postcards.some((p) => p.adventure === a.id))
    const pool = [...shuffle(fresh, rng), ...shuffle(ADVENTURES.filter((a) => !fresh.includes(a)), rng)]
    options = pool.slice(0, n).map((a) => a.id)
  }
  return { ...s, pending: { ...s.pending, offer: { kind, options } } }
}

export function cancelOffer(s: GameState): GameState {
  return s.pending ? { ...s, pending: { ...s.pending, offer: null } } : s
}

export type RewardResult =
  | { kind: 'treat'; id: string; favorite: boolean; firstFavorite: boolean }
  | { kind: 'gift'; id: string }
  | { kind: 'clothes'; id: string }
  | { kind: 'adventure'; id: string; returnsAt: number }
  | { kind: 'note'; note: Note }

/** Take a reward. `choice` is required for everything except notes. */
export function claim(s: GameState, now: number, kind: RewardKind, choice: string | null, rng: Rng = Math.random): { state: GameState; result: RewardResult } | null {
  const p = s.pending
  if (!p) return null
  let next: GameState = s
  let result: RewardResult
  switch (kind) {
    case 'treat': {
      if (!choice || !byId(TREATS, choice)) return null
      const favorite = s.favoriteTreats.includes(choice)
      const firstFavorite = favorite && !s.treatsFed[choice]
      next = {
        ...s,
        tummy: clamp(s.tummy + (favorite ? 45 : 35)),
        happiness: clamp(s.happiness + (favorite ? 12 : 5)),
        treatsFed: { ...s.treatsFed, [choice]: (s.treatsFed[choice] ?? 0) + 1 },
      }
      result = { kind, id: choice, favorite, firstFavorite }
      break
    }
    case 'gift': {
      if (!choice || !byId(GIFTS, choice) || s.gifts.includes(choice)) return null
      next = { ...s, gifts: [...s.gifts, choice], happiness: clamp(s.happiness + 18) }
      result = { kind, id: choice }
      break
    }
    case 'clothes': {
      const item = choice ? byId(CLOTHES, choice) : undefined
      if (!item || s.wardrobe.includes(item.id)) return null
      next = {
        ...s,
        wardrobe: [...s.wardrobe, item.id],
        equipped: { ...s.equipped, [item.slot]: item.id },
        happiness: clamp(s.happiness + 12),
      }
      result = { kind, id: item.id }
      break
    }
    case 'adventure': {
      if (!choice || !ADVENTURES.some((a) => a.id === choice)) return null
      const minutes = Math.max(3, Math.min(15, s.settings.breakMinutes))
      const returnsAt = now + minutes * MIN
      next = { ...s, adventure: { id: choice, startedAt: now, returnsAt } }
      result = { kind, id: choice, returnsAt }
      break
    }
    case 'note': {
      next = writeNote(s, now, p.minutes, p.label, rng)
      next = { ...next, happiness: clamp(next.happiness + 8) }
      result = { kind, note: next.notes[0] }
      break
    }
  }
  const picksLeft = p.picksLeft - 1
  next = {
    ...next,
    pending: picksLeft > 0 ? { ...p, picksLeft, offer: null, taken: [...p.taken, kind] } : null,
  }
  return { state: next, result }
}

export function skipRewards(s: GameState): GameState {
  return { ...s, pending: null }
}

// ─── notes ──────────────────────────────────────────────────────────────────

function pickUnused(pool: readonly string[], s: GameState, rng: Rng) {
  const unused = pool.filter((t) => !s.usedNotes.includes(t))
  return pick(unused.length ? unused : pool, rng)
}

function addNote(s: GameState, n: Pick<Note, 'kind' | 'text'>, now: number): GameState {
  const note: Note = { id: `${now.toString(36)}-${s.notes.length}`, at: now, read: false, ...n }
  const pool = n.kind === 'secret' ? [] : [n.text]
  return {
    ...s,
    notes: [note, ...s.notes],
    // keep the "recently used" list short so notes come back around eventually
    usedNotes: [...pool, ...s.usedNotes].slice(0, 24),
  }
}

/** Deliver the next letter from gift.ts, if any are left. */
function deliverSecret(s: GameState, now: number): GameState {
  const secrets = GIFT.secretNotes
  if (s.secretsDelivered >= secrets.length) return s
  const from = GIFT.from ? `\n\n— ${GIFT.from}` : ''
  const next = addNote(s, { kind: 'secret', text: secrets[s.secretsDelivered] + from }, now)
  return { ...next, secretsDelivered: s.secretsDelivered + 1 }
}

function writeNote(s: GameState, now: number, minutes: number, label: string, rng: Rng): GameState {
  if (s.secretsDelivered < GIFT.secretNotes.length && rng() < 0.3) return deliverSecret(s, now)
  const hour = new Date(now).getHours()
  const st = streak(s.stats.days, now)
  const pools: string[][] = [GENERAL_NOTES, GENERAL_NOTES]
  if (hour >= 5 && hour < 11) pools.push(MORNING_NOTES)
  if (hour >= 21 || hour < 4) pools.push(NIGHT_NOTES)
  if (minutes >= 45) pools.push(LONG_NOTES, LONG_NOTES)
  if (label) pools.push(LABEL_NOTES, LABEL_NOTES)
  if (st >= 3) pools.push(STREAK_NOTES)
  const template = pickUnused(pick(pools, rng), s, rng)
  const text = fill(template, { name: s.owner.toLowerCase(), fox: s.foxName.toLowerCase(), label, minutes, streak: st })
  return addNote({ ...s, usedNotes: [template, ...s.usedNotes] }, { kind: 'fox', text }, now)
}

export function readNote(s: GameState, id: string): GameState {
  return { ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, read: true } : n)) }
}

// ─── adventures ─────────────────────────────────────────────────────────────

export function resolveAdventure(s: GameState, now: number, rng: Rng = Math.random, force = false): GameState {
  const adv = s.adventure
  if (!adv || (!force && now < adv.returnsAt)) return s
  const def = ADVENTURES.find((a) => a.id === adv.id)!
  const card: Postcard = { adventure: def.id, story: pick(def.stories, rng), at: now }
  return {
    ...s,
    adventure: null,
    postcards: [card, ...s.postcards],
    postcardToShow: card,
    happiness: clamp(s.happiness + 20),
    tummy: clamp(s.tummy - 10),
  }
}

export function dismissPostcard(s: GameState): GameState {
  return { ...s, postcardToShow: null }
}

// ─── breaks, petting, wardrobe, misc ───────────────────────────────────────

export function startBreak(s: GameState, now: number): GameState {
  return { ...s, breakEndsAt: now + s.settings.breakMinutes * MIN }
}

export function endBreak(s: GameState): GameState {
  return { ...s, breakEndsAt: null }
}

/** Petting gives a small boost, capped so it can't replace real attention. */
export function pet(s: GameState, now: number): { state: GameState; counted: boolean } {
  const fresh = now - s.pets.windowStart > 30 * MIN
  const pets = fresh ? { windowStart: now, count: 0 } : s.pets
  const counted = pets.count < 5
  return {
    state: { ...s, pets: { ...pets, count: pets.count + 1 }, happiness: clamp(s.happiness + (counted ? 2 : 0)) },
    counted,
  }
}

export function toggleWear(s: GameState, id: string): GameState {
  const item = byId(CLOTHES, id)
  if (!item || !s.wardrobe.includes(id)) return s
  const equipped = { ...s.equipped }
  if (equipped[item.slot] === id) delete equipped[item.slot]
  else equipped[item.slot] = id
  return { ...s, equipped }
}

export function isAsleep(s: GameState, now: number) {
  const h = new Date(now).getHours()
  return (h >= 23 || h < 6) && !s.session
}
