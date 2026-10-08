import { useState } from 'react'
import { BOOK_COLORS, BOOKCASE, drawBook, placeBooks, seedOf } from '../art/bookcase.ts'
import type { Painter } from '../art/painter.ts'
import { drawRoom } from '../art/room.ts'
import { photoSprite } from '../art/photo.ts'
import { sfx } from '../audio.ts'
import { unlocked } from '../game/career.ts'
import {
  addCourse,
  bookProgress,
  courseMinutes,
  deleteCourse,
  draftCourse,
  finishCourse,
  isShelved,
  shelfIndex,
  shelfTags,
  shelvesOf,
  shelfBooks,
  updateCourse,
  type CourseDraft,
} from '../game/shelf.ts'
import { MAX_SHELVES, newShelf, setShelves, tagFor } from '../game/studySetup.ts'
import { cardsIn, dueCards } from '../game/study.ts'
import type { Course, GameState, Shelf } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal, toast } from '../ui/bits.tsx'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'

/** Hours, to one decimal while it's small. */
export const hoursOf = (min: number) => (min < 600 ? Math.round(min / 6) / 10 : Math.round(min / 60))

const offset = (p: Painter, dx: number, dy: number): Painter => ({
  rect: (x, y, w, h, c, a) => p.rect(x - dx, y - dy, w, h, c, a),
  sprite: (s, x, y, a) => p.sprite(s, x - dx, y - dy, a),
})

// the bit of the room around the bookcase
const VIEW = { x: BOOKCASE.x - 6, y: BOOKCASE.y - 14, w: BOOKCASE.w + 12, h: BOOKCASE.h + 16 }

/** Her classes and work: the bookcase up close, a list per shelf, and adding/editing. */
export function BookshelfPanel({ startAdding = false }: { startAdding?: boolean }) {
  const game = useGame()
  const [editing, setEditing] = useState<{ course?: Course; kind: Course['kind'] } | null>(startAdding ? { kind: 'class' } : null)
  const [shelves, setShelvesOpen] = useState(false)
  const books = placeBooks(shelfBooks(game))
  const all = shelvesOf(game)

  const draw = (p: Painter, t: number) => {
    drawRoom(offset(p, VIEW.x, VIEW.y), {
      hour: 12,
      gifts: game.gifts,
      t,
      gloom: 0,
      decor: game.decor,
      law: unlocked(game, 'law'),
      photo: game.photo ? photoSprite(game.photo) : null,
      books,
      shelfLabels: shelfTags(game),
    })
  }
  const tap = (x: number, y: number) => {
    const rx = x + VIEW.x
    const ry = y + VIEW.y
    const b = books.find((b) => rx >= b.x && rx < b.x + b.w && ry >= b.y - 1 && ry < b.y + b.h + 1)
    const course = b && game.courses.find((c) => c.id === b.id)
    if (course) setEditing({ course, kind: course.kind })
  }

  return (
    <div className="bookshelf">
      <div className="bookcase-view px-box">
        <PixelCanvas w={VIEW.w} h={VIEW.h} draw={draw} fps={8} onTap={tap} label={`your bookcase, ${game.courses.length} book${game.courses.length === 1 ? '' : 's'}`} />
        <p className="muted">
          every class is a book. it fills in as you focus on it, and when you finish the class (or reach its hours) it stays on the shelf for good, with gold
          on the spine ✿
        </p>
      </div>
      <div className="row">
        <button className="btn btn-pink" onClick={() => setEditing({ kind: 'class' })}>
          + add a class
        </button>
        <button className="btn" onClick={() => setEditing({ kind: 'work' })}>
          + add work
        </button>
      </div>
      {!all.length && (
        <section className="px-box card shelf-card">
          <h2>no shelves yet</h2>
          <p className="muted">name a shelf or two (a year, a term, “work”…) and your classes will have somewhere to stand.</p>
          <button className="btn btn-pink" onClick={() => setShelvesOpen(true)}>
            set up the shelves
          </button>
        </section>
      )}
      {all.map((shelf, i) => {
        const list = game.courses.filter((c) => shelfIndex(game, c) === i)
        return (
          <section key={shelf.id} className="px-box card shelf-card">
            <h2>
              {shelf.name} shelf <small className="shelf-tag">{shelf.tag}</small>
            </h2>
            {list.length ? (
              <ul className="course-list">
                {list.map((c) => (
                  <CourseRow key={c.id} game={game} course={c} onEdit={() => setEditing({ course: c, kind: c.kind })} />
                ))}
              </ul>
            ) : (
              <p className="muted">nothing on the {shelf.name} shelf yet.</p>
            )}
          </section>
        )
      })}
      {all.length > 0 && (
        <button className="link" onClick={() => setShelvesOpen(true)}>
          rename or rearrange the shelves →
        </button>
      )}
      {editing && <CourseEditor course={editing.course} kind={editing.kind} onClose={() => setEditing(null)} />}
      {shelves && <ShelvesEditor onClose={() => setShelvesOpen(false)} />}
    </div>
  )
}

