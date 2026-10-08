import { useState } from 'react'
import { NEED_ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { BOOK_COLORS } from '../art/bookcase.ts'
import { addCard, addCards, addExam, cardCourse, cardPiles, daysUntil, deleteCard, deleteExam, dueCards, parseCardList, updateCard, whenLabel, type CardGroup } from '../game/study.ts'
import type { StudyCard } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { dayKey } from '../game/time.ts'
import { Modal, toast } from '../ui/bits.tsx'
import { Flashcards } from '../ui/Flashcards.tsx'
import { enabledDecks, type Deck } from '../game/decks.ts'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { ReviewCards } from '../ui/ReviewCards.tsx'
import { CareerPanel } from './Stats.tsx'
import { BookshelfPanel } from './Bookshelf.tsx'
import { lastCourse, shelfIndex } from '../game/shelf.ts'
import { Header } from './Header.tsx'

export type StudyTab = 'cards' | 'classes' | 'exams' | 'career'

export function StudyScreen({ onBack, initialTab = 'cards', addClass = false, onAddClass }: { onBack: () => void; initialTab?: StudyTab; addClass?: boolean; onAddClass?: () => void }) {
  const [tab, setTab] = useState<StudyTab>(initialTab)
  return (
    <main className="screen">
      <Header title="study" onBack={onBack} />
      {/* on the Mac these live in the sidebar instead */}
      <div className="tabs study-tabs" role="tablist">
        {(['cards', 'classes', 'exams', 'career'] as StudyTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'cards' ? 'my cards' : t}
          </button>
        ))}
      </div>
      {tab === 'cards' && <CardsPanel onAddClass={onAddClass} />}
      {tab === 'classes' && <BookshelfPanel startAdding={addClass && initialTab === 'classes'} />}
      {tab === 'exams' && <ExamsPanel onAddClass={onAddClass} />}
      {tab === 'career' && <CareerPanel />}
    </main>
  )
}

