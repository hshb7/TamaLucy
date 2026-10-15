// The front door: sign in first. A returning account gets its fox back; a new
// one meets its fox next (the intro). A mailbox code still opens the door for
// the gift's own link, and the preview can look around without an account.
import { useState } from 'react'
import { signInWithGoogle } from '../account.ts'
import { DEBUG } from '../debug.ts'
import { GIFT } from '../gift.ts'
import { cantReach, framed } from '../preview.ts'
import { runSignIn, type SignInResult } from '../signin.ts'
import { toast } from '../ui/bits.tsx'
import { GoogleLogo } from '../ui/brands.tsx'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { EmailAuth } from './EmailAuth.tsx'

export function Gate({ onCode, onGuest, onSignedIn }: { onCode: () => void; onGuest: () => void; onSignedIn: (r: SignInResult) => void }) {
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
  return (
    <main className="screen onboarding gate">
      <FoxPortrait equipped={{}} hearts className="portrait-xl" />
      <h1 className="title">{GIFT.appName}</h1>
      <p className="muted center">a little fox who helps you focus. sign in and it’s yours, the same on every device.</p>
      <button className="btn btn-big signin" disabled={busy} onClick={signIn}>
        <GoogleLogo /> {busy ? 'signing in…' : 'sign in with Google'}
      </button>
      <p className="or-line">
        <span>or with email</span>
      </p>
      <EmailAuth onDone={onSignedIn} />
      <button className="link" onClick={onCode}>
        i have a mailbox code →
      </button>
      {(framed || DEBUG) && (
        <button className="link" onClick={onGuest}>
          just looking, no account →
        </button>
      )}
    </main>
  )
}
