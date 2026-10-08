import { CLOTHES, GIFTS, TREATS, adventures, byId, type RewardKind } from './content.ts'
import { GIFT } from '../gift.ts'
import {
  GENERAL_NOTES,
  LABEL_NOTES,
  LAW_NOTES,
  STUDY_NOTES,
  LONG_NOTES,
  MISSED_NOTES,
  MORNING_NOTES,
  NIGHT_NOTES,
  STREAK_NOTES,
  fill,
} from './notes.ts'
import type { GameState, Note, Postcard } from './state.ts'
import { EFFECTS, SOCIAL, bump, simulate, type Activity } from './needs.ts'
import { unlocked, rankOf, type UnlockKind } from './career.ts'
import { dayKey, isOctober, monthDay, seasonOf } from './time.ts'
import { examsToday } from './study.ts'
import { celebrateBook, courseForLabel, courseMinutes, shelfName, shelfOf } from './shelf.ts'
import { BIRTHDAY_NOTE, EXAM_NOTES, LAW_EXAM_NOTES } from './notes.ts'
import type { Clothing } from './content.ts'

type Rng = () => number
const HOUR = 3_600_000
const MIN = 60_000
/** Completed-session counts at which a secret letter is guaranteed (if any are left). */
export const SECRET_MILESTONES = [1, 3, 7, 12, 20, 30, 50, 75, 100]

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

export { dayKey } from './time.ts'

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

// ─── mood & time passing ──────────────────────────────────────────────────

export { foxMood, isAsleep, moodOf, moodValue, simulate, type Mood } from './needs.ts'

/** Called when the app is opened / comes back into view. */
export function arrive(s: GameState, now: number, rng: Rng = Math.random): GameState {
  // longer gaps: the fox looked after itself (bowl, toys, naps) while you were gone
  let next = simulate(s, now, now - s.lastTick > 10 * MIN)
  const away = now - s.lastVisit
  if (next.onboarded && away > 30 * HOUR && next.settings.care !== 'paused') {
    next = addNote(next, { kind: 'missed', text: pickUnused(MISSED_NOTES, next, rng) }, now)
    next = bump(next, { social: 5 }) // a little reunion joy
  }
  next = resolveAdventure(next, now, rng)
  if (next.onboarded) next = celebrateDays(next, now, rng)
  return { ...next, lastVisit: now }
}

export function isBirthday(s: GameState, now: number) {
  return !!s.birthday && s.birthday === monthDay(now)
}

/** Birthday surprise + exam-day good luck, once each. */
export function celebrateDays(s: GameState, now: number, rng: Rng = Math.random): GameState {
  let next = s
  const year = new Date(now).getFullYear()
  if (isBirthday(next, now) && next.birthdayYear !== year) {
    const text = GIFT.birthdayLetter
      ? GIFT.birthdayLetter + (GIFT.from ? `\n\n— ${GIFT.from}` : '')
      : fill(BIRTHDAY_NOTE, { name: next.owner.toLowerCase(), fox: next.foxName.toLowerCase() })
    next = addNote(next, { kind: 'birthday', text }, now)
    next = bump(next, { social: 20, fun: 20 })
    next = {
      ...next,
      birthdayYear: year,
      wardrobe: next.wardrobe.includes('partyHat') ? next.wardrobe : [...next.wardrobe, 'partyHat'],
      equipped: { ...next.equipped, head: 'partyHat' },
    }
  }
  for (const exam of examsToday(next, now)) {
    if (next.examsWished.includes(exam.id)) continue
    const notes = next.study.track === 'law' ? [...EXAM_NOTES, ...LAW_EXAM_NOTES] : EXAM_NOTES
    const text = fill(pick(notes, rng), { name: next.owner.toLowerCase(), exam: exam.name })
    next = { ...addNote(next, { kind: 'exam', text }, now), examsWished: [...next.examsWished, exam.id] }
  }
  return next
}

