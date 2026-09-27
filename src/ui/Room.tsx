import { useEffect, useRef, useState } from 'react'
import { BED_SPOT, BOWL, DESK, FOX_Y, ROOM_H, ROOM_W, RUG_SPOT, SPOTS, TUB, VIEW_W, drawAtmosphere, drawRoom } from '../art/room.ts'
import type { Painter } from '../art/painter.ts'
import { BRUSH_ART, GIFT_ART, ICON_ART, NEED_ICON_ART, ROOM_ART, TREAT_ART } from '../art/items.ts'
import { sprite, type Sprite } from '../art/sprite.ts'
import type { Face } from '../art/fox.ts'
import { unlocked } from '../game/career.ts'
import { TREATS } from '../game/content.ts'
import { foxMood, lowestNeed, type NeedKey } from '../game/needs.ts'
import type { GameState } from '../game/state.ts'
import { PixelCanvas } from './PixelCanvas.tsx'
import { PieMenu, type PieOption } from './PieMenu.tsx'
import { Brain, PLACE, task, type Task, type TaskKind } from './brain.ts'
import { DEBUG } from '../debug.ts'
import { RAIN_CLOUD, THOUGHT, chatBubble, drawFox, idleFace, idleTail, spawn, stepParticles, type Particle } from './foxDraw.ts'

export type RoomCommand = 'refill' | 'study' | 'quiz'

interface Props {
  game: GameState
  bubble: string | null
  onStart?: (t: Task) => void
  onDone: (t: Task) => void
  onCommand: (cmd: RoomCommand) => void
  /** Tapped the fox while it was asleep or sulking. */
  onWake?: () => void
  onStatus?: (label: string | null) => void
}

type Box = { x: number; y: number; w: number; h: number }
type Menu = { target: string; cssX: number; cssY: number; sub?: 'treat' }

const shift = (p: Painter, dx: number): Painter => ({
  rect: (x, y, w, h, c, a) => p.rect(x - dx, y, w, h, c, a),
  sprite: (s, x, y, a) => p.sprite(s, x - dx, y, a),
})

const BOOK = sprite(['oooooooo', 'oRrrrrYo', 'oRrrrrYo', 'oRrYYrYo', 'oRrrrrYo', 'oooooooo'])
const ARROW_L = sprite(['..o', '.oo', 'ooo', '.oo', '..o'], { o: '#fffaf3' })
const ARROW_R = sprite(['o..', 'oo.', 'ooo', 'oo.', 'o..'], { o: '#fffaf3' })
const PICTOS = [ICON_ART.heart, ICON_ART.acorn, NEED_ICON_ART.card, TREAT_ART.strawberry, NEED_ICON_ART.gavel]
const CHAT = PICTOS.map((s) => chatBubble(scaleDown(s)))
const NEED_THOUGHT: Record<NeedKey, Sprite> = {
  hunger: ROOM_ART.bowlFull,
  energy: NEED_ICON_ART.moon,
  fun: NEED_ICON_ART.ball,
  hygiene: NEED_ICON_ART.bubbles,
  social: ICON_ART.heart,
}

