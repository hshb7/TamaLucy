import { useState } from 'react'
import { GIFT } from '../gift.ts'
import { clearState, freshState } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal } from '../ui/bits.tsx'
import { Header } from './Header.tsx'
import { LockTips } from './Modals.tsx'
import type { Settings } from '../game/state.ts'
import { DEBUG } from '../debug.ts'

function Choice<T extends string | number>({ value, options, onChange, format }: { value: T; options: T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} className={`chip-btn ${value === o ? 'on' : ''}`} onClick={() => onChange(o)}>
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

/** Text field that saves on blur/enter and never saves an empty name. */
function NameField({ label, value, max, onSave }: { label: string; value: string; max: number; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    const v = draft.trim()
    if (v) onSave(v)
    else setDraft(value)
  }
  return (
    <label>
      {label}
      <input
        value={draft}
        maxLength={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const game = useGame()
  const [tips, setTips] = useState(false)
  const [install, setInstall] = useState(false)
  const [reset, setReset] = useState(0)
  const set = (patch: Partial<Settings>) => setGame((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  return (
    <main className="screen">
      <Header title="settings" onBack={onBack} />
      <section className="px-box card form">
        <NameField label="fox’s name" value={game.foxName} max={14} onSave={(v) => setGame((s) => ({ ...s, foxName: v }))} />
        <NameField label="your name" value={game.owner} max={16} onSave={(v) => setGame((s) => ({ ...s, owner: v }))} />
      </section>

      <section className="px-box card">
        <h2>when I leave the app during focus</h2>
        <Choice
          value={game.settings.leaveMode}
          options={['strict', 'gentle']}
          onChange={(v) => set({ leaveMode: v })}
          format={(v) => (v === 'strict' ? 'wake the fox' : 'just pause')}
        />
        <p className="muted">
          {game.settings.leaveMode === 'strict'
            ? `leaving for more than a few seconds ends the session, and ${game.foxName} gets sad.`
            : 'the timer pauses while you are away. no penalty, but no fox-powered willpower either.'}
        </p>
        {game.settings.leaveMode === 'strict' && (
          <>
            <h3>grace period</h3>
            <Choice value={game.settings.graceSeconds} options={[5, 10, 20]} onChange={(v) => set({ graceSeconds: v })} format={(v) => `${v}s`} />
          </>
        )}
        <button className="link" onClick={() => setTips(true)}>
          how to lock your phone to this app →
        </button>
      </section>

      <section className="px-box card">
        <h2>break length</h2>
        <Choice value={game.settings.breakMinutes} options={DEBUG ? [0.2, 3, 5, 10, 15] : [3, 5, 10, 15]} onChange={(v) => set({ breakMinutes: v })} format={(v) => (v < 1 ? `${v * 60}s` : `${v} min`)} />
        <h2>sounds</h2>
        <Choice value={game.settings.sound ? 'on' : 'off'} options={['on', 'off']} onChange={(v) => set({ sound: v === 'on' })} />
      </section>

      <section className="px-box card">
        <button className="link" onClick={() => setInstall(true)}>
          add {GIFT.appName} to your home screen →
        </button>
        <button className="link danger" onClick={() => setReset(1)}>
          start over…
        </button>
      </section>

      <p className="muted center credits">
        made with love{GIFT.from ? ` by ${GIFT.from}` : ''} for {game.owner} ♡
      </p>

      {tips && <LockTips onClose={() => setTips(false)} />}
      {install && (
        <Modal onClose={() => setInstall(false)}>
          <h2>add to home screen</h2>
          <h3>iPhone (Safari)</h3>
          <p>tap the Share button → &ldquo;Add to Home Screen&rdquo;.</p>
          <h3>Android (Chrome)</h3>
          <p>tap ⋮ → &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>
          <p className="muted">it opens full-screen like a real app, works offline, and {game.foxName}&rsquo;s memories stay safe.</p>
          <button className="btn btn-pink" onClick={() => setInstall(false)}>
            okay!
          </button>
        </Modal>
      )}
      {reset > 0 && (
        <Modal onClose={() => setReset(0)}>
          <h2>{reset === 1 ? 'start over?' : 'really really sure?'}</h2>
          <p>this says goodbye to {game.foxName} and erases every letter, postcard and outfit. it can&rsquo;t be undone.</p>
          <div className="row">
            <button className="btn" onClick={() => setReset(0)}>
              no, keep {game.foxName}
            </button>
            <button
              className="btn btn-muted"
              onClick={() => {
                if (reset === 1) return setReset(2)
                clearState()
                setGame(freshState(Date.now()))
                setReset(0)
                onBack()
              }}
            >
              {reset === 1 ? 'yes' : 'erase everything'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
