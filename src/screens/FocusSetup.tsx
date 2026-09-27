import { useState } from 'react'
import { ICON_ART } from '../art/items.ts'
import { sfx } from '../audio.ts'
import { acornsFor, startFocus } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { Modal } from '../ui/bits.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { DEBUG } from '../debug.ts'
import { GIFT } from '../gift.ts'

const PRESETS = [10, 15, 25, 45, 60]

export function FocusSetup({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [minutes, setMinutes] = useState(game.settings.focusMinutes)
  const [label, setLabel] = useState('')
  const f = game.foxName
  const strict = game.settings.leaveMode === 'strict'

  const start = () => {
    sfx.start()
    setGame((s) => startFocus(s, Date.now(), minutes, label))
    onClose()
  }

  return (
    <Modal onClose={onClose} className="sheet">
      <h2>how long shall we focus?</h2>
      <div className="chips">
        {DEBUG && (
          <button className={`chip-btn ${minutes === 0.1 ? 'on' : ''}`} onClick={() => setMinutes(0.1)}>
            6s
          </button>
        )}
        {PRESETS.map((m) => (
          <button key={m} className={`chip-btn ${minutes === m ? 'on' : ''}`} onClick={() => setMinutes(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="stepper">
        <button className="btn btn-small" onClick={() => setMinutes((m) => Math.max(5, Math.round(m) - 5))} aria-label="5 minutes less">
          −
        </button>
        <span className="stepper-value">
          {minutes < 1 ? minutes * 60 + 's' : `${minutes} min`}
        </span>
        <button className="btn btn-small" onClick={() => setMinutes((m) => Math.min(180, Math.round(m) + 5))} aria-label="5 minutes more">
          +
        </button>
      </div>
      <div className="field">
        <label htmlFor="focus-label">
          what are you working on? <span className="muted">(optional)</span>
        </label>
        <div className="subject-chips">
          {GIFT.subjects.map((sub) => (
            <button key={sub} className={`subject-chip ${label === sub ? 'on' : ''}`} onClick={() => setLabel(label === sub ? '' : sub)}>
              {sub}
            </button>
          ))}
        </div>
        <input id="focus-label" value={label} maxLength={40} placeholder="or type anything, e.g. Torts outline" onChange={(e) => setLabel(e.target.value)} />
      </div>
      <p className="hint">
        <PixelIcon sprite={ICON_ART.heart} scale={2} />
        {strict
          ? `stay in the app! leaving for more than ${game.settings.graceSeconds}s distracts ${f}, and the session won’t count.`
          : `leaving the app pauses the timer until you come back.`}
      </p>
      <p className="hint">
        <PixelIcon sprite={ICON_ART.acorn} scale={2} />
        earns {acornsFor(minutes)} acorn{acornsFor(minutes) === 1 ? '' : 's'} for looking after {f}
      </p>
      <p className="hint">
        <PixelIcon sprite={ICON_ART.gift} scale={2} />
        {minutes >= 45 ? 'long session: you’ll get 2 rewards!' : minutes >= 15 ? 'pick from 3 rewards · 45+ min = 2 rewards' : 'short session: pick from 2 · 15+ min = 3'}
      </p>
      <button className="btn btn-big btn-pink" onClick={start}>
        <PixelIcon sprite={ICON_ART.acorn} scale={3} /> start focusing
      </button>
    </Modal>
  )
}
