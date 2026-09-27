import { useState } from 'react'
import { GIFT_ART, SOUVENIR_ART, TREAT_ART } from '../art/items.ts'
import { ADVENTURES, GIFTS, TREATS } from '../game/content.ts'
import { readNote } from '../game/logic.ts'
import type { Note, Postcard } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal } from '../ui/bits.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { Header } from './Header.tsx'
import { LetterView, PostcardModal } from './Modals.tsx'

type Tab = 'letters' | 'trips' | 'treats' | 'room'

export function Album({ onBack }: { onBack: () => void }) {
  const game = useGame()
  const [tab, setTab] = useState<Tab>('letters')
  const [note, setNote] = useState<Note | null>(null)
  const [card, setCard] = useState<Postcard | null>(null)
  const unread = game.notes.filter((n) => !n.read).length

  return (
    <main className="screen">
      <Header title="album" onBack={onBack} />
      <div className="tabs" role="tablist">
        {(['letters', 'trips', 'treats', 'room'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'letters' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === 'letters' &&
        (game.notes.length ? (
          <ul className="list">
            {game.notes.map((n) => (
              <li key={n.id}>
                <button
                  className={`list-item px-box ${n.read ? '' : 'unread'}`}
                  onClick={() => {
                    setNote(n)
                    setGame((s) => readNote(s, n.id))
                  }}
                >
                  <span className="list-title">
                    {n.kind === 'secret'
                      ? 'a secret letter ♡'
                      : n.kind === 'missed'
                        ? 'while you were away...'
                        : n.kind === 'birthday'
                          ? 'a birthday letter ♡'
                          : n.kind === 'exam'
                            ? 'a good-luck note'
                            : `a note from ${game.foxName}`}
                  </span>
                  <span className="list-sub">{n.read ? n.text.slice(0, 48) + (n.text.length > 48 ? '…' : '') : 'unopened ✿'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">no letters yet. choose &ldquo;write you a note&rdquo; after a focus session!</p>
        ))}

      {tab === 'trips' && (
        <>
          <p className="muted center">
            {new Set(game.postcards.map((p) => p.adventure)).size}/{ADVENTURES.length} places visited
          </p>
          <div className="grid">
            {ADVENTURES.map((a) => {
              const cards = game.postcards.filter((p) => p.adventure === a.id)
              return (
                <button key={a.id} className={`tile px-box ${cards.length ? '' : 'locked'}`} disabled={!cards.length} onClick={() => setCard(cards[0])}>
                  <PixelIcon sprite={SOUVENIR_ART[a.souvenir]} scale={3} className={cards.length ? '' : 'silhouette'} />
                  <span>{cards.length ? a.place : '???'}</span>
                  {cards.length > 1 && <small>×{cards.length}</small>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {tab === 'treats' && (
        <>
          <p className="muted center">feed {game.foxName} everything to find the two favourites ♡</p>
          <div className="grid">
            {TREATS.map((t) => {
              const n = game.treatsFed[t.id] ?? 0
              const fav = n > 0 && game.favoriteTreats.includes(t.id)
              return (
                <div key={t.id} className={`tile px-box ${n ? '' : 'locked'}`}>
                  <PixelIcon sprite={TREAT_ART[t.id]} scale={3} className={n ? '' : 'silhouette'} />
                  <span>{n ? t.name : '???'}</span>
                  <small>{n ? `${fav ? '♡ favourite · ' : ''}×${n}` : 'not tried'}</small>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'room' && (
        <>
          <p className="muted center">
            {game.gifts.length}/{GIFTS.length} gifts in the room
          </p>
          <div className="grid">
            {GIFTS.map((g) => {
              const has = game.gifts.includes(g.id)
              return (
                <div key={g.id} className={`tile px-box ${has ? '' : 'locked'}`}>
                  <PixelIcon sprite={GIFT_ART[g.id]} scale={2} className={has ? '' : 'silhouette'} />
                  <span>{has ? g.name : '???'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {note && (
        <Modal onClose={() => setNote(null)}>
          <LetterView note={note} foxName={game.foxName} />
          <button className="btn btn-pink" onClick={() => setNote(null)}>
            close
          </button>
        </Modal>
      )}
      {card && <PostcardModal card={card} onClose={() => setCard(null)} />}
    </main>
  )
}
