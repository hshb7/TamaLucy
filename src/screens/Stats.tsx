import { ICON_ART } from '../art/items.ts'
import { bondLevel, dayKey, minutesForLevel, streak } from '../game/logic.ts'
import { useGame } from '../game/store.ts'
import { formatMinutes } from '../hooks.ts'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { Header } from './Header.tsx'

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const game = useGame()
  const now = Date.now()
  const s = game.stats
  const level = bondLevel(s.totalMinutes)
  const lo = minutesForLevel(level)
  const hi = minutesForLevel(level + 1)
  const pct = Math.round(((s.totalMinutes - lo) / (hi - lo)) * 100)
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * 86_400_000
    return { key: dayKey(t), label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), min: s.days[dayKey(t)] ?? 0 }
  })
  const max = Math.max(30, ...week.map((d) => d.min))

  return (
    <main className="screen">
      <Header title="stats" onBack={onBack} />
      <section className="px-box card">
        <h2>
          <PixelIcon sprite={ICON_ART.heart} scale={2} /> bond level {level}
        </h2>
        <div className="xp">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted">{formatMinutes(hi - s.totalMinutes)} of focus until level {level + 1}</p>
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
          <PixelIcon sprite={ICON_ART.mail} scale={3} />
          <b>{game.notes.length}</b>
          <small>letters received</small>
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
      {s.left + s.gaveUp > 0 && (
        <p className="muted center">
          sessions cut short: {s.left} left the app · {s.gaveUp} gave up
        </p>
      )}
    </main>
  )
}
