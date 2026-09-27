import type { GameState } from './state.ts'

// Sims-style needs. Each runs 0-100 and drains over time; the fox's overall
// mood comes from all of them, with the lowest one pulling hardest.

export const NEEDS = ['hunger', 'energy', 'fun', 'hygiene', 'social'] as const
export type NeedKey = (typeof NEEDS)[number]
export type Needs = Record<NeedKey, number>

export const NEED_INFO: Record<NeedKey, { label: string; icon: string; low: string }> = {
  hunger: { label: 'hunger', icon: 'onigiri', low: 'is hungry' },
  energy: { label: 'energy', icon: 'moon', low: 'is sleepy' },
  fun: { label: 'fun', icon: 'ball', low: 'is bored' },
  hygiene: { label: 'hygiene', icon: 'bubbles', low: 'needs a bath' },
  social: { label: 'social', icon: 'heart', low: 'is lonely' },
}

const HOUR = 3_600_000
const MIN = 60_000
const clamp = (n: number) => Math.max(0, Math.min(100, n))

export type Mood = 'joyful' | 'happy' | 'okay' | 'sad' | 'depressed'

export function moodValue(n: Needs): number {
  const vals = NEEDS.map((k) => n[k])
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return 0.5 * avg + 0.5 * Math.min(...vals)
}

export function moodOf(value: number): Mood {
  if (value < 15) return 'depressed'
  if (value < 35) return 'sad'
  if (value < 60) return 'okay'
  if (value < 82) return 'happy'
  return 'joyful'
}

export const foxMood = (s: GameState) => moodOf(moodValue(s.needs))

export function lowestNeed(n: Needs): NeedKey {
  return NEEDS.reduce((lo, k) => (n[k] < n[lo] ? k : lo), NEEDS[0])
}

/** Add (or subtract) from needs, clamped. */
export function bump(s: GameState, delta: Partial<Needs>): GameState {
  const needs = { ...s.needs }
  for (const k of NEEDS) if (delta[k]) needs[k] = clamp(needs[k] + delta[k]!)
  return { ...s, needs }
}

export function isBedtime(t: number) {
  const h = new Date(t).getHours()
  return h >= 23 || h < 7
}

export function isAsleep(s: GameState, t: number) {
  return !s.session && (isBedtime(t) || t < s.napUntil)
}

/**
 * Let time pass. With `autonomy` the fox also looks after itself the way it
 * would while you're away: eats from the bowl, plays with toys, cuddles the
 * teddy, naps when exhausted. (While the app is open the room does this
 * visibly instead, so the live ticker runs without autonomy.)
 */
export function simulate(s: GameState, now: number, autonomy = false): GameState {
  let t = s.lastTick
  if (now <= t) return s
  // exam week: everything is frozen, the fox just waits happily for you
  const care = s.settings.care ?? 'classic'
  if (care === 'paused') return { ...s, lastTick: now }
  const rate = care === 'gentle' ? 0.6 : 1
  const floor = care === 'gentle' ? 20 : 0
  const n = { ...s.needs }
  const lastUse = { ...s.lastUse }
  let { bowl, napUntil } = s
  const has = (g: string) => s.gifts.includes(g)
  const ready = (k: string, cooldown: number) => (lastUse[k] ?? 0) + cooldown <= t
  const end = Math.min(now, t + 30 * 24 * HOUR)
  while (t < end) {
    const step = Math.min(15 * MIN, end - t)
    const h = step / HOUR
    const asleep = isBedtime(t) || t < napUntil
    const comfy = (has('mushroomLamp') ? 1.15 : 1) * (has('cushion') ? 1.1 : 1)
    n.hunger -= (asleep ? 1.2 : 2) * h * rate
    n.energy += asleep ? 9 * comfy * h : -3.2 * h * rate
    n.fun -= (asleep ? 0.4 : 2.4) * h * rate
    n.hygiene -= (asleep ? 0.4 : 1.2) * h * rate
    n.social -= (asleep ? 0.5 : 1.6) * h * rate
    if (autonomy && !asleep) {
      if (n.energy < 15) napUntil = t + 90 * MIN
      if (n.hunger < 55 && bowl > 0 && ready('bowl', 2 * HOUR)) {
        n.hunger += 28
        bowl--
        lastUse.bowl = t
      }
      // too lonely to play by itself
      if (n.fun < 45 && n.social >= 20 && ready('toy', 3 * HOUR)) {
        n.fun += has('yarn') ? 20 : 14
        lastUse.toy = t
      }
      if (n.social < 40 && has('teddy') && ready('teddy', 4 * HOUR)) {
        n.social += 10
        lastUse.teddy = t
      }
      if (n.fun < 50 && has('books') && ready('books', 5 * HOUR)) {
        n.fun += 10
        lastUse.books = t
      }
    }
    for (const k of NEEDS) n[k] = Math.max(floor, clamp(n[k]))
    t += step
  }
  return { ...s, needs: n, bowl, lastUse, napUntil, lastTick: now }
}

// ─── things the fox can do in the room ─────────────────────────────────────

export type Activity =
  | 'eat'
  | 'nap'
  | 'ball'
  | 'yarn'
  | 'read'
  | 'window'
  | 'teddy'
  | 'cushion'
  | 'bath'
  | 'brush'
  | 'pet'
  | 'cuddle'
  | 'chat'
  | 'dance'
  | 'play'
  | 'treat'

/** Social actions share a cooldown window so spamming them fades out. */
export const SOCIAL: Activity[] = ['pet', 'cuddle', 'chat', 'dance', 'play']

export const EFFECTS: Record<Activity, Partial<Needs>> = {
  eat: { hunger: 28 },
  nap: { energy: 30 },
  ball: { fun: 14, energy: -3, hunger: -2 },
  yarn: { fun: 22, energy: -3, hunger: -2 },
  read: { fun: 10, energy: -1 },
  window: { fun: 6 },
  teddy: { social: 10, fun: 3 },
  cushion: { energy: 8, fun: 2 },
  bath: { hygiene: 100, fun: -2, social: 2 },
  brush: { hygiene: 30, social: 6 },
  pet: { social: 3 },
  cuddle: { social: 14 },
  chat: { social: 10, fun: 4 },
  dance: { fun: 14, energy: -4, social: 3 },
  play: { fun: 16, energy: -5, social: 4, hygiene: -3 },
  treat: {},
}
