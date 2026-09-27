import { useRef } from 'react'
import { BED_SPOT, FOX_SPOT, ROOM_H, ROOM_W, RUG_SPOT, drawAtmosphere, drawRoom } from '../art/room.ts'
import type { Painter } from '../art/painter.ts'
import { TREAT_ART, ICON_ART } from '../art/items.ts'
import { HUNGRY, isAsleep, moodOf } from '../game/logic.ts'
import type { GameState } from '../game/state.ts'
import { PixelCanvas } from './PixelCanvas.tsx'
import { RAIN_CLOUD, THOUGHT, drawFox, idleFace, idleTail, spawn, stepParticles, type Particle } from './foxDraw.ts'

export interface RoomFx {
  /** Timestamp (performance.now) of the last pet, drives the hop + hearts. */
  petAt: number
  /** Show the fox awake until this performance.now time (tapping a sleeping fox). */
  awakeUntil: number
}

interface Props {
  game: GameState
  fx: RoomFx
  bubble: string | null
  onFoxTap: () => void
}

type Placement = { kind: 'sit' | 'bed' | 'rug' | 'away'; x: number; y: number; w: number; h: number }

function placement(game: GameState, t: number, fx: RoomFx): Placement {
  const now = Date.now()
  if (game.adventure) return { kind: 'away', x: 0, y: 0, w: 0, h: 0 }
  const awake = t < fx.awakeUntil
  if (isAsleep(game, now) && !awake) return { kind: 'bed', x: BED_SPOT.x, y: BED_SPOT.y, w: 40, h: 22 }
  if (moodOf(game.happiness) === 'depressed' && !awake) return { kind: 'rug', x: RUG_SPOT.x, y: RUG_SPOT.y, w: 40, h: 22 }
  return { kind: 'sit', x: FOX_SPOT.x, y: FOX_SPOT.y, w: 34, h: 32 }
}

/** The fox's room: time of day, gifts, mood, and a tappable fox. */
export function Room({ game, fx, bubble, onFoxTap }: Props) {
  const particles = useRef<Particle[]>([])
  const lastPet = useRef(fx.petAt)
  const lastSpawn = useRef(0)
  const place = useRef<Placement>({ kind: 'sit', x: 0, y: 0, w: 0, h: 0 })

  const draw = (p: Painter, t: number) => {
    const d = new Date()
    const hour = d.getHours() + d.getMinutes() / 60
    const mood = moodOf(game.happiness)
    const gloom = mood === 'depressed' ? 1 : mood === 'sad' ? 0.45 : 0
    const opts = { hour, gifts: game.gifts, t, gloom }
    drawRoom(p, opts)

    const pl = placement(game, t, fx)
    place.current = pl
    const list = particles.current
    if (fx.petAt !== lastPet.current) {
      lastPet.current = fx.petAt
      spawn(list, 'heart', pl.x + 16, pl.y + 2, t, 3)
    }
    const every = (ms: number) => {
      if (t - lastSpawn.current > ms) {
        lastSpawn.current = t
        return true
      }
      return false
    }

    if (pl.kind === 'bed') {
      drawFox(p, pl.x, pl.y, { pose: 'curl', face: 'sleep', tail: 0, breath: Math.floor(t / 1400) % 2, equipped: game.equipped })
      if (every(1300)) spawn(list, 'z', pl.x + 8, pl.y, t)
    } else if (pl.kind === 'rug') {
      drawFox(p, pl.x, pl.y, { pose: 'curl', face: 'sad', tail: 0, breath: Math.floor(t / 2000) % 2, equipped: game.equipped })
      const cy = pl.y - 8 + Math.round(Math.sin(t / 900))
      p.sprite(RAIN_CLOUD, pl.x + 2, cy)
      if (every(260)) spawn(list, 'drop', pl.x + 10, cy + 7, t)
    } else if (pl.kind === 'sit') {
      const sincePet = t - fx.petAt
      const hop = sincePet < 360 ? -Math.round(Math.sin((sincePet / 360) * Math.PI) * 4) : 0
      let face = idleFace(t)
      if (sincePet < 1200) face = 'happy'
      else if (mood === 'sad') face = 'sad'
      else if (mood === 'joyful' && Math.floor(t / 3000) % 4 === 0) face = 'happy'
      const wag = mood === 'joyful' ? 2.2 : mood === 'happy' ? 1.2 : mood === 'sad' ? 0.35 : 0.8
      drawFox(p, pl.x, pl.y + hop, { pose: 'sit', face, tail: idleTail(t, wag), equipped: game.equipped })
      if (game.tummy < HUNGRY && Math.floor(t / 4000) % 2 === 1 && sincePet > 1500) {
        p.sprite(THOUGHT, pl.x + 30, pl.y - 14)
        p.sprite(TREAT_ART.onigiri, pl.x + 32, pl.y - 12)
      }
      if (mood === 'joyful' && every(900)) spawn(list, 'spark', pl.x + 4 + Math.random() * 30, pl.y + 4, t)
    } else {
      // out on an adventure: a little note left on the rug
      p.sprite(ICON_ART.mail, 60, 84)
    }
    drawAtmosphere(p, opts)
    stepParticles(p, list, t)
  }

  const onTap = (x: number, y: number) => {
    const pl = place.current
    if (pl.kind === 'away') return
    const pad = 6
    if (x >= pl.x - pad && x <= pl.x + pl.w + pad && y >= pl.y - pad - 6 && y <= pl.y + pl.h + pad) onFoxTap()
  }

  const pl = place.current
  const bubbleLeft = ((pl.x + (pl.kind === 'sit' ? 16 : 12)) / ROOM_W) * 100
  const bubbleTop = ((pl.y - 4) / ROOM_H) * 100

  return (
    <div className="room">
      <PixelCanvas w={ROOM_W} h={ROOM_H} draw={draw} onTap={onTap} label={`${game.foxName}'s room`} />
      {bubble && pl.kind !== 'away' && (
        <div className="bubble" style={{ left: `${bubbleLeft}%`, top: `${bubbleTop}%` }} key={bubble}>
          {bubble}
        </div>
      )}
    </div>
  )
}
