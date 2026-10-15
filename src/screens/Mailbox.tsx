import { useState } from 'react'
import { claimMailbox, signInWithGoogle, signOut, useAccount, writerKey } from '../account.ts'
import { SignOutButton } from './SignOut.tsx'
import { useGame } from '../game/store.ts'
import { checkMail, connectMailbox, mailProblem } from '../mail.ts'
import { cantReach } from '../preview.ts'
import { runSignIn } from '../signin.ts'
import { CardHead, toast } from '../ui/bits.tsx'
import { GoogleLogo } from '../ui/brands.tsx'
import { syncNow, useSyncStatus } from '../sync.ts'

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

/** Her account: sign in once and the fox follows her to any device, no code to type. */
function AccountBlock() {
  const game = useGame()
  const acct = useAccount()
  const [busy, setBusy] = useState(false)
  const signIn = async () => {
    if (framed) return toast(cantReach('Google’s sign-in page', ''), 5000)
    setBusy(true)
    try {
      const res = await runSignIn(signInWithGoogle)
      if (res) toast(res.message, 6000)
    } finally {
      setBusy(false)
    }
  }
  if (acct)
    return (
      <p>
        signed in as <b>{acct.email || acct.name || 'your Google account'}</b> ✓{' '}
        <span className="muted">· {game.mailbox ? `${game.foxName} follows this account to any device: just sign in there.` : 'connect a mailbox below and it’ll follow this account too.'}</span>
        {!game.mailbox && (
          <>
            {' '}
            <button className="link inline" onClick={() => void signOut().then(() => toast('signed out of Google on this device'))}>
              sign out
            </button>
          </>
        )}
      </p>
    )
  return (
    <>
      <p className="muted">sign in with Google and {game.foxName} follows you to any device: no code to type there.</p>
      <button className="btn signin" disabled={busy} onClick={signIn}>
        <GoogleLogo /> {busy ? 'signing in…' : 'sign in with Google'}
      </button>
    </>
  )
}

/** Settings: connect her mailbox so letters from far away can find her. */
export function MailboxSection() {
  const game = useGame()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const sync = useSyncStatus()

  const connect = async () => {
    setBusy(true)
    setProblem('')
    try {
      if (!(await connectMailbox(code))) return setProblem('hmm, that code doesn’t open any mailbox. check the spelling?')
      setCode('')
      toast('mailbox connected! letters (and your fox) will find you here ♡')
      void checkMail(0)
      void syncNow()
      // signed in already: this mailbox is hers now
      void claimMailbox().catch(() => {})
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
      const [added] = await Promise.all([checkMail(0, true), syncNow()])
      if (!added.length) toast('no new letters right now. the fox will keep an eye on the door ✿')
    } catch (e) {
      setProblem(mailProblem(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-box card mailbox">
      <CardHead title="account, mailbox & sync" status={game.mailbox ? 'connected ✓' : 'not connected'} on={!!game.mailbox} />
      <AccountBlock />
      {game.mailbox && <SignOutButton className="btn" label="sign out" />}
      {game.mailbox ? (
        <>
          <p>
            connected ✓ <span className="muted">· last looked {ago(game.lastMailCheck)}</span>
          </p>
          <p className="muted">letters sent to you show up in your album. {game.foxName} checks whenever you open the app.</p>
          <p>
            {sync.state === 'ok'
              ? `${game.foxName} is in sync with your other devices ✓`
              : sync.state === 'syncing'
                ? 'syncing…'
                : sync.state === 'offline'
                  ? 'offline right now. it’ll sync when you’re back online.'
                  : sync.state === 'error'
                    ? 'couldn’t sync just now. it’ll try again soon.'
                    : ''}
          </p>
          <p className="muted">
            on your iPhone or Mac, sign in with Google (or type this same code) and it&rsquo;s the same {game.foxName} everywhere.
          </p>
          {writerKey() && (
            <p className="muted">
              someone writing you letters? give them this writer key, once: <code className="backup-code">{writerKey()}</code>{' '}
              <button className="link inline" onClick={() => void navigator.clipboard?.writeText(writerKey()).then(() => toast('copied ✓'))}>
                copy
              </button>
            </p>
          )}
          <div className="row">
            <button className="btn" disabled={busy} onClick={look}>
              {busy ? 'looking…' : 'check now'}
            </button>
          </div>

        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim() && !busy) void connect()
          }}
        >
          <p className="muted">
            your mailbox code is how you sign in: letters find their way to {game.foxName}’s door, and {game.foxName} is the same on your
            iPhone and your Mac. if your fox already lives on another device, signing in brings it here (replacing this one).
          </p>
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
