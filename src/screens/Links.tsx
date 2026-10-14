// Settings: her connections to the outside world. Each one is optional, says
// what it needs, and works without the others.
import { useEffect, useState } from 'react'
import { addCanvasClasses, canvasCourses, canvasProblem, connectCanvas, disconnectCanvas, syncCanvas, type CanvasCourse } from '../canvas.ts'
import { spotifyUri } from '../game/music.ts'
import { setGame, useGame } from '../game/store.ts'
import { usesFahrenheit, weatherLine } from '../game/weather.ts'
import { ago, patchLinks, useLinks } from '../links.ts'
import { musicAvailable, musicStatus, playNow, playlists, spotifyOnDevice } from '../music.ts'
import { connectSpotify, disconnectSpotify, hasSpotify, openInSpotify, spotifyConnected, SpotifyError } from '../spotify.ts'
import { nativePlatform, type MusicStatus, type NotifyStatus, type Player, type Playlist } from '../native.ts'
import { askToRemind, notifyStatus, remindersAvailable, syncReminders } from '../reminders.ts'
import { CardHead, Modal, toast } from '../ui/bits.tsx'
import { findPlace, herePlace, refreshWeather, useWeather, type Place } from '../weather.ts'
import { cantReach, framed } from '../preview.ts'
import { CalendarLinker } from './CalendarLinks.tsx'


/** Her calendars: the device's own or Google, and any calendar by its address. */
export function CalendarSection() {
  const { calendar } = useLinks()
  const linked = calendar.on || calendar.feeds.some((f) => f.on)
  return (
    <section className="px-box card" id="calendar">
      <CardHead title="your calendars" status={linked ? 'on ✓' : 'off'} on={linked} />
      <p className="muted">
        your lectures and everything else show on the calendar page; anything named like an exam or a deadline lands under exams too, so you never type a date
        twice.
      </p>
      <CalendarLinker />
    </section>
  )
}

