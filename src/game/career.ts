// The fox's career. It climbs one rung for every chunk of focus time, so her
// study hours literally carry the fox up the ladder: from 1L to the Supreme
// Court on the law track, or from freshman to dean on the general one. Both
// tracks have the same rungs (same hours), just different titles and prizes.
import type { GameState, Track } from './state.ts'

/** 'law' is career-unlocked decor for the study corner (diploma, scales, trophy…). */
export type UnlockKind = 'wall' | 'floor' | 'clothes' | 'law'

export interface Unlock {
  kind: UnlockKind
  id: string
  label: string
}

export interface Rank {
  title: string
  /** Short form for the header chip. */
  short: string
  /** Total focus minutes needed. */
  min: number
  unlocks: Unlock[]
}

export const LAW_RANKS: Rank[] = [
  { title: 'Pre-Law Pup', short: 'Pre-Law', min: 0, unlocks: [] },
  { title: '1L', short: '1L', min: 60, unlocks: [{ kind: 'wall', id: 'gingham', label: 'mint gingham wallpaper' }] },
  { title: '2L', short: '2L', min: 240, unlocks: [{ kind: 'floor', id: 'checker', label: 'milk checker floor' }] },
  { title: '3L', short: '3L', min: 540, unlocks: [{ kind: 'clothes', id: 'necktie', label: 'a law-firm necktie' }] },
  {
    title: 'Law Graduate',
    short: 'J.D.',
    min: 900,
    unlocks: [
      { kind: 'clothes', id: 'gradCap', label: 'a graduation cap' },
      { kind: 'law', id: 'diploma', label: 'a framed diploma' },
    ],
  },
  { title: 'Passed the Bar', short: 'Esq.', min: 1380, unlocks: [{ kind: 'wall', id: 'dots', label: 'lavender dots wallpaper' }] },
  { title: 'Junior Associate', short: 'Assoc.', min: 1980, unlocks: [{ kind: 'floor', id: 'carpet', label: 'cloud carpet' }] },
  {
    title: 'Senior Associate',
    short: 'Sr. Assoc.',
    min: 2700,
    unlocks: [
      { kind: 'wall', id: 'library', label: 'law library wallpaper' },
      { kind: 'floor', id: 'walnut', label: 'walnut floor' },
    ],
  },
  { title: 'Partner', short: 'Partner', min: 3600, unlocks: [{ kind: 'law', id: 'scales', label: 'the scales of justice' }] },
  {
    title: 'Judge',
    short: 'Judge',
    min: 4800,
    unlocks: [
      { kind: 'clothes', id: 'judgeWig', label: 'a judge’s wig' },
      { kind: 'law', id: 'gavel', label: 'a gavel' },
    ],
  },
  { title: 'Supreme Court Justice', short: 'Justice', min: 6600, unlocks: [{ kind: 'wall', id: 'damask', label: 'golden damask wallpaper' }] },
]

/** The plain ladder (no field of study assumed); her setup gives the rungs their names. */
export const GENERAL_RANKS: Rank[] = [
  { title: 'Curious Kit', short: 'Kit', min: 0, unlocks: [] },
  { title: 'Beginner', short: 'Beginner', min: 60, unlocks: [{ kind: 'wall', id: 'gingham', label: 'mint gingham wallpaper' }] },
  { title: 'Learner', short: 'Learner', min: 240, unlocks: [{ kind: 'floor', id: 'checker', label: 'milk checker floor' }] },
  { title: 'Apprentice', short: 'Apprentice', min: 540, unlocks: [{ kind: 'clothes', id: 'necktie', label: 'a smart necktie' }] },
  {
    title: 'Regular',
    short: 'Regular',
    min: 900,
    unlocks: [
      { kind: 'clothes', id: 'gradCap', label: 'a graduation cap' },
      { kind: 'law', id: 'diploma', label: 'a framed diploma' },
    ],
  },
  { title: 'Dedicated', short: 'Dedicated', min: 1380, unlocks: [{ kind: 'wall', id: 'dots', label: 'lavender dots wallpaper' }] },
  { title: 'Scholar', short: 'Scholar', min: 1980, unlocks: [{ kind: 'floor', id: 'carpet', label: 'cloud carpet' }] },
  {
    title: 'Expert',
    short: 'Expert',
    min: 2700,
    unlocks: [
      { kind: 'wall', id: 'library', label: 'library wallpaper' },
      { kind: 'floor', id: 'walnut', label: 'walnut floor' },
    ],
  },
  { title: 'Mentor', short: 'Mentor', min: 3600, unlocks: [{ kind: 'law', id: 'trophy', label: 'a shiny trophy' }] },
  { title: 'Master', short: 'Master', min: 4800, unlocks: [{ kind: 'law', id: 'globe', label: 'a globe for the desk' }] },
  { title: 'Legend', short: 'Legend', min: 6600, unlocks: [{ kind: 'wall', id: 'damask', label: 'golden damask wallpaper' }] },
]

