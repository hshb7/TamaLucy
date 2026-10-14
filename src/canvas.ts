// Her school's Canvas: assignments with due dates flow into the exams list,
// and her enrolled courses can become classes on the bookcase. She makes her
// own access token in Canvas (Account → Settings → New Access Token); it stays
// on this device. Browsers can't call Canvas directly (no CORS), so requests
// go through a tiny relay (supabase/functions/canvas-proxy) that only forwards
// them, which is why her mailbox code is needed too.
import { cleanCourseName, fromCanvas, importEvents, matchCourse, type CanvasAssignment } from './game/external.ts'
import { addCourse, draftCourse } from './game/shelf.ts'
import { getGame, setGame } from './game/store.ts'
import { FUNCTIONS_URL, SUPABASE_KEY } from './game/remote.ts'
import { getLinks, patchLinks } from './links.ts'
import { cantReach } from './preview.ts'

export type CanvasProblem = 'no-mailbox' | 'not-connected' | 'offline' | 'bad-token' | 'bad-url' | 'limit' | 'server'

export class CanvasError extends Error {
  readonly problem: CanvasProblem
  constructor(problem: CanvasProblem, message: string = problem) {
    super(message)
    this.problem = problem
  }
}

export function canvasProblem(e: unknown): string {
  const p = e instanceof CanvasError ? e.problem : 'server'
  if (p === 'no-mailbox') return 'connect your mailbox first (mailbox & sync, above): it’s what lets the relay know it’s you.'
  if (p === 'not-connected') return 'connect Canvas first.'
  if (p === 'offline') return cantReach('Canvas', 'couldn’t reach Canvas. are you online?')
  if (p === 'bad-token') return 'Canvas didn’t accept that token. make a new one in Canvas → Account → Settings → New Access Token.'
  if (p === 'bad-url') return 'that doesn’t look like a Canvas address. it’s usually something like https://canvas.yourschool.edu'
  if (p === 'limit') return 'that’s a lot of syncing for one day. try again tomorrow?'
  return 'Canvas is having a moment. try again in a bit?'
}

export const cleanBase = (url: string) => {
  const m = /^(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})\/?/i.exec(url.trim())
  return m ? `https://${m[1].toLowerCase()}` : ''
}

interface Relay<T> {
  status: number
  data: T
  next: string | null
}

/** One Canvas API call, through the relay. */
async function canvasApi<T>(path: string, base = getLinks().canvas.base, token = getLinks().canvas.token): Promise<Relay<T>> {
  const code = getGame().mailbox
  if (!code) throw new CanvasError('no-mailbox')
  if (!base || !token) throw new CanvasError('not-connected')
  let res: Response
  try {
    res = await fetch(`${FUNCTIONS_URL}/canvas-proxy`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, base, token, path }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new CanvasError('offline')
  }
  const body = (await res.json().catch(() => null)) as (Relay<T> & { error?: string }) | null
  if (res.status === 429) throw new CanvasError('limit')
  if (!res.ok || !body) throw new CanvasError(body?.error === 'bad-url' ? 'bad-url' : body?.error === 'no-mailbox' ? 'no-mailbox' : 'server', body?.error)
  if (body.status === 401) throw new CanvasError('bad-token')
  if (body.status >= 400) throw new CanvasError('server', `canvas ${body.status}`)
  return body
}

/** Every page of a list (Canvas pages everything), up to a sensible limit. */
async function all<T>(path: string, pages = 3): Promise<T[]> {
  const out: T[] = []
  let next: string | null = path
  for (let i = 0; next && i < pages; i++) {
    const r: Relay<T[]> = await canvasApi<T[]>(next)
    out.push(...(Array.isArray(r.data) ? r.data : []))
    next = r.next
  }
  return out
}

/** Check a token by asking Canvas who she is, and remember both. */
export async function connectCanvas(url: string, token: string): Promise<string> {
  const base = cleanBase(url)
  if (!base) throw new CanvasError('bad-url')
  const r = await canvasApi<{ name?: string; short_name?: string }>('/api/v1/users/self', base, token.trim())
  const user = (r.data?.short_name || r.data?.name || 'you').slice(0, 40)
  patchLinks('canvas', { base, token: token.trim(), user, lastSync: 0 })
  return user
}

export function disconnectCanvas() {
  patchLinks('canvas', { base: '', token: '', user: '', lastSync: 0 })
}

export interface CanvasCourse {
  id: number
  name: string
  /** Tidied for the bookcase. */
  short: string
  /** Already one of her classes. */
  known: boolean
}

export async function canvasCourses(): Promise<CanvasCourse[]> {
  const raw = await all<{ id: number; name?: string; course_code?: string; access_restricted_by_date?: boolean }>('/api/v1/courses?enrollment_state=active&per_page=50')
  const s = getGame()
  return raw
    .filter((c) => c.name && !c.access_restricted_by_date)
    .map((c) => {
      const short = cleanCourseName(c.name!)
      return { id: c.id, name: c.name!, short, known: !!matchCourse(s, c.name, short) }
    })
}

/** Put Canvas courses on the bookcase as classes (ones she already has are skipped). */
export function addCanvasClasses(courses: readonly Pick<CanvasCourse, 'name' | 'short'>[]): number {
  let added = 0
  setGame((s0) => {
    let s = s0
    for (const c of courses) {
      if (matchCourse(s, c.name, c.short)) continue
      s = addCourse(s, { ...draftCourse(s, 'class'), name: c.short }, Date.now() + added)
      added++
    }
    return s
  })
  return added
}

let syncing: Promise<number> | null = null

/** Due dates from every active course. Resolves to how many Canvas items are on the list. */
export function syncCanvas(): Promise<number> {
  if (syncing) return syncing
  syncing = (async () => {
    const courses = await canvasCourses()
    const items: CanvasAssignment[] = []
    for (const c of courses.slice(0, 12)) {
      const list = await all<{ id: number; name: string; due_at: string | null; submission?: { workflow_state?: string } }>(
        `/api/v1/courses/${c.id}/assignments?per_page=100&order_by=due_at&bucket=future&include[]=submission`,
        2,
      )
      for (const a of list) items.push({ id: a.id, name: a.name, due_at: a.due_at, course: c.short, submitted: a.submission?.workflow_state === 'submitted' || a.submission?.workflow_state === 'graded' })
    }
    const now = Date.now()
    const events = items.map(fromCanvas).filter((e): e is NonNullable<typeof e> => !!e)
    setGame((s) => importEvents(s, 'canvas', events, now))
    patchLinks('canvas', { lastSync: now })
    return getGame().exams.filter((e) => e.source === 'canvas').length
  })().finally(() => {
    syncing = null
  })
  return syncing
}

export function syncCanvasIfStale(hours = 6) {
  const { canvas } = getLinks()
  if (!canvas.base || !canvas.token || Date.now() - canvas.lastSync < hours * 3_600_000) return
  syncCanvas().catch(() => {})
}