function CourseRow({ game, course, onEdit }: { game: GameState; course: Course; onEdit: () => void }) {
  const min = courseMinutes(game, course)
  const done = isShelved(game, course)
  const color = BOOK_COLORS[course.color] ?? BOOK_COLORS.cherry
  const cards = cardsIn(game, { courseId: course.id }).length
  const due = cards ? dueCards(game, Date.now(), { courseId: course.id }).length : 0
  return (
    <li>
      <button className="course-row" onClick={onEdit} aria-label={`edit ${course.name}`}>
        <span className="course-spine" style={{ background: `linear-gradient(90deg, ${color.dark} 0 30%, ${color.spine} 30% 75%, ${color.light} 75%)` }} />
        <span className="course-name">
          {course.name}
          <small>
            {done ? (course.doneAt ? 'finished ✿ on the shelf' : 'hours reached ✿ on the shelf') : `${Math.round(bookProgress(game, course) * 100)}% filled in`}
            {course.kind === 'work' ? ' · work' : ''}
            {cards ? ` · ${cards} card${cards === 1 ? '' : 's'}${due ? `, ${due} due` : ''}` : ''}
          </small>
        </span>
        <span className="subject-bar course-bar">
          <span style={{ width: `${Math.round(bookProgress(game, course) * 100)}%`, background: color.spine, boxShadow: `inset 0 -3px 0 0 ${color.dark}` }} />
        </span>
        <small className="course-hours">
          {hoursOf(min)} / {course.goalHours} h
        </small>
      </button>
    </li>
  )
}

const GOALS = [25, 50, 100, 150]

