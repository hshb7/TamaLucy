import { ICON_ART, NEED_ICON_ART } from '../art/items.ts'
import { TRACKS, ladder, rankOf } from '../game/career.ts'
import { dayKey, streak } from '../game/logic.ts'
import { useGame } from '../game/store.ts'
import { formatMinutes } from '../hooks.ts'
import { PixelIcon } from '../ui/PixelIcon.tsx'

/** The fox's career, focus stats and study time per subject. */
export function CareerPanel() {
  const game = useGame()
  const now = Date.now()
  const s = game.stats
  const CAREER = ladder(game)
  const track = TRACKS[game.study.track]
  const r = rankOf(game)
  const next = CAREER[r + 1]
  const lo = CAREER[r].min
  const pct = next ? Math.round(((s.totalMinutes - lo) / (next.min - lo)) * 100) : 100
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * 86_400_000
    return { key: dayKey(t), label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), min: s.days[dayKey(t)] ?? 0 }
  })
  const max = Math.max(30, ...week.map((d) => d.min))
  const subjects = Object.entries(s.subjects).sort((a, b) => b[1] - a[1])
  const topSubject = subjects[0]?.[1] ?? 1

  return (
    <>
      <section className="px-box card">
        <p className="eyebrow">{game.foxName}&rsquo;s {game.study.track === 'law' ? 'law career' : 'career'}</p>
        <h2>
          <PixelIcon sprite={game.study.track === 'law' ? NEED_ICON_ART.gavel : NEED_ICON_ART.books} scale={2} /> {CAREER[r].title}
        </h2>
        <div className="xp">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted">
          {next ? `${formatMinutes(next.min - s.totalMinutes)} of focus until ${next.title}` : track.top}
        </p>
        <ol className="ladder">
          {CAREER.map((rank, i) => (
            <li key={rank.title} className={i < r ? 'done' : i === r ? 'now' : ''}>
              <span className="rung" aria-hidden>
                {i <= r ? '★' : '·'}
              </span>
              <span>{rank.title}</span>
              <small>{i === 0 ? 'start' : formatMinutes(rank.min)}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className="stat-grid">
        <div className="px-box stat">
          <PixelIcon sprite={ICON_ART.flame} scale={3} />
          <b>{streak(s.days, now)}</b>
          <small>day streak (best {s.bestStreak})</small>
        </div>
        <div className="px-box stat">
          <PixelIcon sprite={ICON_ART.acorn} scale={3} />
          <b>{formatMinutes(s.totalMinutes)}</b>
          <small>focused in total</small>
        </div>
        <div className="px-box stat">
          <PixelIcon sprite={ICON_ART.gift} scale={3} />
          <b>{s.sessions}</b>
          <small>sessions completed</small>
        </div>
        <div className="px-box stat">
          <PixelIcon sprite={NEED_ICON_ART.card} scale={3} />
          <b>{game.quiz.answered ? `${Math.round((game.quiz.correct / game.quiz.answered) * 100)}%` : '–'}</b>
          <small>flashcards right (best round {game.quiz.best})</small>
        </div>
      </div>

      <section className="px-box card">
        <h2>this week</h2>
        <div className="bars">
          {week.map((d) => (
            <div key={d.key} className="bar-col">
              <small>{d.min || ''}</small>
              <div className="bar" style={{ height: `${Math.max(d.min ? 8 : 2, (d.min / max) * 100)}%` }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-box card">
        <h2>by subject</h2>
        {subjects.length ? (
          <ul className="subjects">
            {subjects.map(([name, min]) => (
              <li key={name}>
                <span className="subject-name">{name}</span>
                <span className="subject-bar">
                  <span style={{ width: `${Math.max(4, (min / topSubject) * 100)}%` }} />
                </span>
                <small>{formatMinutes(min)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">pick a subject when you start focusing and it&rsquo;ll show up here.</p>
        )}
      </section>

      {s.left + s.gaveUp > 0 && (
        <p className="muted center">
          sessions cut short: {s.left} left the app · {s.gaveUp} gave up
        </p>
      )}
    </>
  )
}
