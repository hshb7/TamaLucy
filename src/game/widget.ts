// Her widget: the fox on her iPhone home screen (and in the Dynamic Island while
// she focuses), styled the way she likes. The style lives in the game state so it
// syncs with her fox; the iPhone app turns it into the real widget.

import { unlocked } from './career.ts'
import { streak } from './logic.ts'
import { dayKey } from './time.ts'
import { lastCourse, courseMinutes } from './shelf.ts'
import { upcomingExams } from './study.ts'
import { statusLine } from './lines.ts'
import { BOOK_COLORS } from '../art/bookcase.ts'
import type { GameState, WidgetPose, WidgetShow, WidgetStyle } from './state.ts'

export interface WidgetBackground {
  name: string
  /** A wallpaper from the room, or a plain colour. */
  wall?: string
  color?: string
  /** Text and the little card it sits on. */
  ink: string
  card: string
  accent: string
}

const LIGHT = { ink: '#5b3a31', card: '#fffaf3' }

export const WIDGET_BACKGROUNDS: Record<string, WidgetBackground> = {
  stripes: { name: 'strawberry milk', wall: 'stripes', ...LIGHT, accent: '#e4819a' },
  hearts: { name: 'butter hearts', wall: 'hearts', ...LIGHT, accent: '#e4819a' },
  gingham: { name: 'mint gingham', wall: 'gingham', ...LIGHT, accent: '#5f9a63' },
  dots: { name: 'lavender dots', wall: 'dots', ...LIGHT, accent: '#9a7cc4' },
  library: { name: 'law library', wall: 'library', ink: '#4a2a22', card: '#f7eed8', accent: '#3f5c4a' },
  damask: { name: 'justice gold', wall: 'damask', ...LIGHT, accent: '#a57a3a' },
  cream: { name: 'cream', color: '#fff4e8', ...LIGHT, accent: '#e4819a' },
  blush: { name: 'blush', color: '#fbd3dd', ...LIGHT, accent: '#e4819a' },
  matcha: { name: 'matcha', color: '#cfe2c1', ...LIGHT, accent: '#5f9a63' },
  lilac: { name: 'lilac', color: '#ddd0f2', ...LIGHT, accent: '#9a7cc4' },
  sky: { name: 'sky', color: '#c9e7f5', ...LIGHT, accent: '#5f93cb' },
  midnight: { name: 'midnight', color: '#2c2340', ink: '#f6ecff', card: '#3b2f55', accent: '#f7abbc' },
}

export const POSES: { id: WidgetPose; label: string }[] = [
  { id: 'sit', label: 'sitting' },
  { id: 'study', label: 'studying' },
  { id: 'nap', label: 'napping' },
]

export const SHOWS: { id: WidgetShow; label: string }[] = [
  { id: 'today', label: 'today’s focus' },
  { id: 'class', label: 'a class' },
  { id: 'exam', label: 'next exam' },
  { id: 'streak', label: 'streak' },
  { id: 'acorns', label: 'acorns' },
]

/** Backgrounds she can use: plain colours always, wallpapers once the fox's career unlocks them. */
export function widgetBackgroundUnlocked(s: GameState, id: string): boolean {
  const bg = WIDGET_BACKGROUNDS[id]
  if (!bg) return false
  return !bg.wall || unlocked(s.stats.totalMinutes, 'wall').includes(bg.wall)
}

export function setWidgetStyle(s: GameState, patch: Partial<WidgetStyle>): GameState {
  const next = { ...s.widget, ...patch }
  if (!widgetBackgroundUnlocked(s, next.bg)) next.bg = s.widget.bg
  next.caption = next.caption.slice(0, 40)
  return { ...s, widget: next }
}

/**
 * Everything the widget shows, in words and numbers. The iPhone redraws the
 * widget from this; anything that changes by itself (a new day, the days until an
 * exam) it works out on its own.
 */
export interface WidgetData {
  fox: string
  caption: string
  show: WidgetShow
  /** The day the numbers are for (local YYYY-MM-DD). */
  day: string
  todayMinutes: number
  acorns: number
  streak: number
  exam: { name: string; date: string } | null
  course: { name: string; hours: number; goal: number; color: string } | null
  ink: string
  card: string
  accent: string
  /** When the app last saw her (ms): an old widget says the fox misses her. */
  savedAt: number
}

export function widgetData(s: GameState, now: number): WidgetData {
  const w = s.widget
  const bg = WIDGET_BACKGROUNDS[w.bg] ?? WIDGET_BACKGROUNDS.stripes
  const c = (w.courseId && s.courses.find((x) => x.id === w.courseId)) || lastCourse(s)
  const exam = upcomingExams(s, now)[0]
  return {
    fox: s.foxName,
    caption: w.caption.trim() || statusLine(s, now),
    show: w.show,
    day: dayKey(now),
    todayMinutes: s.stats.days[dayKey(now)] ?? 0,
    acorns: s.acorns,
    streak: streak(s.stats.days, now),
    exam: exam ? { name: exam.name, date: exam.date } : null,
    course: c ? { name: c.name, hours: Math.floor(courseMinutes(s, c) / 60), goal: c.goalHours, color: (BOOK_COLORS[c.color] ?? BOOK_COLORS.cherry).spine } : null,
    ink: bg.ink,
    card: bg.card,
    accent: bg.accent,
    savedAt: now,
  }
}

/** The stat line, as the widget words it (the preview here and the Swift widget agree). */
export function widgetStat(d: WidgetData, today: string, daysUntil: (date: string) => number): { big: string; small: string } {
  switch (d.show) {
    case 'acorns':
      return { big: String(d.acorns), small: 'acorns' }
    case 'streak':
      return { big: String(d.day === today || isYesterday(d.day, today) ? d.streak : 0), small: 'day streak' }
    case 'exam': {
      if (!d.exam) return { big: '—', small: 'no exams coming up' }
      const n = daysUntil(d.exam.date)
      if (n < 0) return { big: '✓', small: `${d.exam.name} is done!` }
      return { big: n === 0 ? 'today' : String(n), small: n === 0 ? d.exam.name : `day${n === 1 ? '' : 's'} to ${d.exam.name}` }
    }
    case 'class':
      if (!d.course) return { big: '—', small: 'add a class on the bookshelf' }
      return { big: `${d.course.hours}/${d.course.goal}h`, small: d.course.name }
    default: {
      const m = d.day === today ? d.todayMinutes : 0
      return { big: m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`, small: 'focused today' }
    }
  }
}

function isYesterday(day: string, today: string) {
  const [y, m, d] = today.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime()) === day
}
