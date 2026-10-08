import { SPOTS } from '../art/room.ts'
import { foxMood, isBedtime, type Activity } from '../game/needs.ts'
import type { GameState } from '../game/state.ts'

// The fox's free will. Every frame the room calls update(); the brain walks
// the fox to wherever its current task happens, performs it for a while, then
// reports back so the game can apply the effect. Taps from the pie menu jump
// the queue; otherwise the fox picks what to do from its needs, Sims-style.

export type TaskKind = Activity | 'idle' | 'wander' | 'sleep' | 'sulk'

export interface Task {
  kind: TaskKind
  /** Where to stand (room x of the fox's head centre). */
  x: number
  /** How long to perform once there (ms). */
  duration: number
  label: string
  user: boolean
  arg?: string
  /** Performance start time, set on arrival. */
  started: number | null
  /** Stays until conditions change (sleep, sulk). */
  persistent?: boolean
}

const WALK_SPEED = 18 // room pixels per second
const MIN_X = 14
const MAX_X = 196

export interface BrainHooks {
  start(task: Task): void
  done(task: Task): void
}

export function task(kind: TaskKind, x: number, duration: number, label: string, user = false, arg?: string): Task {
  return { kind, x, duration, label, user, arg, started: null }
}

/** Where each activity happens (null = right where the fox is). */
export const PLACE: Partial<Record<TaskKind, number>> = {
  eat: SPOTS.bowl.x,
  nap: SPOTS.bed.x,
  sleep: SPOTS.bed.x,
  ball: SPOTS.ball.x,
  yarn: SPOTS.yarn.x,
  read: SPOTS.desk.x,
  window: SPOTS.window.x,
  teddy: SPOTS.teddy.x,
  cushion: SPOTS.cushion.x,
  bath: SPOTS.tub.x,
  sulk: SPOTS.rug.x,
}

export class Brain {
  x: number = SPOTS.rug.x
  facing: 1 | -1 = 1
  task: Task | null = null
  queue: Task[] = []
  /** Tapping a sleeping fox wakes it for a moment. */
  awakeUntil = 0
  private cooldown: Record<string, number> = {}
  private lastT = 0
  private hooks: BrainHooks

  constructor(hooks: BrainHooks) {
    this.hooks = hooks
  }

  get walking() {
    const t = this.task
    return !!t && t.started == null && Math.abs(t.x - this.x) > 0.5
  }

  /** The player asked for something: drop whatever the fox was doing on its own. */
  ask(t: Task) {
    this.queue = [t]
    if (this.task && (!this.task.user || this.task.started == null)) this.task = null
  }

  cancel() {
    this.queue = []
    this.task = null
  }

  update(t: number, game: GameState) {
    const dt = Math.min(120, Math.max(0, t - this.lastT))
    this.lastT = t
    if (!this.task) this.task = this.queue.shift() ?? this.think(t, game)
    const cur = this.task
    if (cur.started == null) {
      const dist = cur.x - this.x
      if (Math.abs(dist) > 0.5) {
        this.facing = dist > 0 ? 1 : -1
        this.x += Math.sign(dist) * Math.min(Math.abs(dist), (WALK_SPEED * dt) / 1000)
        return
      }
      cur.started = t
      this.hooks.start(cur)
    }
    if (cur.persistent) {
      if (!this.stillWants(cur, t, game) || this.queue.length) this.task = null
      return
    }
    if (t - cur.started >= cur.duration) {
      this.cooldown[cur.kind] = t
      this.task = null
      this.hooks.done(cur)
    }
  }

  private stillWants(cur: Task, t: number, game: GameState) {
    if (cur.kind === 'sleep') return (isBedtime(Date.now()) || Date.now() < game.napUntil) && t > this.awakeUntil
    if (cur.kind === 'sulk') return foxMood(game) === 'depressed' && t > this.awakeUntil
    return false
  }

  private ready(kind: string, t: number, cooldown = 45_000) {
    return (this.cooldown[kind] ?? -Infinity) + cooldown < t
  }

  /** Autonomy: decide what to do next from the fox's needs. */
  think(t: number, game: GameState): Task {
    const now = Date.now()
    if ((isBedtime(now) || now < game.napUntil) && t > this.awakeUntil) return { ...task('sleep', SPOTS.bed.x, 0, 'fast asleep'), persistent: true }
    if (foxMood(game) === 'depressed' && t > this.awakeUntil) return { ...task('sulk', SPOTS.rug.x, 0, 'feeling really down'), persistent: true }
    const n = game.needs
    const has = (g: string) => game.gifts.includes(g)
    if (n.hunger < 50 && game.bowl > 0 && this.ready('eat', t)) return task('eat', SPOTS.bowl.x, 5000, 'eating from the bowl')
    if (n.energy < 25 && this.ready('nap', t, 120_000)) return task('nap', SPOTS.bed.x, 25_000, 'taking a nap')
    if (n.social < 45 && has('teddy') && this.ready('teddy', t)) return task('teddy', SPOTS.teddy.x, 6000, 'cuddling the teddy bear')
    if (n.fun < 65) {
      const fun: Task[] = []
      if (this.ready('ball', t)) fun.push(task('ball', SPOTS.ball.x, 6000, 'playing with the ball'))
      if (has('yarn') && this.ready('yarn', t)) fun.push(task('yarn', SPOTS.yarn.x, 6000, 'batting the yarn around'))
      if (this.ready('window', t, 90_000)) fun.push(task('window', SPOTS.window.x, 6000, 'watching the sky'))
      if (this.ready('read', t, 90_000)) fun.push(task('read', SPOTS.desk.x, 8000, 'reading your books'))
      if (fun.length) return fun[Math.floor(Math.random() * fun.length)]
    }
    if (Math.random() < 0.55) {
      const spots = [SPOTS.rug.x, SPOTS.window.x, SPOTS.desk.x, 88, 130, SPOTS.bowl.x, 40 + Math.random() * 150]
      if (has('cushion')) spots.push(SPOTS.cushion.x)
      const x = Math.max(MIN_X, Math.min(MAX_X, spots[Math.floor(Math.random() * spots.length)]))
      return task('wander', x, 2500 + Math.random() * 4000, 'wandering around')
    }
    return task('idle', this.x, 3000 + Math.random() * 4000, 'hanging out')
  }
}
