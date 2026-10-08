import { useState } from 'react'
import { FOX_SPOT, FLOORS, ROOM_H, ROOM_W, WALLPAPERS, drawAtmosphere, drawRoom, drawWallAndFloor } from '../art/room.ts'
import type { Painter } from '../art/painter.ts'
import { sfx } from '../audio.ts'
import { ladder, unlockRank, unlocked } from '../game/career.ts'
import { setDecor } from '../game/logic.ts'
import { isOctober, seasonOf } from '../game/time.ts'
import { setGame, useGame } from '../game/store.ts'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'
import { drawFox, idleFace, idleTail } from '../ui/foxDraw.ts'
import { Header } from './Header.tsx'
import { photoSprite } from '../art/photo.ts'
import { placeBooks } from '../art/bookcase.ts'
import { shelfBooks, shelfTags } from '../game/shelf.ts'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import { NEED_ICON_ART } from '../art/items.ts'
import { pixelatePhoto } from '../ui/photo.ts'
import { toast } from '../ui/bits.tsx'
function PhotoSection() {
  const game = useGame()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const photo = await pixelatePhoto(file)
      setGame((s) => ({ ...s, photo }))
      sfx.sparkle()
      toast(`${game.foxName} hung it up in the study corner ✿`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'that photo didn’t work. try another one.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="px-box card photo-card">
      <h2>a photo on the wall</h2>
      <div className="photo-row">
        {game.photo ? (
          <div className="photo-frame">
            <PixelIcon sprite={photoSprite(game.photo)} scale={5} alt="your photo, pixelated" />
          </div>
        ) : (
          <div className="photo-frame empty-frame" aria-hidden />
        )}
        <div className="photo-actions">
          <p className="muted">pick any photo (friends, a pet, a favourite place) and it becomes pixel art in the study corner. only the pixel version is kept.</p>
          <label className={`btn file-btn ${busy ? 'busy' : ''}`}>
            {busy ? 'pixelating…' : game.photo ? 'change photo' : 'add a photo'}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {game.photo && (
            <button className="link" onClick={() => setGame((s) => ({ ...s, photo: null }))}>
              take it down
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </section>
  )
}

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

export function DecorScreen({ onBack, onWidget }: { onBack: () => void; onWidget: () => void }) {
  const game = useGame()
  const walls = unlocked(game, 'wall')
  const floors = unlocked(game, 'floor')

  const preview = (p: Painter, t: number) => {
    const d = new Date()
    const opts = {
      hour: d.getHours() + d.getMinutes() / 60,
      gifts: game.gifts,
      t,
      gloom: 0,
      decor: game.decor,
      law: unlocked(game, 'law'),
      bowl: game.bowl,
      season: seasonOf(d.getTime()),
      october: isOctober(d.getTime()),
      photo: game.photo ? photoSprite(game.photo) : null,
      books: placeBooks(shelfBooks(game)),
      shelfLabels: shelfTags(game),
    }
    drawRoom(p, opts)
    drawFox(p, FOX_SPOT.x, FOX_SPOT.y, { pose: 'sit', face: idleFace(t), tail: idleTail(t), equipped: game.equipped })
    drawAtmosphere(p, opts)
  }

  const lock = (kind: 'wall' | 'floor', id: string) => {
    const r = unlockRank(game, kind, id)
    return r >= 0 ? `at ${ladder(game)[r].short}` : ''
  }

  return (
    <main className="screen">
      <Header title="decor" onBack={onBack} />
      <div className="room decor-preview">
        <PixelCanvas w={ROOM_W} h={ROOM_H} draw={preview} fps={8} label="room preview" />
      </div>
      <PhotoSection />
      <button className="letter-card px-box tone-lav" onClick={onWidget}>
        <PixelIcon sprite={NEED_ICON_ART.palette} scale={3} />
        <span>
          style your widget
          <small>{game.foxName} on your home screen, in your colours ✿</small>
        </span>
      </button>
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
