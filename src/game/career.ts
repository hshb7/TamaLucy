// The fox's law career. It climbs one rung for every chunk of focus time,
// so her study hours literally carry the fox from 1L to the Supreme Court.

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

export const CAREER: Rank[] = [
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
  { title: 'Supreme Court Justice', short: 'Justice', min: 6600, unlocks: [{ kind: 'wall', id: 'damask', label: 'justice gold wallpaper' }] },
]

export const FREE_WALLS = ['stripes', 'hearts']
export const FREE_FLOORS = ['honey']

export function rankOf(totalMinutes: number): number {
  let r = 0
  CAREER.forEach((rank, i) => {
    if (totalMinutes >= rank.min) r = i
  })
  return r
}

/** Everything of one kind unlocked at this much focus time. */
export function unlocked(totalMinutes: number, kind: UnlockKind): string[] {
  const r = rankOf(totalMinutes)
  const ids = CAREER.slice(0, r + 1).flatMap((rank) => rank.unlocks.filter((u) => u.kind === kind).map((u) => u.id))
  if (kind === 'wall') return [...FREE_WALLS, ...ids]
  if (kind === 'floor') return [...FREE_FLOORS, ...ids]
  return ids
}

/** The rank that unlocks an item, or -1 if it isn't a career unlock. */
export function unlockRank(kind: UnlockKind, id: string): number {
  return CAREER.findIndex((rank) => rank.unlocks.some((u) => u.kind === kind && u.id === id))
}
