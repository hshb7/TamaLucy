import { FOX_SPOT, FLOORS, ROOM_H, ROOM_W, WALLPAPERS, drawAtmosphere, drawRoom, drawWallAndFloor } from '../art/room.ts'
import type { Painter } from '../art/painter.ts'
import { sfx } from '../audio.ts'
import { CAREER, unlockRank, unlocked } from '../game/career.ts'
import { setDecor } from '../game/logic.ts'
import { setGame, useGame } from '../game/store.ts'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'
import { drawFox, idleFace, idleTail } from '../ui/foxDraw.ts'
import { Header } from './Header.tsx'

const crop = (p: Painter, dx: number, dy: number): Painter => ({
  rect: (x, y, w, h, c, a) => p.rect(x - dx, y - dy, w, h, c, a),
  sprite: (s, x, y, a) => p.sprite(s, x - dx, y - dy, a),
})

function Swatch({ wall, floor }: { wall: string; floor: string }) {
  const isWall = wall !== ''
  return (
    <PixelCanvas
      w={24}
      h={16}
      fps={1}
      className="swatch"
      draw={(p) => drawWallAndFloor(crop(p, 0, isWall ? 10 : 74), { wall: wall || 'stripes', floor: floor || 'honey' })}
    />
  )
}

export function DecorScreen({ onBack }: { onBack: () => void }) {
  const game = useGame()
  const walls = unlocked(game.stats.totalMinutes, 'wall')
  const floors = unlocked(game.stats.totalMinutes, 'floor')

  const preview = (p: Painter, t: number) => {
    const d = new Date()
    const opts = { hour: d.getHours() + d.getMinutes() / 60, gifts: game.gifts, t, gloom: 0, decor: game.decor, law: unlocked(game.stats.totalMinutes, 'law'), bowl: game.bowl }
    drawRoom(p, opts)
    drawFox(p, FOX_SPOT.x, FOX_SPOT.y, { pose: 'sit', face: idleFace(t), tail: idleTail(t), equipped: game.equipped })
    drawAtmosphere(p, opts)
  }

  const lock = (kind: 'wall' | 'floor', id: string) => {
    const r = unlockRank(kind, id)
    return r >= 0 ? `at ${CAREER[r].short}` : ''
  }

  return (
    <main className="screen">
      <Header title="decor" onBack={onBack} />
      <div className="room decor-preview">
        <PixelCanvas w={ROOM_W} h={ROOM_H} draw={preview} fps={8} label="room preview" />
      </div>
      <p className="muted center">more wallpapers and floors unlock as {game.foxName}&rsquo;s law career grows</p>
      {(
        [
          ['wallpaper', 'wall', WALLPAPERS, walls],
          ['floor', 'floor', FLOORS, floors],
        ] as const
      ).map(([title, kind, all, open]) => (
        <section key={kind}>
          <h2 className="section-title">{title}</h2>
          <div className="grid">
            {Object.entries(all).map(([id, item]) => {
              const ok = open.includes(id)
              const on = game.decor[kind] === id
              return (
                <button
                  key={id}
                  className={`tile px-box ${on ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  aria-pressed={on}
                  onClick={() => {
                    sfx.tap()
                    setGame((s) => setDecor(s, { [kind]: id }))
                  }}
                >
                  <Swatch wall={kind === 'wall' ? id : ''} floor={kind === 'floor' ? id : ''} />
                  <span>{item.name}</span>
                  {!ok && <small>unlocks {lock(kind, id)}</small>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
