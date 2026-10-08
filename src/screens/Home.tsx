import { useState } from 'react'
import { ICON_ART, NEED_ICON_ART, SPECIAL_ART } from '../art/items.ts'
import { BOOK_COLORS } from '../art/bookcase.ts'
import type { Sprite } from '../art/sprite.ts'
import { currentRank } from '../game/career.ts'
import { dayKey, isBirthday, streak } from '../game/logic.ts'
import { activeCourses, bookProgress, courseMinutes } from '../game/shelf.ts'
import { daysUntil, dueCards, examsToday, upcomingExams, whenLabel } from '../game/study.ts'
import type { GameState } from '../game/state.ts'
import { useGame } from '../game/store.ts'
import { useNow, useWide, formatMinutes } from '../hooks.ts'
import { QuizChooser } from '../ui/QuizChooser.tsx'
import { LivingRoom } from '../ui/LivingRoom.tsx'
import { NeedsPanel } from '../ui/NeedsPanel.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { toast } from '../ui/bits.tsx'
import { hoursOf } from './Bookshelf.tsx'
import { FocusForm } from './FocusSetup.tsx'
import type { View } from '../App.tsx'

const DAILY_GOAL = 4

type Notice = { text: string; sub: string; icon: Sprite; go: View; tone?: 'pink' | 'butter' | 'lav' }

/** The single most relevant thing to tell her right now. */
function notice(game: GameState, now: number, unread: number): Notice | null {
  const f = game.foxName
  if (isBirthday(game, now)) return { text: `happy birthday, ${game.owner}!!`, sub: `${f} made you a cake (and a letter) ♡`, icon: SPECIAL_ART.cake, go: 'album', tone: 'pink' }
  const today = examsToday(game, now)[0]
  const law = game.study.track === 'law'
  const examIcon = law ? NEED_ICON_ART.gavel : NEED_ICON_ART.card
  if (today) return { text: `today: ${today.name}`, sub: `you’ve got this${law ? ', counsellor' : ''}. ${f} believes in you ♡`, icon: examIcon, go: 'exams', tone: 'butter' }
  const mail = game.notes.find((n) => n.kind === 'post' && !n.read)
  if (mail) return { text: 'you’ve got mail! ✉', sub: mail.signed ? `a letter from ${mail.signed}` : 'a letter came for you ✿', icon: ICON_ART.mail, go: 'album', tone: 'pink' }
  if (unread) return { text: unread === 1 ? 'a letter is waiting for you!' : `${unread} letters are waiting for you!`, sub: 'tap to open ✿', icon: ICON_ART.mail, go: 'album', tone: 'pink' }
  if (!game.study.asked) return { text: `tell ${f} what you’re studying`, sub: 'your classes, the shelves, the fox’s career: set it up your way', icon: NEED_ICON_ART.books, go: 'settings', tone: 'lav' }
  const soon = upcomingExams(game, now)[0]
  if (soon && daysUntil(soon.date, now) <= 7) return { text: `${soon.name} ${whenLabel(daysUntil(soon.date, now))}`, sub: `${f} is counting down with you`, icon: examIcon, go: 'exams', tone: 'lav' }
  const due = dueCards(game, now).length
  if (due) return { text: `${due} flashcard${due === 1 ? '' : 's'} due today`, sub: 'a quick review keeps them fresh', icon: NEED_ICON_ART.card, go: 'study', tone: 'lav' }
  if (game.settings.care === 'paused') return { text: 'exam week mode is on', sub: `${f}’s needs are paused. good luck ♡`, icon: NEED_ICON_ART.moon, go: 'exams', tone: 'butter' }
  return null
}

