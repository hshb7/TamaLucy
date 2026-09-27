import { useState } from 'react'
import { setGame, useGame } from '../game/store.ts'
import { checkMail, connectMailbox, mailProblem } from '../mail.ts'
import { toast } from '../ui/bits.tsx'

/** Embedded previews (iframes) usually block network requests, so no mail gets through. */
const framed = typeof window !== 'undefined' && window.self !== window.top

function ago(t: number) {
  if (!t) return 'not yet'
  const min = Math.floor((Date.now() - t) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

/** Settings: connect her mailbox so letters from far away can find her. */
export function MailboxSection() {
  const game = useGame()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [forget, setForget] = useState(false)

  const connect = async () => {
    setBusy(true)
    setProblem('')
    try {
      if (!(await connectMailbox(code))) return setProblem('hmm, that code doesn’t open any mailbox. check the spelling?')
      setCode('')
      toast('mailbox connected! letters will find you here ♡')
      void checkMail(0)
    } catch (e) {
      setProblem(mailProblem(e))
    } finally {
      setBusy(false)
    }
  }

  const look = async () => {
    setBusy(true)
    setProblem('')
    try {
      const added = await checkMail(0, true)
      if (!added.length) toast('no new letters right now. the fox will keep an eye on the door ✿')
    } catch (e) {
      setProblem(mailProblem(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-box card mailbox">
      <h2>mailbox</h2>
      {game.mailbox ? (
        <>
          <p>
            connected ✓ <span className="muted">· last looked {ago(game.lastMailCheck)}</span>
          </p>
          <p className="muted">letters sent to you show up in your album. {game.foxName} checks whenever you open the app.</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={look}>
              {busy ? 'looking…' : 'check now'}
            </button>
          </div>
          {!forget ? (
            <button className="link" onClick={() => setForget(true)}>
              disconnect this mailbox…
            </button>
          ) : (
            <p className="muted">
              stop getting letters here? the ones you have stay in your album.{' '}
              <button className="link inline" onClick={() => setGame((s) => ({ ...s, mailbox: '', lastMailCheck: 0 }))}>
                yes, disconnect
              </button>{' '}
              <button className="link inline" onClick={() => setForget(false)}>
                no
              </button>
            </p>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim() && !busy) void connect()
          }}
        >
          <p className="muted">did someone give you a mailbox code? type it here and letters they send will find their way to {game.foxName}’s door.</p>
          <label>
            mailbox code
            <input
              id="mailbox-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="word-word-word-word-word-123"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button className="btn btn-pink" disabled={busy || !code.trim()}>
            {busy ? 'knocking…' : 'connect'}
          </button>
        </form>
      )}
      {problem && <p className="error">{problem}</p>}
      {framed && <p className="muted">(letters can’t reach this preview. they arrive in the real app.)</p>}
    </section>
  )
}
