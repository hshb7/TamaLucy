import { useEffect, useState } from 'react'
import { sfx } from '../audio.ts'
import { ICON_ART, LAW_ART, SOUVENIR_ART } from '../art/items.ts'
import { CLOTHING_ART } from '../art/clothes.ts'
import { CAREER } from '../game/career.ts'
import { ADVENTURES } from '../game/content.ts'
import { dismissPostcard, readNote } from '../game/logic.ts'
import type { Note, Postcard } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatDuration } from '../hooks.ts'
import { Modal } from '../ui/bits.tsx'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'

const PAW = ICON_ART.heart

export function LetterView({ note, foxName }: { note: Note; foxName: string }) {
  const date = new Date(note.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <article className={`letter px-box ${note.kind}`}>
      <p className="letter-date">{date}</p>
      {note.kind === 'secret' && <p className="letter-intro">({foxName.toLowerCase()} found this tucked under the rug...)</p>}
      {note.kind === 'post' && <p className="letter-intro">(this one came in the mail ✉)</p>}
      {note.text.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : null))}
      {note.kind === 'post' && note.signed && <p className="sign">— {note.signed}</p>}
      {note.kind !== 'secret' && note.kind !== 'post' && (
        <p className="sign">
          — {foxName.toLowerCase()} <PixelIcon sprite={PAW} scale={2} />
        </p>
      )}
    </article>
  )
}

export function PostcardView({ card, foxName }: { card: Postcard; foxName: string }) {
  const a = ADVENTURES.find((x) => x.id === card.adventure)!
  return (
    <article className="postcard px-box">
      <div className="postcard-top">
        <h3>greetings from {a.place}!</h3>
        <div className="stamp">
          <PixelIcon sprite={SOUVENIR_ART[a.souvenir]} scale={3} />
        </div>
      </div>
      <p>{card.story}</p>
      <p className="sign">— {foxName.toLowerCase()}</p>
      <p className="souvenir">
        souvenir: <b>{a.souvenirName.toLowerCase()}</b>
      </p>
    </article>
  )
}

export function PostcardModal({ card, fresh, onClose }: { card: Postcard; fresh?: boolean; onClose?: () => void }) {
  const game = useGame()
  const close = onClose ?? (() => setGame((s) => dismissPostcard(s)))
  return (
    <Modal onClose={close}>
      {fresh && <h2>{game.foxName} is back home!</h2>}
      <PostcardView card={card} foxName={game.foxName} />
      <button className="btn btn-pink" onClick={close}>
        {fresh ? 'welcome back ♡' : 'close'}
      </button>
    </Modal>
  )
}

/** A letter just came in the mail: first the envelope, then the letter. */
export function MailModal({ notes, onClose }: { notes: Note[]; onClose: () => void }) {
  const game = useGame()
  const [open, setOpen] = useState(false)
  const note = notes[0]
  const more = notes.length - 1
  const f = game.foxName
  const signers = new Set(notes.map((n) => n.signed ?? ''))
  const from = signers.size === 1 && note.signed ? `, from ${note.signed}` : ''
  return (
    <Modal onClose={onClose} className="mail-modal">
      {!open ? (
        <>
          <div className="envelope">
            <PixelIcon sprite={ICON_ART.mail} scale={6} />
          </div>
          <h2>you’ve got mail!</h2>
          <p>
            {f} heard the letterbox and ran to the door. {notes.length === 1 ? 'a letter came for you' : `${notes.length} letters came for you`}
            {from} ✉
          </p>
          <div className="row">
            <button className="btn" onClick={onClose}>
              later
            </button>
            <button
              className="btn btn-pink"
              onClick={() => {
                sfx.sparkle()
                setGame((s) => readNote(s, note.id))
                setOpen(true)
              }}
            >
              open it
            </button>
          </div>
        </>
      ) : (
        <>
          <LetterView note={note} foxName={f} />
          {more > 0 && <p className="muted center">{more === 1 ? 'one more is' : `${more} more are`} waiting in your album ♡</p>}
          <button className="btn btn-pink" onClick={onClose}>
            keep it ♡
          </button>
        </>
      )}
    </Modal>
  )
}

export function FailedModal({ awayMs, onClose, onRetry }: { awayMs: number; onClose: () => void; onRetry: () => void }) {
  const game = useGame()
  const f = game.foxName
  return (
    <Modal onClose={onClose}>
      <FoxPortrait equipped={game.equipped} face="sad" className="portrait-m" />
      <h2>{f} looked up and you were gone...</h2>
      <p>
        you left the app for {formatDuration(awayMs)}, so this session didn&rsquo;t count. {f} is a little sad, but it&rsquo;s
        okay. you can try again!
      </p>
      <div className="row">
        <button className="btn" onClick={onClose}>
          okay
        </button>
        <button className="btn btn-pink" onClick={onRetry}>
          try again
        </button>
      </div>
    </Modal>
  )
}

export function LockTips({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2>lock your phone to this app</h2>
      <p>
        your phone can pin itself to one app, so you <i>really</i> can&rsquo;t open anything else until you unlock it.
      </p>
      <h3>iPhone: Guided Access</h3>
      <ol>
        <li>Settings → Accessibility → Guided Access → turn it on and set a passcode.</li>
        <li>In this app, triple-click the side button → Start.</li>
        <li>When you&rsquo;re done, triple-click again and enter the passcode.</li>
      </ol>
      <h3>Android: App pinning</h3>
      <ol>
        <li>Settings → Security → App pinning (or &ldquo;Pin app&rdquo;) → on.</li>
        <li>Open Recents, tap this app&rsquo;s icon → Pin.</li>
        <li>To unpin, hold Back + Overview (or swipe up and hold).</li>
      </ol>
      <p className="muted">tip: the screen stays awake during focus, so the fox won&rsquo;t think you left.</p>
      <button className="btn btn-pink" onClick={onClose}>
        got it
      </button>
    </Modal>
  )
}

export function PromotionModal({ rank, onClose }: { rank: number; onClose: () => void }) {
  const game = useGame()
  useEffect(() => sfx.fanfare(), [])
  const r = CAREER[rank]
  const hours = Math.round(game.stats.totalMinutes / 6) / 10
  return (
    <Modal onClose={onClose} className="promo">
      <p className="promo-kicker">promotion!</p>
      <FoxPortrait equipped={game.equipped} cheer className="portrait-m" />
      <h2>
        {game.foxName} is now {/^[AEIOU]/.test(r.title) ? 'an' : 'a'} {r.title}!
      </h2>
      <p className="center">after {hours} hours of studying together. {game.foxName} couldn&rsquo;t have done it without you.</p>
      {r.unlocks.length > 0 && (
        <ul className="unlocks">
          {r.unlocks.map((u) => (
            <li key={u.id} className="px-box">
              {u.kind === 'clothes' && <PixelIcon sprite={CLOTHING_ART[u.id].sprite} scale={2} />}
              {u.kind === 'law' && <PixelIcon sprite={LAW_ART[u.id]} scale={2} />}
              <span>unlocked {u.label}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-pink" onClick={onClose}>
        congratulations! ♡
      </button>
    </Modal>
  )
}