/** Mac dashboard: her classes' books at a glance. */
function ShelfCard({ game, go }: { game: GameState; go: (v: View) => void }) {
  const mine = activeCourses(game)
  const shown = mine.slice(0, 3)
  const more = mine.length - shown.length
  return (
    <section className="px-box card shelf-glance" aria-label="bookshelf">
      <span className="card-title">bookshelf</span>
      {shown.length ? (
        <ul className="mini-courses">
          {shown.map((c) => {
            const col = BOOK_COLORS[c.color] ?? BOOK_COLORS.cherry
            return (
              <li key={c.id}>
                <span className="course-dot" style={{ background: col.spine }} />
                <span className="mini-name">{c.name}</span>
                <span className="subject-bar course-bar">
                  <span style={{ width: `${Math.round(bookProgress(game, c) * 100)}%`, background: col.spine, boxShadow: `inset 0 -3px 0 0 ${col.dark}` }} />
                </span>
                <small>
                  {hoursOf(courseMinutes(game, c))}/{c.goalHours} h
                </small>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">add your classes and each one becomes a book that fills in as you study.</p>
      )}
      <button className="link" onClick={() => go('classes')}>
        {shown.length ? (more > 0 ? `all ${mine.length} classes →` : 'all classes →') : 'set up my classes →'}
      </button>
    </section>
  )
}

export function Home({ onFocus, go, onShelf }: { onFocus: () => void; go: (v: View) => void; onShelf: (add?: boolean) => void }) {
  const game = useGame()
  const now = useNow(1000)
  const wide = useWide()
  const [quiz, setQuiz] = useState(false)

  const unread = game.notes.filter((n) => !n.read).length
  const today = game.stats.days[dayKey(now)] ?? 0
  const todaySessions = game.stats.daySessions[dayKey(now)] ?? 0
  const st = streak(game.stats.days, now)
  const rank = currentRank(game)
  const note = notice(game, now, unread)

  // The phone stacks everything in its own order (the wrappers below step aside,
  // see .home-main in styles.css); the Mac lays it out as a dashboard: notice,
  // room and cards on the left, the focus form on the right, the menu in the sidebar.
  return (
    <main className="screen home">
      <header className="home-head">
        <div className="home-name">
          <h1>{game.foxName}</h1>
          <button className="chip chip-btn-plain" onClick={() => go('career')} title={rank.title}>
            <PixelIcon sprite={game.study.track === 'law' ? NEED_ICON_ART.gavel : NEED_ICON_ART.books} scale={1} /> {rank.short}
          </button>
        </div>
        <div className="home-badges">
          <button
            className="chip chip-btn-plain acorn-chip"
            aria-label={`${game.acorns} acorns`}
            onClick={() => toast(`acorns come from focusing: 1 for every 5 minutes. spend them on food, baths and playtime with ${game.foxName} ✿`, 5000)}
          >
            <PixelIcon sprite={ICON_ART.acorn} scale={2} /> {game.acorns}
          </button>
          <span className="chip streak" title="focus streak">
            <PixelIcon sprite={ICON_ART.flame} scale={2} /> {st}
          </span>
          <button className="icon-btn" onClick={() => go('album')} aria-label={`letters${unread ? `, ${unread} unread` : ''}`}>
            <PixelIcon sprite={ICON_ART.mail} scale={2} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        </div>
      </header>

      <div className="home-main">
        {note && (
          <button className={`letter-card px-box tone-${note.tone ?? 'pink'}`} onClick={() => go(note.go)}>
            <PixelIcon sprite={note.icon} scale={3} />
            <span>
              {note.text}
              <small>{note.sub}</small>
            </span>
          </button>
        )}
        <LivingRoom onStudy={onFocus} onQuiz={() => setQuiz(true)} onShelf={onShelf} />
        <div className="home-cards">
          <NeedsPanel game={game} />
          {wide && <ShelfCard game={game} go={go} />}
          <section className="today px-box" aria-label="today's focus">
            <span className="card-title">today</span>
            <div className="acorns">
              {Array.from({ length: Math.max(DAILY_GOAL, todaySessions) }, (_, i) => (
                <PixelIcon key={i} sprite={ICON_ART.heart} scale={2} className={i < todaySessions ? '' : 'silhouette'} />
              ))}
            </div>
            <p>
              {todaySessions === 0
                ? `focus to earn acorns, then spend them on ${game.foxName} ✿`
                : todaySessions >= DAILY_GOAL
                  ? `all ${DAILY_GOAL} sessions done today! ${formatMinutes(today)} of focus ✿`
                  : `${todaySessions}/${DAILY_GOAL} sessions today · ${formatMinutes(today)} of focus`}
            </p>
          </section>
        </div>
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
      </div>

      <aside className="home-side">
        {wide ? (
          <section className="px-box card focus-card" aria-label="start a focus session">
            <FocusForm compact onAddClass={() => onShelf(true)} />
          </section>
        ) : (
          <button className="btn btn-big btn-pink focus-btn" onClick={onFocus}>
            <PixelIcon sprite={ICON_ART.acorn} scale={3} /> focus with {game.foxName}
          </button>
        )}
      </aside>
      {quiz && <QuizChooser onClose={() => setQuiz(false)} onMakeCards={() => go('study')} />}
    </main>
  )
}
