import { useState } from 'react'
import { NEED_ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { GIFT } from '../gift.ts'
import { addCard, addExam, cardSubjects, daysUntil, deleteCard, deleteExam, dueCards, updateCard, whenLabel } from '../game/study.ts'
import type { StudyCard } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { dayKey } from '../game/time.ts'
import { Modal, toast } from '../ui/bits.tsx'
import { Flashcards } from '../ui/Flashcards.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { ReviewCards } from '../ui/ReviewCards.tsx'
import { CareerPanel } from './Stats.tsx'
import { Header } from './Header.tsx'

export type StudyTab = 'cards' | 'exams' | 'career'

export function StudyScreen({ onBack, initialTab = 'cards' }: { onBack: () => void; initialTab?: StudyTab }) {
  const [tab, setTab] = useState<StudyTab>(initialTab)
  return (
    <main className="screen">
      <Header title="study" onBack={onBack} />
      <div className="tabs tabs-3" role="tablist">
        {(['cards', 'exams', 'career'] as StudyTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'cards' ? 'my cards' : t}
          </button>
        ))}
      </div>
      {tab === 'cards' && <CardsPanel />}
      {tab === 'exams' && <ExamsPanel />}
      {tab === 'career' && <CareerPanel />}
    </main>
  )
}

function SubjectPicker({ value, onChange, extra = [] }: { value: string; onChange: (s: string) => void; extra?: string[] }) {
  const all = [...new Set([...GIFT.subjects, ...extra])]
  return (
    <div className="subject-chips">
      {all.map((sub) => (
        <button key={sub} type="button" className={`subject-chip ${value === sub ? 'on' : ''}`} onClick={() => onChange(sub)}>
          {sub}
        </button>
      ))}
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

function CardsPanel() {
  const game = useGame()
  const now = Date.now()
  const [subject, setSubject] = useState(GIFT.subjects[0] ?? 'General')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [review, setReview] = useState<{ subject?: string; all?: boolean } | null>(null)
  const [latin, setLatin] = useState(false)
  const [editing, setEditing] = useState<StudyCard | null>(null)
  const due = dueCards(game, now)
  const subjects = cardSubjects(game)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setGame((s) => addCard(s, { front, back, subject }, Date.now()))
    setFront('')
    setBack('')
    sfx.sparkle()
    toast(`card added to ${subject} ✿`)
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
            : `write cards for cases, rules and elements. ${game.foxName} will quiz you and schedule them so you review each one right before you’d forget it.`}
        </p>
        <div className="row">
          {game.cards.length > 0 && (
            <button className="btn btn-pink" onClick={() => setReview(due.length ? {} : { all: true })}>
              {due.length ? `review ${due.length} due` : 'practise all'}
            </button>
          )}
          <button className="btn" onClick={() => setLatin(true)}>
            legal latin quiz
          </button>
        </div>
      </section>

      <form className="px-box card form" onSubmit={add}>
        <h2>add a card</h2>
        <SubjectPicker value={subject} onChange={setSubject} extra={subjects} />
        <label>
          front
          <input id="card-front" value={front} maxLength={120} placeholder="e.g. Palsgraf v. Long Island R.R." onChange={(e) => setFront(e.target.value)} />
        </label>
        <label>
          back
          <textarea id="card-back" value={back} maxLength={400} rows={3} placeholder="e.g. duty is owed only to foreseeable plaintiffs" onChange={(e) => setBack(e.target.value)} />
        </label>
        <button className="btn btn-pink" type="submit" disabled={!front.trim() || !back.trim()}>
          add card
        </button>
      </form>

      {subjects.map((sub) => {
        const cards = game.cards.filter((c) => c.subject === sub)
        const subDue = cards.filter((c) => c.due <= now).length
        return (
          <section key={sub} className="deck">
            <div className="deck-head">
              <h2 className="section-title">
                {sub} <small>· {cards.length}</small>
              </h2>
              {cards.length > 0 && (
                <button className="link" onClick={() => setReview(subDue ? { subject: sub } : { subject: sub, all: true })}>
                  {subDue ? `review ${subDue} due` : 'practise'}
                </button>
              )}
            </div>
            <ul className="list">
              {cards.map((c) => (
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
        )
      })}

      {review && <ReviewCards subject={review.subject} practiceAll={review.all} onClose={() => setReview(null)} />}
      {latin && <Flashcards onClose={() => setLatin(false)} />}
      {editing && <EditCard card={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditCard({ card, onClose }: { card: StudyCard; onClose: () => void }) {
  const game = useGame()
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [subject, setSubject] = useState(card.subject)
  const [sure, setSure] = useState(false)
  return (
    <Modal onClose={onClose}>
      <h2>edit card</h2>
      <div className="form">
        <SubjectPicker value={subject} onChange={setSubject} extra={cardSubjects(game)} />
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
            setGame((s) => updateCard(s, card.id, { front: front.trim(), back: back.trim(), subject }))
            onClose()
          }}
        >
          save
        </button>
      </div>
    </Modal>
  )
}

function ExamsPanel() {
  const game = useGame()
  const now = Date.now()
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => dayKey(now + 7 * 86_400_000))
  const [subject, setSubject] = useState('')
  const upcoming = game.exams.filter((e) => daysUntil(e.date, now) >= 0)
  const past = game.exams.filter((e) => daysUntil(e.date, now) < 0).reverse()
  const paused = game.settings.care === 'paused'

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    setGame((s) => addExam(s, { name: name || (subject ? `${subject} exam` : ''), date, subject }, Date.now()))
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
            ? `${game.foxName}’s needs are paused, so it won’t get hungry or lonely while you’re buried in outlines. good luck ♡`
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
          <input id="exam-name" value={name} maxLength={40} placeholder="e.g. Torts final" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          when
          <input id="exam-date" type="date" value={date} min={dayKey(now)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <SubjectPicker value={subject} onChange={(s) => setSubject(subject === s ? '' : s)} />
        <button className="btn btn-pink" type="submit" disabled={!date || (!name.trim() && !subject)}>
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
