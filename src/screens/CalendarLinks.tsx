// Linking her calendars: the device's own (or Google on the web), and any
// calendar by its subscription address. Used by the calendar page's "link a
// calendar" sheet and by the settings card alike.
import { useEffect, useState, type ReactNode } from 'react'
import { BOOK_COLORS } from '../art/bookcase.ts'
import { addFeed, calendarWay, connectCalendar, disconnectCalendar, feedProblem, listCalendars, previewFeed, removeFeed, syncCalendar, updateFeed, useCalendarEvents } from '../calendar.ts'
import { useGame } from '../game/store.ts'
import { ago, patchLinks, useLinks } from '../links.ts'
import { isNativeApp, nativePlatform, type CalendarInfo } from '../native.ts'
import { cantReach } from '../preview.ts'
import { Modal, toast } from '../ui/bits.tsx'
import { CanvasLogo, DeviceCalendarLogo, GoogleLogo, ICloudLogo, LinkLogo, OutlookLogo } from '../ui/brands.tsx'

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


export type Provider = 'device' | 'google' | 'icloud' | 'outlook' | 'canvas' | 'other'

interface Guide {
  name: string
  logo: ReactNode
  /** Where the address lives, to open in her browser. */
  open?: string
  openLabel?: string
  steps: string[]
  /** What the address looks like. */
  hint: string
}

const GUIDES: Record<Exclude<Provider, 'device'>, Guide> = {
  google: {
    name: 'Google Calendar',
    logo: <GoogleLogo />,
    open: 'https://calendar.google.com/calendar/r/settings',
    openLabel: 'open Google Calendar’s settings',
    steps: ['on the left, under “Settings for my calendars”, pick the calendar', 'scroll to “Integrate calendar” and copy the “Secret address in iCal format”', 'paste it below'],
    hint: 'https://calendar.google.com/calendar/ical/…/basic.ics',
  },
  icloud: {
    name: 'iCloud',
    logo: <ICloudLogo />,
    open: 'https://www.icloud.com/calendar/',
    openLabel: 'open iCloud Calendar',
    steps: [
      'on your iPhone: Calendar → Calendars → the ⓘ next to the calendar → turn on “Public Calendar” → Share Link → Copy',
      'on icloud.com: the share icon next to the calendar → “Public Calendar” → copy the link',
      'paste it below',
    ],
    hint: 'webcal://p12-caldav.icloud.com/published/2/…',
  },
  outlook: {
    name: 'Outlook',
    logo: <OutlookLogo />,
    open: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars',
    openLabel: 'open Outlook’s shared calendars',
    steps: ['under “Publish a calendar”, pick the calendar, “Can view all details”, then Publish', 'copy the ICS link', 'paste it below'],
    hint: 'https://outlook.live.com/owa/calendar/…/calendar.ics',
  },
  canvas: {
    name: 'Canvas',
    logo: <CanvasLogo />,
    openLabel: 'open Canvas’ calendar',
    steps: ['in Canvas, open Calendar (on the left)', 'tap “Calendar Feed” at the bottom right and copy the link', 'paste it below'],
    hint: 'https://canvas.yourschool.edu/feeds/calendars/user_….ics',
  },
  other: {
    name: 'another calendar',
    logo: <LinkLogo />,
    steps: ['in the calendar app or site, look for “subscribe”, “share”, “iCal” or “.ics”', 'copy the address (it starts with webcal:// or https://)', 'paste it below'],
    hint: 'webcal:// or https://….ics',
  },
}

const deviceName = () => (nativePlatform === 'mac' ? 'this Mac’s calendar' : 'this iPhone’s calendar')

/** A link that leaves the app: a new tab on the web, her browser from the apps. */
function OpenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="btn btn-small open-link" href={href} target={isNativeApp ? undefined : '_blank'} rel="noopener noreferrer">
      {children} ↗
    </a>
  )
}

/** The buttons: one per place a calendar can live. */
export function ProviderTiles({ onPick }: { onPick: (p: Provider) => void }) {
  const way = calendarWay()
  const { calendar } = useLinks()
  const day = new Date().getDate()
  const tiles: { id: Provider; name: string; logo: ReactNode; note?: string }[] = []
  if (way === 'device') tiles.push({ id: 'device', name: deviceName(), logo: <DeviceCalendarLogo day={day} />, note: calendar.on ? 'connected ✓' : 'iCloud, Google, Outlook… whatever is on it' })
  tiles.push(
    { id: 'google', name: 'Google Calendar', logo: <GoogleLogo />, note: way === 'google' ? (calendar.on ? 'connected ✓' : 'sign in with Google') : undefined },
    { id: 'icloud', name: 'iCloud', logo: <ICloudLogo /> },
    { id: 'outlook', name: 'Outlook', logo: <OutlookLogo /> },
    { id: 'canvas', name: 'Canvas', logo: <CanvasLogo /> },
    { id: 'other', name: 'another calendar', logo: <LinkLogo /> },
  )
  return (
    <div className="providers">
      {tiles.map((t) => (
        <button key={t.id} className="provider" onClick={() => onPick(t.id)}>
          {t.logo}
          <span>
            {t.name}
            {t.note && <small>{t.note}</small>}
          </span>
        </button>
      ))}
    </div>
  )
}

