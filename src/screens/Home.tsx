import { useState } from 'react'
import { ICON_ART, NEED_ICON_ART } from '../art/items.ts'
import { CAREER, rankOf } from '../game/career.ts'
import { dayKey, streak } from '../game/logic.ts'
import { useGame } from '../game/store.ts'
import { useNow, formatMinutes } from '../hooks.ts'
import { Flashcards } from '../ui/Flashcards.tsx'
import { LivingRoom } from '../ui/LivingRoom.tsx'
import { NeedsPanel } from '../ui/NeedsPanel.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import type { View } from '../App.tsx'

const DAILY_GOAL = 4

export function Home({ onFocus, go }: { onFocus: () => void; go: (v: View) => void }) {
  const game = useGame()
  const now = useNow(1000)
  const [quiz, setQuiz] = useState(false)

  const unread = game.notes.filter((n) => !n.read).length
  const today = game.stats.days[dayKey(now)] ?? 0
  const todaySessions = game.stats.daySessions[dayKey(now)] ?? 0
  const st = streak(game.stats.days, now)
  const rank = CAREER[rankOf(game.stats.totalMinutes)]

  return (
    <main className="screen home">
      <header className="home-head">
        <div className="home-name">
          <h1>{game.foxName}</h1>
          <button className="chip chip-btn-plain" onClick={() => go('stats')} title={rank.title}>
            <PixelIcon sprite={NEED_ICON_ART.gavel} scale={1} /> {rank.short}
          </button>
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

      <NeedsPanel game={game} />

      <LivingRoom onStudy={onFocus} onQuiz={() => setQuiz(true)} />

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
            ? `tap ${game.foxName} or anything in the room ✿`
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
        <button onClick={() => go('decor')}>
          <PixelIcon sprite={NEED_ICON_ART.palette} scale={3} />
          <span>decor</span>
        </button>
        <button onClick={() => go('album')}>
          <PixelIcon sprite={ICON_ART.gift} scale={3} />
          <span>album</span>
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <button onClick={() => go('stats')}>
          <PixelIcon sprite={ICON_ART.chart} scale={3} />
          <span>career</span>
        </button>
        <button onClick={() => go('settings')}>
          <PixelIcon sprite={ICON_ART.gear} scale={3} />
          <span>settings</span>
        </button>
      </nav>
      {quiz && <Flashcards onClose={() => setQuiz(false)} />}
    </main>
  )
}
