import { useState } from 'react'
import { NEED_ICON_ART } from '../art/items.ts'
import { CARDS } from '../game/flashcards.ts'
import { dueCards } from '../game/study.ts'
import { useGame } from '../game/store.ts'
import { Modal } from './bits.tsx'
import { Flashcards } from './Flashcards.tsx'
import { PixelIcon } from './PixelIcon.tsx'
import { ReviewCards } from './ReviewCards.tsx'

/** "quiz me!": her own cards (if she has any) or the built-in Legal Latin deck. */
export function QuizChooser({ onClose, onMakeCards }: { onClose: () => void; onMakeCards?: () => void }) {
  const game = useGame()
  const [mode, setMode] = useState<'pick' | 'mine' | 'practice' | 'latin'>(() => (game.cards.length ? 'pick' : 'latin'))
  const due = dueCards(game, Date.now()).length

  if (mode === 'latin') return <Flashcards onClose={onClose} />
  if (mode === 'mine') return <ReviewCards onClose={onClose} />
  if (mode === 'practice') return <ReviewCards practiceAll onClose={onClose} />
  return (
    <Modal onClose={onClose}>
      <h2>what shall we study?</h2>
      <div className="options">
        <button className="option px-box" onClick={() => setMode(due ? 'mine' : 'practice')}>
          <PixelIcon sprite={NEED_ICON_ART.card} scale={3} />
          <span className="option-text">
            <b>my cards</b>
            <small>{due ? `${due} due today` : `all caught up · practise all ${game.cards.length}`}</small>
          </span>
        </button>
        <button className="option px-box" onClick={() => setMode('latin')}>
          <PixelIcon sprite={NEED_ICON_ART.gavel} scale={3} />
          <span className="option-text">
            <b>legal latin</b>
            <small>{CARDS.length} terms, multiple choice</small>
          </span>
        </button>
      </div>
      {onMakeCards && (
        <button className="link" onClick={onMakeCards}>
          add or edit my cards →
        </button>
      )}
    </Modal>
  )
}
