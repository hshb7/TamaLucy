import { useState } from 'react'
import { endBreak } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatClock, useNow } from '../hooks.ts'
import { Room, type RoomFx } from '../ui/Room.tsx'
import { ADVENTURES } from '../game/content.ts'

const TIPS = [
  'stand up and stretch like a fox after a nap',
  'drink a glass of water',
  'look out of a window for a bit, let your eyes rest',
  'roll your shoulders. both of them!',
  'take three slow, deep breaths',
  'grab a little snack',
]

export function BreakScreen({ onFocus, onHome }: { onFocus: () => void; onHome: () => void }) {
  const game = useGame()
  const now = useNow(500)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const [fx, setFx] = useState<RoomFx>({ petAt: -1e9, awakeUntil: -1e9 })
  const running = game.breakEndsAt != null
  const adv = game.adventure && ADVENTURES.find((a) => a.id === game.adventure!.id)

  return (
    <main className="screen break">
      <h1 className="title">{running ? 'break time ☕' : 'break’s over!'}</h1>
      {running ? <div className="timer timer-light">{formatClock(game.breakEndsAt! - now)}</div> : <p className="lead">ready for another round?</p>}
      <Room game={game} fx={fx} bubble={null} onFoxTap={() => setFx({ petAt: performance.now(), awakeUntil: performance.now() + 5000 })} />
      {adv ? (
        <p className="status">
          {game.foxName} is out {adv.verb} at {adv.place} · back in {formatClock(game.adventure!.returnsAt - now)}
        </p>
      ) : (
        <p className="status">break idea: {tip}</p>
      )}
      <div className="stack">
        <button
          className={`btn btn-big ${running ? '' : 'btn-pink'}`}
          onClick={() => {
            setGame((s) => endBreak(s))
            onFocus()
          }}
        >
          {running ? 'skip break & focus' : 'focus again'}
        </button>
        <button
          className="btn"
          onClick={() => {
            setGame((s) => endBreak(s))
            onHome()
          }}
        >
          back home
        </button>
      </div>
    </main>
  )
}
