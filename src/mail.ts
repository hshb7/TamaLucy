import { receiveLetters } from './game/logic.ts'
import { checkMailbox, fetchLetters, MailError } from './game/remote.ts'
import { normalizeCode } from './game/mailcode.ts'
import type { Note } from './game/state.ts'
import { getGame, setGame } from './game/store.ts'

let inFlight = false
const listeners = new Set<(added: Note[]) => void>()

/** Be told whenever new letters arrive. Returns an unsubscribe function. */
export function onNewMail(fn: (added: Note[]) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
/** Last failed look (offline, post office asleep): wait a while before trying again. */
let lastFail = 0

/**
 * Look in the mailbox, if it's been at least `gapMs` since the last look.
 * Never during a focus session (a letter would pull her out of it).
 * Quietly gives up when offline, unless `loud` (the "check now" button).
 */
export async function checkMail(gapMs: number, loud = false): Promise<Note[]> {
  const s = getGame()
  if (!s.mailbox || inFlight || s.session) return []
  if (Date.now() - Math.max(s.lastMailCheck, loud ? 0 : lastFail) < gapMs) return []
  inFlight = true
  try {
    const letters = await fetchLetters(s.mailbox)
    let added: Note[] = []
    setGame((g) => {
      if (g.mailbox !== s.mailbox) return g
      const r = receiveLetters(g, letters, Date.now())
      added = r.added
      return r.state
    })
    if (added.length) listeners.forEach((l) => l(added))
    return added
  } catch (e) {
    lastFail = Date.now()
    if (loud) throw e
    return []
  } finally {
    inFlight = false
  }
}

/** Connect her mailbox. Resolves false if the code doesn't open anything. */
export async function connectMailbox(code: string): Promise<boolean> {
  const clean = normalizeCode(code)
  if (!clean) return false
  if (!(await checkMailbox(clean))) return false
  setGame((s) => ({ ...s, mailbox: clean, lastMailCheck: 0 }))
  return true
}

/** A code from a `#mail=...` link, removed from the address bar right away. */
export function takeMailLink(): string | null {
  const m = location.hash.match(/^#mail=(.+)$/)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

export function mailProblem(e: unknown): string {
  const problem = e instanceof MailError ? e.problem : 'server'
  if (problem === 'offline') return 'couldn’t reach the post office. are you online?'
  if (problem === 'wrong-code') return 'hmm, that code doesn’t open any mailbox.'
  return 'the post office is having a moment. try again in a bit?'
}
