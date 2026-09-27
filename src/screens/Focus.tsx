import { useEffect, useRef, useState } from 'react'
import type { Painter } from '../art/painter.ts'
import { ellipse } from '../art/painter.ts'
import { giveUp } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatClock, useNow, useWakeLock } from '../hooks.ts'
import { Modal } from '../ui/bits.tsx'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'
import { drawFox, spawn, stepParticles, type Particle } from '../ui/foxDraw.ts'
import { LockTips } from './Modals.tsx'

const W = 96
const H = 58

export function FocusScreen() {
  const game = useGame()
  const now = useNow(250)
  const [confirm, setConfirm] = useState(false)
  const [tips, setTips] = useState(false)
  const parts = useRef<Particle[]>([])
  const lastZ = useRef(0)
  const wake = useWakeLock(true)

  // darker status bar while in night-light mode
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content')
    meta?.setAttribute('content', '#2c2340')
    return () => {
      if (prev) meta?.setAttribute('content', prev)
    }
  }, [])

  const ses = game.session!
  const left = Math.max(0, ses.endsAt - now)
  const progress = 1 - left / (ses.endsAt - ses.startedAt)
  const f = game.foxName

  const draw = (p: Painter, t: number) => {
    // cozy night-light corner
    p.rect(0, 0, W, H, '#35294a')
    for (let x = 4; x < W; x += 12) p.rect(x, 0, 1, 42, '#3b2e52')
    p.rect(0, 42, W, H - 42, '#47385c')
    p.rect(0, 42, W, 1, '#2a2039')
    // window with stars
    p.rect(8, 8, 22, 18, '#1c1f4a')
    for (const [sx, sy, i] of [[11, 11, 0], [24, 13, 1], [16, 20, 2], [27, 21, 3], [13, 16, 4]])
      if (Math.sin(t / 500 + i * 2) > -0.4) p.rect(sx, sy, 1, 1, '#fff6d8')
    p.rect(20, 10, 3, 3, '#fff4c9')
    p.rect(7, 7, 24, 1, '#6a5a80')
    p.rect(7, 26, 24, 1, '#6a5a80')
    p.rect(7, 7, 1, 20, '#6a5a80')
    p.rect(30, 7, 1, 20, '#6a5a80')
    p.rect(18, 8, 1, 18, '#6a5a80')
    // candle glow
    const flick = Math.sin(t / 90) + Math.sin(t / 37)
    ellipse(p, 80, 30, 18 + Math.round(flick), 14, '#ffcf8a', 0.08)
    ellipse(p, 80, 30, 10, 8, '#ffdca0', 0.1)
    p.rect(76, 38, 9, 6, '#7b523d')
    p.rect(78, 30, 5, 8, '#fff4e3')
    p.rect(78, 30, 1, 8, '#efd9bd')
    p.rect(80, 26 - (flick > 1 ? 1 : 0), 1, 4, '#ffd76e')
    p.rect(79, 28, 3, 2, '#ffb27f')
    // cushion + sleeping fox
    ellipse(p, 46, 50, 24, 5, '#9a7cc4')
    ellipse(p, 46, 49, 22, 4, '#cbb0ea')
    drawFox(p, 26, 30, { pose: 'curl', face: 'sleep', tail: 0, breath: Math.floor(t / 1600) % 2, equipped: game.equipped })
    if (t - lastZ.current > 1500) {
      lastZ.current = t
      spawn(parts.current, 'z', 34, 30, t)
    }
    stepParticles(p, parts.current, t)
  }

  const segs = 20
  const on = Math.floor(progress * segs)

  return (
    <main className="screen focus">
      <p className="focus-label">{ses.label ? <>working on: {ses.label}</> : <>focus time ✿</>}</p>
      <div className="timer" role="timer" aria-live="off">
        {formatClock(left)}
      </div>
      <div className="progress" aria-label={`${Math.round(progress * 100)}% done`}>
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className={i < on ? 'on' : ''} />
        ))}
      </div>
      <PixelCanvas w={W} h={H} draw={draw} className="focus-scene" label={`${f} napping while you focus`} />
      <p className="focus-note">
        shh... {f} is napping while you work.
        <br />
        {game.settings.leaveMode === 'strict'
          ? `leaving the app for more than ${game.settings.graceSeconds}s will wake ${f} up!`
          : `leaving the app pauses the timer.`}
      </p>
      {wake === 'unavailable' && game.settings.leaveMode === 'strict' && (
        <p className="focus-warn">
          heads up: this phone might auto-lock, and locking counts as leaving. set Auto-Lock to &ldquo;Never&rdquo; while you focus, or
          switch to &ldquo;just pause&rdquo; in settings.
        </p>
      )}
      <div className="focus-actions">
        <button className="link" onClick={() => setTips(true)}>
          lock my phone for real
        </button>
        <button className="link" onClick={() => setConfirm(true)}>
          give up
        </button>
      </div>
      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <h2>give up?</h2>
          <p>{f} will be a little disappointed, and this session won&rsquo;t earn a reward.</p>
          <div className="row">
            <button className="btn" onClick={() => setConfirm(false)}>
              keep going!
            </button>
            <button className="btn btn-muted" onClick={() => setGame((s) => giveUp(s))}>
              give up
            </button>
          </div>
        </Modal>
      )}
      {tips && <LockTips onClose={() => setTips(false)} />}
    </main>
  )
}