/** The chosen provider: how to get its address, and the box to paste it in (or the sign-in, where there is one). */
export function ProviderGuide({ provider, onBack, onLinked }: { provider: Provider; onBack: () => void; onLinked?: () => void }) {
  const { canvas } = useLinks()
  const way = calendarWay()
  const back = (
    <button className="link inline" onClick={onBack}>
      ← other calendars
    </button>
  )
  if (provider === 'device')
    return (
      <div className="guide">
        <div className="guide-head">
          <DeviceCalendarLogo day={new Date().getDate()} />
          <h3>{deviceName()}</h3>
          {back}
        </div>
        <DeviceCalendarPanel />
      </div>
    )
  const g = GUIDES[provider]
  const open = provider === 'canvas' ? (canvas.base ? `${canvas.base}/calendar` : undefined) : g.open
  const viaDevice = provider === 'icloud' && way === 'device'
  const viaGoogle = provider === 'google' && way === 'google'
  return (
    <div className="guide">
      <div className="guide-head">
        {g.logo}
        <h3>{g.name}</h3>
        {back}
      </div>
      {viaDevice && (
        <>
          <p className="muted">your iCloud calendars are already in {deviceName()}, so that’s the one to connect:</p>
          <DeviceCalendarPanel />
          <details className="help">
            <summary>a public iCloud calendar someone shared with you?</summary>
            <AddressSteps guide={g} open={open} onLinked={onLinked} />
          </details>
        </>
      )}
      {viaGoogle && (
        <>
          <DeviceCalendarPanel />
          <details className="help">
            <summary>or by its address, without signing in</summary>
            <AddressSteps guide={g} open={open} onLinked={onLinked} />
          </details>
        </>
      )}
      {!viaDevice && !viaGoogle && <AddressSteps guide={g} open={open} onLinked={onLinked} />}
    </div>
  )
}

function AddressSteps({ guide, open, onLinked }: { guide: Guide; open?: string; onLinked?: () => void }) {
  return (
    <>
      {open && guide.openLabel && <OpenLink href={open}>{guide.openLabel}</OpenLink>}
      <ol>
        {guide.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <AddressForm hint={guide.hint} onLinked={onLinked} />
    </>
  )
}

/** Paste an address, check it, name it, pick a colour, link it. */
export function AddressForm({ hint, onLinked }: { hint: string; onLinked?: () => void }) {
  const { calendar } = useLinks()
  const [address, setAddress] = useState('')
  const [found, setFound] = useState<{ url: string; name: string; count: number } | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(FEED_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  useEffect(() => {
    // a colour no other calendar wears yet
    const used = new Set(calendar.feeds.map((f) => f.color))
    if (!found) setColor(FEED_COLORS.find((c) => !used.has(c)) ?? FEED_COLORS[calendar.feeds.length % FEED_COLORS.length])
  }, [calendar.feeds, found])

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
      onLinked?.()
    } catch (err) {
      setProblem(feedProblem(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="address">
      {!found ? (
        <form className="row feed-form" onSubmit={check}>
          <input
            value={address}
            placeholder={hint}
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
    </div>
  )
}

/** What's linked already: calendars by address (switch off, unlink) and the device's own or Google. */
export function LinkedList({ onManage }: { onManage?: (p: Provider) => void }) {
  const { calendar } = useLinks()
  const events = useCalendarEvents()
  const way = calendarWay()
  const count = (id: string) => events.filter((e) => e.calendar === id).length
  if (!calendar.on && !calendar.feeds.length) return null
  return (
    <ul className="feed-list">
      {calendar.on && way && (
        <li className="feed-row">
          <span className="cal-name linked-device">
            {way === 'device' ? <DeviceCalendarLogo day={new Date().getDate()} /> : <GoogleLogo />}
            {way === 'device' ? deviceName() : 'Google Calendar'}
            <small className="muted">
              {' '}
              · {calendar.calendars.length} {calendar.calendars.length === 1 ? 'calendar' : 'calendars'} ✓
            </small>
          </span>
          {onManage && (
            <button className="link inline" onClick={() => onManage(way)}>
              change
            </button>
          )}
        </li>
      )}
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
  )
}

/** The whole thing: what's linked, the buttons, and the guide for the one she tapped. */
export function CalendarLinker({ compact = false }: { compact?: boolean }) {
  const [provider, setProvider] = useState<Provider | null>(null)
  return (
    <div className="linker">
      <LinkedList onManage={setProvider} />
      {provider ? <ProviderGuide provider={provider} onBack={() => setProvider(null)} onLinked={() => setProvider(null)} /> : <>{!compact && <h3>link a calendar</h3>}<ProviderTiles onPick={setProvider} /></>}
    </div>
  )
}

/** The calendar page's sheet. */
export function CalendarLinksModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} className="sheet">
      <h2>link a calendar</h2>
      <p className="muted center">your lectures and everything else show on the calendar page; exams and deadlines land under exams too.</p>
      <CalendarLinker compact />
      <button className="btn" onClick={onClose}>
        done
      </button>
    </Modal>
  )
}