/** Seasonal outfits only turn up as rewards in their season. */
export function inSeason(c: Clothing, now: number) {
  if (!c.season) return true
  return c.season === 'october' ? isOctober(now) : seasonOf(now) === c.season
}

const rewardable = (c: Clothing, now: number) => !c.career && !c.special && inSeason(c, now)

// ─── focus sessions ────────────────────────────────────────────────────────

export function startFocus(s: GameState, now: number, minutes: number, label: string, rng: Rng = Math.random): GameState {
  // if the fox is out exploring, it hurries home to keep you company
  const next = s.adventure ? resolveAdventure(s, now, rng, true) : s
  const course = courseForLabel(next, label)
  return {
    ...next,
    session: { startedAt: now, durationMs: minutes * MIN, endsAt: now + minutes * MIN, label: label.trim(), hiddenAt: null, lastBeat: now, awayMs: 0, ...(course && { courseId: course.id }) },
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
  // on a Mac she's allowed (expected!) to work in other apps
  if (s.settings.leaveMode === 'free') return { state: { ...s, session: { ...ses, hiddenAt: null, lastBeat: now } }, outcome: 'none', awayMs }
  if (awayMs <= 1500) {
    return { state: { ...s, session: { ...ses, hiddenAt: null, lastBeat: now } }, outcome: 'fine', awayMs }
  }
  if (s.settings.leaveMode === 'gentle') {
    const extra = Math.max(0, now - since)
    const endsAt = since >= ses.endsAt ? ses.endsAt : ses.endsAt + extra
    return {
      state: { ...bump(s, { social: -1 }), session: { ...ses, hiddenAt: null, lastBeat: now, endsAt, awayMs: ses.awayMs + extra } },
      outcome: 'paused',
      awayMs,
    }
  }
  if (awayMs <= grace) {
    return { state: { ...s, session: { ...ses, hiddenAt: null, lastBeat: now, awayMs: ses.awayMs + awayMs } }, outcome: 'close-call', awayMs }
  }
  return { state: failFocus(s), outcome: 'failed', awayMs }
}

/** The fox looked up and she was gone (or she opened a blocked app): the session doesn't count. */
export function failFocus(s: GameState): GameState {
  if (!s.session) return s
  return {
    ...bump(s, { social: -12, fun: -6 }),
    session: null,
    stats: { ...s.stats, left: s.stats.left + 1 },
  }
}

export function giveUp(s: GameState): GameState {
  if (!s.session) return s
  return { ...bump(s, { social: -5 }), session: null, stats: { ...s.stats, gaveUp: s.stats.gaveUp + 1 } }
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
    subjects: ses.label ? { ...next.stats.subjects, [ses.label]: (next.stats.subjects[ses.label] ?? 0) + minutes } : next.stats.subjects,
    courses: ses.courseId ? { ...next.stats.courses, [ses.courseId]: (next.stats.courses[ses.courseId] ?? 0) + minutes } : next.stats.courses,
  }
  stats.bestStreak = Math.max(stats.bestStreak, streak(days, now))
  const milestone = SECRET_MILESTONES.includes(stats.sessions) && next.secretsDelivered < GIFT.secretNotes.length
  if (milestone) next = deliverSecret(next, now)
  // studying together is quality time
  next = bump(next, { social: Math.min(20, 6 + minutes / 3), fun: Math.min(10, 3 + minutes / 6) })
  const acorns = acornsFor(minutes)
  next = {
    ...next,
    acorns: next.acorns + acorns,
    session: null,
    stats,
    lastCourse: ses.courseId ?? next.lastCourse,
    pending: {
      acorns,
      minutes,
      label: ses.label,
      ...(ses.courseId && { courseId: ses.courseId }),
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

export function available(s: GameState, kind: RewardKind, now = Date.now()): boolean {
  if (kind === 'gift') return GIFTS.some((g) => !s.gifts.includes(g.id))
  if (kind === 'clothes') return CLOTHES.some((c) => rewardable(c, now) && !s.wardrobe.includes(c.id))
  return true
}

/** Show the options for one reward kind (e.g. three treats to choose from). */
export function offer(s: GameState, kind: RewardKind, rng: Rng = Math.random, now = Date.now()): GameState {
  if (!s.pending) return s
  const n = s.pending.choices
  let options: string[] = []
  if (kind === 'treat') options = shuffle(TREATS, rng).slice(0, n).map((t) => t.id)
  if (kind === 'gift') options = shuffle(GIFTS.filter((g) => !s.gifts.includes(g.id)), rng).slice(0, n).map((g) => g.id)
  if (kind === 'clothes') {
    // an in-season outfit, if there is one, always makes the shortlist
    const pool = shuffle(CLOTHES.filter((c) => rewardable(c, now) && !s.wardrobe.includes(c.id)), rng)
    pool.sort((a, b) => Number(!!b.season) - Number(!!a.season))
    options = pool.slice(0, n).map((c) => c.id)
  }
  if (kind === 'adventure') {
    // prefer places we haven't sent a postcard from yet
    const all = adventures(s)
    const fresh = all.filter((a) => !s.postcards.some((p) => p.adventure === a.id))
    const pool = [...shuffle(fresh, rng), ...shuffle(all.filter((a) => !fresh.includes(a)), rng)]
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
      // one now, two saved in the pantry for later
      next = {
        ...bump(s, { hunger: favorite ? 45 : 35, social: favorite ? 12 : 5, fun: 3 }),
        treatsFed: { ...s.treatsFed, [choice]: (s.treatsFed[choice] ?? 0) + 1 },
        pantry: { ...s.pantry, [choice]: (s.pantry[choice] ?? 0) + 2 },
      }
      result = { kind, id: choice, favorite, firstFavorite }
      break
    }
    case 'gift': {
      if (!choice || !byId(GIFTS, choice) || s.gifts.includes(choice)) return null
      next = { ...bump(s, { fun: 18, social: 8 }), gifts: [...s.gifts, choice] }
      result = { kind, id: choice }
      break
    }
    case 'clothes': {
      const item = choice ? byId(CLOTHES, choice) : undefined
      if (!item || item.career || item.special || s.wardrobe.includes(item.id)) return null
      next = {
        ...bump(s, { fun: 12, social: 4 }),
        wardrobe: [...s.wardrobe, item.id],
        equipped: { ...s.equipped, [item.slot]: item.id },
      }
      result = { kind, id: item.id }
      break
    }
    case 'adventure': {
      if (!choice || !adventures(s).some((a) => a.id === choice)) return null
      // adventures last about as long as a break (sub-minute breaks only exist in ?debug)
      const b = s.settings.breakMinutes
      const minutes = b < 1 ? b : Math.max(3, Math.min(15, b))
      const returnsAt = now + minutes * MIN
      next = { ...s, adventure: { id: choice, startedAt: now, returnsAt } }
      result = { kind, id: choice, returnsAt }
      break
    }
    case 'note': {
      next = writeNote(s, now, p.minutes, p.label, rng)
      next = bump(next, { social: 8, fun: 2 })
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
  const pool = n.kind === 'secret' || n.kind === 'post' ? [] : [n.text]
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
  const pools: string[][] = [GENERAL_NOTES, GENERAL_NOTES, s.study.track === 'law' ? LAW_NOTES : STUDY_NOTES]
  if (hour >= 5 && hour < 11) pools.push(MORNING_NOTES)
  if (hour >= 21 || hour < 4) pools.push(NIGHT_NOTES)
  if (minutes >= 45) pools.push(LONG_NOTES, LONG_NOTES)
  if (label) pools.push(LABEL_NOTES, LABEL_NOTES)
  if (st >= 3) pools.push(STREAK_NOTES)
  const template = pickUnused(pick(pools, rng), s, rng)
  const text = fill(template, { name: s.owner.toLowerCase(), fox: s.foxName.toLowerCase(), label, minutes, streak: st })
  return addNote({ ...s, usedNotes: [template, ...s.usedNotes] }, { kind: 'fox', text }, now)
}

export interface MailLetter {
  id: string
  body: string
  signed: string
  /** ISO timestamp */
  deliver_at: string
}

/** Put letters that came in the mail into the album. Letters she already has are skipped. */
export function receiveLetters(s: GameState, letters: MailLetter[], now: number): { state: GameState; added: Note[] } {
  const have = new Set(s.notes.map((n) => n.id))
  const fresh = letters
    .filter((l) => !have.has(`post-${l.id}`) && l.body.trim())
    .map((l) => ({ ...l, at: Math.min(Date.parse(l.deliver_at) || now, now) }))
    .sort((a, b) => b.at - a.at) // newest first, like every other note
  if (!fresh.length) return { state: { ...s, lastMailCheck: now }, added: [] }
  const added: Note[] = fresh.map((l) => ({ id: `post-${l.id}`, kind: 'post', text: l.body.trim(), signed: l.signed.trim(), at: l.at, read: false }))
  return { state: { ...s, lastMailCheck: now, notes: [...added, ...s.notes] }, added }
}

export function readNote(s: GameState, id: string): GameState {
  return { ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, read: true } : n)) }
}

// ─── adventures ─────────────────────────────────────────────────────────────

export function resolveAdventure(s: GameState, now: number, rng: Rng = Math.random, force = false): GameState {
  const adv = s.adventure
  if (!adv || (!force && now < adv.returnsAt)) return s
  const def = adventures(s).find((a) => a.id === adv.id)!
  const card: Postcard = { adventure: def.id, story: pick(def.stories, rng), at: now }
  // a great time, but it comes home hungry, tired and a bit muddy
  return {
    ...bump(s, { fun: 30, social: 5, hunger: -10, energy: -15, hygiene: -20 }),
    adventure: null,
    postcards: [card, ...s.postcards],
    postcardToShow: card,
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

/**
 * The fox does something in the room (on its own, or because you asked).
 * Social actions share a 30-minute window: after a handful they stop
 * counting, so real attention beats button mashing.
 */
export function doActivity(s: GameState, now: number, act: Activity, arg?: string): GameState {
  let next = s
  let scale = 1
  // paid actions are already limited by acorns; only free petting fades out
  if (SOCIAL.includes(act) && !costOf(act)) {
    const fresh = now - s.pets.windowStart > 30 * MIN
    const pets = fresh ? { windowStart: now, count: 0 } : s.pets
    scale = pets.count < 6 ? 1 : 0.2
    next = { ...next, pets: { ...pets, count: pets.count + 1 } }
  }
  if (act === 'eat') {
    if (next.bowl <= 0) return next
    next = { ...next, bowl: next.bowl - 1 }
  }
  if (act === 'treat') {
    if (!arg || !next.pantry[arg]) return next
    const favorite = next.favoriteTreats.includes(arg)
    const pantry = { ...next.pantry, [arg]: next.pantry[arg] - 1 }
    if (!pantry[arg]) delete pantry[arg]
    next = {
      ...bump(next, { hunger: favorite ? 40 : 30, social: favorite ? 12 : 5 }),
      pantry,
      treatsFed: { ...next.treatsFed, [arg]: (next.treatsFed[arg] ?? 0) + 1 },
    }
  }
  if (act === 'nap') next = { ...next, napUntil: 0 }
  const fx = EFFECTS[act]
  const scaled: typeof fx = {}
  for (const [k, v] of Object.entries(fx) as [keyof typeof fx, number][]) scaled[k] = v > 0 ? v * scale : v
  return bump(next, scaled)
}

// ─── acorns ─────────────────────────────────────────────────────────────────
// Focusing earns acorns, and looking after the fox costs them, so the fox
// stays happy only if she studies. Petting, naps, treats she already won and
// flashcards are free, and the fox still eats, naps and plays on its own.

/** One acorn for every 5 minutes of focus, and at least one per session. */
export const acornsFor = (minutes: number) => Math.max(1, Math.floor(minutes / 5))

/** What she can ask the fox to do, in acorns. Anything not listed is free. */
export const COSTS: Partial<Record<Activity, number>> = { bath: 2, brush: 1, cuddle: 1, chat: 1, dance: 1, play: 1, ball: 1, yarn: 1 }
export const costOf = (act: Activity) => COSTS[act] ?? 0
/** One acorn per portion of food. */
export const refillCost = (s: GameState) => Math.max(0, 3 - s.bowl)

/** She asked the fox to do something: it happens if she can pay for it. */
export function doCare(s: GameState, now: number, act: Activity, arg?: string): GameState {
  const cost = costOf(act)
  if (s.acorns < cost) return s
  return { ...doActivity(s, now, act, arg), acorns: s.acorns - cost }
}

export function refillBowl(s: GameState): GameState {
  const cost = refillCost(s)
  if (!cost || s.acorns < cost) return s
  return { ...s, bowl: 3, acorns: s.acorns - cost }
}

/** Kept for the simple tap-to-pet on the fox. */
export function pet(s: GameState, now: number): { state: GameState; counted: boolean } {
  const before = s.pets
  const state = doActivity(s, now, 'pet')
  const fresh = now - before.windowStart > 30 * MIN
  return { state, counted: fresh || before.count < 6 }
}

// ─── career, decor, quiz ─────────────────────────────────────────────────────

export function ownsClothing(s: GameState, id: string) {
  return s.wardrobe.includes(id) || unlocked(s, 'clothes').includes(id)
}

export function isUnlocked(s: GameState, kind: UnlockKind, id: string) {
  return unlocked(s, kind).includes(id)
}

export function setDecor(s: GameState, patch: { wall?: string; floor?: string }): GameState {
  if (patch.wall && !isUnlocked(s, 'wall', patch.wall)) return s
  if (patch.floor && !isUnlocked(s, 'floor', patch.floor)) return s
  return { ...s, decor: { ...s.decor, ...patch } }
}

/** A book just went on the shelf: remember it, and the fox writes about it. */
export function shelveBook(s: GameState, id: string, now: number): GameState {
  const c = s.courses.find((x) => x.id === id)
  if (!c || s.booksSeen.includes(id)) return celebrateBook(s, id)
  const hours = Math.round(courseMinutes(s, c) / 60)
  const text =
    c.kind === 'work'
      ? `i filed ${c.name} away on the ${shelfOf(s, c)?.name ?? 'work'} shelf today. ${hours} hours of hard work! you make it look easy (it isn’t). proud of you.`
      : `i put ${c.name} on the ${shelfName(s, c)} today, right where i can see it. ${hours} hours! it has gold on the spine and everything. i’m so proud of you.`
  return addNote(celebrateBook(s, id), { kind: 'fox', text }, now)
}

/** A promotion is waiting to be celebrated. */
export function pendingPromotion(s: GameState): number | null {
  const r = rankOf(s)
  return r > s.rankSeen ? r : null
}

export function celebratePromotion(s: GameState): GameState {
  return { ...s, rankSeen: rankOf(s) }
}

/** After reviewing her own cards: the fox loves studying with her. */
export function finishReview(s: GameState, reviewed: number, knew: number): GameState {
  if (!reviewed) return s
  const q = s.quiz
  const next = bump(s, { fun: Math.min(20, 6 + reviewed), social: 6 })
  return { ...next, quiz: { ...q, correct: q.correct + knew, answered: q.answered + reviewed } }
}

export function finishQuiz(s: GameState, correct: number, total: number): GameState {
  const q = s.quiz
  const next = bump(s, { fun: 12 + correct, social: 6 })
  return { ...next, quiz: { rounds: q.rounds + 1, best: Math.max(q.best, correct), correct: q.correct + correct, answered: q.answered + total } }
}

export function toggleWear(s: GameState, id: string): GameState {
  const item = byId(CLOTHES, id)
  if (!item || !ownsClothing(s, id)) return s
  const equipped = { ...s.equipped }
  if (equipped[item.slot] === id) delete equipped[item.slot]
  else equipped[item.slot] = id
  return { ...s, equipped }
}
