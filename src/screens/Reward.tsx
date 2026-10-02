import { GIFT_ART, ICON_ART, NEED_ICON_ART, SOUVENIR_ART, TREAT_ART } from '../art/items.ts'
import { CLOTHING_ART } from '../art/clothes.ts'
import type { Sprite } from '../art/sprite.ts'
import { buzz, sfx } from '../audio.ts'
import { ADVENTURES, CLOTHES, GIFTS, REWARD_INFO, REWARD_KINDS, TREATS, byId, type RewardKind } from '../game/content.ts'
import { available, cancelOffer, claim, offer, startBreak, type RewardResult } from '../game/logic.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { LetterView } from './Modals.tsx'
import type { View } from '../App.tsx'
import { courseMinutes, isShelved } from '../game/shelf.ts'
import { hoursOf } from './Bookshelf.tsx'

export function iconFor(kind: RewardKind | 'souvenir', id: string): Sprite {
  if (kind === 'treat') return TREAT_ART[id]
  if (kind === 'gift') return GIFT_ART[id]
  if (kind === 'clothes') return CLOTHING_ART[id].sprite
  if (kind === 'adventure') return SOUVENIR_ART[ADVENTURES.find((a) => a.id === id)!.souvenir]
  if (kind === 'souvenir') return SOUVENIR_ART[id]
  return ICON_ART.mail
}

const KIND_ICON: Record<RewardKind, Sprite> = {
  adventure: ICON_ART.backpack,
  gift: ICON_ART.gift,
  treat: TREAT_ART.strawberry,
  clothes: ICON_ART.bow,
  note: ICON_ART.mail,
}

function optionInfo(kind: RewardKind, id: string) {
  if (kind === 'treat') return byId(TREATS, id)!
  if (kind === 'gift') return byId(GIFTS, id)!
  if (kind === 'clothes') return byId(CLOTHES, id)!
  const a = ADVENTURES.find((x) => x.id === id)!
  return { id, name: a.place, blurb: a.verb }
}

const OFFER_TITLE: Record<RewardKind, string> = {
  adventure: 'where should we go?',
  gift: 'choose a gift',
  treat: 'choose a treat',
  clothes: 'choose an outfit',
  note: '',
}

interface Props {
  result: RewardResult | null
  setResult: (r: RewardResult | null) => void
  onDone: (next: View) => void
}

