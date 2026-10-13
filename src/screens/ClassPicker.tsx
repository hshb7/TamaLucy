import { BOOK_COLORS } from '../art/bookcase.ts'
import { shelfIndex } from '../game/shelf.ts'
import { useGame } from '../game/store.ts'

/** Which class a card or exam is for: her classes in bookcase order, or "general". '' = general. */
export function ClassPicker({ value, onChange, onAddClass }: { value: string; onChange: (courseId: string) => void; onAddClass?: () => void }) {
  const game = useGame()
  const classes = [...game.courses].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || shelfIndex(game, a) - shelfIndex(game, b) || a.created - b.created)
  return (
    <div className="subject-chips">
      {classes.map((c) => (
        <button key={c.id} type="button" className={`subject-chip course-chip ${value === c.id ? 'on' : ''}`} onClick={() => onChange(c.id)}>
          <span className="course-dot" style={{ background: (BOOK_COLORS[c.color] ?? BOOK_COLORS.cherry).spine }} />
          {c.name}
        </button>
      ))}
      <button type="button" className={`subject-chip ${value === '' ? 'on' : ''}`} onClick={() => onChange('')}>
        general
      </button>
      {onAddClass && (
        <button type="button" className="subject-chip add-chip" onClick={onAddClass}>
          {classes.length ? '+ class' : '+ add my classes'}
        </button>
      )}
    </div>
  )
}
