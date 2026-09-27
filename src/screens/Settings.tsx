import { useState } from 'react'
import { GIFT } from '../gift.ts'
import { clearState, freshState } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal } from '../ui/bits.tsx'
import { Header } from './Header.tsx'
import { LockTips } from './Modals.tsx'
import type { Settings } from '../game/state.ts'
import { DEBUG } from '../debug.ts'
import { BackupSection } from './Backup.tsx'
import { MailboxSection } from './Mailbox.tsx'
import { resetSync } from '../sync.ts'

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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function BirthdayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [m, d] = value ? value.split('-') : ['', '']
  const update = (mm: string, dd: string) => onChange(mm && dd ? `${mm}-${dd}` : '')
  return (
    <div className="birthday">
      <select id="bday-month" aria-label="birth month" value={m} onChange={(e) => update(e.target.value, d || '01')}>
        <option value="">month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, '0')}>
            {name}
          </option>
        ))}
      </select>
      <select id="bday-day" aria-label="birth day" value={d} onChange={(e) => update(m || '01', e.target.value)}>
        <option value="">day</option>
        {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((dd) => (
          <option key={dd} value={dd}>
            {Number(dd)}
          </option>
        ))}
      </select>
    </div>
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
        <h2>how much looking after {game.foxName} needs</h2>
        <Choice
          value={game.settings.care}
          options={['classic', 'gentle', 'paused']}
          onChange={(v) => set({ care: v, careBefore: v === 'paused' ? (game.settings.care === 'paused' ? game.settings.careBefore : game.settings.care) : undefined })}
          format={(v) => (v === 'classic' ? 'classic' : v === 'gentle' ? 'gentle' : 'exam week')}
        />
        <p className="muted">
          {game.settings.care === 'classic'
            ? `a real little pet: ${game.foxName} gets sad after a couple of days alone, and depressed after three.`
            : game.settings.care === 'gentle'
              ? `needs drain more slowly, and ${game.foxName} never gets more than a little sad.`
              : `everything is paused. ${game.foxName} won’t get hungry or lonely until you turn this off.`}
        </p>
      </section>

      <section className="px-box card">
        <h2>your birthday</h2>
        <BirthdayField value={game.birthday} onChange={(v) => setGame((s) => ({ ...s, birthday: v }))} />
        <p className="muted">{game.foxName} has a little something planned for the day. (no peeking.)</p>
      </section>

      <section className="px-box card">
        <h2>when I leave the app during focus</h2>
        <Choice
          value={game.settings.leaveMode}
          options={['strict', 'gentle', 'free']}
          onChange={(v) => set({ leaveMode: v })}
          format={(v) => (v === 'strict' ? 'end the session' : v === 'gentle' ? 'just pause' : 'keep going')}
        />
        <p className="muted">
          {game.settings.leaveMode === 'strict'
            ? `leaving for more than a few seconds ends the session, and ${game.foxName} gets sad. best on your phone.`
            : game.settings.leaveMode === 'free'
              ? `the timer keeps running while you study in other apps, and ${game.foxName} lets you know when it’s done. best on your Mac.`
              : 'the timer pauses while you are away. no penalty, but no fox-powered willpower either.'}
        </p>
        <p className="muted">this is set separately on each device.</p>
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

      <MailboxSection />

      <BackupSection />

      <section className="px-box card">
        <button className="link" onClick={() => setInstall(true)}>
          install {GIFT.appName} on your iPhone or Mac →
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
          <h2>install {GIFT.appName}</h2>
          <h3>iPhone (Safari)</h3>
          <p>tap the Share button → &ldquo;Add to Home Screen&rdquo;.</p>
          <h3>Mac (Safari)</h3>
          <p>
            File → &ldquo;Add to Dock…&rdquo;. it gets its own window and Dock icon, and {game.foxName} can tap you on the shoulder when a
            focus session ends.
          </p>
          <h3>Chrome</h3>
          <p>click the install icon at the right of the address bar (on a phone: ⋮ → &ldquo;Add to Home screen&rdquo;).</p>
          <p className="muted">
            it opens like a real app and works offline. connect your mailbox code on each device (settings → mailbox &amp; sync) and
            it&rsquo;s the same {game.foxName} on all of them.
          </p>
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
                resetSync()
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
