// What the fox would say if it could tap her on the shoulder: a plan of local
// notifications, worked out from her save and handed to the phone (or the
// Mac) every time she opens the app. Because it's recomputed from the latest
// state, "Mochi misses you" only ever fires if she really has stayed away.
import { streak } from './logic.ts'
import type { GameState } from './state.ts'
import { daysUntil, upcomingExams } from './study.ts'
import { dayKey } from './time.ts'

export interface ReminderPrefs {
  /** After two quiet days. */
  lonely: boolean
  /** The week before and the day before each exam; the day before a deadline. */
  exams: boolean
  /** At 8pm, if a streak is about to break. */
  streak: boolean
  /** A daily "study with me?" at this time ('HH:MM'), or '' for none. */
  nudge: string
}

export const DEFAULT_REMINDERS: ReminderPrefs = { lonely: true, exams: true, streak: true, nudge: '' }

export interface Reminder {
  id: string
  title: string
  body: string
  /** ms */
  at: number
}

/** iOS keeps at most 64 pending notifications per app; leave room for "time's up". */
export const MAX_REMINDERS = 40

const NUDGES = [
  'even ten minutes count. the desk is ready ✿',
  'a little today beats a lot tomorrow.',
  'the fox sharpened a pencil for you.',
  'one session, then a treat for both of you?',
  'your streak would love some company.',
  'the acorns don’t earn themselves ♡',
  'small steps, every day. that’s the whole trick.',
]

export function reminderPlan(s: GameState, prefs: ReminderPrefs, now: number): Reminder[] {
  const f = s.foxName
  const out: Reminder[] = []
  const at = (dayOffset: number, hh: number, mm = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hh, mm, 0, 0)
    return d.getTime()
  }
  const todayMin = s.stats.days[dayKey(now)] ?? 0

  if (prefs.lonely) {
    out.push({ id: 'lonely', title: `${f} misses you`, body: 'it’s been a couple of days. come say hi? ♡', at: at(2, 18) })
    out.push({ id: 'lonely2', title: `${f} is getting lonely`, body: 'the bowl is empty and the room is quiet. five minutes together?', at: at(4, 18) })
  }

  if (prefs.exams) {
    for (const e of upcomingExams(s, now).slice(0, 12)) {
      const d = daysUntil(e.date, now)
      if (e.kind === 'due') {
        if (d >= 1) out.push({ id: `due:${e.id}`, title: `due tomorrow: ${e.name}`, body: `${f} will keep you company while you finish it.`, at: at(d - 1, 18) })
        continue
      }
      if (d >= 7) out.push({ id: `exam7:${e.id}`, title: `${e.name} in a week`, body: `${f} is counting down with you. a little every day ✿`, at: at(d - 7, 18) })
      if (d >= 1) out.push({ id: `exam1:${e.id}`, title: `tomorrow: ${e.name}`, body: `early night tonight. ${f} believes in you ♡`, at: at(d - 1, 19) })
    }
  }

  if (prefs.streak) {
    const st = streak(s.stats.days, now)
    if (st >= 2 && !todayMin) out.push({ id: 'streak', title: `don’t lose your ${st}-day streak`, body: `one short session keeps it going. ${f} is waiting by the desk.`, at: at(0, 20) })
  }

  if (/^\d{2}:\d{2}$/.test(prefs.nudge)) {
    const [hh, mm] = prefs.nudge.split(':').map(Number)
    for (let i = 0; i < 7; i++) {
      if (i === 0 && todayMin > 0) continue // already studied today
      out.push({ id: `nudge:${i}`, title: `study with ${f}?`, body: NUDGES[(i + new Date(now).getDate()) % NUDGES.length], at: at(i, hh, mm) })
    }
  }

  return out
    .filter((r) => r.at > now + 60_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_REMINDERS)
}