/** How many rungs a ladder has (every preset and her own list match this). */
export const RUNGS = GENERAL_RANKS.length

export const TRACKS: Record<Track, { name: string; ranks: Rank[]; top: string }> = {
  law: { name: 'law', ranks: LAW_RANKS, top: 'the highest court in the land. legendary.' },
  general: { name: 'school', ranks: GENERAL_RANKS, top: 'the top of the ladder. legendary.' },
}

/** A short form for a chip: the title itself when it's short, else initials ("Chief Nursing Officer" → "CNO"). */
export function shortOf(title: string): string {
  const t = title.trim()
  if (t.length <= 10) return t
  const words = t.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w))
  if (words.length >= 2) return words.map((w) => w[0].toUpperCase()).join('').slice(0, 4)
  return t.slice(0, 9) + '.'
}

/** Hand-made short forms for the titles the app ships with, whichever ladder they came from. */
const KNOWN_SHORTS = new Map([...LAW_RANKS, ...GENERAL_RANKS].map((r) => [r.title, r.short]))

/**
 * The ladder the fox is on: the track's rungs (hours and prizes), named the
 * way she named them.
 */
export function ladder(s: Pick<GameState, 'study'>): Rank[] {
  const base = TRACKS[s.study.track]?.ranks ?? GENERAL_RANKS
  const rungs = s.study.rungs
  if (rungs?.length !== base.length) return base
  return base.map((r, i) => {
    const title = rungs[i].trim() || r.title
    return title === r.title ? r : { ...r, title, short: KNOWN_SHORTS.get(title) ?? shortOf(title) }
  })
}

export const FREE_WALLS = ['stripes', 'hearts']
export const FREE_FLOORS = ['honey']

export function rankIn(ranks: readonly Rank[], totalMinutes: number): number {
  let r = 0
  ranks.forEach((rank, i) => {
    if (totalMinutes >= rank.min) r = i
  })
  return r
}

type Climber = Pick<GameState, 'study' | 'stats'>

/** The rung the fox is on (an index into ladder(s)). */
export const rankOf = (s: Climber) => rankIn(ladder(s), s.stats.totalMinutes)

/** The fox's current rank. */
export const currentRank = (s: Climber): Rank => ladder(s)[rankOf(s)]

/** Everything of one kind the fox has unlocked so far. */
export function unlocked(s: Climber, kind: UnlockKind): string[] {
  const ranks = ladder(s)
  const ids = ranks.slice(0, rankOf(s) + 1).flatMap((rank) => rank.unlocks.filter((u) => u.kind === kind).map((u) => u.id))
  if (kind === 'wall') return [...FREE_WALLS, ...ids]
  if (kind === 'floor') return [...FREE_FLOORS, ...ids]
  return ids
}

/** The rung that unlocks an item on the fox's track, or -1 if it isn't a career unlock there. */
export function unlockRank(s: Pick<GameState, 'study'>, kind: UnlockKind, id: string): number {
  return ladder(s).findIndex((rank) => rank.unlocks.some((u) => u.kind === kind && u.id === id))
}