/** Add or edit one class (or piece of work). */
export function CourseEditor({ course, kind, onClose }: { course?: Course; kind: Course['kind']; onClose: () => void }) {
  const game = useGame()
  const shelves = shelvesOf(game)
  const [d, setD] = useState<CourseDraft>(() =>
    course
      ? { name: course.name, kind: course.kind, year: course.year, color: course.color, goalHours: course.goalHours, priorHours: course.priorHours }
      : draftCourse(game, kind),
  )
  const [sure, setSure] = useState(false)
  const set = (patch: Partial<CourseDraft>) => setD((x) => ({ ...x, ...patch }))
  const work = d.kind === 'work'
  const live = course && game.courses.find((c) => c.id === course.id)
  const shelf = shelves[shelfIndex(game, d)]

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) return
    setGame((s) => (course ? updateCourse(s, course.id, d) : addCourse(s, d, Date.now())))
    sfx.sparkle()
    if (!course) toast(work ? `${d.name.trim()} has a binder on the ${shelf?.name ?? ''} shelf ✿` : `${d.name.trim()} is on the ${shelf?.name ?? ''} shelf ✿ pick it when you focus`)
    onClose()
  }

  // the book as it'll look, big
  const preview = (p: Painter, t: number) => {
    const progress = live ? bookProgress(game, live) : Math.min(1, d.priorHours / d.goalHours)
    const done = live ? isShelved(game, live) : progress >= 1
    drawBook(p, { id: 'preview', shelf: 0, color: d.color, progress, done, work, seed: seedOf(course?.id ?? 'new'), x: 1, y: 1, w: work ? 6 : 5, h: work ? 11 : 10 }, t)
  }

  return (
    <Modal onClose={onClose} className="sheet course-editor">
      <form onSubmit={save} className="course-form">
        <div className="course-head">
          <PixelCanvas w={work ? 8 : 7} h={13} draw={preview} fps={6} className="book-preview" label="the book" />
          <h2>{course ? course.name : work ? 'add work' : 'add a class'}</h2>
        </div>
        <label>
          {work ? 'what is it?' : 'class name'}
          <input value={d.name} maxLength={40} autoFocus={!course} placeholder={work ? 'e.g. my job, the journal, a clinic' : 'e.g. Evidence'} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="field">
          <span>shelf</span>
          <div className="chips chips-left">
            {shelves.map((sh) => (
              <button key={sh.id} type="button" className={`chip-btn ${d.year === sh.id ? 'on' : ''}`} onClick={() => set({ year: sh.id })}>
                {sh.name}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={work} onChange={(e) => set({ kind: e.target.checked ? 'work' : 'class', goalHours: e.target.checked && d.goalHours === 100 ? 50 : d.goalHours })} />
          <span>
            it&rsquo;s work, not a class <small className="muted">(a binder instead of a book)</small>
          </span>
        </label>
        <div className="field">
          <span>colour</span>
          <div className="color-dots">
            {Object.entries(BOOK_COLORS).map(([id, c]) => (
              <button
                key={id}
                type="button"
                className={`color-dot ${d.color === id ? 'on' : ''}`}
                style={{ background: `linear-gradient(135deg, ${c.light} 0 22%, ${c.spine} 22% 70%, ${c.dark} 70%)` }}
                onClick={() => set({ color: id })}
                aria-label={c.name}
                aria-pressed={d.color === id}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <span>its {work ? 'binder' : 'book'} is full after</span>
          <div className="chips chips-left">
            {GOALS.map((g) => (
              <button key={g} type="button" className={`chip-btn ${d.goalHours === g ? 'on' : ''}`} onClick={() => set({ goalHours: g })}>
                {g} h
              </button>
            ))}
            <input
              className="hours-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={d.goalHours}
              aria-label="hours"
              onChange={(e) => set({ goalHours: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <label>
          hours you&rsquo;d already put in before {game.foxName}
          <input type="number" inputMode="numeric" min={0} max={1000} value={d.priorHours || ''} placeholder="0" onChange={(e) => set({ priorHours: Number(e.target.value) || 0 })} />
        </label>
        {live && (
          <p className="muted">
            {hoursOf(courseMinutes(game, live))} of {live.goalHours} hours so far{live.doneAt ? `, finished ${new Date(live.doneAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}.
          </p>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="btn btn-pink" disabled={!d.name.trim()}>
            {course ? 'save' : 'add it'}
          </button>
        </div>
        {live && (
          <div className="course-more">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setGame((s) => updateCourse(finishCourse(s, live.id, !live.doneAt, Date.now()), live.id, d))
                if (!live.doneAt) sfx.sparkle()
                onClose()
              }}
            >
              {live.doneAt ? 'not finished after all' : work ? 'all wrapped up ✓' : 'i finished this class ✓'}
            </button>
            {sure ? (
              <button
                type="button"
                className="link danger"
                onClick={() => {
                  setGame((s) => deleteCourse(s, live.id))
                  toast(`${live.name} is off the shelf`)
                  onClose()
                }}
              >
                yes, take its {work ? 'binder' : 'book'} off the shelf
              </button>
            ) : (
              <button type="button" className="link" onClick={() => setSure(true)}>
                delete
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

/** Name the bookcase's shelves (a year, a term, "work"…), up to three. */
export function ShelvesEditor({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [rows, setRows] = useState<Shelf[]>(() => shelvesOf(game).map((sh) => ({ ...sh })))
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const update = (id: string, patch: Partial<Shelf>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        // the plate follows the name until she edits the plate herself
        if (patch.name !== undefined && !touched.has(id)) next.tag = tagFor(patch.name)
        return next
      }),
    )
  const ok = rows.length > 0 && rows.every((r) => r.name.trim())
  const moving = (id: string) => game.courses.filter((c) => c.year === id).length

  return (
    <Modal onClose={onClose} className="sheet">
      <h2>the shelves</h2>
      <p className="muted">one for each year, term, or whatever you like. the two letters are what&rsquo;s on the little brass plate.</p>
      <ul className="shelf-rows">
        {rows.map((r, i) => (
          <li key={r.id}>
            <span className="shelf-no">{i + 1}</span>
            <input value={r.name} maxLength={24} placeholder="e.g. year 2, spring, work" aria-label={`shelf ${i + 1} name`} onChange={(e) => update(r.id, { name: e.target.value })} />
            <input
              className="tag-input"
              value={r.tag}
              maxLength={2}
              aria-label={`shelf ${i + 1} plate`}
              onChange={(e) => {
                setTouched((t) => new Set(t).add(r.id))
                update(r.id, { tag: e.target.value.toUpperCase() })
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`remove shelf ${r.name || i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              title={moving(r.id) ? `its ${moving(r.id)} book${moving(r.id) === 1 ? '' : 's'} move to the top shelf` : undefined}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {rows.length < MAX_SHELVES && (
        <button type="button" className="link" onClick={() => setRows((rs) => [...rs, newShelf('', Date.now())])}>
          + add a shelf
        </button>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>
          cancel
        </button>
        <button
          type="button"
          className="btn btn-pink"
          disabled={!ok}
          onClick={() => {
            setGame((s) => setShelves(s, rows))
            sfx.sparkle()
            onClose()
          }}
        >
          save shelves
        </button>
      </div>
    </Modal>
  )
}