export function RewardScreen({ result, setResult, onDone }: Props) {
  const game = useGame()
  const p = game.pending
  const f = game.foxName
  const course = p?.courseId ? game.courses.find((c) => c.id === p.courseId) : undefined

  const take = (kind: RewardKind, choice: string | null) => {
    const r = claim(getGame(), Date.now(), kind, choice)
    if (!r) return
    setGame(r.state)
    setResult(r.result)
    if (kind === 'treat') sfx.nom()
    else sfx.sparkle()
    buzz(30)
  }

  if (result) return <RewardResultView result={result} picksLeft={p?.picksLeft ?? 0} onNext={() => setResult(null)} onDone={onDone} />
  if (!p) return null

  if (p.offer) {
    const { kind, options } = p.offer
    return (
      <main className="screen reward">
        <h1 className="title">{OFFER_TITLE[kind]}</h1>
        <div className="options">
          {options.map((id) => {
            const info = optionInfo(kind, id)
            return (
              <button key={id} className="option px-box" onClick={() => take(kind, id)}>
                <PixelIcon sprite={iconFor(kind, id)} scale={4} />
                <span className="option-text">
                  <b>{info.name}</b>
                  <small>{info.blurb}</small>
                </span>
              </button>
            )
          })}
        </div>
        <button className="link" onClick={() => setGame((s) => cancelOffer(s))}>
          ← back
        </button>
      </main>
    )
  }

  return (
    <main className="screen reward">
      <FoxPortrait equipped={game.equipped} cheer className="portrait-l" />
      <h1 className="title">you did it!</h1>
      <p className="lead">
        {p.minutes ? `${p.minutes} minute${p.minutes === 1 ? '' : 's'}` : 'less than a minute'} of focus{p.label ? ` on “${p.label}”` : ''}. {f} is so proud of you!
      </p>
      {!!p.acorns && p.taken.length === 0 && (
        <p className="pill pill-acorn">
          <PixelIcon sprite={ICON_ART.acorn} scale={2} /> +{p.acorns} acorn{p.acorns === 1 ? '' : 's'} to spend on {f}
        </p>
      )}
      {course && p.taken.length === 0 && (
        <p className="pill">
          <PixelIcon sprite={NEED_ICON_ART.books} scale={2} /> {course.name}: {hoursOf(courseMinutes(game, course))}/{course.goalHours} h{' '}
          {isShelved(game, course) ? 'on the shelf ✿' : course.kind === 'work' ? 'in its binder' : `on the ${course.year} shelf`}
        </p>
      )}
      {p.foundLetter && p.taken.length === 0 && <p className="pill pill-pink">{f} found a secret letter under the rug! it&rsquo;s in your album ♡</p>}
      {p.picksLeft > 1 || p.taken.length > 0 ? (
        <p className="pill">
          long session bonus · reward {p.taken.length + 1} of {p.taken.length + p.picksLeft}
        </p>
      ) : null}
      <div className="kinds">
        {REWARD_KINDS.map((k) => {
          const info = REWARD_INFO[k]
          const ok = available(game, k) && !(k === 'adventure' && game.adventure)
          return (
            <button
              key={k}
              className={`kind px-box kind-${k}`}
              disabled={!ok}
              onClick={() => {
                sfx.tap()
                if (k === 'note') take('note', null)
                else setGame((s) => offer(s, k))
              }}
            >
              <PixelIcon sprite={KIND_ICON[k]} scale={3} />
              <span>
                <b>{info.title}</b>
                <small>{ok ? info.blurb : k === 'adventure' ? `${f} is already out!` : 'collected them all!'}</small>
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}

function RewardResultView({ result, picksLeft, onNext, onDone }: { result: RewardResult; picksLeft: number; onNext: () => void; onDone: (v: View) => void }) {
  const game = useGame()
  const f = game.foxName
  let body
  switch (result.kind) {
    case 'treat': {
      const t = byId(TREATS, result.id)!
      body = (
        <>
          <FoxPortrait equipped={game.equipped} eating={result.id} className="portrait-l" />
          <h1 className="title">nom nom nom!</h1>
          <p className="lead">
            {f} gobbled up the {t.name.toLowerCase()}, and saved two more in the pantry (tap {f} → give a treat).
            {result.firstFavorite && <b className="favorite"> you found {f}&rsquo;s favourite treat! ♡</b>}
            {result.favorite && !result.firstFavorite && <b className="favorite"> it&rsquo;s {f}&rsquo;s favourite! ♡</b>}
          </p>
        </>
      )
      break
    }
    case 'gift': {
      const g = byId(GIFTS, result.id)!
      body = (
        <>
          <div className="gift-reveal">
            <PixelIcon sprite={GIFT_ART[result.id]} scale={6} />
          </div>
          <h1 className="title">a {g.name.toLowerCase()}!</h1>
          <p className="lead">{f} loves it and found the perfect spot for it in the room.</p>
        </>
      )
      break
    }
    case 'clothes': {
      const c = byId(CLOTHES, result.id)!
      body = (
        <>
          <FoxPortrait equipped={game.equipped} cheer className="portrait-l" />
          <h1 className="title">so stylish!</h1>
          <p className="lead">
            {f} is wearing the {c.name.toLowerCase()}. change outfits any time in the closet.
          </p>
        </>
      )
      break
    }
    case 'adventure': {
      const a = ADVENTURES.find((x) => x.id === result.id)!
      const mins = Math.round((result.returnsAt - Date.now()) / 60000)
      body = (
        <>
          <div className="gift-reveal">
            <PixelIcon sprite={ICON_ART.backpack} scale={6} />
          </div>
          <h1 className="title">off to {a.place}!</h1>
          <p className="lead">
            {f} packed a snack and set off {a.verb}. back in about {mins} minutes with a postcard, the perfect length for your break.
          </p>
        </>
      )
      break
    }
    case 'note':
      body = (
        <>
          <h1 className="title">{result.note.kind === 'secret' ? `${f} found a letter!` : `${f} wrote you a note`}</h1>
          <LetterView note={result.note} foxName={f} />
        </>
      )
  }

  return (
    <main className="screen reward">
      {body}
      <div className="stack">
        {picksLeft > 0 ? (
          <button className="btn btn-big btn-pink" onClick={onNext}>
            pick your next reward
          </button>
        ) : (
          <>
            <button
              className="btn btn-big btn-pink"
              onClick={() => {
                setGame((s) => startBreak(s, Date.now()))
                onDone('break')
              }}
            >
              take a {game.settings.breakMinutes < 1 ? `${game.settings.breakMinutes * 60}-second` : `${game.settings.breakMinutes}-minute`} break
            </button>
            <button className="btn" onClick={() => onDone('home')}>
              back home
            </button>
          </>
        )}
      </div>
    </main>
  )
}
