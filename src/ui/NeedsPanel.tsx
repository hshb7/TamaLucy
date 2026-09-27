import { ICON_ART, NEED_ICON_ART, TREAT_ART } from '../art/items.ts'
import { NEEDS, NEED_INFO } from '../game/needs.ts'
import type { GameState } from '../game/state.ts'
import { PixelIcon } from './PixelIcon.tsx'

const ICONS = { onigiri: TREAT_ART.onigiri, moon: NEED_ICON_ART.moon, ball: NEED_ICON_ART.ball, bubbles: NEED_ICON_ART.bubbles, heart: ICON_ART.heart }

/** Five little need bars, green when fine and red when it needs you. */
export function NeedsPanel({ game }: { game: GameState }) {
  return (
    <div className="needs" aria-label="needs">
      {NEEDS.map((k) => {
        const v = game.needs[k]
        const tone = v >= 60 ? 'good' : v >= 30 ? 'meh' : 'bad'
        return (
          <div key={k} className="need" role="meter" aria-label={NEED_INFO[k].label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} title={NEED_INFO[k].label}>
            <PixelIcon sprite={ICONS[NEED_INFO[k].icon as keyof typeof ICONS]} scale={2} />
            <div className={`need-bar ${tone}`}>
              <span style={{ width: `${Math.max(4, v)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
