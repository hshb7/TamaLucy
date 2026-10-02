import { useState } from 'react'
import { BOOK_COLORS, BOOKCASE, drawBook, placeBooks, seedOf } from '../art/bookcase.ts'
import type { Painter } from '../art/painter.ts'
import { drawRoom } from '../art/room.ts'
import { photoSprite } from '../art/photo.ts'
import { sfx } from '../audio.ts'
import { unlocked } from '../game/career.ts'
import {
  SHELF_LABELS,
  SHELVES,
  WORK_SHELF,
  addCourse,
  bookProgress,
  courseMinutes,
  deleteCourse,
  draftCourse,
  finishCourse,
  isShelved,
  shelfBooks,
  updateCourse,
  type CourseDraft,
} from '../game/shelf.ts'
import type { Course, GameState } from '../game/state.ts'
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

const inShelf = (c: Course, label: string) =>
  label === WORK_SHELF ? c.kind === 'work' : c.kind === 'class' && (c.year === label || (label === SHELVES[0] && !(SHELVES as readonly string[]).includes(c.year)))

/** Her classes and work: the bookcase up close, a list per shelf, and adding/editing. */
export function BookshelfPanel({ startAdding = false }: { startAdding?: boolean }) {
  const game = useGame()
  const [editing, setEditing] = useState<{ course?: Course; kind: Course['kind'] } | null>(startAdding ? { kind: 'class' } : null)
  const books = placeBooks(shelfBooks(game))

  const draw = (p: Painter, t: number) => {
    drawRoom(offset(p, VIEW.x, VIEW.y), {
      hour: 12,
      gifts: game.gifts,
      t,
      gloom: 0,
      decor: game.decor,
      law: unlocked(game.stats.totalMinutes, 'law'),
      photo: game.photo ? photoSprite(game.photo) : null,
      books,
      shelfLabels: SHELF_LABELS,
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
      {SHELF_LABELS.map((label) => {
        const list = game.courses.filter((c) => inShelf(c, label))
        return (
          <section key={label} className="px-box card shelf-card">
            <h2>{label === WORK_SHELF ? 'work' : `${label} shelf`}</h2>
            {list.length ? (
              <ul className="course-list">
                {list.map((c) => (
                  <CourseRow key={c.id} game={game} course={c} onEdit={() => setEditing({ course: c, kind: c.kind })} />
                ))}
              </ul>
            ) : (
              <p className="muted">
                {label === WORK_SHELF
                  ? 'a job, the journal, a clinic, moot court... anything you focus on outside class gets a binder here.'
                  : `nothing on the ${label} shelf yet.`}
              </p>
            )}
          </section>
        )
      })}
      {editing && <CourseEditor course={editing.course} kind={editing.kind} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CourseRow({ game, course, onEdit }: { game: GameState; course: Course; onEdit: () => void }) {
  const min = courseMinutes(game, course)
  const done = isShelved(game, course)
  const color = BOOK_COLORS[course.color] ?? BOOK_COLORS.cherry
  return (
    <li>
      <button className="course-row" onClick={onEdit} aria-label={`edit ${course.name}`}>
        <span className="course-spine" style={{ background: `linear-gradient(90deg, ${color.dark} 0 30%, ${color.spine} 30% 75%, ${color.light} 75%)` }} />
        <span className="course-name">
          {course.name}
          <small>{done ? (course.doneAt ? 'finished ✿ on the shelf' : 'hours reached ✿ on the shelf') : `${Math.round(bookProgress(game, course) * 100)}% filled in`}</small>
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
  const [d, setD] = useState<CourseDraft>(() =>
    course
      ? { name: course.name, kind: course.kind, year: course.year, color: course.color, goalHours: course.goalHours, priorHours: course.priorHours }
      : draftCourse(game, kind),
  )
  const [sure, setSure] = useState(false)
  const set = (patch: Partial<CourseDraft>) => setD((x) => ({ ...x, ...patch }))
  const work = d.kind === 'work'
  const live = course && game.courses.find((c) => c.id === course.id)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) return
    setGame((s) => (course ? updateCourse(s, course.id, d) : addCourse(s, d, Date.now())))
    sfx.sparkle()
    if (!course) toast(work ? `${d.name.trim()} has a binder on the work shelf ✿` : `${d.name.trim()} is on the ${d.year} shelf ✿ pick it when you focus`)
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
          <input value={d.name} maxLength={40} autoFocus={!course} placeholder={work ? 'e.g. Law Review, clinic, firm job' : 'e.g. Evidence'} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="field">
          <span>shelf</span>
          <div className="chips chips-left">
            {SHELVES.map((y) => (
              <button key={y} type="button" className={`chip-btn ${!work && d.year === y ? 'on' : ''}`} onClick={() => set({ kind: 'class', year: y })}>
                {y}
              </button>
            ))}
            <button type="button" className={`chip-btn ${work ? 'on' : ''}`} onClick={() => set({ kind: 'work', year: WORK_SHELF })}>
              work
            </button>
          </div>
        </div>
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
