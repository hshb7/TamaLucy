import { useState } from 'react'
import { sfx } from '../audio.ts'
import { makeRound } from '../game/flashcards.ts'
import { finishQuiz } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal } from './bits.tsx'
import { FoxPortrait } from './FoxPortrait.tsx'

/** Legal Latin flashcards, quizzed by the fox. */
export function Flashcards({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [round, setRound] = useState(() => makeRound(8))
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const f = game.foxName
  const q = round[i]

  const choose = (c: number) => {
    if (picked != null) return
    setPicked(c)
    const right = c === q.answer
    if (right) {
      setScore((n) => n + 1)
      sfx.sparkle()
    } else sfx.tap()
  }

  const next = () => {
    if (i + 1 < round.length) {
      setI(i + 1)
      setPicked(null)
      return
    }
    setDone(true)
    setGame((s) => finishQuiz(s, score, round.length))
    sfx.fanfare()
  }

  if (done) {
    const great = score >= round.length - 1
    return (
      <Modal onClose={onClose}>
        <FoxPortrait equipped={game.equipped} cheer={great} face={great ? undefined : 'happy'} className="portrait-m" />
        <h2>
          {score}/{round.length}!
        </h2>
        <p className="center">
          {great ? `${f} is deeply impressed. objection overruled!` : score >= round.length / 2 ? `nice work, counsellor! ${f} had fun.` : `${f} thinks those were tricky ones. again?`}
        </p>
        <p className="muted center">best round: {Math.max(game.quiz.best, score)}/{round.length}</p>
        <div className="row">
          <button className="btn" onClick={onClose}>
            done
          </button>
          <button
            className="btn btn-pink"
            onClick={() => {
              setRound(makeRound(8))
              setI(0)
              setPicked(null)
              setScore(0)
              setDone(false)
            }}
          >
            another round
          </button>
        </div>
      </Modal>
    )
  }

  const right = picked != null && picked === q.answer
  return (
    <Modal onClose={onClose} className="quiz">
      <div className="quiz-top">
        <FoxPortrait equipped={game.equipped} face={picked == null ? 'open' : right ? 'happy' : 'shock'} className="portrait-s" />
        <div className="quiz-card px-box">
          <small>
            card {i + 1} of {round.length}
          </small>
          <b>{q.card.term}</b>
        </div>
      </div>
      <div className="quiz-choices">
        {q.choices.map((c, k) => (
          <button
            key={c}
            className={`quiz-choice ${picked != null && k === q.answer ? 'right' : ''} ${picked === k && k !== q.answer ? 'wrong' : ''}`}
            onClick={() => choose(k)}
            disabled={picked != null && k !== picked && k !== q.answer}
          >
            {c}
          </button>
        ))}
      </div>
      {picked != null && (
        <button className="btn btn-pink" onClick={next}>
          {right ? 'yes!! next →' : 'ah, next →'}
        </button>
      )}
    </Modal>
  )
}