/** Which class a card or exam is for: her classes in bookcase order, or "general". '' = general. */
function ClassPicker({ value, onChange, onAddClass }: { value: string; onChange: (courseId: string) => void; onAddClass?: () => void }) {
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

function Pips({ box }: { box: number }) {
  return (
    <span className="pips" aria-label={`learned ${box} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= box ? 'on' : ''} />
      ))}
    </span>
  )
}

function CardsPanel({ onAddClass }: { onAddClass?: () => void }) {
  const game = useGame()
  const now = Date.now()
  // new cards go to the class she studied last
  const [courseId, setCourseId] = useState(() => lastCourse(game)?.id ?? '')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [review, setReview] = useState<{ group?: CardGroup; all?: boolean } | null>(null)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [bulk, setBulk] = useState(false)
  const decks = enabledDecks(game)
  const [editing, setEditing] = useState<StudyCard | null>(null)
  const due = dueCards(game, now)
  const piles = cardPiles(game, now)
  const pickedName = game.courses.find((c) => c.id === courseId)?.name ?? 'general'

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setGame((s) => addCard(s, { front, back, courseId: courseId || undefined }, Date.now()))
    setFront('')
    setBack('')
    sfx.sparkle()
    toast(`card added to ${pickedName} ✿`)
  }

  return (
    <>
      <section className="px-box card">
        <h2>
          <PixelIcon sprite={NEED_ICON_ART.card} scale={2} /> {game.cards.length ? `${due.length} due today` : 'flashcards for your classes'}
        </h2>
        <p className="muted">
          {game.cards.length
            ? `${game.cards.length} cards. ${game.foxName} brings each one back right before you’d forget it: the ones you know come back less and less often.`
            : `write cards for terms, concepts and questions. ${game.foxName} will quiz you and schedule them so you review each one right before you’d forget it.`}
        </p>
        <div className="row">
          {game.cards.length > 0 && (
            <button className="btn btn-pink" onClick={() => setReview(due.length ? {} : { all: true })}>
              {due.length ? `review ${due.length} due` : 'practise all'}
            </button>
          )}
          {decks.map((d) => (
            <button key={d.id} className="btn" onClick={() => setDeck(d)}>
              {d.name.toLowerCase()} quiz
            </button>
          ))}
        </div>
      </section>

      <form className="px-box card form" onSubmit={add}>
        <h2>add a card</h2>
        <div className="field">
          <span>for which class?</span>
          <ClassPicker value={courseId} onChange={setCourseId} onAddClass={onAddClass} />
        </div>
        <label>
          front
          <input id="card-front" value={front} maxLength={120} placeholder="a term, a case, a question" onChange={(e) => setFront(e.target.value)} />
        </label>
        <label>
          back
          <textarea id="card-back" value={back} maxLength={400} rows={3} placeholder="the answer" onChange={(e) => setBack(e.target.value)} />
        </label>
        <button className="btn btn-pink" type="submit" disabled={!front.trim() || !back.trim()}>
          add card
        </button>
        <button type="button" className="link" onClick={() => setBulk(true)}>
          paste a whole list instead →
        </button>
      </form>

      {piles.map((pile) => (
        <section key={pile.key} className="deck">
          <div className="deck-head">
            <h2 className="section-title">
              {pile.course && <span className="course-dot" style={{ background: (BOOK_COLORS[pile.course.color] ?? BOOK_COLORS.cherry).spine }} />}
              {pile.label} <small>· {pile.cards.length}</small>
            </h2>
            <button className="link" onClick={() => setReview(pile.due ? { group: pile.group } : { group: pile.group, all: true })}>
              {pile.due ? `review ${pile.due} due` : 'practise'}
            </button>
          </div>
          <ul className="list">
            {pile.cards.map((c) => (
                <li key={c.id}>
                <button className="list-item px-box study-card" onClick={() => setEditing(c)}>
                  <span className="list-title">{c.front}</span>
                  <span className="list-sub">{c.back}</span>
                  <Pips box={c.box} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {review && <ReviewCards group={review.group} practiceAll={review.all} onClose={() => setReview(null)} />}
      {deck && <Flashcards deck={deck} onClose={() => setDeck(null)} />}
      {bulk && <BulkAdd courseId={courseId} onClose={() => setBulk(false)} onAddClass={onAddClass} />}
      {editing && <EditCard card={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditCard({ card, onClose }: { card: StudyCard; onClose: () => void }) {
  const game = useGame()
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [courseId, setCourseId] = useState(cardCourse(game, card)?.id ?? '')
  const [sure, setSure] = useState(false)
  return (
    <Modal onClose={onClose}>
      <h2>edit card</h2>
      <div className="form">
        <ClassPicker value={courseId} onChange={setCourseId} />
        <label>
          front
          <input id="edit-front" value={front} maxLength={120} onChange={(e) => setFront(e.target.value)} />
        </label>
        <label>
          back
          <textarea id="edit-back" value={back} maxLength={400} rows={3} onChange={(e) => setBack(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button
          className="btn btn-muted"
          onClick={() => {
            if (!sure) return setSure(true)
            setGame((s) => deleteCard(s, card.id))
            onClose()
          }}
        >
          {sure ? 'really delete' : 'delete'}
        </button>
        <button
          className="btn btn-pink"
          disabled={!front.trim() || !back.trim()}
          onClick={() => {
            setGame((s) => updateCard(s, card.id, { front: front.trim(), back: back.trim(), courseId }))
            onClose()
          }}
        >
          save
        </button>
      </div>
    </Modal>
  )
}

function ExamsPanel({ onAddClass }: { onAddClass?: () => void }) {
  const game = useGame()
  const now = Date.now()
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => dayKey(now + 7 * 86_400_000))
  const [courseId, setCourseId] = useState('')
  const picked = game.courses.find((c) => c.id === courseId)
  const upcoming = game.exams.filter((e) => daysUntil(e.date, now) >= 0)
  const past = game.exams.filter((e) => daysUntil(e.date, now) < 0).reverse()
  const paused = game.settings.care === 'paused'

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    setGame((s) => addExam(s, { name: name || (picked ? `${picked.name} exam` : ''), date, courseId: courseId || undefined }, Date.now()))
    setName('')
    sfx.sparkle()
  }

  const setPaused = (on: boolean) =>
    setGame((s) => ({
      ...s,
      settings: { ...s.settings, care: on ? 'paused' : s.settings.careBefore ?? 'classic', careBefore: on ? s.settings.care : s.settings.careBefore },
    }))

  return (
    <>
      <section className={`px-box card ${paused ? 'exam-mode-on' : ''}`}>
        <h2>exam week mode {paused ? 'is on' : ''}</h2>
        <p className="muted">
          {paused
            ? `${game.foxName}’s needs are paused, so it won’t get hungry or lonely while you’re buried in revision. good luck ♡`
            : `busy stretch coming up? pause ${game.foxName}’s needs so it can’t get sad while you focus on exams.`}
        </p>
        <button className={`btn ${paused ? '' : 'btn-pink'}`} onClick={() => setPaused(!paused)}>
          {paused ? 'turn off exam week mode' : 'turn on exam week mode'}
        </button>
      </section>

      <form className="px-box card form" onSubmit={add}>
        <h2>add an exam</h2>
        <label>
          what
          <input id="exam-name" value={name} maxLength={40} placeholder="e.g. the final" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          when
          <input id="exam-date" type="date" value={date} min={dayKey(now)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field">
          <span>for which class?</span>
          <ClassPicker value={courseId} onChange={setCourseId} onAddClass={onAddClass} />
        </div>
        <button className="btn btn-pink" type="submit" disabled={!date || (!name.trim() && !picked)}>
          add exam
        </button>
      </form>

      {upcoming.length > 0 && (
        <ul className="list">
          {upcoming.map((e) => {
            const d = daysUntil(e.date, now)
            return (
              <li key={e.id} className="exam px-box">
                <span className="exam-days">
                  <b>{d === 0 ? 'today' : d}</b>
                  <small>{d === 0 ? '' : d === 1 ? 'day' : 'days'}</small>
                </span>
                <span className="exam-info">
                  <span className="list-title">{e.name}</span>
                  <span className="list-sub">
                    {new Date(e.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {whenLabel(d)}
                  </span>
                </span>
                <button className="icon-x" aria-label={`remove ${e.name}`} onClick={() => setGame((s) => deleteExam(s, e.id))}>
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!upcoming.length && <p className="empty">no exams coming up. add one and {game.foxName} will count down with you, and wish you luck on the day.</p>}
      {past.length > 0 && (
        <p className="muted center">
          done: {past.map((e) => e.name).join(' · ')} ✓
        </p>
      )}
    </>
  )
}

/** Many cards at once: one per line, "front — back" (or a dash, a colon, or a tab between them). */
function BulkAdd({ courseId, onClose, onAddClass }: { courseId: string; onClose: () => void; onAddClass?: () => void }) {
  const game = useGame()
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(courseId)
  const parsed = parseCardList(text)
  const pickedName = game.courses.find((c) => c.id === picked)?.name ?? 'general'
  return (
    <Modal onClose={onClose} className="sheet">
      <h2>paste a list</h2>
      <p className="muted">one card per line, with a dash, a colon or a tab between the front and the back. from your notes, a spreadsheet, anywhere.</p>
      <ClassPicker value={picked} onChange={setPicked} onAddClass={onAddClass} />
      <textarea
        value={text}
        rows={8}
        placeholder={'mitochondria — the powerhouse of the cell\nosmosis: water moving across a membrane'}
        onChange={(e) => setText(e.target.value)}
        aria-label="cards, one per line"
      />
      <p className="muted">{parsed.length ? `${parsed.length} card${parsed.length === 1 ? '' : 's'} ready` : 'nothing to add yet'}</p>
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>
          cancel
        </button>
        <button
          type="button"
          className="btn btn-pink"
          disabled={!parsed.length}
          onClick={() => {
            setGame((s) => addCards(s, parsed, picked || undefined, Date.now()))
            sfx.sparkle()
            toast(`${parsed.length} cards added to ${pickedName} ✿`)
            onClose()
          }}
        >
          add {parsed.length || ''} cards
        </button>
      </div>
    </Modal>
  )
}
