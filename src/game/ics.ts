// A calendar's subscription link (iCloud, Google, Outlook, Canvas, a school's
// own feed) hands over iCalendar text. This reads the events out of it, the
// repeating ones included, within a window of days, and nothing else.
export interface IcsEvent {
  /** The event's UID (every occurrence of a repeating one shares it). */
  id: string
  title: string
  /** ms */
  start: number
  end: number
  allDay: boolean
  recurring: boolean
}

export interface IcsCalendar {
  /** What the feed calls itself (X-WR-CALNAME), or ''. */
  name: string
  events: IcsEvent[]
}

const DAY = 86_400_000
/** Occurrences of one repeating event, at most. */
const MAX_OCCURRENCES = 1000

/** A pasted address, as the relay wants it: webcal:// is https:// in disguise; http isn't allowed. */
export function feedUrl(text: string): string | null {
  const t = text.trim().replace(/^webcals?:\/\//i, 'https://')
  if (!/^https:\/\//i.test(t)) return null
  try {
    const u = new URL(t)
    if (u.username || u.password || !u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/** Lines fold at 75 octets; a continuation line starts with a space or a tab. */
export function unfold(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length) out[out.length - 1] += raw.slice(1)
    else if (raw) out.push(raw)
  }
  return out
}

interface Prop {
  name: string
  params: Record<string, string>
  value: string
}

function parseLine(line: string): Prop | null {
  // the first ':' outside quotes splits name;params from the value
  let quoted = false
  let at = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') quoted = !quoted
    else if (ch === ':' && !quoted) {
      at = i
      break
    }
  }
  if (at <= 0) return null
  const [name, ...ps] = line.slice(0, at).split(';')
  const params: Record<string, string> = {}
  for (const p of ps) {
    const j = p.indexOf('=')
    if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value: line.slice(at + 1) }
}

const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

/** The offset of a named time zone at a moment, if the runtime knows the zone. */
function zoneOffset(t: number, tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t))
    const g: Record<string, number> = {}
    for (const p of parts) if (p.type !== 'literal') g[p.type] = Number(p.value)
    return Date.UTC(g.year, g.month - 1, g.day, g.hour % 24, g.minute, g.second) - t
  } catch {
    return null
  }
}

/** A wall-clock time in a named zone, as a moment. */
function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number | null {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  const off = zoneOffset(guess, tz)
  if (off === null) return null
  let t = guess - off
  const again = zoneOffset(t, tz)
  if (again !== null && again !== off) t = guess - again
  return t
}

/**
 * DATE (20261014) or DATE-TIME (20261014T130000; Z for UTC; TZID=… for a
 * named zone, read in that zone when the runtime knows it, else as hers).
 */
export function parseStamp(value: string, params: Record<string, string> = {}): { t: number; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  if (m[4] === undefined || params.VALUE === 'DATE') return { t: new Date(y, mo - 1, d).getTime(), allDay: true }
  const h = +m[4]
  const mi = +m[5]
  const s = +(m[6] ?? 0)
  if (m[7]) return { t: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false }
  if (params.TZID) {
    const t = zoned(y, mo, d, h, mi, s, params.TZID)
    if (t !== null) return { t, allDay: false }
  }
  return { t: new Date(y, mo - 1, d, h, mi, s).getTime(), allDay: false }
}

