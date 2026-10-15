import { useState } from 'react'
import { ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { GIFT } from '../gift.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { MAX_SHELVES, STUDY_PRESETS, applyPreset, setRungs, shelvesFromNames, tagFor, type StudyPreset } from '../game/studySetup.ts'
import { ladder } from '../game/career.ts'
import { RungsFields } from './Rungs.tsx'
import { claimMailbox, setFreshSignIn, signInWithGoogle, startFreshMailbox, useAccount, useFreshSignIn } from '../account.ts'
import { connectMailbox, mailProblem } from '../mail.ts'
import { cantReach, framed } from '../preview.ts'
import { runSignIn } from '../signin.ts'
import { syncNow } from '../sync.ts'
import { toast } from '../ui/bits.tsx'
import { GoogleLogo } from '../ui/brands.tsx'
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
      // signed in already: from now on the account alone brings this fox anywhere
      void claimMailbox().catch(() => {})
      setFreshSignIn(false)
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

/**
 * What she's studying: a preset to start from (law school, college, grad
 * school…), her name for it, and the shelves on the bookcase. Every field is
 * hers to change; nothing is assumed.
 */
function StudySetup({ fox, onDone }: { fox: string; onDone: (preset: StudyPreset, program: string, shelves: string[], rungs: string[]) => void }) {
  const [preset, setPreset] = useState<StudyPreset | null>(null)
  const [program, setProgram] = useState('')
  const [shelves, setShelves] = useState<string[]>(['', '', ''])
  const [rungs, setRungsLocal] = useState<string[]>([])
  const pick = (p: StudyPreset) => {
    sfx.tap()
    setPreset(p)
    setProgram(p.program)
    setShelves([...p.shelves, '', ''].slice(0, MAX_SHELVES))
    setRungsLocal([...p.rungs])
  }
  const named = shelves.filter((x) => x.trim())
  return (
    <main className="screen onboarding">
      <FoxPortrait equipped={{}} face="open" className="portrait-m" />
      <form
        className="px-box form"
        onSubmit={(e) => {
          e.preventDefault()
          if (preset && named.length) onDone(preset, program, shelves, rungs)
        }}
      >
        <h2>what are you studying?</h2>
        <div className="presets">
          {STUDY_PRESETS.map((p) => (
            <button key={p.id} type="button" className={`chip-btn ${preset?.id === p.id ? 'on' : ''}`} onClick={() => pick(p)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset && (
          <>
            <label>
              call it whatever you like <span className="muted">(optional)</span>
              <input value={program} maxLength={30} placeholder="e.g. nursing, the bar, my master’s" onChange={(e) => setProgram(e.target.value)} />
            </label>
            <div className="field">
              <span>
                the shelves on {fox}&rsquo;s bookcase <span className="muted">(a year, a term, “work”… up to {MAX_SHELVES})</span>
              </span>
              <div className="setup-shelves">
                {shelves.map((name, i) => (
                  <div key={i} className="row-shelf">
                    <span className="shelf-no">{i + 1}</span>
                    <input
                      value={name}
                      maxLength={24}
                      placeholder={i === 0 ? 'e.g. year 1' : 'leave empty for fewer shelves'}
                      aria-label={`shelf ${i + 1}`}
                      onChange={(e) => setShelves(shelves.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    <span className="shelf-tag">{name.trim() ? tagFor(name) : '··'}</span>
                  </div>
                ))}
              </div>
            </div>
            <details className="rungs-details">
              <summary>
                {fox}&rsquo;s career: <b>{rungs[1] || preset.rungs[1]}</b> → <b>{rungs[rungs.length - 1] || preset.rungs[preset.rungs.length - 1]}</b>{' '}
                <span className="muted">(tap to rename the rungs)</span>
              </summary>
              <p className="muted">every hour you focus moves {fox} up a rung. these are only suggestions: name them after what you&rsquo;re studying.</p>
              <RungsFields value={rungs} onChange={setRungsLocal} track={preset.track} />
            </details>
            <p className="muted">every class you add becomes a book on one of these shelves, and fills in as you study for it. you can change all of this later in settings.</p>
          </>
        )}
        <button className="btn btn-big btn-pink" type="submit" disabled={!preset || !named.length}>
          {preset ? 'that’s me' : 'pick one to start'}
        </button>
      </form>
    </main>
  )
}

/** Signed in with an account that has nothing behind it yet: her first fox, or one that lives elsewhere? */
function FreshStart({ name, onStart, onHave }: { name: string; onStart: () => Promise<void>; onHave: () => void }) {
  const [busy, setBusy] = useState(false)
  const first = name.split(/[\s@]/)[0]
  return (
    <main className="screen onboarding">
      <FoxPortrait equipped={{}} face="happy" hearts className="portrait-xl" />
      <h1 className="title">hi{first ? `, ${first}` : ''}! first time here?</h1>
      <p className="muted center">you’re signed in, and there’s no fox under this account yet. let’s fix that.</p>
      <button
        className="btn btn-big btn-pink"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onStart()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'getting things ready…' : 'start my fox →'}
      </button>
      <button className="link" onClick={onHave}>
        i already have a fox on another device →
      </button>
    </main>
  )
}

export function Onboarding() {
  const game = useGame()
  const fresh = useFreshSignIn()
  const acct = useAccount()
  const [step, setStep] = useState(0)
  const [joining, setJoining] = useState(false)
  const [signing, setSigning] = useState(false)
  const [fox, setFox] = useState(game.foxName)
  const [me, setMe] = useState(game.owner)

  /** "I already have my fox": sign in, and it comes here with everything. */
  const signIn = async () => {
    if (framed) return toast(cantReach('Google’s sign-in page', ''), 5000)
    setSigning(true)
    try {
      const res = await runSignIn(signInWithGoogle)
      if (res) toast(res.message, 6000)
    } finally {
      setSigning(false)
    }
  }

  const next = () => {
    sfx.tap()
    setStep(step + 1)
  }

  if (joining) return <Join onBack={() => setJoining(false)} onNew={() => (setJoining(false), setStep(1))} />

  if (fresh && step === 0)
    return (
      <FreshStart
        name={acct?.name || acct?.email || ''}
        onStart={async () => {
          if (await startFreshMailbox()) {
            sfx.tap()
            setStep(1)
          } else toast('couldn’t set up your mailbox just now. are you online?', 5000)
        }}
        onHave={() => setJoining(true)}
      />
    )

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
        <p className="muted center or">already have your fox on another device?</p>
        <button className="btn btn-big signin" disabled={signing} onClick={signIn}>
          <GoogleLogo /> {signing ? 'signing in…' : 'sign in with Google'}
        </button>
        <button className="link" onClick={() => setJoining(true)}>
          or use my mailbox code →
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

  if (step === 2)
    return (
      <StudySetup
        fox={name}
        onDone={(preset, program, shelves, rungs) => {
          const now = Date.now()
          setGame((s) => {
            const withPreset = applyPreset(s, preset, now)
            return setRungs({ ...withPreset, study: { ...withPreset.study, program: program.trim().slice(0, 30), shelves: shelvesFromNames(shelves, now) } }, rungs)
          })
          next()
        }}
      />
    )

  const rungs = ladder(game)
  return (
    <main className="screen onboarding">
      <h1 className="title">how it works</h1>
      <ul className="howto">
        <li className="px-box">
          <PixelIcon sprite={ICON_ART.acorn} scale={3} />
          <p>
            <b>study with {name}.</b> set a timer and stay in the app. if you leave for more than a few seconds, {name} gets
            distracted and the session doesn&rsquo;t count. every hour you study moves {name} up a rung, from {rungs[1].title} all the way to{' '}
            {rungs[rungs.length - 1].title}, and fills in the book for the class you picked.
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
