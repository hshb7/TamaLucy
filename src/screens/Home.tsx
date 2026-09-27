import { useRef, useState } from 'react'
import { ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { bondLevel, dayKey, isAsleep, pet, streak } from '../game/logic.ts'
import { statusLine, tapLine } from '../game/lines.ts'
import { setGame, useGame } from '../game/store.ts'
import { useNow, formatClock, formatMinutes } from '../hooks.ts'
import { Meter } from '../ui/bits.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { Room, type RoomFx } from '../ui/Room.tsx'
import type { View } from '../App.tsx'

const DAILY_GOAL = 4

export function Home({ onFocus, go }: { onFocus: () => void; go: (v: View) => void }) {
  const game = useGame()
  const now = useNow(1000)
  const [fx, setFx] = useState<RoomFx>({ petAt: -1e9, awakeUntil: -1e9 })
  const [bubble, setBubble] = useState<string | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const say = (text: string) => {
    setBubble(text)
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200)
  }

  const onFoxTap = () => {
    const t = performance.now()
    const asleep = isAsleep(game, Date.now())
    const r = pet(game, Date.now())
    setGame(r.state)
    setFx({ petAt: t, awakeUntil: asleep ? t + 4500 : t + 6000 })
    sfx.pet()
    say(tapLine(game, Date.now()))
  }

  const unread = game.notes.filter((n) => !n.read).length
  const today = game.stats.days[dayKey(now)] ?? 0
  const todaySessions = game.stats.daySessions[dayKey(now)] ?? 0
  const st = streak(game.stats.days, now)
  const level = bondLevel(game.stats.totalMinutes)

  return (
    <main className="screen home">
      <header className="home-head">
        <div className="home-name">
          <h1>{game.foxName}</h1>
          <span className="chip">Lv {level}</span>
        </div>
        <div className="home-badges">
          <span className="chip streak" title="focus streak">
            <PixelIcon sprite={ICON_ART.flame} scale={2} /> {st}
          </span>
          <button className="icon-btn" onClick={() => go('album')} aria-label={`letters${unread ? `, ${unread} unread` : ''}`}>
            <PixelIcon sprite={ICON_ART.mail} scale={2} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        </div>
      </header>

      <div className="meters">
        <Meter value={game.happiness} icon="heart" label="happiness" tone="pink" />
        <Meter value={game.tummy} icon="onigiri" label="tummy" tone="butter" />
      </div>

      <Room game={game} fx={fx} bubble={bubble} onFoxTap={onFoxTap} />

      <p className="status">
        {statusLine(game, now)}
        {game.adventure && <> · back in {formatClock(game.adventure.returnsAt - now)}</>}
      </p>

      <button className="btn btn-big btn-pink" onClick={onFocus}>
        <PixelIcon sprite={ICON_ART.acorn} scale={3} /> focus with {game.foxName}
      </button>
      <section className="today px-box" aria-label="today's focus">
        <div className="acorns">
          {Array.from({ length: Math.max(DAILY_GOAL, todaySessions) }, (_, i) => (
            <PixelIcon key={i} sprite={ICON_ART.acorn} scale={2} className={i < todaySessions ? '' : 'silhouette'} />
          ))}
        </div>
        <p>
          {todaySessions === 0
            ? `today's acorns: focus ${DAILY_GOAL} times to fill the row!`
            : todaySessions >= DAILY_GOAL
              ? `all acorns collected today! ${formatMinutes(today)} of focus ✿`
              : `${todaySessions}/${DAILY_GOAL} today · ${formatMinutes(today)} of focus`}
        </p>
      </section>

      {unread > 0 && (
        <button className="letter-card px-box" onClick={() => go('album')}>
          <PixelIcon sprite={ICON_ART.mail} scale={3} />
          <span>
            {unread === 1 ? `a letter is waiting for you!` : `${unread} letters are waiting for you!`}
            <small>tap to open ✿</small>
          </span>
        </button>
      )}

      <nav className="nav">
        <button onClick={() => go('wardrobe')}>
          <PixelIcon sprite={ICON_ART.bow} scale={3} />
          <span>closet</span>
        </button>
        <button onClick={() => go('album')}>
          <PixelIcon sprite={ICON_ART.gift} scale={3} />
          <span>album</span>
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button onClick={() => go('stats')}>
          <PixelIcon sprite={ICON_ART.chart} scale={3} />
          <span>stats</span>
        </button>
        <button onClick={() => go('settings')}>
          <PixelIcon sprite={ICON_ART.gear} scale={3} />
          <span>settings</span>
        </button>
      </nav>
    </main>
  )
}