/** P1D, PT1H30M, P1DT2H… in ms. */
export function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim())
  if (!m) return null
  const ms = (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * DAY + +(m[4] ?? 0) * 3_600_000 + +(m[5] ?? 0) * 60_000 + +(m[6] ?? 0) * 1000
  return m[1] === '-' ? -ms : ms
}

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: number
  /** 0 = Sunday … 6 = Saturday (plain days only; "2MO" and friends fall back to the start's day). */
  byDay?: number[]
  byMonthDay?: number[]
  /** Week start, 0-6 (RFC default Monday). */
  wkst: number
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function parseRule(v: string): Rule | null {
  const r: Partial<Rule> & { wkst: number; interval: number } = { interval: 1, wkst: 1 }
  for (const part of v.split(';')) {
    const [k, val] = part.split('=')
    if (!val) continue
    switch (k.toUpperCase()) {
      case 'FREQ':
        if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(val.toUpperCase())) r.freq = val.toUpperCase() as Rule['freq']
        break
      case 'INTERVAL':
        r.interval = Math.max(1, Number(val) || 1)
        break
      case 'COUNT':
        r.count = Math.max(0, Number(val) || 0)
        break
      case 'UNTIL': {
        const u = parseStamp(val)
        if (u) r.until = u.allDay ? u.t + DAY - 1 : u.t
        break
      }
      case 'BYDAY': {
        const days = val
          .split(',')
          .map((d) => DAYS.indexOf(d.trim().toUpperCase().slice(-2)))
          .filter((d) => d >= 0)
        // an ordinal ("2MO", the second Monday) is more than this reader knows; keep the start's day instead
        if (days.length && !/\d/.test(val)) r.byDay = [...new Set(days)].sort()
        break
      }
      case 'BYMONTHDAY':
        r.byMonthDay = val
          .split(',')
          .map(Number)
          .filter((n) => n >= 1 && n <= 31)
        break
      case 'WKST':
        r.wkst = Math.max(0, DAYS.indexOf(val.toUpperCase()))
        break
    }
  }
  return r.freq ? (r as Rule) : null
}

/** Every start of a repeating event between `from` and `to`, counting from its first one. */
export function occurrences(start: number, rule: Rule, from: number, to: number): number[] {
  const first = new Date(start)
  const y = first.getFullYear()
  const mo = first.getMonth()
  const d = first.getDate()
  const h = first.getHours()
  const mi = first.getMinutes()
  const s = first.getSeconds()
  const out: number[] = []
  let made = 0
  const take = (t: number): boolean => {
    // false when the rule is spent
    if (t < start) return true
    if (rule.until !== undefined && t > rule.until) return false
    if (rule.count !== undefined && made >= rule.count) return false
    made++
    if (t >= from && t <= to) out.push(t)
    return out.length < MAX_OCCURRENCES && t <= to
  }
  if (rule.freq === 'WEEKLY' && rule.byDay) {
    const back = (first.getDay() - rule.wkst + 7) % 7
    for (let w = 0; w < MAX_OCCURRENCES; w++) {
      for (const day of rule.byDay) {
        const offset = (day - rule.wkst + 7) % 7
        if (!take(new Date(y, mo, d - back + w * rule.interval * 7 + offset, h, mi, s).getTime())) return out
      }
    }
    return out
  }
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const n = i * rule.interval
    if (rule.freq === 'DAILY') {
      if (!take(new Date(y, mo, d + n, h, mi, s).getTime())) break
    } else if (rule.freq === 'WEEKLY') {
      if (!take(new Date(y, mo, d + n * 7, h, mi, s).getTime())) break
    } else if (rule.freq === 'MONTHLY') {
      const days = rule.byMonthDay ?? [d]
      let spent = false
      for (const md of days) {
        const t = new Date(y, mo + n, md, h, mi, s)
        if (t.getMonth() !== (((mo + n) % 12) + 12) % 12) continue // the 31st of a short month
        if (!take(t.getTime())) {
          spent = true
          break
        }
      }
      if (spent) break
    } else if (!take(new Date(y + n, mo, d, h, mi, s).getTime())) break
  }
  return out
}

interface RawEvent {
  uid: string
  title: string
  start: number
  end: number
  allDay: boolean
  rrule: Rule | null
  exdates: number[]
  recurrenceId: number | null
  cancelled: boolean
}

