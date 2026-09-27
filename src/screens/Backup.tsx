import { useEffect, useRef, useState } from 'react'
import { sfx } from '../audio.ts'
import { BackupError, backupSummary, decodeBackup, encodeBackup } from '../game/backup.ts'
import { arrive } from '../game/logic.ts'
import type { GameState } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { dayKey } from '../game/time.ts'
import { formatMinutes } from '../hooks.ts'
import { Modal, toast } from '../ui/bits.tsx'

function ago(t: number) {
  if (!t) return 'never'
  const days = Math.floor((Date.now() - t) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Save a backup code (copy or file) and restore from one. */
export function BackupSection() {
  const game = useGame()
  const [code, setCode] = useState('')
  const [restoring, setRestoring] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let live = true
    void encodeBackup(game).then((c) => live && setCode(c))
    return () => {
      live = false
    }
  }, [game])

  const mark = () => setGame((s) => ({ ...s, lastBackupAt: Date.now() }))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      mark()
      toast('backup code copied. paste it somewhere safe, like Notes ✿')
    } catch {
      box.current?.select()
      toast('select the code below and copy it')
    }
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    a.download = `tamalucy-backup-${dayKey(Date.now())}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    mark()
  }

  return (
    <section className="px-box card">
      <h2>backup</h2>
      <p className="muted">
        {game.foxName} lives on this phone. a backup code lets you bring {game.foxName} back if you delete the app or switch phones. last backup: {ago(game.lastBackupAt)}.
      </p>
      <textarea id="backup-code" ref={box} className="backup-code" readOnly value={code} rows={2} onFocus={(e) => e.currentTarget.select()} aria-label="backup code" />
      <div className="row">
        <button className="btn" onClick={copy} disabled={!code}>
          copy code
        </button>
        <button className="btn" onClick={download} disabled={!code}>
          save as file
        </button>
      </div>
      <button className="link" onClick={() => setRestoring(true)}>
        restore from a backup →
      </button>
      {restoring && <RestoreModal onClose={() => setRestoring(false)} />}
    </section>
  )
}

function RestoreModal({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [found, setFound] = useState<GameState | null>(null)

  const check = async (raw: string) => {
    setError('')
    try {
      setFound(await decodeBackup(raw, Date.now()))
    } catch (e) {
      setFound(null)
      setError(e instanceof BackupError ? e.message : 'something went wrong reading that backup.')
    }
  }

  if (found) {
    const b = backupSummary(found)
    return (
      <Modal onClose={onClose}>
        <h2>restore {b.fox}?</h2>
        <p>
          this backup has {b.fox} with {formatMinutes(b.minutes)} of focus and {b.notes} letters. it will replace {game.foxName} on this phone.
        </p>
        <div className="row">
          <button className="btn" onClick={onClose}>
            cancel
          </button>
          <button
            className="btn btn-pink"
            onClick={() => {
              setGame(arrive(found, Date.now()))
              sfx.fanfare()
              toast(`welcome back, ${found.foxName}!`)
              onClose()
            }}
          >
            restore
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose}>
      <h2>restore from a backup</h2>
      <label htmlFor="restore-code">paste a backup code</label>
      <textarea id="restore-code" className="backup-code" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="TAMALUCY1z:…" />
      <label className="file-btn btn">
        or choose a backup file
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await check(await file.text())
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" onClick={onClose}>
          cancel
        </button>
        <button className="btn btn-pink" disabled={!text.trim()} onClick={() => check(text)}>
          check backup
        </button>
      </div>
    </Modal>
  )
}

