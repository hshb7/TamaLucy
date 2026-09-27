import { CLOTHING_ART } from '../art/clothes.ts'
import { sfx } from '../audio.ts'
import { CLOTHES } from '../game/content.ts'
import { toggleWear } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { Header } from './Header.tsx'

const SLOTS = [
  ['head', 'hats'],
  ['face', 'glasses'],
  ['neck', 'neckwear'],
] as const

export function Wardrobe({ onBack }: { onBack: () => void }) {
  const game = useGame()
  return (
    <main className="screen">
      <Header title="closet" onBack={onBack} />
      <FoxPortrait equipped={game.equipped} className="portrait-l" hearts={Object.keys(game.equipped).length > 0} />
      <p className="muted center">
        {game.wardrobe.length}/{CLOTHES.length} collected · tap to wear or take off
      </p>
      {SLOTS.map(([slot, title]) => (
        <section key={slot}>
          <h2 className="section-title">{title}</h2>
          <div className="grid">
            {CLOTHES.filter((c) => c.slot === slot).map((c) => {
              const owned = game.wardrobe.includes(c.id)
              const on = game.equipped[slot] === c.id
              return (
                <button
                  key={c.id}
                  className={`tile px-box ${on ? 'on' : ''} ${owned ? '' : 'locked'}`}
                  disabled={!owned}
                  onClick={() => {
                    sfx.tap()
                    setGame((s) => toggleWear(s, c.id))
                  }}
                  aria-pressed={on}
                >
                  <PixelIcon sprite={CLOTHING_ART[c.id].sprite} scale={3} className={owned ? '' : 'silhouette'} />
                  <span>{owned ? c.name : '???'}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
