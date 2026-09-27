// The post office: letters written from far away, delivered by the fox.
//
// Letters live in a small Supabase database. The key below is Supabase's
// *publishable* key, which is meant to be public: on its own it can't read or
// write anything. Every call goes through a database function that also needs
// a secret code (her mailbox code to read, the writer key to write), and the
// database only stores hashes of those codes. See supabase/migrations/.
import type { MailLetter } from './logic.ts'
import { normalizeCode } from './mailcode.ts'

const SUPABASE_URL = 'https://slaeektmteyxlkebxhan.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VNBq8VEgE_HWarmCrool1A_5kszWmVU'

export type MailProblem = 'wrong-code' | 'offline' | 'full' | 'conflict' | 'server'

export class MailError extends Error {
  readonly problem: MailProblem
  constructor(problem: MailProblem, message: string) {
    super(message)
    this.problem = problem
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>, keepalive = false): Promise<T> {
  let res: Response
  const body = JSON.stringify(args)
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body,
      // lets a save finish as the app goes to the background (browsers cap these at 64 KB)
      keepalive: keepalive && body.length < 60_000,
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new MailError('offline', 'could not reach the post office')
  }
  const data = await res.json().catch(() => null)
  if (res.ok) return data as T
  const message = String(data?.message ?? res.statusText)
  if (data?.code === '28000') throw new MailError('wrong-code', message)
  if (res.status === 409) throw new MailError('conflict', message)
  if (/full/.test(message)) throw new MailError('full', message)
  throw new MailError('server', message)
}

/** Is this a real mailbox code? */
export function checkMailbox(code: string): Promise<boolean> {
  return rpc<boolean>('tl_check_mailbox', { p_code: normalizeCode(code) })
}

/** Letters that have arrived (scheduled ones stay hidden until their time). */
export function fetchLetters(code: string): Promise<MailLetter[]> {
  return rpc<MailLetter[]>('tl_fetch_letters', { p_code: normalizeCode(code) })
}

export interface SentLetter extends MailLetter {
  created_at: string
}

export function sendLetter(key: string, body: string, signed: string, deliverAt: Date | null): Promise<string> {
  return rpc<string>('tl_send_letter', {
    p_key: normalizeCode(key),
    p_body: body,
    p_signed: signed,
    p_deliver_at: deliverAt ? deliverAt.toISOString() : null,
  })
}

/** Everything in the mailbox, including letters still waiting for their day. */
export function listLetters(key: string): Promise<SentLetter[]> {
  return rpc<SentLetter[]>('tl_list_letters', { p_key: normalizeCode(key) })
}

export function deleteLetter(key: string, id: string): Promise<boolean> {
  return rpc<boolean>('tl_delete_letter', { p_key: normalizeCode(key), p_id: id })
}

// ─── cloud save: the same fox on her iPhone and her Mac ─────────────────────

export interface CloudSave {
  version: number
  state: Record<string, unknown>
  updated_at: string
}

/** 0 when there's no save yet. */
export function saveVersion(code: string): Promise<number> {
  return rpc<number>('tl_save_version', { p_code: normalizeCode(code) })
}

export async function loadSave(code: string): Promise<CloudSave | null> {
  const rows = await rpc<CloudSave[]>('tl_load_save', { p_code: normalizeCode(code) })
  return rows[0] ?? null
}

/** Store a save made from `version` (0 = first save). Throws a 'conflict' MailError if the cloud has moved on. */
export function storeSave(code: string, state: object, version: number, keepalive = false): Promise<number> {
  return rpc<number>('tl_store_save', { p_code: normalizeCode(code), p_state: state, p_version: version }, keepalive)
}
