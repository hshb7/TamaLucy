import { useEffect, useRef, useState } from 'react'
import type { Painter } from '../art/painter.ts'
import { ellipse } from '../art/painter.ts'
import { giveUp } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatClock, useNow, useWakeLock } from '../hooks.ts'
import { isNativeApp } from '../native.ts'
import { Modal } from '../ui/bits.tsx'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'
import { drawFox, spawn, stepParticles, type Particle } from '../ui/foxDraw.ts'
import { ROOM_ART, SPECIAL_ART, TREAT_ART } from '../art/items.ts'
import { startAmbient, stopAmbient, type AmbientKind } from '../audio.ts'
import { LockTips } from './Modals.tsx'

const W = 96
const H = 58
const SOUNDS: [AmbientKind, string][] = [
  ['off', 'quiet'],
  ['rain', 'rain'],
  ['fire', 'fireplace'],
  ['hum', 'library'],
]

export function FocusScreen() {
  const game = useGame()
  const now = useNow(250)
  // the countdown in the window title, handy on a Mac while she works in other apps
  useEffect(() => {
    const before = document.title
    return () => {
      document.title = before
    }
  }, [])
  const [confirm, setConfirm] = useState(false)
  const [tips, setTips] = useState(false)
  const parts = useRef<Particle[]>([])
  const lastSpark = useRef(0)
  const wake = useWakeLock(true)

  // background sound for the session
  const ambient = game.settings.ambient
  useEffect(() => {
    startAmbient(ambient)
  }, [ambient])
  useEffect(() => () => stopAmbient(), [])

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
    // a cozy night-time study corner
    p.rect(0, 0, W, H, '#35294a')
    for (let x = 4; x < W; x += 12) p.rect(x, 0, 1, 50, '#3b2e52')
    p.rect(0, 50, W, H - 50, '#47385c')
    p.rect(0, 50, W, 1, '#2a2039')
    // window with stars
    p.rect(6, 6, 20, 16, '#1c1f4a')
    for (const [sx, sy, i] of [[9, 9, 0], [21, 11, 1], [13, 17, 2], [23, 18, 3], [10, 14, 4]])
      if (Math.sin(t / 500 + i * 2) > -0.4) p.rect(sx, sy, 1, 1, '#fff6d8')
    p.rect(18, 8, 3, 3, '#fff4c9')
    p.rect(5, 5, 22, 1, '#6a5a80')
    p.rect(5, 22, 22, 1, '#6a5a80')
    p.rect(5, 5, 1, 18, '#6a5a80')
    p.rect(26, 5, 1, 18, '#6a5a80')
    p.rect(15, 6, 1, 16, '#6a5a80')
    // the fox, behind its desk, in study glasses
    const reading = Math.floor(t / 3200) % 5
    const face = reading === 4 ? 'happy' : t % 4000 < 150 ? 'blink' : 'open'
    const equipped = { ...game.equipped, face: game.equipped.face ?? 'roundGlasses' }
    drawFox(p, 32, 13 + (Math.floor(t / 1800) % 2), { pose: 'sit', face, tail: Math.floor(t / 1400) % 2, equipped })
    // desk
    p.rect(14, 38, 70, 3, '#b08361')
    p.rect(14, 41, 70, 2, '#7b523d')
    p.rect(13, 37, 72, 1, '#4a2a22')
    p.rect(16, 43, 66, 9, '#7b523d')
    p.rect(16, 43, 66, 1, '#553628')
    for (const dx of [20, 58]) {
      p.rect(dx, 45, 18, 5, '#8a5e45')
      p.rect(dx + 8, 47, 3, 1, '#e5ab3d')
    }
    // cocoa, open casebook (pages turn now and then), banker's lamp
    p.sprite(TREAT_ART.cocoa, 16, 26)
    p.sprite(SPECIAL_ART.openBook, 42, 32)
    if (reading === 2 && t % 3200 < 500) p.rect(48, 32, 1, 5, '#fff4e3')
    const flick = Math.sin(t / 900)
    ellipse(p, 72, 34, 20 + Math.round(flick), 13, '#ffe3a0', 0.1)
    ellipse(p, 72, 34, 10, 7, '#fff0c0', 0.12)
    p.sprite(ROOM_ART.lamp, 66, 27)
    if (reading === 3 && t - lastSpark.current > 900) {
      lastSpark.current = t
      spawn(parts.current, 'spark', 40 + Math.random() * 16, 14, t)
    }
    stepParticles(p, parts.current, t)
  }

  const title = `${formatClock(left)} · ${f}`
  useEffect(() => {
    document.title = title
  }, [title])
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
      <PixelCanvas w={W} h={H} draw={draw} className="focus-scene" label={`${f} studying with you`} />
      <div className="sound-chips" role="group" aria-label="background sound">
        {SOUNDS.map(([id, name]) => (
          <button
            key={id}
            className={`sound-chip ${ambient === id ? 'on' : ''}`}
            aria-pressed={ambient === id}
            onClick={() => setGame((s) => ({ ...s, settings: { ...s.settings, ambient: id } }))}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="focus-note">
        {f} is studying right alongside you.
        <br />
        {game.settings.leaveMode === 'strict'
          ? `leaving the app for more than ${game.settings.graceSeconds}s will distract ${f}!`
          : game.settings.leaveMode === 'free'
            ? isNativeApp
              ? `your distracting apps are locked till then. ${f} will call you when time’s up.`
              : `go study in any app. ${f} will call you when time’s up.`
            : `leaving the app pauses the timer.`}
      </p>
      {wake === 'unavailable' && game.settings.leaveMode === 'strict' && (
        <p className="focus-warn">
          heads up: this phone might auto-lock, and locking counts as leaving. set Auto-Lock to &ldquo;Never&rdquo; while you focus, or
          switch to &ldquo;just pause&rdquo; in settings.
        </p>
      )}
      <div className="focus-actions">
        {game.settings.leaveMode !== 'free' && (
          <button className="link" onClick={() => setTips(true)}>
            lock my phone for real
          </button>
        )}
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