/** Her school's Canvas: due dates in, classes onto the bookcase. */
export function CanvasSection() {
  const game = useGame()
  const { canvas } = useLinks()
  const [url, setUrl] = useState(canvas.base)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const f = game.foxName
  const connected = !!canvas.base && !!canvas.token

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setProblem('')
    try {
      await fn()
    } catch (e) {
      setProblem(canvasProblem(e))
    } finally {
      setBusy(false)
    }
  }
  const connect = () =>
    run(async () => {
      const user = await connectCanvas(url, token)
      setToken('')
      toast(`connected to Canvas as ${user} ✓`)
      const n = await syncCanvas()
      if (n) toast(`${n} due date${n === 1 ? '' : 's'} from Canvas are on the exams list ✓`)
    })
  const sync = () =>
    run(async () => {
      const n = await syncCanvas()
      toast(n ? `${n} due date${n === 1 ? '' : 's'} from Canvas are on the exams list ✓` : 'nothing due on Canvas right now ✓')
    })
  const showCourses = () =>
    run(async () => {
      const list = await canvasCourses()
      setCourses(list)
      setPicked(new Set(list.filter((c) => !c.known).map((c) => c.id)))
    })
  const add = () => {
    const n = addCanvasClasses((courses ?? []).filter((c) => picked.has(c.id)))
    toast(n ? `${n} class${n === 1 ? '' : 'es'} on the bookcase ✓` : 'those are all on the bookcase already')
    setCourses(null)
  }

  return (
    <section className="px-box card" id="canvas">
      <CardHead title="Canvas" status={connected ? 'connected ✓' : 'off'} on={connected} />
      {connected ? (
        <>
          <p>
            connected as {canvas.user} ✓ <span className="muted">· last synced {ago(canvas.lastSync)}</span>
          </p>
          <p className="muted">assignments with a due date show up under exams, and go away once you hand them in. {f} checks a few times a day.</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={sync}>
              {busy ? 'syncing…' : 'sync now'}
            </button>
            <button className="btn" disabled={busy} onClick={showCourses}>
              add my classes…
            </button>
          </div>
          <button className="link" onClick={() => disconnectCanvas()}>
            disconnect Canvas
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) void connect()
          }}
        >
          <p className="muted">
            {game.mailbox
              ? `your school’s Canvas can fill in due dates, and put your classes on the bookcase, for you.`
              : `connect your mailbox first (mailbox & sync, above), then Canvas: the relay that talks to your school needs to know it’s you.`}
          </p>
          <label>
            your school’s Canvas address
            <input value={url} placeholder="https://canvas.yourschool.edu" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label>
            access token
            <input type="password" value={token} autoComplete="off" placeholder="paste it here" onChange={(e) => setToken(e.target.value)} />
          </label>
          <p className="muted">make one in Canvas: Account → Settings → “+ New Access Token”. it stays on this device and is only ever sent to your school.</p>
          <button className="btn btn-pink" type="submit" disabled={busy || !url.trim() || !token.trim() || !game.mailbox}>
            {busy ? 'connecting…' : 'connect Canvas'}
          </button>
        </form>
      )}
      {problem && <p className="error">{problem}</p>}
      {courses && (
        <Modal onClose={() => setCourses(null)} className="sheet">
          <h2>your Canvas courses</h2>
          {courses.length ? (
            <div className="cal-list">
              {courses.map((c) => (
                <label key={c.id} className="check">
                  <input
                    type="checkbox"
                    disabled={c.known}
                    checked={c.known || picked.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(picked)
                      if (e.target.checked) next.add(c.id)
                      else next.delete(c.id)
                      setPicked(next)
                    }}
                  />
                  <span>
                    {c.short}
                    {c.known && <small className="muted"> · on the bookcase ✓</small>}
                    {!c.known && c.short !== c.name && <small className="muted"> · {c.name}</small>}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="muted">no active courses found on Canvas.</p>
          )}
          <p className="muted">each one becomes a book on the first shelf; you can move or rename them under study → classes.</p>
          <div className="row">
            <button className="btn" onClick={() => setCourses(null)}>
              cancel
            </button>
            <button className="btn btn-pink" disabled={!picked.size} onClick={add}>
              add {picked.size || ''} class{picked.size === 1 ? '' : 'es'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** Where the study buddy lives, and what it needs. */
export function BuddySection({ onStudy }: { onStudy?: () => void }) {
  const game = useGame()
  const f = game.foxName
  return (
    <section className="px-box card" id="buddy">
      <CardHead title="study buddy ✨" status={game.mailbox ? 'ready ✓' : 'needs your mailbox'} on={!!game.mailbox} />
      <p className="muted">
        paste your notes and {f} turns them into flashcards. or let {f} ask you questions about a class and check your answers. it lives under study → my cards.
      </p>
      {!game.mailbox ? (
        <p className="muted">it needs your mailbox connected (above): that’s how {f} knows it’s you.</p>
      ) : (
        onStudy && (
          <button className="btn btn-small" onClick={onStudy}>
            open my cards →
          </button>
        )
      )}
    </section>
  )
}

/** The real weather at the window. */
export function WeatherSection() {
  const game = useGame()
  const w = useWeather()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const f = game.foxName
  const on = !!(game.weather.lat || game.weather.lon)
  const set = (p: Place) => {
    const place = { place: p.name, lat: p.lat, lon: p.lon }
    setGame((s) => ({ ...s, weather: place }))
    void refreshWeather(place, true)
    toast(`${f}’s window now looks out on ${p.name} ✓`)
  }
  const find = async () => {
    setBusy(true)
    setProblem('')
    try {
      const p = await findPlace(text)
      if (!p) return setProblem('hmm, couldn’t find that place. try the nearest city?')
      set(p)
      setText('')
    } catch {
      setProblem(cantReach('the weather service', 'couldn’t look that up right now. are you online?'))
    } finally {
      setBusy(false)
    }
  }
  const here = async () => {
    setBusy(true)
    setProblem('')
    const p = await herePlace()
    setBusy(false)
    if (!p) return setProblem('couldn’t get your location. type a city instead?')
    set(p)
  }
  const fresh = w && Math.abs(w.lat - game.weather.lat) < 0.01 && Math.abs(w.lon - game.weather.lon) < 0.01
  return (
    <section className="px-box card" id="weather">
      <CardHead title="weather at the window" status={on ? 'on ✓' : 'off'} on={on} />
      {on && (
        <p>
          {game.weather.place} ✓ <span className="muted">· {fresh ? weatherLine(w.kind, w.temp, usesFahrenheit(navigator.language)) : 'checking the sky…'}</span>
        </p>
      )}
      <p className="muted">
        {on
          ? `when it rains where you are, it rains on ${f}’s window. the forecast comes from open-meteo.com; only your coordinates are kept.`
          : `tell ${f} where you are and the window shows the real weather: rain, snow, fog, the odd storm.`}
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim() && !busy) void find()
        }}
      >
        <input value={text} placeholder="a city, e.g. Boston" aria-label="where are you?" onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit" disabled={busy || !text.trim()}>
          {busy ? 'looking…' : 'find'}
        </button>
      </form>
      <div className="row">
        <button className="btn btn-small" disabled={busy} onClick={here}>
          use my location
        </button>
        {on && (
          <button className="link" onClick={() => setGame((s) => ({ ...s, weather: { place: '', lat: 0, lon: 0 } }))}>
            turn it off
          </button>
        )}
      </div>
      {problem && <p className="error">{problem}</p>}
    </section>
  )
}

/** Music that starts with the timer: the device's own apps, or her Spotify account anywhere. */
export function MusicSection() {
  const game = useGame()
  const { music } = useLinks()
  const [status, setStatus] = useState<MusicStatus | null>(null)
  const [lists, setLists] = useState<Playlist[] | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [linked, setLinked] = useState(spotifyConnected())
  const f = game.foxName
  const mac = nativePlatform === 'mac'
  useEffect(() => {
    if (musicAvailable()) void musicStatus().then(setStatus)
  }, [])
  const players = status?.players ?? []
  useEffect(() => {
    // one player on this device: no need to ask which
    if (players.length === 1 && music.player === 'none') patchLinks('music', { player: players[0] })
  }, [players.length, music.player])

  if (!musicAvailable())
    return (
      <section className="px-box card" id="music">
        <CardHead title="music with the timer" status="iPhone & Mac apps" />
        <p className="muted">
          in the iPhone and Mac apps, a playlist of yours can start when a focus session starts and pause when it ends (Apple Music on the iPhone; Music or Spotify
          on the Mac). to link a Spotify account here too, set up a Spotify key (see the README).
        </p>
      </section>
    )

  const label = (p: Player) => (p === 'apple' ? (mac ? 'Music' : 'Apple Music') : 'Spotify')
  const spot = music.player === 'spotify'
  /** The Spotify app itself is on this Mac (asked directly; the account is only for listing playlists). */
  const spotifyApp = spotifyOnDevice()

  const loadLists = async () => {
    if (music.player === 'none') return
    setBusy(true)
    setProblem('')
    try {
      const l = await playlists(music.player)
      setLists(l)
      if (!l.length)
        setProblem(
          spot ? 'no playlists on your Spotify yet.' : mac ? 'no playlists found in the Music app yet.' : 'no playlists found. is TamaLucy allowed to see your music library? (Settings → TamaLucy → Media & Apple Music)',
        )
    } catch (e) {
      if (e instanceof SpotifyError && e.problem === 'not-linked') {
        setLinked(false)
        setProblem('Spotify let go of the link. connect it again?')
      } else setProblem(cantReach('Spotify', 'couldn’t reach Spotify just now. are you online?'))
    } finally {
      setBusy(false)
    }
  }
  const useLink = () => {
    const uri = spotifyUri(link)
    if (!uri) return setProblem('that doesn’t look like a Spotify link.')
    setProblem('')
    patchLinks('music', { playlist: uri, name: uri.replace('spotify:', '').replace(':', ' ') })
    setLink('')
    setLists(null)
  }
  const connect = async () => {
    if (framed) return setProblem(cantReach('Spotify’s sign-in page', ''))
    setBusy(true)
    setProblem('')
    try {
      await connectSpotify() // leaves for Spotify; App picks it up when she's back
    } catch {
      setProblem('couldn’t open Spotify’s sign-in page just now.')
      setBusy(false)
    }
  }
  const unlink = () => {
    disconnectSpotify()
    setLinked(false)
    setLists(null)
    toast('Spotify unlinked')
  }
  const test = async () => {
    const r = await playNow()
    if (r === 'playing') return toast('♪ playing')
    if (r === 'no-device' || r === 'not-premium') {
      toast(r === 'no-device' ? 'Spotify isn’t open anywhere right now. opening it for you ♪' : 'Spotify only lets Premium accounts be started from outside. opening it, press play there ♪', 5000)
      return openInSpotify(music.playlist)
    }
    if (r === 'not-linked') {
      setLinked(false)
      return toast('Spotify let go of the link. connect it again?')
    }
    toast('hmm, nothing played. is the app installed and signed in?')
  }

  return (
    <section className="px-box card" id="music">
      <CardHead title="music with the timer" status={music.player !== 'none' && music.playlist ? 'on ✓' : 'off'} on={music.player !== 'none' && !!music.playlist} />
      <p className="muted">
        {!status
          ? 'looking for your music apps…'
          : players.length
            ? `a playlist that starts when you and ${f} start, and pauses when time’s up.`
            : mac
              ? 'no Music or Spotify app found on this Mac.'
              : 'Apple Music isn’t available on this phone.'}
      </p>
      {players.length > 1 && (
        <div className="chips">
          {players.map((p) => (
            <button key={p} className={`chip-btn ${music.player === p ? 'on' : ''}`} onClick={() => patchLinks('music', { player: p, playlist: '', name: '' })}>
              {label(p)}
            </button>
          ))}
        </div>
      )}
      {music.player === 'apple' && players.includes('apple') && (
        <>
          <p>{music.name ? <>playlist: <b>{music.name}</b></> : 'pick a playlist from your library'}</p>
          <button className="btn btn-small" disabled={busy} onClick={loadLists}>
            {busy ? 'looking…' : music.name ? 'change playlist' : 'choose a playlist'}
          </button>
        </>
      )}
      {spot && players.includes('spotify') && (
        <>
          {hasSpotify() && !linked && (
            <>
              <p className="muted">
                {spotifyApp
                  ? 'link your Spotify account to pick straight from your playlists (or paste a link below).'
                  : `link your Spotify account and ${f} starts your playlist wherever Spotify is open: this ${mac ? 'Mac' : 'phone'}, your laptop, a speaker.`}
              </p>
              <button className="btn" disabled={busy} onClick={connect}>
                {busy ? 'opening Spotify…' : 'connect Spotify'}
              </button>
            </>
          )}
          {linked && (
            <p>
              linked to <b>{music.account || 'your Spotify'}</b> ✓{' '}
              <button className="link inline" onClick={unlink}>
                unlink
              </button>
            </p>
          )}
          {linked && !music.premium && !spotifyApp && (
            <p className="muted">on Spotify free, {f} can’t press play from here: the playlist opens in Spotify and you press play.</p>
          )}
          <p>{music.name ? <>playlist: <b>{music.name}</b></> : linked ? 'pick a playlist' : 'paste a Spotify link'}</p>
          {linked && (
            <button className="btn btn-small" disabled={busy} onClick={loadLists}>
              {busy ? 'looking…' : music.name ? 'change playlist' : 'choose a playlist'}
            </button>
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              useLink()
            }}
          >
            <input value={link} placeholder={linked ? 'or paste a link…' : 'https://open.spotify.com/playlist/…'} aria-label="spotify link" onChange={(e) => setLink(e.target.value)} />
            <button className="btn btn-small" type="submit" disabled={!link.trim()}>
              use it
            </button>
          </form>
          {!linked && <p className="muted">in Spotify: ··· → Share → Copy link to playlist.</p>}
        </>
      )}
      {lists && lists.length > 0 && (
        <div className="chips chips-left">
          {lists.slice(0, 60).map((pl) => (
            <button
              key={pl.id}
              className={`chip-btn ${music.playlist === pl.id ? 'on' : ''}`}
              onClick={() => {
                patchLinks('music', { playlist: pl.id, name: pl.name })
                setLists(null)
              }}
            >
              {pl.name}
              {pl.count ? <small> · {pl.count}</small> : null}
            </button>
          ))}
        </div>
      )}
      {music.player !== 'none' && music.playlist && (
        <>
          <label className="check">
            <input type="checkbox" checked={music.autoplay} onChange={(e) => patchLinks('music', { autoplay: e.target.checked })} />
            <span>start it with the timer</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={music.pauseAtEnd} onChange={(e) => patchLinks('music', { pauseAtEnd: e.target.checked })} />
            <span>pause it when time’s up</span>
          </label>
          <button className="link" onClick={test}>
            play it now →
          </button>
        </>
      )}
      {problem && <p className="error">{problem}</p>}
    </section>
  )
}

/** The fox tapping her on the shoulder while the app is closed (the iPhone and Mac apps). */
export function RemindersSection() {
  const game = useGame()
  const { reminders } = useLinks()
  const [status, setStatus] = useState<NotifyStatus | null>(null)
  const f = game.foxName
  useEffect(() => {
    if (remindersAvailable()) void notifyStatus().then(setStatus)
  }, [])
  if (!remindersAvailable()) return null

  const turnOn = async () => {
    const st = await askToRemind()
    setStatus(st)
    if (st.state === 'granted') {
      patchLinks('reminders', { on: true })
      void syncReminders(true)
      toast(`${f} will tap you on the shoulder now and then ✓`)
    }
  }
  const set = (patch: Partial<typeof reminders>) => {
    patchLinks('reminders', patch)
    void syncReminders(true)
  }
  const on = reminders.on && status?.state === 'granted'

  return (
    <section className="px-box card" id="reminders">
      <CardHead title="notifications" status={on ? 'on ✓' : 'off'} on={on} />
      {status?.state === 'denied' ? (
        <p className="muted">notifications are off for TamaLucy. turn them on in Settings → Notifications → TamaLucy and come back here.</p>
      ) : !on ? (
        <>
          <p className="muted">{f} can let you know when it misses you, when an exam is close, and when a streak is about to slip. nothing during a session, nothing spammy.</p>
          <button className="btn" onClick={turnOn}>
            turn on notifications
          </button>
        </>
      ) : (
        <>
          <label className="check">
            <input type="checkbox" checked={reminders.lonely} onChange={(e) => set({ lonely: e.target.checked })} />
            <span>
              {f} misses you <small className="muted">· after two quiet days</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={reminders.exams} onChange={(e) => set({ exams: e.target.checked })} />
            <span>
              exams and deadlines <small className="muted">· a week before and the day before an exam; the day before something is due</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={reminders.streak} onChange={(e) => set({ streak: e.target.checked })} />
            <span>
              streak at risk <small className="muted">· at 8pm, if today would break it</small>
            </span>
          </label>
          <label>
            a daily “study with me?” <span className="muted">(leave empty for none)</span>
            <input type="time" value={reminders.nudge} onChange={(e) => set({ nudge: e.target.value })} />
          </label>
          <button className="link" onClick={() => set({ on: false })}>
            turn them off
          </button>
        </>
      )}
    </section>
  )
}
