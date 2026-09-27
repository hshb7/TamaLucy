import { useState } from 'react'
import { ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { GIFT } from '../gift.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { connectMailbox, mailProblem } from '../mail.ts'
import { syncNow } from '../sync.ts'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'

/** "I already have my fox on my phone": bring it to this device with her mailbox code. */
function Join({ onBack, onNew }: { onBack: () => void; onNew: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const join = async () => {
    setBusy(true)
    setProblem('')
    try {
      if (!(await connectMailbox(code))) return setProblem('hmm, that code doesn’t open any mailbox. check the spelling?')
      await syncNow()
      // if a fox came down from the cloud, onboarding is over and this screen goes away
      if (!getGame().onboarded) {
        setProblem('connected! there’s no fox saved there yet, so let’s set one up here. it’ll show up on your other device too.')
        setTimeout(onNew, 2500)
      }
    } catch (e) {
      setProblem(mailProblem(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="screen onboarding">
      <FoxPortrait equipped={{}} face="happy" className="portrait-l" />
      <form
        className="px-box form"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim() && !busy) void join()
        }}
      >
        <label>
          your mailbox code
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="word-word-word-word-word-123"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="muted">it&rsquo;s like signing in: your fox comes here with everything, and stays the same on your iPhone and your Mac.</p>
        <button className="btn btn-big btn-pink" type="submit" disabled={busy || !code.trim()}>
          {busy ? 'finding your fox…' : 'bring my fox here'}
        </button>
        {problem && <p className="error">{problem}</p>}
        <button type="button" className="link" onClick={onBack}>
          ← back
        </button>
      </form>
    </main>
  )
}

export function Onboarding() {
  const game = useGame()
  const [step, setStep] = useState(0)
  const [joining, setJoining] = useState(false)
  const [fox, setFox] = useState(game.foxName)
  const [me, setMe] = useState(game.owner)

  const next = () => {
    sfx.tap()
    setStep(step + 1)
  }

  if (joining) return <Join onBack={() => setJoining(false)} onNew={() => (setJoining(false), setStep(1))} />

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
        <button className="link" onClick={() => setJoining(true)}>
          i already have my fox on another device →
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
            <b>study with {name}.</b> set a timer and stay in the app. if you leave for more than a few seconds, {name} gets
            distracted and the session doesn&rsquo;t count. every hour you study moves {name} up a law career, from 1L to the Supreme Court.
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
            <b>take care of {name}.</b> it has needs like a Sim: hunger, energy, fun, hygiene and love. studying earns acorns
            (one for every 5 minutes), and you spend them on food, baths and playtime: tap {name} or anything in the room. petting
            is always free. it gets lonely if you stay away for days.
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
