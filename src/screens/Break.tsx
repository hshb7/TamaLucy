import { useState } from 'react'
import { NEED_ICON_ART } from '../art/items.ts'
import { endBreak } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatClock, useNow } from '../hooks.ts'
import { QuizChooser } from '../ui/QuizChooser.tsx'
import { LivingRoom } from '../ui/LivingRoom.tsx'
import { NeedsPanel } from '../ui/NeedsPanel.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'

const TIPS = [
  'stand up and stretch like a fox after a nap',
  'drink a glass of water',
  'look out of a window for a bit, let your eyes rest',
  'roll your shoulders. both of them!',
  'take three slow, deep breaths',
  'grab a little snack',
]

export function BreakScreen({ onFocus, onHome, onStudy, onShelf }: { onFocus: () => void; onHome: () => void; onStudy: () => void; onShelf: (add?: boolean) => void }) {
  const game = useGame()
  const now = useNow(500)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const [quiz, setQuiz] = useState(false)
  const running = game.breakEndsAt != null

  return (
    <main className="screen break">
      <h1 className="title">{running ? 'break time ☕' : 'break’s over!'}</h1>
      {running ? <div className="timer timer-light">{formatClock(game.breakEndsAt! - now)}</div> : <p className="lead">ready for another round?</p>}
      <NeedsPanel game={game} />
      <LivingRoom onStudy={onFocus} onQuiz={() => setQuiz(true)} onShelf={onShelf} />
      <p className="muted center">break idea: {tip} · or look after {game.foxName}!</p>
      <div className="stack">
        <button className="btn" onClick={() => setQuiz(true)}>
          <PixelIcon sprite={NEED_ICON_ART.card} scale={2} /> flashcards
        </button>
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
      {quiz && <QuizChooser onClose={() => setQuiz(false)} onMakeCards={onStudy} />}
    </main>
  )
}
