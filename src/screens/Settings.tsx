import { useEffect, useState } from 'react'
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
import { isNativeApp, native, nativePlatform, type BlockingStatus } from '../native.ts'
import { toast } from '../ui/bits.tsx'
import { DECKS, toggleDeck } from '../game/decks.ts'
import { setStudy } from '../game/studySetup.ts'
import { shelvesOf } from '../game/shelf.ts'
import { ShelvesEditor } from './Bookshelf.tsx'

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

/** What she's studying: the fox's career track, the shelves, the built-in quiz decks. Nothing here is assumed. */
function StudiesSection() {
  const game = useGame()
  const [shelves, setShelves] = useState(false)
  const [program, setProgram] = useState(game.study.program)
  const f = game.foxName
  // a deck made for one track is only offered on that track (or if she already has it on)
  const offered = DECKS.filter((d) => !d.track || d.track === game.study.track || game.study.decks.includes(d.id))
  return (
    <section className={`px-box card ${game.study.asked ? '' : 'nudge-card'}`} id="my-studies">
      <h2>my studies</h2>
      <label>
        what are you studying?
        <input
          value={program}
          maxLength={30}
          placeholder="e.g. law school, nursing, the CPA"
          onChange={(e) => setProgram(e.target.value)}
          onBlur={() => setGame((s) => setStudy(s, { program }))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <h3>{f}&rsquo;s career</h3>
      <Choice value={game.study.track} options={['general', 'law']} onChange={(v) => setGame((s) => setStudy(s, { track: v }))} format={(v) => (v === 'law' ? 'law: 1L to the Supreme Court' : 'school: freshman to dean')} />
      <p className="muted">
        {game.study.track === 'law' ? `${f} climbs the law ladder, tells law jokes and visits the law library.` : `${f} climbs from freshman to dean. same hours, same prizes, no law jokes.`}
      </p>
      <h3>the bookshelf</h3>
      <p className="muted">
        {shelvesOf(game)
          .map((sh) => sh.name)
          .join(' · ')}
      </p>
      <button className="btn btn-small" onClick={() => setShelves(true)}>
        rename or rearrange the shelves
      </button>
      <h3>quiz decks</h3>
      {offered.length ? (
        <p className="muted">your own flashcards always come first. these are extras {f} can quiz you on, if they fit.</p>
      ) : (
        <p className="muted">your own flashcards are the quiz. there are no extra decks for your track yet.</p>
      )}
      {offered.map((d) => {
        const on = game.study.decks.includes(d.id)
        return (
          <label key={d.id} className="check">
            <input type="checkbox" checked={on} onChange={() => setGame((s) => toggleDeck(s, d.id))} />
            <span>
              {d.name} <small className="muted">· {d.cards.length} cards · {d.blurb}</small>
            </span>
          </label>
        )
      })}
      {shelves && <ShelvesEditor onClose={() => setShelves(false)} />}
    </section>
  )
}

/** Native apps only: on the iPhone, Screen Time locks her distracting apps; on the Mac, the fox pops up over them. */
function BlockingSection() {
  const game = useGame()
  const [status, setStatus] = useState<BlockingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void native.blockingStatus().then(setStatus)
  }, [])
  if (!status?.available) return null
  const f = game.foxName
  const mac = nativePlatform === 'mac'
  const n = status.count
  const choose = async () => {
    setBusy(true)
    const next = await native.chooseBlockedApps()
    setStatus(next)
    setBusy(false)
    if (next.count > 0) {
      // the chosen apps are the rule now, so other apps (notes, readings) are fine
      setGame((s) => ({ ...s, settings: { ...s.settings, leaveMode: 'free' } }))
      toast(mac ? `got it! ${f} will keep an eye out for those ✿` : `got it! those stay locked while you and ${f} focus ✿`)
    }
  }
  return (
    <section className="px-box card">
      <h2>{mac ? 'distracting apps' : 'block distracting apps'}</h2>
      <p className="muted">
        {mac
          ? n > 0
            ? `${n} app${n === 1 ? '' : 's'} to watch during focus. opening one brings up ${f}: back to studying, or “use it anyway”, which ends the session.`
            : `pick the apps that pull you away (messages, games...). during focus, opening one brings up ${f}. everything else, like Word and your readings, works as usual.`
          : n > 0
            ? `${n} app${n === 1 ? '' : 's'} and site${n === 1 ? '' : 's'} are locked during focus. opening one shows ${f}; “use it anyway” ends the session.`
            : `pick the apps that pull you away (instagram, tiktok...). during focus they show ${f} instead, and anything else, like your readings, still works.`}
      </p>
      <button className="btn" disabled={busy} onClick={choose}>
        {busy ? (mac ? 'choosing…' : 'opening Screen Time…') : n > 0 ? (mac ? 'choose again' : 'change blocked apps') : mac ? 'choose apps' : 'choose apps to block'}
      </button>
      <p className="muted">
        {mac
          ? 'it stays on this Mac: the app only notices the apps you pick, and only during focus.'
          : 'uses Apple’s Screen Time. it stays on this phone: the app never sees which apps you use.'}
      </p>
    </section>
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

export function SettingsScreen({ onBack, onWidget }: { onBack: () => void; onWidget: () => void }) {
  const game = useGame()
  const [tips, setTips] = useState(false)
  const [install, setInstall] = useState(false)
  const [reset, setReset] = useState(0)
  const set = (patch: Partial<Settings>) => setGame((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  return (
    <main className="screen settings">
      <Header title="settings" onBack={onBack} />
      {/* two columns of cards on a wide screen */}
      <div className="settings-cards">
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

        <StudiesSection />

        <section className="px-box card">
          <h2>your widget</h2>
          <p className="muted">
            {game.foxName} on your iPhone home screen (and in the Dynamic Island while you focus), in your colours, saying what you want.
          </p>
          <button className="btn" onClick={onWidget}>
            style your widget ✿
          </button>
        </section>

        <section className="px-box card">
          <h2>your birthday</h2>
          <BirthdayField value={game.birthday} onChange={(v) => setGame((s) => ({ ...s, birthday: v }))} />
          <p className="muted">{game.foxName} has a little something planned for the day. (no peeking.)</p>
        </section>

        {isNativeApp && <BlockingSection />}

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
      </div>

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
