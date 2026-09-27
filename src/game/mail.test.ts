import { describe, expect, it } from 'vitest'
import { freshState, hydrate } from './state.ts'
import { receiveLetters, type MailLetter } from './logic.ts'
import { normalizeCode } from './mailcode.ts'
import { decodeBackup, encodeBackup } from './backup.ts'

const T0 = new Date(2026, 8, 1, 12, 0, 0).getTime()
const HOUR = 3_600_000
const letter = (id: string, hoursAgo: number, body = `letter ${id}`, signed = 'sam'): MailLetter => ({
  id,
  body,
  signed,
  deliver_at: new Date(T0 - hoursAgo * HOUR).toISOString(),
})

describe('letters in the mail', () => {
  it('puts new letters in the album, newest first, unread', () => {
    const s = { ...freshState(T0), mailbox: 'x' }
    const { state, added } = receiveLetters(s, [letter('b', 1), letter('a', 5)], T0)
    expect(added.map((n) => n.id)).toEqual(['post-b', 'post-a'])
    expect(state.notes.slice(0, 2).map((n) => [n.kind, n.text, n.signed, n.read])).toEqual([
      ['post', 'letter b', 'sam', false],
      ['post', 'letter a', 'sam', false],
    ])
    expect(state.notes[0].at).toBe(T0 - HOUR)
    expect(state.lastMailCheck).toBe(T0)
  })

  it('never delivers the same letter twice', () => {
    const s = freshState(T0)
    const once = receiveLetters(s, [letter('a', 2)], T0).state
    const twice = receiveLetters(once, [letter('b', 1), letter('a', 2)], T0 + HOUR)
    expect(twice.added.map((n) => n.id)).toEqual(['post-b'])
    expect(twice.state.notes.filter((n) => n.kind === 'post')).toHaveLength(2)
    expect(receiveLetters(twice.state, [letter('b', 1), letter('a', 2)], T0 + 2 * HOUR).added).toHaveLength(0)
  })

  it('keeps her place when nothing new came', () => {
    const s = freshState(T0)
    const r = receiveLetters(s, [], T0 + HOUR)
    expect(r.added).toHaveLength(0)
    expect(r.state.notes).toBe(s.notes)
    expect(r.state.lastMailCheck).toBe(T0 + HOUR)
  })

  it('dates a letter no later than when it arrived, and skips empty ones', () => {
    const future = { ...letter('f', 0), deliver_at: new Date(T0 + 5 * HOUR).toISOString() }
    const { added } = receiveLetters(freshState(T0), [future, letter('e', 1, '   ')], T0)
    expect(added).toHaveLength(1)
    expect(added[0].at).toBe(T0)
  })

  it('does not count mail towards the fox’s "recently used" notes', () => {
    const s = freshState(T0)
    expect(receiveLetters(s, [letter('a', 1)], T0).state.usedNotes).toEqual(s.usedNotes)
  })

  it('old saves get an empty mailbox', () => {
    const { mailbox: _m, lastMailCheck: _l, ...old } = freshState(T0)
    const s = hydrate(old as unknown as Record<string, unknown>, T0)
    expect(s.mailbox).toBe('')
    expect(s.lastMailCheck).toBe(0)
  })

  it('backups keep the mailbox and its letters', async () => {
    const s = receiveLetters({ ...freshState(T0), onboarded: true, mailbox: 'acorn-bear-123' }, [letter('a', 1)], T0).state
    const back = await decodeBackup(await encodeBackup(s), T0)
    expect(back.mailbox).toBe('acorn-bear-123')
    expect(back.notes.find((n) => n.id === 'post-a')?.signed).toBe('sam')
  })
})

describe('mailbox codes', () => {
  it('forgive capitals, spaces and underscores', () => {
    expect(normalizeCode('  Acorn Bear_cloud\tDaisy-elm 123 ')).toBe('acorn-bear-cloud-daisy-elm-123')
    expect(normalizeCode('acorn-bear-cloud-daisy-elm-123')).toBe('acorn-bear-cloud-daisy-elm-123')
  })
})
