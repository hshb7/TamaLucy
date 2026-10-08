import { useState } from 'react'
import { sfx } from '../audio.ts'
import { GENERAL_RANKS, LAW_RANKS, RUNGS } from '../game/career.ts'
import { STUDY_PRESETS, cleanRungs, setRungs } from '../game/studySetup.ts'
import type { Track } from '../game/state.ts'
import { setGame, useGame } from '../game/store.ts'
import { formatMinutes } from '../hooks.ts'
import { Modal } from '../ui/bits.tsx'

/** Eleven inputs, one per rung, with the hours each takes. */
export function RungsFields({ value, onChange, track }: { value: string[]; onChange: (rungs: string[]) => void; track: Track }) {
  const base = track === 'law' ? LAW_RANKS : GENERAL_RANKS
  return (
    <ol className="rungs">
      {Array.from({ length: RUNGS }, (_, i) => (
        <li key={i}>
          <small>{i === 0 ? 'start' : formatMinutes(base[i].min)}</small>
          <input
            value={value[i] ?? ''}
            maxLength={24}
            placeholder={base[i].title}
            aria-label={`rung ${i + 1}`}
            onChange={(e) => onChange(value.map((r, j) => (j === i ? e.target.value : r)))}
          />
        </li>
      ))}
    </ol>
  )
}

/** Rename the rungs of the fox's career, or start again from one of the ladders. */
export function RungsEditor({ onClose }: { onClose: () => void }) {
  const game = useGame()
  const [rungs, setLocal] = useState<string[]>(() => cleanRungs(game.study.rungs, game.study.track))
  return (
    <Modal onClose={onClose} className="sheet">
      <h2>{game.foxName}&rsquo;s ladder</h2>
      <p className="muted">every hour you focus moves {game.foxName} up a rung. call the rungs whatever fits what you&rsquo;re studying.</p>
      <div className="field">
        <span>start from</span>
        <div className="chips chips-left">
          {STUDY_PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip-btn" onClick={() => setLocal([...p.rungs])}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <RungsFields value={rungs} onChange={setLocal} track={game.study.track} />
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>
          cancel
        </button>
        <button
          type="button"
          className="btn btn-pink"
          onClick={() => {
            setGame((s) => setRungs(s, rungs))
            sfx.sparkle()
            onClose()
          }}
        >
          save the ladder
        </button>
      </div>
    </Modal>
  )
}
