// Email and password: sign in, create an account, forgot password, and the
// "new password" step a reset link lands on. Lives on the front door and in
// the account card.
import { useState } from 'react'
import { emailProblem, registerWithEmail, sendPasswordReset, setPassword, signInWithEmail } from '../account.ts'
import { isNativeApp } from '../native.ts'
import { cantReach, framed } from '../preview.ts'
import { completeAccountSignIn, type SignInResult } from '../signin.ts'
import { toast } from '../ui/bits.tsx'

export type EmailMode = 'signin' | 'register' | 'forgot'

export function EmailAuth({ onDone, start = 'signin' }: { onDone: (r: SignInResult) => void; start?: EmailMode }) {
  const [mode, setMode] = useState<EmailMode>(start)
  const [email, setEmail] = useState('')
  const [password, setPassword1] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [note, setNote] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (framed) return setProblem(cantReach('the sign-in', ''))
    setProblem('')
    setNote('')
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email)
        setNote(
          `if there’s an account for ${email.trim()}, a reset link is on its way. ${isNativeApp ? 'open it, pick a new password, then sign in here with it.' : 'open it on any device and pick a new password.'}`,
        )
        setMode('signin')
        return
      }
      if (mode === 'register') {
        if (password !== again) return setProblem('the two passwords don’t match.')
        const r = await registerWithEmail(email, password)
        if (r === 'confirm') {
          setNote(`almost there: we sent a confirmation link to ${email.trim()}. ${isNativeApp ? 'open it to confirm, then sign in here.' : 'open it, and you’ll come back signed in.'}`)
          setMode('signin')
          return
        }
      } else await signInWithEmail(email, password)
      onDone(await completeAccountSignIn())
    } catch (err) {
      setProblem(emailProblem(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form email-auth" onSubmit={submit}>
      <label>
        email
        <input type="email" value={email} autoComplete="email" inputMode="email" autoCapitalize="none" required onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'forgot' && (
        <label>
          password
          <input
            type="password"
            value={password}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 8 : 1}
            required
            onChange={(e) => setPassword1(e.target.value)}
          />
        </label>
      )}
      {mode === 'register' && (
        <label>
          password, once more
          <input type="password" value={again} autoComplete="new-password" minLength={8} required onChange={(e) => setAgain(e.target.value)} />
        </label>
      )}
      <button className={`btn btn-big ${mode === 'register' ? 'btn-pink' : ''}`} type="submit" disabled={busy || !email.trim() || (mode !== 'forgot' && !password)}>
        {busy ? 'one moment…' : mode === 'register' ? 'create my account' : mode === 'forgot' ? 'send me a reset link' : 'sign in'}
      </button>
      {problem && <p className="error">{problem}</p>}
      {note && <p className="note">{note}</p>}
      <div className="email-links">
        {mode !== 'register' && (
          <button type="button" className="link" onClick={() => (setMode('register'), setProblem(''))}>
            new here? create an account →
          </button>
        )}
        {mode !== 'signin' && (
          <button type="button" className="link" onClick={() => (setMode('signin'), setProblem(''))}>
            i have an account: sign in →
          </button>
        )}
        {mode === 'signin' && (
          <button type="button" className="link" onClick={() => (setMode('forgot'), setProblem(''))}>
            forgot your password?
          </button>
        )}
      </div>
    </form>
  )
}

/** Where a reset link lands: pick a new password, then carry on. */
export function NewPassword({ onDone }: { onDone: (r: SignInResult) => void }) {
  const [password, setPassword1] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== again) return setProblem('the two passwords don’t match.')
    setBusy(true)
    setProblem('')
    try {
      await setPassword(password)
      toast('new password saved ✓')
      onDone(await completeAccountSignIn())
    } catch (err) {
      setProblem(emailProblem(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="screen onboarding gate">
      <h1 className="title">a new password</h1>
      <p className="muted center">you got here from the reset link. pick a new password and you’re in.</p>
      <form className="form email-auth" onSubmit={submit}>
        <label>
          new password
          <input type="password" value={password} autoComplete="new-password" minLength={8} required onChange={(e) => setPassword1(e.target.value)} />
        </label>
        <label>
          once more
          <input type="password" value={again} autoComplete="new-password" minLength={8} required onChange={(e) => setAgain(e.target.value)} />
        </label>
        <button className="btn btn-big btn-pink" type="submit" disabled={busy || password.length < 8}>
          {busy ? 'saving…' : 'save and continue'}
        </button>
        {problem && <p className="error">{problem}</p>}
      </form>
    </main>
  )
}
