/** Local calendar day, YYYY-MM-DD. */
export function dayKey(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Local month-day, MM-DD. */
export function monthDay(t: number) {
  const d = new Date(t)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

/** Northern-hemisphere seasons by month. */
export function seasonOf(t: number): Season {
  const m = new Date(t).getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'autumn'
}

export const isOctober = (t: number) => new Date(t).getMonth() === 9
