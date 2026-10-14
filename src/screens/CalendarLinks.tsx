// Linking her calendars: the device's own (or Google on the web), and any
// calendar by its subscription address. Used by the calendar page's "link a
// calendar" sheet and by the settings card alike.
import { useEffect, useState } from 'react'
import { BOOK_COLORS } from '../art/bookcase.ts'
import { addFeed, calendarWay, connectCalendar, disconnectCalendar, feedProblem, listCalendars, previewFeed, removeFeed, syncCalendar, updateFeed, useCalendarEvents } from '../calendar.ts'
import { useGame } from '../game/store.ts'
import { ago, patchLinks, useLinks } from '../links.ts'
import { nativePlatform, type CalendarInfo } from '../native.ts'
import { cantReach } from '../preview.ts'
import { Modal, toast } from '../ui/bits.tsx'

const SCHOOLISH = /school|class|law|uni|college|course|study|exam|lecture|semester|term/i

/** Colours a linked calendar can wear (the bookcase's spines). */
export const FEED_COLORS = ['navy', 'forest', 'honey', 'plum', 'rose', 'sky', 'cocoa', 'mint', 'peach', 'cherry'].map((k) => BOOK_COLORS[k].spine)

/** The device's own calendar (the apps) or Google Calendar (the web): connect, pick calendars, write sessions back. */
export function DeviceCalendarPanel() {
  const game = useGame()
  const { calendar } = useLinks()
  const way = calendarWay()
  const [cals, setCals] = useState<CalendarInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const f = game.foxName
  useEffect(() => {
    if (calendar.on) void listCalendars().then(setCals)
  }, [calendar.on])

  if (!way)
    return (
      <p className="muted">
        the iPhone and Mac apps can read the device’s own calendar, and the web app Google Calendar once a key is set up (see the README). any calendar can be
        linked by its address below.
      </p>
    )

  const connect = async () => {
    setBusy(true)
    setProblem('')
    try {
      const a = await connectCalendar()
      if (!a.authorized) {
        setProblem(way === 'device' ? `${f} wasn’t allowed to see your calendar. you can allow it in Settings → Privacy → Calendars.` : 'google didn’t let us in. try again?')
        return
      }
      setCals(a.calendars)
      const picked = a.calendars.filter((c) => SCHOOLISH.test(c.title)).map((c) => c.id)
      patchLinks('calendar', { on: true, calendars: picked, logCalendar: a.calendars.find((c) => c.writable)?.id ?? '' })
      if (picked.length) {
        const n = await syncCalendar()
        toast(n ? `${n} from your calendar are on the exams list ✓` : 'connected! pick the calendars with your classes in them ✓')
      }
    } catch {
      setProblem(cantReach('your calendar', 'couldn’t reach your calendar just now.'))
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    setProblem('')
    try {
      const n = await syncCalendar()
      toast(n ? `${n} from your calendar are on the exams list ✓` : 'nothing that looks like an exam or a deadline in those calendars yet')
    } catch {
      setProblem('couldn’t read your calendar just now. are you online?')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string, on: boolean) =>
    patchLinks('calendar', { calendars: on ? [...new Set([...calendar.calendars, id])] : calendar.calendars.filter((x) => x !== id) })

  return (
    <div className="cal-device">
      <h3>{way === 'device' ? (nativePlatform === 'mac' ? 'this Mac’s calendar' : 'this iPhone’s calendar') : 'Google Calendar'}</h3>
      {!calendar.on ? (
        <>
          <p className="muted">
            anything in your calendar named like an exam or a deadline (“exam”, “final”, “quiz”, “due”, “memo”…) shows up under exams, so you never type a date
            twice.{way === 'device' ? ' nothing leaves this device.' : ' sign in with Google once per session.'}
          </p>
          <button className="btn" disabled={busy} onClick={connect}>
            {busy ? 'connecting…' : 'connect my calendar'}
          </button>
        </>
      ) : (
        <>
          <p>
            connected ✓ <span className="muted">· last synced {ago(calendar.lastSync)}</span>
          </p>
          <div className="field">
            <span>read exams and deadlines from</span>
            {cals === null ? (
              <p className="muted">looking for your calendars…</p>
            ) : cals.length ? (
              <div className="cal-list">
                {cals.map((c) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" checked={calendar.calendars.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                    <span className="cal-name">
                      {c.color && <span className="cal-dot" style={{ background: c.color }} />}
                      {c.title}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted">no calendars found right now.</p>
            )}
          </div>
          <label className="check">
            <input type="checkbox" checked={calendar.logSessions} onChange={(e) => patchLinks('calendar', { logSessions: e.target.checked })} />
            <span>
              write my finished sessions to my calendar <small className="muted">“studied Contracts”, with the minutes</small>
            </span>
          </label>
          {calendar.logSessions && cals && cals.some((c) => c.writable) && (
            <label>
              into
              <select value={calendar.logCalendar} onChange={(e) => patchLinks('calendar', { logCalendar: e.target.value })} aria-label="calendar for sessions">
                {cals
                  .filter((c) => c.writable)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="row">
            <button className="btn" disabled={busy || !calendar.calendars.length} onClick={sync}>
              {busy ? 'syncing…' : 'sync now'}
            </button>
          </div>
          <button className="link" onClick={() => disconnectCalendar()}>
            disconnect {way === 'device' ? 'this calendar' : 'Google Calendar'}
          </button>
        </>
      )}
      {problem && <p className="error">{problem}</p>}
    </div>
  )
}

/** Calendars linked by their subscription address, through the relay. */
export function FeedsPanel() {
  const { calendar } = useLinks()
  const events = useCalendarEvents()
  const [address, setAddress] = useState('')
  const [found, setFound] = useState<{ url: string; name: string; count: number } | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(FEED_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const used = new Set(calendar.feeds.map((f) => f.color))
  useEffect(() => {
    // a colour no other calendar wears yet
    if (!found) setColor(FEED_COLORS.find((c) => !used.has(c)) ?? FEED_COLORS[calendar.feeds.length % FEED_COLORS.length])
  }, [calendar.feeds.length, found]) // eslint-disable-line react-hooks/exhaustive-deps

  const check = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const f = await previewFeed(address)
      setFound(f)
      setName(f.name)
    } catch (err) {
      setProblem(feedProblem(err))
    } finally {
      setBusy(false)
    }
  }
  const link = async () => {
    if (!found) return
    setBusy(true)
    setProblem('')
    try {
      const f = await addFeed({ url: found.url, name, color })
      toast(`${f.name} is linked ✓`)
      setFound(null)
      setAddress('')
      setName('')
    } catch (err) {
      setProblem(feedProblem(err))
    } finally {
      setBusy(false)
    }
  }
  const count = (id: string) => events.filter((e) => e.calendar === id).length

  return (
    <div className="feeds">
      <h3>calendars by address</h3>
      {calendar.feeds.length > 0 && (
        <ul className="feed-list">
          {calendar.feeds.map((f) => (
            <li key={f.id} className="feed-row">
              <label className="check feed-name">
                <input type="checkbox" checked={f.on} onChange={(e) => updateFeed(f.id, { on: e.target.checked })} aria-label={`read ${f.name}`} />
                <span className="cal-name">
                  <span className="cal-dot" style={{ background: f.color }} />
                  {f.name}
                  <small className="muted">
                    {' '}
                    · {count(f.id)} {count(f.id) === 1 ? 'event' : 'events'}
                  </small>
                </span>
              </label>
              <button
                className="icon-x"
                aria-label={`unlink ${f.name}`}
                onClick={() => {
                  removeFeed(f.id)
                  toast(`${f.name} unlinked`)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {!found ? (
        <form className="row feed-form" onSubmit={check}>
          <input
            value={address}
            placeholder="paste a calendar’s address (webcal:// or https://…)"
            aria-label="calendar address"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button className="btn btn-small" type="submit" disabled={busy || !address.trim()}>
            {busy ? 'looking…' : 'check it'}
          </button>
        </form>
      ) : (
        <div className="form feed-found">
          <p>
            found a calendar with <b>{found.count}</b> {found.count === 1 ? 'event' : 'events'} around now ✓
          </p>
          <label>
            call it
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="calendar name" />
          </label>
          <div className="field">
            <span>its colour</span>
            <div className="chips chips-left swatches" role="radiogroup" aria-label="calendar colour">
              {FEED_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-pink" disabled={busy || !name.trim()} onClick={link}>
              {busy ? 'linking…' : 'link it'}
            </button>
            <button className="btn" type="button" onClick={() => setFound(null)}>
              never mind
            </button>
          </div>
        </div>
      )}
      {problem && <p className="error">{problem}</p>}
      <details className="help">
        <summary>where do I find a calendar’s address?</summary>
        <ul>
          <li>
            <b>iCloud</b>: in Calendar, the ⓘ next to the calendar → <i>Public Calendar</i> → copy the webcal link.
          </li>
          <li>
            <b>Google</b>: calendar.google.com → settings → the calendar → <i>Secret address in iCal format</i>.
          </li>
          <li>
            <b>Outlook</b>: settings → Calendar → <i>Shared calendars</i> → publish a calendar → the ICS link.
          </li>
          <li>
            <b>Canvas</b>: Calendar → <i>Calendar Feed</i> (bottom right) → copy.
          </li>
          <li>
            <b>your school’s site</b>: look for “subscribe”, “iCal” or a link ending in .ics.
          </li>
        </ul>
        <p className="muted">the address is private to you: it stays on this device, and only the relay that fetches it for the app ever sees it.</p>
      </details>
    </div>
  )
}

/** The calendar page's sheet: everything that can be linked, in one place. */
export function CalendarLinksModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} className="sheet">
      <h2>link a calendar</h2>
      <p className="muted center">your lectures and everything else show on the calendar page; exams and deadlines land under exams too.</p>
      <DeviceCalendarPanel />
      <FeedsPanel />
      <button className="btn" onClick={onClose}>
        done
      </button>
    </Modal>
  )
}
