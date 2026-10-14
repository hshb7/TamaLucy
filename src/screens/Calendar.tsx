// Her term on one page: a month with every exam and deadline on its day, the
// days she studied, and a place to add the next one by tapping a day.
import { useEffect, useRef, useState } from 'react'
import { dayInfo, daysInMonth, dayTitle, keyOf, monthGrid, monthNames, monthSummary, monthTitle, parseKey, shiftMonth, weekdayLetters } from '../game/calendar.ts'
import { removeExam } from '../game/external.ts'
import { setGame, useGame } from '../game/store.ts'
import { addExam, daysUntil, whenLabel } from '../game/study.ts'
import { dayKey } from '../game/time.ts'
import { BOOK_COLORS } from '../art/bookcase.ts'
import { sfx } from '../audio.ts'
import { formatMinutes } from '../hooks.ts'
import { CardHead } from '../ui/bits.tsx'
import { ClassPicker } from './ClassPicker.tsx'
import type { Exam } from '../game/state.ts'

const WEEK_START = 0 // Sunday

export function CalendarPanel({ onAddClass }: { onAddClass?: () => void }) {
  const game = useGame()
  const now = Date.now()
  const today = dayKey(now)
  const [shown, setShown] = useState(() => {
    const { year, month } = parseKey(today)
    return { year, month }
  })
  const [picked, setPicked] = useState(today)
  const [pickerOpen, setPickerOpen] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const wheelAt = useRef(0)
  /** After a key moved the selection, keep the keyboard on the new day. */
  const refocus = useRef(false)
  const weeks = monthGrid(shown.year, shown.month, WEEK_START)
  const sum = monthSummary(game, shown.year, shown.month)
  const onThisMonth = parseKey(today).year === shown.year && parseKey(today).month === shown.month
  const f = game.foxName

  const go = (by: number) => {
    setShown((m) => shiftMonth(m.year, m.month, by))
  }
  const pick = (key: string, inMonth: boolean) => {
    setPicked(key)
    if (!inMonth) {
      const { year, month } = parseKey(key)
      setShown({ year, month })
    }
  }
  const backToToday = () => {
    const { year, month } = parseKey(today)
    setShown({ year, month })
    setPicked(today)
  }
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    grid.current?.querySelector<HTMLElement>('.cal-day.on')?.focus()
  }, [picked, shown])

  // a swipe across the grid turns the page (a vertical one still scrolls)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }
  // two fingers sideways on a trackpad, too
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
    const t = performance.now()
    if (t - wheelAt.current < 500) return
    wheelAt.current = t
    go(e.deltaX > 0 ? 1 : -1)
  }
  // arrow keys walk the days, page up/down the months (with shift, the years), home is today
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    let by = 0
    if (e.key === 'ArrowLeft') by = -1
    else if (e.key === 'ArrowRight') by = 1
    else if (e.key === 'ArrowUp') by = -7
    else if (e.key === 'ArrowDown') by = 7
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      // the same day a month (or a year) along, so the keyboard stays on the page
      e.preventDefault()
      const { year, month, day } = parseKey(picked)
      const t = shiftMonth(year, month, (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1))
      refocus.current = true
      return pick(keyOf(t.year, t.month, Math.min(day, daysInMonth(t.year, t.month))), false)
    } else if (e.key === 'Home') {
      e.preventDefault()
      refocus.current = true
      return backToToday()
    } else return
    e.preventDefault()
    const { year, month, day } = parseKey(picked)
    const d = new Date(year, month, day + by)
    refocus.current = true
    pick(dayKey(d.getTime()), d.getFullYear() === shown.year && d.getMonth() === shown.month)
  }

  const summary = [
    sum.minutes ? `${formatMinutes(sum.minutes)} over ${sum.studyDays} ${sum.studyDays === 1 ? 'day' : 'days'}` : '',
    sum.exams ? `${sum.exams} ${sum.exams === 1 ? 'exam' : 'exams'}` : '',
    sum.due ? `${sum.due} ${sum.due === 1 ? 'deadline' : 'deadlines'}` : '',
  ].filter(Boolean)

  return (
    <>
      <section className="px-box card cal" onKeyDown={onKey}>
        <div className="cal-head">
          <button className="btn btn-small" onClick={() => go(-1)} aria-label="previous month">
            ‹
          </button>
          <h2 aria-live="polite">
            <button className={`cal-title ${pickerOpen ? 'open' : ''}`} aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>
              {monthTitle(shown.year, shown.month)} <span aria-hidden="true">▾</span>
            </button>
          </h2>
          <button className="btn btn-small" onClick={() => go(1)} aria-label="next month">
            ›
          </button>
        </div>
        {pickerOpen && (
          <div className="cal-picker">
            <div className="cal-head">
              <button className="btn btn-small" onClick={() => setShown((m) => ({ ...m, year: m.year - 1 }))} aria-label="previous year">
                ‹
              </button>
              <b>{shown.year}</b>
              <button className="btn btn-small" onClick={() => setShown((m) => ({ ...m, year: m.year + 1 }))} aria-label="next year">
                ›
              </button>
            </div>
            <div className="cal-months">
              {monthNames().map((name, i) => (
                <button
                  key={i}
                  className={`chip-btn ${i === shown.month ? 'on' : ''}`}
                  onClick={() => {
                    setShown((m) => ({ ...m, month: i }))
                    setPickerOpen(false)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={grid} className="cal-grid" role="grid" aria-label={monthTitle(shown.year, shown.month)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onWheel={onWheel}>
          {weekdayLetters(WEEK_START).map((w, i) => (
            <span key={i} className="cal-dow" role="columnheader">
              {w}
            </span>
          ))}
          {weeks.flat().map((d) => {
            const info = dayInfo(game, d.key)
            const exam = info.exams.some((e) => e.kind !== 'due')
            const due = info.exams.some((e) => e.kind === 'due')
            const past = d.key < today
            const marks = [
              exam ? 'an exam' : '',
              due ? 'something due' : '',
              info.minutes ? `studied ${formatMinutes(info.minutes)}` : '',
              info.birthday ? 'your birthday' : '',
            ].filter(Boolean)
            return (
              <button
                key={d.key}
                role="gridcell"
                aria-selected={picked === d.key}
                aria-label={`${dayTitle(d.key)}${marks.length ? ': ' + marks.join(', ') : ''}`}
                tabIndex={picked === d.key ? 0 : -1}
                className={`cal-day ${d.inMonth ? '' : 'out'} ${d.key === today ? 'today' : ''} ${picked === d.key ? 'on' : ''} ${past ? 'past' : ''}`}
                onClick={() => pick(d.key, d.inMonth)}
              >
                <span className="cal-num">{d.day}</span>
                <span className="cal-marks" aria-hidden="true">
                  {exam && <i className="mk mk-exam" />}
                  {due && <i className="mk mk-due" />}
                  {info.birthday && <i className="mk mk-bday" />}
                </span>
                {info.minutes > 0 && <i className="cal-study" style={{ width: `${Math.min(100, 20 + (info.minutes / 180) * 80)}%` }} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <p className="cal-foot">
          <span className="cal-legend" aria-hidden="true">
            <i className="mk mk-exam" /> exam <i className="mk mk-due" /> due <i className="cal-study legend" /> studied
          </span>
          {!onThisMonth && (
            <button className="link inline" onClick={backToToday}>
              today →
            </button>
          )}
        </p>
        {summary.length > 0 && <p className="muted center">this month: {summary.join(' · ')}</p>}
      </section>

      <DayPanel key={picked} day={picked} today={today} now={now} onAddClass={onAddClass} fox={f} />
    </>
  )
}

function DayPanel({ day, today, now, onAddClass, fox }: { day: string; today: string; now: number; onAddClass?: () => void; fox: string }) {
  const game = useGame()
  const info = dayInfo(game, day)
  const past = day < today
  const d = daysUntil(day, now)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'exam' | 'due'>('exam')
  const [courseId, setCourseId] = useState('')
  const course = game.courses.find((c) => c.id === courseId)
  const ready = !!name.trim() || (!!course && kind === 'exam')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setGame((s) => addExam(s, { name: name || `${course?.name} exam`, date: day, courseId: courseId || undefined, kind }, Date.now()))
    setName('')
    setAdding(false)
    sfx.sparkle()
  }

  const when = day === today ? 'today' : whenLabel(d)
  return (
    <section className="px-box card cal-day-panel">
      <CardHead title={dayTitle(day)} status={when} on={day === today} />
      {info.birthday && <p className="cal-line">🎂 your birthday! {fox} is baking.</p>}
      {info.exams.length > 0 && (
        <ul className="list">
          {info.exams.map((e) => (
            <ExamRow key={e.id} exam={e} />
          ))}
        </ul>
      )}
      {info.minutes > 0 ? (
        <p className="cal-line">
          <i className="cal-study legend" aria-hidden="true" /> studied {formatMinutes(info.minutes)}
          {info.sessions ? ` · ${info.sessions} ${info.sessions === 1 ? 'session' : 'sessions'}` : ''} ✓
        </p>
      ) : (
        !info.exams.length && !info.birthday && <p className="muted">{past ? 'a quiet day.' : day === today ? `nothing on today. a good day for a session with ${fox}?` : 'nothing on this day yet.'}</p>
      )}
      {!adding ? (
        <button className="link" onClick={() => setAdding(true)}>
          + add an exam or a deadline here
        </button>
      ) : (
        <form className="form cal-add" onSubmit={add}>
          <div className="chips chips-left">
            {(['exam', 'due'] as const).map((k) => (
              <button key={k} type="button" className={`chip-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {k === 'exam' ? 'exam' : 'something due'}
              </button>
            ))}
          </div>
          <label>
            what
            <input autoFocus value={name} maxLength={40} placeholder={kind === 'exam' ? 'e.g. the final' : 'e.g. memo, problem set'} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>for which class?</span>
            <ClassPicker value={courseId} onChange={setCourseId} onAddClass={onAddClass} />
          </div>
          <div className="row">
            <button className="btn btn-pink" type="submit" disabled={!ready}>
              add it
            </button>
            <button className="btn" type="button" onClick={() => setAdding(false)}>
              never mind
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function ExamRow({ exam: e }: { exam: Exam }) {
  const game = useGame()
  const course = game.courses.find((c) => c.id === e.courseId)
  const color = course ? BOOK_COLORS[course.color]?.spine : undefined
  return (
    <li className="exam px-box cal-exam">
      <span className={`cal-kind ${e.kind === 'due' ? 'due' : 'exam'}`} aria-hidden="true" style={color ? { background: color } : undefined} />
      <span className="exam-info">
        <span className="list-title">{e.name}</span>
        <span className="list-sub">
          {e.kind === 'due' ? 'due' : 'exam'}
          {course || e.subject ? ` · ${course?.name ?? e.subject}` : ''}
          {e.source && <span className="from"> · from {e.source === 'canvas' ? 'Canvas' : 'your calendar'}</span>}
        </span>
      </span>
      <button className="icon-x" aria-label={`remove ${e.name}`} onClick={() => setGame((s) => removeExam(s, e.id))}>
        ×
      </button>
    </li>
  )
}
