import { useState } from 'react'
import { ICON_ART, NEED_ICON_ART, SPECIAL_ART } from '../art/items.ts'
import type { Sprite } from '../art/sprite.ts'
import { CAREER, rankOf } from '../game/career.ts'
import { dayKey, isBirthday, streak } from '../game/logic.ts'
import { daysUntil, dueCards, examsToday, upcomingExams, whenLabel } from '../game/study.ts'
import type { GameState } from '../game/state.ts'
import { useGame } from '../game/store.ts'
import { useNow, formatMinutes } from '../hooks.ts'
import { QuizChooser } from '../ui/QuizChooser.tsx'
import { LivingRoom } from '../ui/LivingRoom.tsx'
import { NeedsPanel } from '../ui/NeedsPanel.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import type { View } from '../App.tsx'

const DAILY_GOAL = 4

type Notice = { text: string; sub: string; icon: Sprite; go: View; tone?: 'pink' | 'butter' | 'lav' }

/** The single most relevant thing to tell her right now. */
function notice(game: GameState, now: number, unread: number): Notice | null {
  const f = game.foxName
  if (isBirthday(game, now)) return { text: `happy birthday, ${game.owner}!!`, sub: `${f} made you a cake (and a letter) ♡`, icon: SPECIAL_ART.cake, go: 'album', tone: 'pink' }
  const today = examsToday(game, now)[0]
  if (today) return { text: `today: ${today.name}`, sub: `you’ve got this, counsellor. ${f} believes in you ♡`, icon: NEED_ICON_ART.gavel, go: 'exams', tone: 'butter' }
  if (unread) return { text: unread === 1 ? 'a letter is waiting for you!' : `${unread} letters are waiting for you!`, sub: 'tap to open ✿', icon: ICON_ART.mail, go: 'album', tone: 'pink' }
  const soon = upcomingExams(game, now)[0]
  if (soon && daysUntil(soon.date, now) <= 7) return { text: `${soon.name} ${whenLabel(daysUntil(soon.date, now))}`, sub: `${f} is counting down with you`, icon: NEED_ICON_ART.gavel, go: 'exams', tone: 'lav' }
  const due = dueCards(game, now).length
  if (due) return { text: `${due} flashcard${due === 1 ? '' : 's'} due today`, sub: 'a quick review keeps them fresh', icon: NEED_ICON_ART.card, go: 'study', tone: 'lav' }
  if (game.settings.care === 'paused') return { text: 'exam week mode is on', sub: `${f}’s needs are paused. good luck ♡`, icon: NEED_ICON_ART.moon, go: 'exams', tone: 'butter' }
  return null
}

export function Home({ onFocus, go }: { onFocus: () => void; go: (v: View) => void }) {
  const game = useGame()
  const now = useNow(1000)
  const [quiz, setQuiz] = useState(false)

  const unread = game.notes.filter((n) => !n.read).length
  const today = game.stats.days[dayKey(now)] ?? 0
  const todaySessions = game.stats.daySessions[dayKey(now)] ?? 0
  const st = streak(game.stats.days, now)
  const rank = CAREER[rankOf(game.stats.totalMinutes)]
  const note = notice(game, now, unread)

  return (
    <main className="screen home">
      <header className="home-head">
        <div className="home-name">
          <h1>{game.foxName}</h1>
          <button className="chip chip-btn-plain" onClick={() => go('career')} title={rank.title}>
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

      {note && (
        <button className={`letter-card px-box tone-${note.tone ?? 'pink'}`} onClick={() => go(note.go)}>
          <PixelIcon sprite={note.icon} scale={3} />
          <span>
            {note.text}
            <small>{note.sub}</small>
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
        <button onClick={() => go('study')}>
          <PixelIcon sprite={NEED_ICON_ART.card} scale={3} />
          <span>study</span>
        </button>
        <button onClick={() => go('settings')}>
          <PixelIcon sprite={ICON_ART.gear} scale={3} />
          <span>settings</span>
        </button>
      </nav>
      {quiz && <QuizChooser onClose={() => setQuiz(false)} onMakeCards={() => go('study')} />}
    </main>
  )
}