/** Halve a 12px icon to 6px for chat bubbles (nearest neighbour). */
function scaleDown(s: Sprite): Sprite {
  const w = Math.ceil(s.w / 2)
  const h = Math.ceil(s.h / 2)
  const data: (string | null)[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.push(s.data[Math.min(s.h - 1, y * 2 + 1) * s.w + Math.min(s.w - 1, x * 2)] ?? null)
  return { w, h, data }
}

const OBJECTS: { id: string; box: Box; gift?: string }[] = [
  { id: 'bowl', box: { x: BOWL.x - 3, y: BOWL.y - 4, w: 18, h: 14 } },
  { id: 'tub', box: { x: TUB.x, y: TUB.y - 2, w: 30, h: 16 } },
  { id: 'desk', box: { x: DESK.x, y: DESK.y - 12, w: 40, h: 26 } },
  { id: 'bed', box: { x: 0, y: 78, w: 42, h: 20 } },
  { id: 'ball', box: { x: 114, y: 91, w: 14, h: 13 } },
  { id: 'yarn', box: { x: 85, y: 90, w: 16, h: 14 }, gift: 'yarn' },
  { id: 'teddy', box: { x: 31, y: 63, w: 18, h: 18 }, gift: 'teddy' },
  { id: 'cushion', box: { x: 98, y: 85, w: 22, h: 12 }, gift: 'cushion' },
  { id: 'window', box: { x: 3, y: 5, w: 48, h: 44 } },
]

const OBJECT_NAMES: Record<string, string> = {
  bowl: 'food bowl',
  tub: 'bathtub',
  desk: 'study desk',
  bed: 'basket bed',
  ball: 'ball',
  yarn: 'yarn ball',
  teddy: 'teddy bear',
  cushion: 'cushion',
  window: 'window',
}

const USER_TASK: Partial<Record<TaskKind, [number, string]>> = {
  pet: [1500, 'enjoying pets'],
  cuddle: [3200, 'cuddling you'],
  brush: [4200, 'getting brushed'],
  chat: [4800, 'chatting with you'],
  dance: [5200, 'dancing'],
  play: [4200, 'playing tag'],
  treat: [3600, 'munching a treat'],
  eat: [4500, 'eating from the bowl'],
  bath: [7500, 'having a bath'],
  nap: [20_000, 'taking a nap'],
  read: [7000, 'reading your casebooks'],
  ball: [5000, 'playing with the ball'],
  yarn: [5000, 'batting the yarn around'],
  teddy: [5000, 'cuddling the teddy bear'],
  window: [5000, 'watching the sky'],
  cushion: [6000, 'lounging on the cushion'],
}

const HEADING: Partial<Record<TaskKind, string>> = {
  sleep: 'heading to bed',
  nap: 'heading to bed for a nap',
  sulk: 'moping',
  eat: 'trotting to the food bowl',
  bath: 'heading to the bath (reluctantly)',
  read: 'heading to the desk',
  ball: 'going to play',
  yarn: 'going to play',
  window: 'going to the window',
  teddy: 'going to find teddy',
  cushion: 'heading to the cushion',
}

function userTask(kind: TaskKind, here: number, arg?: string): Task {
  const [ms, label] = USER_TASK[kind] ?? [3000, 'doing a thing']
  return task(kind, PLACE[kind] ?? here, ms, label, true, arg)
}

/** The fox's home: a wide room you can swipe across, a fox with free will, and pie menus. */
export function Room({ game, bubble, onStart, onDone, onCommand, onWake, onStatus }: Props) {
  const gameRef = useRef(game)
  gameRef.current = game
  const hooks = useRef({ onStart, onDone, onStatus })
  hooks.current = { onStart, onDone, onStatus }
  const particles = useRef<Particle[]>([])
  const lastSpawn = useRef<Record<string, number>>({})
  const cam = useRef(0)
  const manualUntil = useRef(0)
  const foxBox = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 })
  const anchor = useRef({ x: SPOTS.rug.x, y: FOX_Y })
  const lastLabel = useRef<string | null>(null)
  const lastT = useRef(0)
  const wrap = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu
  const [userLabel, setUserLabel] = useState<string | null>(null)
  const [, force] = useState(0)

  const brain = useRef<Brain | null>(null)
  if (!brain.current) {
    brain.current = new Brain({
      start: (tk) => {
        const now = performance.now()
        const b = brain.current!
        if (tk.kind === 'pet' || tk.kind === 'cuddle') spawn(particles.current, 'heart', b.x, FOX_Y + 2, now, tk.kind === 'cuddle' ? 5 : 3)
        if (tk.user) setUserLabel(tk.label)
        hooks.current.onStart?.(tk)
      },
      done: (tk) => {
        if (tk.user) setUserLabel(null)
        if (!['idle', 'wander', 'sleep', 'sulk'].includes(tk.kind)) hooks.current.onDone(tk)
      },
    })
  }

  // tapping anywhere outside the room closes an open menu
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])

  // ?debug exposes the fox and camera so automated tests can find it
  useEffect(() => {
    if (DEBUG) Object.assign(window, { __fox: brain.current, __cam: cam })
  }, [])

  // camera starts centred on the fox
  useEffect(() => {
    cam.current = Math.max(0, Math.min(ROOM_W - VIEW_W, brain.current!.x - VIEW_W / 2))
  }, [])

  const every = (key: string, t: number, ms: number) => {
    if (t - (lastSpawn.current[key] ?? -Infinity) > ms) {
      lastSpawn.current[key] = t
      return true
    }
    return false
  }

  const draw = (p0: Painter, t: number) => {
    const g = gameRef.current
    const b = brain.current!
    const dt = Math.min(120, t - lastT.current)
    lastT.current = t
    if (!g.adventure) b.update(t, g)

    // camera: follow the fox unless the player is looking around
    const maxCam = ROOM_W - VIEW_W
    if (!menuRef.current && t > manualUntil.current) {
      const target = Math.max(0, Math.min(maxCam, b.x - VIEW_W / 2))
      cam.current += (target - cam.current) * Math.min(1, dt * 0.004)
    }
    const camX = Math.round(cam.current)
    const p = shift(p0, camX)

    const d = new Date()
    const hour = d.getHours() + d.getMinutes() / 60
    const mood = foxMood(g)
    const gloom = mood === 'depressed' ? 1 : mood === 'sad' ? 0.45 : 0
    const cur = b.task
    const doing: TaskKind | null = cur && cur.started != null ? cur.kind : null
    const opts = {
      hour,
      gifts: g.gifts,
      t,
      gloom,
      decor: g.decor,
      law: unlocked(g.stats.totalMinutes, 'law'),
      bowl: g.bowl,
      hide: doing === 'ball' ? ['ball'] : doing === 'yarn' ? ['yarn'] : [],
    }
    drawRoom(p, opts)
    if (g.adventure) p.sprite(ICON_ART.mail, 60, 84)
    else drawTheFox(p, t, g, b, doing)
    drawAtmosphere(p, opts)
    stepParticles(p, particles.current, t)

    // hint that there's more room to either side
    const pulse = 0.35 + 0.25 * Math.sin(t / 300)
    if (camX > 1) p0.sprite(ARROW_L, 2, 52, pulse)
    if (camX < maxCam - 1) p0.sprite(ARROW_R, VIEW_W - 5, 52, pulse)

    const label = g.adventure ? null : cur ? (b.walking ? HEADING[cur.kind] ?? cur.label : cur.label) : null
    if (label !== lastLabel.current) {
      lastLabel.current = label
      hooks.current.onStatus?.(label)
    }
  }

  const drawTheFox = (p: Painter, t: number, g: GameState, b: Brain, doing: TaskKind | null) => {
    const list = particles.current
    const mood = foxMood(g)
    const eq = g.equipped
    const awake = t < b.awakeUntil
    const since = b.task?.started != null ? t - b.task.started : 0
    const baseFace = (): Face => (mood === 'sad' ? 'sad' : mood === 'joyful' && Math.floor(t / 3000) % 4 === 0 ? 'happy' : idleFace(t))
    const wag = mood === 'joyful' ? 2.2 : mood === 'happy' ? 1.2 : mood === 'sad' ? 0.35 : 0.8
    let head = { x: b.x, y: FOX_Y }

    const sit = (x: number, y: number, face: Face, tailSpeed = wag) => {
      drawFox(p, x - 16, y, { pose: 'sit', face, tail: idleTail(t, tailSpeed), equipped: eq })
      foxBox.current = { x: x - 16, y, w: 42, h: 32 }
      head = { x, y }
    }

    if (b.walking) {
      const dx = b.facing > 0 ? -33 : -17
      drawFox(p, b.x + dx, FOX_Y, { pose: 'walk', frame: Math.floor(t / 130) % 4, facing: b.facing, face: mood === 'sad' ? 'sad' : idleFace(t), tail: 0, equipped: eq })
      foxBox.current = { x: b.x + dx, y: FOX_Y, w: 50, h: 31 }
    } else {
      switch (doing) {
        case 'sleep':
        case 'nap':
          if (awake) sit(SPOTS.bed.x, FOX_Y + 2, 'blink', 0.4)
          else {
            drawFox(p, BED_SPOT.x, BED_SPOT.y, { pose: 'curl', face: 'sleep', tail: 0, breath: Math.floor(t / 1400) % 2, equipped: eq })
            foxBox.current = { x: BED_SPOT.x, y: BED_SPOT.y, w: 40, h: 22 }
            head = { x: BED_SPOT.x + 10, y: BED_SPOT.y + 4 }
            if (every('z', t, 1300)) spawn(list, 'z', BED_SPOT.x + 8, BED_SPOT.y, t)
          }
          break
        case 'sulk': {
          if (awake) {
            sit(SPOTS.rug.x, FOX_Y, 'sad', 0.3)
            break
          }
          drawFox(p, RUG_SPOT.x, RUG_SPOT.y, { pose: 'curl', face: 'sad', tail: 0, breath: Math.floor(t / 2000) % 2, equipped: eq })
          foxBox.current = { x: RUG_SPOT.x, y: RUG_SPOT.y, w: 40, h: 22 }
          head = { x: RUG_SPOT.x + 10, y: RUG_SPOT.y + 4 }
          const cy = RUG_SPOT.y - 8 + Math.round(Math.sin(t / 900))
          p.sprite(RAIN_CLOUD, RUG_SPOT.x + 2, cy)
          if (every('drop', t, 260)) spawn(list, 'drop', RUG_SPOT.x + 10, cy + 7, t)
          break
        }
        case 'bath': {
          const x = TUB.x + 15
          sit(x, TUB.y - 19, Math.floor(t / 700) % 3 === 0 ? 'blink' : 'happy', 0)
          p.sprite(ROOM_ART.tub, TUB.x, TUB.y)
          if (every('bubble', t, 280)) spawn(list, 'bubble', x - 8 + Math.random() * 16, TUB.y - 2, t)
          break
        }
        case 'eat':
        case 'treat': {
          sit(b.x, FOX_Y, Math.floor(t / 260) % 2 ? 'eat' : 'happy', 1.6)
          if (doing === 'treat' && b.task?.arg && TREAT_ART[b.task.arg]) p.sprite(TREAT_ART[b.task.arg], b.x - 6, FOX_Y + 18)
          if (every('crumb', t, 500)) spawn(list, 'crumb', b.x, FOX_Y + 20, t, 2)
          break
        }
        case 'ball':
        case 'yarn': {
          const hop = -Math.abs(Math.round(Math.sin(t / 160) * 4))
          sit(b.x, FOX_Y + hop, 'happy', 2.5)
          const bx = b.x + 14 + Math.round(Math.sin(t / 240) * 8)
          const by = 92 - Math.abs(Math.round(Math.sin(t / 200) * 9))
          p.sprite(doing === 'ball' ? ROOM_ART.ball : GIFT_ART.yarn, bx, by)
          break
        }
        case 'read':
          sit(b.x, FOX_Y, Math.floor(t / 1600) % 3 === 0 ? 'open' : 'blink', 0.5)
          p.sprite(BOOK, b.x - 4, FOX_Y + 20)
          if (every('read', t, 2600)) spawn(list, 'spark', b.x + 6, FOX_Y + 2, t)
          break
        case 'window':
          sit(b.x, FOX_Y, Math.floor(t / 2000) % 2 ? 'happy' : 'open')
          if (every('win', t, 1200)) spawn(list, 'spark', 14 + Math.random() * 26, 14 + Math.random() * 20, t)
          break
        case 'teddy':
        case 'cuddle':
          sit(b.x, FOX_Y - (doing === 'cuddle' && since < 400 ? 3 : 0), 'love', 2)
          if (every('heart', t, 700)) spawn(list, 'heart', b.x, FOX_Y + 2, t)
          break
        case 'cushion':
          sit(b.x, FOX_Y - 3, Math.floor(t / 2500) % 2 ? 'blink' : 'happy', 0.6)
          break
        case 'brush': {
          sit(b.x, FOX_Y, 'happy', 1.8)
          const sweep = Math.sin(t / 220) * 10
          p.sprite(BRUSH_ART, b.x - 5 + sweep, FOX_Y + 6)
          if (every('spark', t, 400)) spawn(list, 'spark', b.x - 8 + Math.random() * 16, FOX_Y + 6, t)
          break
        }
        case 'chat':
          sit(b.x, FOX_Y, Math.floor(t / 400) % 2 ? 'open' : 'happy', 1.5)
          if (every('chat', t, 1000)) {
            list.push({ kind: 'icon', art: CHAT[Math.floor(Math.random() * CHAT.length)], x: b.x + 8, y: FOX_Y - 6, vx: 2, vy: -5, born: t, life: 1500 })
          }
          break
        case 'dance': {
          const sway = Math.floor(t / 260) % 2 ? 2 : -2
          sit(b.x + sway, FOX_Y - (Math.floor(t / 130) % 2), 'happy', 3)
          if (every('note', t, 450)) spawn(list, 'note', b.x - 10 + Math.random() * 20, FOX_Y, t)
          break
        }
        case 'play':
        case 'pet': {
          const hop = since < 360 || doing === 'play' ? -Math.abs(Math.round(Math.sin((since / 360) * Math.PI) * 4)) : 0
          sit(b.x, FOX_Y + hop, 'happy', 2.5)
          if (doing === 'play' && every('spark', t, 500)) spawn(list, 'spark', b.x - 12 + Math.random() * 24, FOX_Y + 8, t)
          break
        }
        default:
          sit(b.x, FOX_Y, baseFace())
      }
    }
    anchor.current = head

    // needs you can see: stink lines and thought bubbles
    const low = lowestNeed(g.needs)
    const resting = doing === 'sleep' || doing === 'nap' || doing === 'sulk' || doing === 'bath'
    if (g.needs.hygiene < 30 && !resting && every('stink', t, 650)) spawn(list, 'stink', head.x - 12 + Math.random() * 24, FOX_Y + 6, t)
    const idleish = b.walking || doing === 'idle' || doing === 'wander' || doing == null
    if (idleish && g.needs[low] < 35 && Math.floor(t / 4000) % 2 === 1) {
      p.sprite(THOUGHT, head.x + 16, FOX_Y - 14)
      const icon = NEED_THOUGHT[low]
      p.sprite(icon, head.x + 16 + Math.round((16 - icon.w) / 2), FOX_Y - 14 + Math.round((13 - icon.h) / 2))
    }
  }

  // ─── input: tap for menus, drag to look around ────────────────────────────
  const drag = useRef<{ x: number; cam: number; moved: boolean; id: number } | null>(null)

  const toRoom = (clientX: number, clientY: number) => {
    const r = wrap.current!.getBoundingClientRect()
    const vx = ((clientX - r.left) / r.width) * VIEW_W
    const vy = ((clientY - r.top) / r.height) * ROOM_H
    return { x: vx + Math.round(cam.current), y: vy, cssX: clientX - r.left, cssY: clientY - r.top }
  }

  const inBox = (x: number, y: number, bx: Box, pad = 4) => x >= bx.x - pad && x <= bx.x + bx.w + pad && y >= bx.y - pad && y <= bx.y + bx.h + pad

  const onTap = (clientX: number, clientY: number) => {
    const g = gameRef.current
    const b = brain.current!
    const pt = toRoom(clientX, clientY)
    if (!g.adventure && inBox(pt.x, pt.y, foxBox.current, 5)) {
      const k = b.task?.kind
      const asleep = (k === 'sleep' || k === 'nap' || k === 'sulk') && b.task?.started != null && performance.now() > b.awakeUntil
      if (asleep) {
        b.awakeUntil = performance.now() + 6000
        onWake?.()
        force((n) => n + 1)
        return
      }
      setMenu({ target: 'fox', cssX: pt.cssX, cssY: pt.cssY })
      return
    }
    const obj = OBJECTS.find((o) => (!o.gift || g.gifts.includes(o.gift)) && inBox(pt.x, pt.y, o.box, 2))
    if (obj) {
      setMenu({ target: obj.id, cssX: pt.cssX, cssY: pt.cssY })
      return
    }
    if (pt.y > 72 && !g.adventure) b.ask(task('wander', Math.max(14, Math.min(196, pt.x)), 2500, 'going for a stroll', true))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, cam: cam.current, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 7) return
    d.moved = true
    const r = wrap.current!.getBoundingClientRect()
    cam.current = Math.max(0, Math.min(ROOM_W - VIEW_W, d.cam - dx * (VIEW_W / r.width)))
    manualUntil.current = performance.now() + 7000
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onTap(e.clientX, e.clientY)
  }

  // ─── menus ───────────────────────────────────────────────────────────────
  const optionsFor = (m: Menu): { title: string; options: PieOption[] } => {
    const g = gameRef.current
    if (m.sub === 'treat') {
      const opts = TREATS.filter((tr) => g.pantry[tr.id]).map((tr) => ({ id: `treat:${tr.id}`, label: `${tr.name} ×${g.pantry[tr.id]}`, icon: TREAT_ART[tr.id] }))
      return { title: 'give a treat', options: opts }
    }
    switch (m.target) {
      case 'fox': {
        const pantry = Object.values(g.pantry).reduce((a, b) => a + b, 0)
        return {
          title: g.foxName,
          options: [
            { id: 'pet', label: 'pet', icon: ICON_ART.heart },
            { id: 'cuddle', label: 'cuddle' },
            { id: 'chat', label: 'chat' },
            { id: 'brush', label: 'brush fur', icon: NEED_ICON_ART.bubbles },
            { id: 'dance', label: 'dance' },
            { id: 'play', label: 'play tag', icon: NEED_ICON_ART.ball },
            { id: 'treats', label: pantry ? `give a treat (${pantry})` : 'no treats saved', icon: TREAT_ART.strawberry, disabled: !pantry },
            { id: 'quiz', label: 'quiz me!', icon: NEED_ICON_ART.card },
          ],
        }
      }
      case 'bowl':
        return {
          title: `${OBJECT_NAMES.bowl} (${g.bowl}/3)`,
          options: [
            { id: 'refill', label: g.bowl >= 3 ? 'bowl is full' : 'refill bowl', icon: ROOM_ART.bowlFull, disabled: g.bowl >= 3 },
            { id: 'eat', label: 'have a bite', disabled: g.bowl <= 0 },
          ],
        }
      case 'tub':
        return { title: OBJECT_NAMES.tub, options: [{ id: 'bath', label: 'bath time!', icon: NEED_ICON_ART.bubbles }] }
      case 'desk':
        return {
          title: OBJECT_NAMES.desk,
          options: [
            { id: 'study', label: 'study together', icon: ICON_ART.acorn },
            { id: 'read', label: 'read casebooks' },
            { id: 'quiz', label: 'flashcards', icon: NEED_ICON_ART.card },
          ],
        }
      case 'bed':
        return { title: OBJECT_NAMES.bed, options: [{ id: 'nap', label: 'take a nap', icon: NEED_ICON_ART.moon }] }
      case 'ball':
        return { title: OBJECT_NAMES.ball, options: [{ id: 'ball', label: 'play ball', icon: NEED_ICON_ART.ball }] }
      case 'yarn':
        return { title: OBJECT_NAMES.yarn, options: [{ id: 'yarn', label: 'play with yarn', icon: GIFT_ART.yarn }] }
      case 'teddy':
        return { title: OBJECT_NAMES.teddy, options: [{ id: 'teddy', label: 'cuddle teddy', icon: GIFT_ART.teddy }] }
      case 'cushion':
        return { title: OBJECT_NAMES.cushion, options: [{ id: 'cushion', label: 'lounge', icon: GIFT_ART.cushion }] }
      case 'window':
        return { title: OBJECT_NAMES.window, options: [{ id: 'window', label: 'look outside' }] }
    }
    return { title: '', options: [] }
  }

  const pick = (id: string) => {
    const m = menu
    setMenu(null)
    if (!m) return
    const b = brain.current!
    if (id === 'treats') return setMenu({ ...m, sub: 'treat' })
    if (id === 'refill' || id === 'study' || id === 'quiz') return onCommand(id)
    if (id.startsWith('treat:')) return b.ask(userTask('treat', b.x, id.slice(6)))
    b.ask(userTask(id as TaskKind, b.x))
  }

  const { title, options } = menu ? optionsFor(menu) : { title: '', options: [] }
  const box = wrap.current?.getBoundingClientRect()
  const a = anchor.current
  const bubbleLeft = ((a.x - cam.current) / VIEW_W) * 100
  const bubbleTop = ((a.y - 4) / ROOM_H) * 100

  return (
    <div
      className="room"
      ref={wrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <PixelCanvas w={VIEW_W} h={ROOM_H} draw={draw} fps={20} label={`${game.foxName}'s room`} />
      {userLabel && (
        <button
          className="action-chip"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            brain.current!.cancel()
            setUserLabel(null)
          }}
          aria-label={`stop ${userLabel}`}
        >
          {userLabel} <span aria-hidden>×</span>
        </button>
      )}
      {bubble && !game.adventure && !menu && bubbleLeft > 4 && bubbleLeft < 96 && (
        <div className="bubble" style={{ left: `${bubbleLeft}%`, top: `${bubbleTop}%` }} key={bubble}>
          {bubble}
        </div>
      )}
      {menu && box && (
        <PieMenu
          x={menu.cssX}
          y={menu.cssY}
          width={box.width}
          height={box.height}
          title={title}
          options={options}
          onPick={pick}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
