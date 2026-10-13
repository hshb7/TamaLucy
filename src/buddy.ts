// The study buddy: the fox makes flashcards from her notes and quizzes her,
// with a little help from Claude. The model is called from a Supabase Edge
// Function (supabase/functions/study-buddy) that holds the API key, checks
// her mailbox code, and keeps a daily cap, so the app itself holds no secret.
import { getGame } from './game/store.ts'
import { FUNCTIONS_URL, SUPABASE_KEY } from './game/remote.ts'

export type BuddyProblem = 'no-mailbox' | 'offline' | 'not-set-up' | 'limit' | 'refused' | 'too-long' | 'server'

export class BuddyError extends Error {
  readonly problem: BuddyProblem
  constructor(problem: BuddyProblem, message: string = problem) {
    super(message)
    this.problem = problem
  }
}

export function buddyProblem(e: unknown, fox: string): string {
  const p = e instanceof BuddyError ? e.problem : 'server'
  if (p === 'no-mailbox') return `connect your mailbox in settings first: it’s how ${fox} knows it’s you.`
  if (p === 'offline') return `couldn’t reach ${fox}’s desk. are you online?`
  if (p === 'not-set-up') return `the study buddy isn’t switched on for this app yet (whoever set it up needs to add a Claude API key, see the README).`
  if (p === 'limit') return `${fox} has done a lot of thinking today. more tomorrow?`
  if (p === 'refused') return `${fox} couldn’t help with that one. try different notes?`
  if (p === 'too-long') return `that’s a lot of notes at once. try a smaller chunk (a few pages at most).`
  return `${fox} got a bit muddled. try again in a moment?`
}

/** Notes longer than this are asked for in pieces. */
export const MAX_NOTES = 12_000

async function callBuddy<T>(task: string, body: Record<string, unknown>): Promise<T> {
  const code = getGame().mailbox
  if (!code) throw new BuddyError('no-mailbox')
  let res: Response
  try {
    res = await fetch(`${FUNCTIONS_URL}/study-buddy`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, task, fox: getGame().foxName, ...body }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch {
    throw new BuddyError('offline')
  }
  const data = (await res.json().catch(() => null)) as ({ error?: string } & Record<string, unknown>) | null
  if (res.ok && data) return data as T
  const err = data?.error
  if (res.status === 503 || err === 'not-set-up') throw new BuddyError('not-set-up')
  if (res.status === 429 || err === 'limit') throw new BuddyError('limit')
  if (err === 'refused') throw new BuddyError('refused')
  if (err === 'too-long') throw new BuddyError('too-long')
  if (err === 'no-mailbox' || err === 'wrong-code') throw new BuddyError('no-mailbox')
  throw new BuddyError('server', String(err ?? res.status))
}

export interface DraftCard {
  front: string
  back: string
}

/** Flashcards from pasted notes, an outline, a case brief. */
export async function makeCards(o: { notes: string; subject: string; count: number }): Promise<DraftCard[]> {
  if (o.notes.length > MAX_NOTES) throw new BuddyError('too-long')
  const r = await callBuddy<{ cards: DraftCard[] }>('cards', o)
  return (r.cards ?? []).filter((c) => c.front?.trim() && c.back?.trim()).map((c) => ({ front: c.front.trim().slice(0, 120), back: c.back.trim().slice(0, 400) }))
}

export interface Question {
  question: string
  hint: string
}

/** One question about a class, in the fox's voice. Her own cards give it something to go on. */
export function askQuestion(o: { subject: string; cards: DraftCard[]; recent: string[] }): Promise<Question> {
  return callBuddy<Question>('ask', { ...o, cards: o.cards.slice(0, 40), recent: o.recent.slice(-6) })
}

export interface Verdict {
  verdict: 'yes' | 'almost' | 'no'
  feedback: string
  answer: string
}

export function checkAnswer(o: { subject: string; question: string; answer: string }): Promise<Verdict> {
  return callBuddy<Verdict>('check', o)
}