function readEvent(lines: Prop[]): RawEvent | null {
  let uid = ''
  let title = ''
  let start: { t: number; allDay: boolean } | null = null
  let end: number | null = null
  let duration: number | null = null
  let rrule: Rule | null = null
  const exdates: number[] = []
  let recurrenceId: number | null = null
  let cancelled = false
  for (const p of lines) {
    switch (p.name) {
      case 'UID':
        uid = p.value.trim()
        break
      case 'SUMMARY':
        title = unescapeText(p.value).trim()
        break
      case 'DTSTART':
        start = parseStamp(p.value, p.params)
        break
      case 'DTEND':
        end = parseStamp(p.value, p.params)?.t ?? null
        break
      case 'DURATION':
        duration = parseDuration(p.value)
        break
      case 'RRULE':
        rrule = parseRule(p.value)
        break
      case 'EXDATE':
        for (const v of p.value.split(',')) {
          const x = parseStamp(v, p.params)
          if (x) exdates.push(x.t)
        }
        break
      case 'RECURRENCE-ID':
        recurrenceId = parseStamp(p.value, p.params)?.t ?? null
        break
      case 'STATUS':
        cancelled = p.value.trim().toUpperCase() === 'CANCELLED'
        break
    }
  }
  if (!start) return null
  let finish = end ?? (duration !== null ? start.t + duration : null)
  if (finish === null) finish = start.allDay ? start.t + DAY : start.t
  if (finish < start.t) finish = start.t
  return { uid: uid || `${title}@${start.t}`, title, start: start.t, end: finish, allDay: start.allDay, rrule, exdates, recurrenceId, cancelled }
}

const sameDay = (a: number, b: number) => {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** The events in a feed that touch the window, repeating ones unrolled, cancellations and exceptions honoured. */
export function parseIcs(text: string, from: number, to: number): IcsCalendar {
  const lines = unfold(text)
  let name = ''
  const raws: RawEvent[] = []
  let inEvent: Prop[] | null = null
  let depth = 0 // nested components inside an event (VALARM) are skipped
  for (const line of lines) {
    const p = parseLine(line)
    if (!p) continue
    if (p.name === 'BEGIN') {
      const what = p.value.trim().toUpperCase()
      if (what === 'VEVENT' && !inEvent) inEvent = []
      else if (inEvent) depth++
      continue
    }
    if (p.name === 'END') {
      const what = p.value.trim().toUpperCase()
      if (inEvent && depth > 0) depth--
      else if (what === 'VEVENT' && inEvent) {
        const e = readEvent(inEvent)
        if (e) raws.push(e)
        inEvent = null
      }
      continue
    }
    if (inEvent) {
      if (depth === 0) inEvent.push(p)
    } else if (p.name === 'X-WR-CALNAME') name = unescapeText(p.value).trim()
  }

  // an occurrence changed by hand replaces the one the rule would have made
  const overrides = new Map<string, number[]>()
  for (const e of raws) if (e.recurrenceId !== null) overrides.set(e.uid, [...(overrides.get(e.uid) ?? []), e.recurrenceId])

  const events: IcsEvent[] = []
  const touches = (start: number, end: number) => start <= to && Math.max(end, start + 1) > from
  for (const e of raws) {
    if (e.cancelled) continue
    const length = e.end - e.start
    if (e.rrule && e.recurrenceId === null) {
      const skip = [...e.exdates, ...(overrides.get(e.uid) ?? [])]
      for (const t of occurrences(e.start, e.rrule, from - length, to)) {
        if (skip.some((x) => x === t || (e.allDay && sameDay(x, t)))) continue
        if (touches(t, t + length)) events.push({ id: e.uid, title: e.title, start: t, end: t + length, allDay: e.allDay, recurring: true })
      }
    } else if (touches(e.start, e.end)) {
      events.push({ id: e.uid, title: e.title, start: e.start, end: e.end, allDay: e.allDay, recurring: e.recurrenceId !== null })
    }
  }
  events.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
  return { name, events }
}
