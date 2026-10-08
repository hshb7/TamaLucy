import { useState } from 'react'
import { sfx } from '../audio.ts'
import { finishReview } from '../game/logic.ts'
import { cardLabel, cardsIn, dueCards, reviewCard, type CardGroup } from '../game/study.ts'
import type { StudyCard } from '../game/state.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { Modal } from './bits.tsx'
import { FoxPortrait } from './FoxPortrait.tsx'

/**
 * Flip-card review of her own cards. Cards she knows move up a box and come
 * back later; misses come back again at the end of this round.
 */
export function ReviewCards({ group, practiceAll, onClose }: { group?: CardGroup; practiceAll?: boolean; onClose: () => void }) {
  const game = useGame()
  const [queue, setQueue] = useState<StudyCard[]>(() => {
    const s = getGame()
    const pool = practiceAll ? cardsIn(s, group) : dueCards(s, Date.now(), group)
    return pool.slice(0, 25)
  })
  const [flipped, setFlipped] = useState(false)
  const [seen, setSeen] = useState(0)
  const [knew, setKnew] = useState(0)
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(queue.length === 0)
  const f = game.foxName
  const card = queue[0]

  const answer = (got: boolean) => {
    if (!card) return
    const firstTime = !missed.has(card.id)
    // only the first answer for a card counts toward its schedule
    if (firstTime) setGame((s) => reviewCard(s, card.id, got, Date.now()))
    let rest = queue.slice(1)
    if (got) {
      sfx.sparkle()
      if (firstTime) setKnew((n) => n + 1)
    } else {
      sfx.tap()
      // see it once more before the round ends
      if (firstTime) rest = [...rest, card]
      setMissed((m) => new Set(m).add(card.id))
    }
    if (firstTime) setSeen((n) => n + 1)
    setQueue(rest)
    setFlipped(false)
    if (!rest.length) {
      setDone(true)
      setGame((s) => finishReview(s, seen + (firstTime ? 1 : 0), knew + (got && firstTime ? 1 : 0)))
      sfx.fanfare()
    }
  }

  if (done) {
    return (
      <Modal onClose={onClose}>
        <FoxPortrait equipped={game.equipped} cheer={seen > 0} className="portrait-m" />
        <h2>{seen ? `${knew}/${seen} on the first try!` : 'nothing due right now'}</h2>
        <p className="center">
          {seen
            ? `${f} will bring the tricky ones back soon, and the easy ones in a few days.`
            : `all caught up. ${f} will bring cards back right before you’d forget them.`}
        </p>
        <button className="btn btn-pink" onClick={onClose}>
          done
        </button>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} className="quiz">
      <div className="quiz-top">
        <FoxPortrait equipped={game.equipped} face={flipped ? 'happy' : 'open'} className="portrait-s" />
        <p className="muted">
          {queue.length} to go · {cardLabel(game, card)}
        </p>
      </div>
      <button className={`flip-card px-box ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(true)} aria-live="polite">
        <small>{flipped ? 'answer' : 'tap to flip'}</small>
        <span className="flip-front">{card.front}</span>
        {flipped && <span className="flip-back">{card.back}</span>}
      </button>
      {flipped ? (
        <div className="row">
          <button className="btn" onClick={() => answer(false)}>
            not yet
          </button>
          <button className="btn btn-pink" onClick={() => answer(true)}>
            got it!
          </button>
        </div>
      ) : (
        <button className="btn btn-pink" onClick={() => setFlipped(true)}>
          show answer
        </button>
      )}
    </Modal>
  )
}
