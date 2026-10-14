// The study buddy: flashcards from her notes, and the fox asking questions.
import { useRef, useState } from 'react'
import { sfx } from '../audio.ts'
import { askQuestion, buddyProblem, checkAnswer, makeCards, MAX_NOTES, type Attachment, type DraftCard, type Question, type Verdict } from '../buddy.ts'
import { MAX_FILES, appendNotes, importNotesFile, importProblem } from '../notesImport.ts'
import { finishQuiz } from '../game/logic.ts'
import { lastCourse } from '../game/shelf.ts'
import { setGame, useGame } from '../game/store.ts'
import { addCards, cardsIn } from '../game/study.ts'
import { Modal, toast } from '../ui/bits.tsx'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { NEED_ICON_ART } from '../art/items.ts'
import { ClassPicker } from './ClassPicker.tsx'

const COUNTS = [10, 15, 20, 30]

/** Paste notes, get cards, keep the good ones. */
export function MakeCards({ courseId, onClose, onAddClass }: { courseId: string; onClose: () => void; onAddClass?: () => void }) {
  const game = useGame()
  const [picked, setPicked] = useState(courseId)
  const [notes, setNotes] = useState('')
  const [count, setCount] = useState(15)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [drafts, setDrafts] = useState<DraftCard[] | null>(null)
  const [keep, setKeep] = useState<boolean[]>([])
  const [files, setFiles] = useState<(Attachment & { pages?: number })[]>([])
  const [importing, setImporting] = useState(false)
  const [over, setOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const f = game.foxName
  const course = game.courses.find((c) => c.id === picked)
  const subject = course?.name ?? (game.study.program || 'general')

  /** Files she picked or dropped: text goes into the box, pages get attached. */
  const addFiles = async (list: FileList | File[] | null) => {
    if (!list?.length) return
    setImporting(true)
    setProblem('')
    const problems: string[] = []
    let text = notes
    let attached = [...files]
    for (const file of Array.from(list)) {
      try {
        const got = await importNotesFile(file)
        if (got.kind === 'text') {
          const r = appendNotes(text, got.text)
          text = r.text
          if (r.cut) problems.push(`${file.name}: took the first ${MAX_NOTES.toLocaleString()} characters, the rest is for another batch.`)
        } else if (attached.length >= MAX_FILES) problems.push(`${file.name}: that’s enough pages for one batch (${MAX_FILES} files).`)
        else attached = [...attached, { ...got.attachment, name: file.name, pages: got.pages }]
      } catch (e) {
        problems.push(importProblem(e, file.name))
      }
    }
    setNotes(text)
    setFiles(attached)
    setProblem(problems.join(' '))
    setImporting(false)
    if (fileInput.current) fileInput.current.value = ''
  }
  const ready = notes.trim().length >= 20 || files.length > 0

  const make = async () => {
    setBusy(true)
    setProblem('')
    try {
      const cards = await makeCards({ notes, subject, count, files })
      if (!cards.length) return setProblem(`${f} couldn’t find anything to make cards from. more notes?`)
      setDrafts(cards)
      setKeep(cards.map(() => true))
    } catch (e) {
      setProblem(buddyProblem(e, f))
    } finally {
      setBusy(false)
    }
  }
  const add = () => {
    const list = (drafts ?? []).filter((_, i) => keep[i])
    setGame((s) => addCards(s, list, picked || undefined, Date.now()))
    sfx.sparkle()
    toast(`${list.length} card${list.length === 1 ? '' : 's'} added to ${course?.name ?? 'general'} ✓`)
    onClose()
  }
  const kept = keep.filter(Boolean).length

  return (
    <Modal onClose={onClose} className="sheet">
      <h2>cards from my notes ✨</h2>
      {!drafts ? (
        <>
          <p className="muted">paste an outline, a case brief, a chapter summary, or bring in a file. {f} picks out the terms, rules and questions worth remembering.</p>
          <ClassPicker value={picked} onChange={setPicked} onAddClass={onAddClass} />
          <textarea
            value={notes}
            rows={7}
            maxLength={MAX_NOTES}
            placeholder="paste or type your notes here"
            aria-label="your notes"
            onChange={(e) => setNotes(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void addFiles(e.dataTransfer.files)
            }}
          />
          <button
            type="button"
            className={`dropzone ${over ? 'over' : ''}`}
            disabled={importing}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              void addFiles(e.dataTransfer.files)
            }}
          >
            <PixelIcon sprite={NEED_ICON_ART.books} scale={2} />
            <span className="dz-text">
              <b>{importing ? 'reading…' : over ? 'drop it here' : 'import a file'}</b>
              <small>txt, docx, pdf, or photos of your notes</small>
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            aria-label="import notes"
            accept=".txt,.md,.markdown,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            onChange={(e) => void addFiles(e.target.files)}
          />
          {files.length > 0 && (
            <ul className="attachments">
              {files.map((a, i) => (
                <li key={i}>
                  <span className="kind">{a.kind === 'pdf' ? 'pdf' : 'photo'}</span>
                  <span className="name">
                    {a.name ?? a.kind}
                    {a.pages ? <small className="muted"> · {a.pages} page{a.pages === 1 ? '' : 's'}</small> : null}
                  </span>
                  <button type="button" className="icon-x" aria-label={`remove ${a.name ?? a.kind}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="field field-inline">
            <span>how many?</span>
            <div className="chips chips-left">
              {COUNTS.map((n) => (
                <button key={n} type="button" className={`chip-btn ${count === n ? 'on' : ''}`} onClick={() => setCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="muted">
            {notes.length ? `${notes.length.toLocaleString()} characters` : 'nothing yet'}
            {files.length ? ` + ${files.length} file${files.length === 1 ? '' : 's'}` : ''} · {f} reads only what you send, and keeps none of it.
          </p>
          {problem && <p className="error">{problem}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>
              cancel
            </button>
            <button type="button" className="btn btn-pink" disabled={busy || importing || !ready} onClick={make}>
              {busy ? `${f} is reading…` : 'make cards'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {drafts.length} card{drafts.length === 1 ? '' : 's'} for {course?.name ?? 'general'}. untick any you don’t want.
          </p>
          <ul className="drafts">
            {drafts.map((c, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" checked={keep[i]} onChange={(e) => setKeep(keep.map((k, j) => (j === i ? e.target.checked : k)))} />
                  <span>
                    <b>{c.front}</b>
                    <span className="back">{c.back}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn" onClick={() => setDrafts(null)}>
              back
            </button>
            <button type="button" className="btn btn-pink" disabled={!kept} onClick={add}>
              add {kept || ''} card{kept === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

const shuffle = <T,>(a: T[]) => {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The fox asks a question about a class; she answers; the fox checks. */
export function AskMe({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [courseId, setCourseId] = useState(() => lastCourse(game)?.id ?? '')
  const [q, setQ] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [hint, setHint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const recent = useRef<string[]>([])
  const score = useRef({ asked: 0, right: 0 })
  const f = game.foxName
  const course = game.courses.find((c) => c.id === courseId)
  const subject = course?.name ?? (game.study.program || 'general')

  const ask = async () => {
    setBusy(true)
    setProblem('')
    setVerdict(null)
    setAnswer('')
    setHint(false)
    try {
      const cards = shuffle(cardsIn(game, courseId ? { courseId } : undefined)).slice(0, 40).map((c) => ({ front: c.front, back: c.back }))
      const next = await askQuestion({ subject, cards, recent: recent.current })
      recent.current = [...recent.current, next.question].slice(-6)
      setQ(next)
    } catch (e) {
      setProblem(buddyProblem(e, f))
    } finally {
      setBusy(false)
    }
  }
  const check = async () => {
    if (!q) return
    setBusy(true)
    setProblem('')
    try {
      const v = await checkAnswer({ subject, question: q.question, answer })
      setVerdict(v)
      score.current.asked++
      if (v.verdict === 'yes') {
        score.current.right++
        sfx.sparkle()
      } else sfx.tap()
    } catch (e) {
      setProblem(buddyProblem(e, f))
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    const { asked, right } = score.current
    if (asked) setGame((s) => finishQuiz(s, right, asked))
    onClose()
  }

  return (
    <Modal onClose={close} className="sheet buddy">
      <h2>{f} asks ✨</h2>
      {!q ? (
        <>
          <p className="muted">pick a class and {f} will ask you something about it, then check what you say. your own cards help it aim.</p>
          <ClassPicker value={courseId} onChange={setCourseId} />
          {problem && <p className="error">{problem}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={close}>
              not now
            </button>
            <button type="button" className="btn btn-pink" disabled={busy} onClick={ask}>
              {busy ? `${f} is thinking…` : 'ask me something'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="question">
            <FoxPortrait equipped={game.equipped} face="open" className="portrait-s" />
            <p>{q.question}</p>
          </div>
          {!verdict && (
            <>
              {hint ? (
                <p className="muted">hint: {q.hint}</p>
              ) : (
                <button type="button" className="link" onClick={() => setHint(true)}>
                  a hint?
                </button>
              )}
              <textarea value={answer} rows={4} maxLength={1500} placeholder="your answer, in your own words" aria-label="your answer" onChange={(e) => setAnswer(e.target.value)} />
              {problem && <p className="error">{problem}</p>}
              <div className="row">
                <button type="button" className="btn" disabled={busy} onClick={ask}>
                  skip
                </button>
                <button type="button" className="btn btn-pink" disabled={busy || answer.trim().length < 2} onClick={check}>
                  {busy ? `${f} is checking…` : 'check my answer'}
                </button>
              </div>
            </>
          )}
          {verdict && (
            <>
              <div className={`verdict ${verdict.verdict}`}>
                <b>{verdict.verdict === 'yes' ? 'yes! ✓' : verdict.verdict === 'almost' ? 'almost' : 'not quite'}</b>
                <p>{verdict.feedback}</p>
                {verdict.answer && (
                  <p className="muted">
                    a good answer: <span className="model">{verdict.answer}</span>
                  </p>
                )}
              </div>
              <p className="muted">
                {score.current.right} of {score.current.asked} so far
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={close}>
                  done
                </button>
                <button type="button" className="btn btn-pink" disabled={busy} onClick={ask}>
                  {busy ? `${f} is thinking…` : 'another one'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
