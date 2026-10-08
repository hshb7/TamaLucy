import { useState } from 'react'
import { NEED_ICON_ART } from '../art/items.ts'
import { enabledDecks, type Deck } from '../game/decks.ts'
import { dueCards } from '../game/study.ts'
import { useGame } from '../game/store.ts'
import { Modal } from './bits.tsx'
import { Flashcards } from './Flashcards.tsx'
import { PixelIcon } from './PixelIcon.tsx'
import { ReviewCards } from './ReviewCards.tsx'

type Mode = { kind: 'pick' } | { kind: 'mine'; all: boolean } | { kind: 'deck'; deck: Deck }

/** "quiz me!": her own cards, and any built-in decks she turned on (settings → my studies). */
export function QuizChooser({ onClose, onMakeCards }: { onClose: () => void; onMakeCards?: () => void }) {
  const game = useGame()
  const decks = enabledDecks(game)
  const due = dueCards(game, Date.now()).length
  // one obvious choice: skip the menu
  const [mode, setMode] = useState<Mode>(() => (game.cards.length ? (decks.length ? { kind: 'pick' } : { kind: 'mine', all: !due }) : decks.length === 1 ? { kind: 'deck', deck: decks[0] } : { kind: 'pick' }))

  if (mode.kind === 'deck') return <Flashcards deck={mode.deck} onClose={onClose} />
  if (mode.kind === 'mine') return <ReviewCards practiceAll={mode.all} onClose={onClose} />
  return (
    <Modal onClose={onClose}>
      <h2>what shall we study?</h2>
      <div className="options">
        {game.cards.length > 0 && (
          <button className="option px-box" onClick={() => setMode({ kind: 'mine', all: !due })}>
            <PixelIcon sprite={NEED_ICON_ART.card} scale={3} />
            <span className="option-text">
              <b>my cards</b>
              <small>{due ? `${due} due today` : `all caught up · practise all ${game.cards.length}`}</small>
            </span>
          </button>
        )}
        {decks.map((d) => (
          <button key={d.id} className="option px-box" onClick={() => setMode({ kind: 'deck', deck: d })}>
            <PixelIcon sprite={NEED_ICON_ART.books} scale={3} />
            <span className="option-text">
              <b>{d.name.toLowerCase()}</b>
              <small>{d.cards.length} terms, multiple choice</small>
            </span>
          </button>
        ))}
        {!game.cards.length && !decks.length && (
          <p className="muted">no cards yet. write a few for your classes and {game.foxName} will quiz you on them (and bring each one back right before you&rsquo;d forget it).</p>
        )}
      </div>
      {onMakeCards && (
        <button className="link" onClick={onMakeCards}>
          {game.cards.length ? 'add or edit my cards →' : 'write my first cards →'}
        </button>
      )}
    </Modal>
  )
}
