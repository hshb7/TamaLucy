// "Sign out": a real button, wherever it sits (the account card, the Mac
// sidebar). It asks once, saves the fox to the cloud, and leaves the device
// as blank as a new one, first screen and all.
import { useState } from 'react'
import { signOutDevice } from '../account.ts'
import { useGame } from '../game/store.ts'
import { Modal, toast } from '../ui/bits.tsx'

export function SignOutButton({ className = 'btn', label = 'sign out' }: { className?: string; label?: string }) {
  const game = useGame()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await signOutDevice()
      toast('signed out. see you soon ♡')
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }
  return (
    <>
      <button className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
      {asking && (
        <Modal onClose={() => !busy && setAsking(false)} className="sheet">
          <h2>sign out?</h2>
          <p className="muted center">
            {game.foxName} is saved in the cloud and comes back the moment you sign in again, here or anywhere. this device goes back to the first screen.
          </p>
          <button className="btn btn-big btn-pink" disabled={busy} onClick={go}>
            {busy ? 'saving…' : 'yes, sign out'}
          </button>
          <button className="btn" disabled={busy} onClick={() => setAsking(false)}>
            never mind
          </button>
        </Modal>
      )}
    </>
  )
}
