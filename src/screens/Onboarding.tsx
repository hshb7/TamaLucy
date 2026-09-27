import { useState } from 'react'
import { ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { GIFT } from '../gift.ts'
import { setGame, useGame } from '../game/store.ts'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'

export function Onboarding() {
  const game = useGame()
  const [step, setStep] = useState(0)
  const [fox, setFox] = useState(game.foxName)
  const [me, setMe] = useState(game.owner)

  const next = () => {
    sfx.tap()
    setStep(step + 1)
  }

  if (step === 0)
    return (
      <main className="screen onboarding">
        <FoxPortrait equipped={{}} hearts className="portrait-xl" />
        <h1 className="title">a little fox has been waiting for you{GIFT.recipientName ? `, ${GIFT.recipientName}` : ''}!</h1>
        {GIFT.welcome && (
          <div className="letter px-box small">
            <p>{GIFT.welcome}</p>
            {GIFT.from && <p className="sign">— {GIFT.from}</p>}
          </div>
        )}
        <button className="btn btn-big btn-pink" onClick={next}>
          hi little fox!
        </button>
      </main>
    )

  if (step === 1)
    return (
      <main className="screen onboarding">
        <FoxPortrait equipped={{}} face="happy" className="portrait-l" />
        <form
          className="px-box form"
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
        >
          <label>
            what should we call this fox?
            <input value={fox} maxLength={14} onChange={(e) => setFox(e.target.value)} required />
          </label>
          <label>
            and what&rsquo;s your name?
            <input value={me} maxLength={16} onChange={(e) => setMe(e.target.value)} required />
          </label>
          <button className="btn btn-big btn-pink" type="submit" disabled={!fox.trim() || !me.trim()}>
            that&rsquo;s perfect
          </button>
        </form>
      </main>
    )

  const name = fox.trim()
  return (
    <main className="screen onboarding">
      <h1 className="title">how it works</h1>
      <ul className="howto">
        <li className="px-box">
          <PixelIcon sprite={ICON_ART.acorn} scale={3} />
          <p>
            <b>focus with {name}.</b> set a timer and stay in the app. if you leave for more than a few seconds, {name} wakes up
            worried and the session doesn&rsquo;t count.
          </p>
        </li>
        <li className="px-box">
          <PixelIcon sprite={ICON_ART.gift} scale={3} />
          <p>
            <b>earn a reward.</b> after each session, {name} can go on an adventure, get a gift, a treat or new clothes, or
            write you a little note.
          </p>
        </li>
        <li className="px-box">
          <PixelIcon sprite={ICON_ART.heart} scale={3} />
          <p>
            <b>come back often.</b> {name} gets hungry and lonely if you stay away for days. tap {name} to say hi!
          </p>
        </li>
      </ul>
      <button
        className="btn btn-big btn-pink"
        onClick={() => {
          sfx.fanfare()
          setGame((s) => ({ ...s, onboarded: true, foxName: name, owner: me.trim(), lastVisit: Date.now() }))
          void navigator.storage?.persist?.()
        }}
      >
        let&rsquo;s go!
      </button>
    </main>
  )
}
