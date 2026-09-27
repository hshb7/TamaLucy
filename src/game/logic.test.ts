import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './state.ts'
import { GIFT } from '../gift.ts'
import {
  arrive,
  bondLevel,
  claim,
  completeFocus,
  decay,
  focusHidden,
  focusVisible,
  moodOf,
  offer,
  pet,
  resolveAdventure,
  startFocus,
  streak,
  dayKey,
} from './logic.ts'

const HOUR = 3_600_000
const MIN = 60_000
// A fixed local noon so night-time slowdowns are predictable.
const T0 = new Date(2026, 8, 1, 12, 0, 0).getTime()
const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

function ready(overrides: Partial<GameState> = {}): GameState {
  return { ...freshState(T0, seq(0.1, 0.5)), onboarded: true, happiness: 80, tummy: 80, ...overrides }
}

describe('mood decay', () => {
  it('stays fine after a day, sad after two, depressed after three', () => {
    const s = ready()
    expect(moodOf(decay(s, T0 + 24 * HOUR).happiness)).toMatch(/happy|okay/)
    expect(moodOf(decay(s, T0 + 48 * HOUR).happiness)).toMatch(/sad|okay/)
    expect(moodOf(decay(s, T0 + 72 * HOUR).happiness)).toBe('depressed')
  })

  it('never goes out of bounds', () => {
    const s = decay(ready(), T0 + 400 * 24 * HOUR)
    expect(s.happiness).toBe(0)
    expect(s.tummy).toBe(0)
  })

  it('leaves a "missed you" note after a long absence', () => {
    const s = arrive({ ...ready(), lastVisit: T0 }, T0 + 40 * HOUR, seq(0))
    expect(s.notes[0]?.kind).toBe('missed')
  })
})

describe('focus sessions', () => {
  it('completes and grants a reward pick', () => {
    let s = startFocus(ready(), T0, 25, 'essay')
    expect(completeFocus(s, T0 + 10 * MIN)).toBe(s) // not done yet
    s = completeFocus(s, T0 + 25 * MIN)
    expect(s.session).toBeNull()
    expect(s.pending).toMatchObject({ minutes: 25, picksLeft: 1, choices: 3, label: 'essay' })
    expect(s.stats.totalMinutes).toBe(25)
    expect(s.stats.days[dayKey(T0)]).toBe(25)
    expect(s.stats.daySessions[dayKey(T0)]).toBe(1)
  })

  it('long sessions give two picks, short ones fewer choices', () => {
    expect(completeFocus(startFocus(ready(), T0, 45, ''), T0 + 45 * MIN).pending?.picksLeft).toBe(2)
    expect(completeFocus(startFocus(ready(), T0, 10, ''), T0 + 10 * MIN).pending?.choices).toBe(2)
  })

  it('forgives a quick glance away within the grace period', () => {
    let s = startFocus(ready(), T0, 25, '')
    s = focusHidden(s, T0 + MIN)
    const r = focusVisible(s, T0 + MIN + 5000)
    expect(r.outcome).toBe('close-call')
    expect(r.state.session).not.toBeNull()
  })

  it('fails the session when you leave for too long (strict)', () => {
    let s = startFocus(ready(), T0, 25, '')
    s = focusHidden(s, T0 + MIN)
    const r = focusVisible(s, T0 + 3 * MIN)
    expect(r.outcome).toBe('failed')
    expect(r.state.session).toBeNull()
    expect(r.state.happiness).toBeLessThan(80)
    expect(r.state.stats.left).toBe(1)
  })

  it('pauses instead of failing in gentle mode', () => {
    const base = ready()
    let s = startFocus({ ...base, settings: { ...base.settings, leaveMode: 'gentle' } }, T0, 25, '')
    s = focusHidden(s, T0 + MIN)
    const r = focusVisible(s, T0 + 3 * MIN)
    expect(r.outcome).toBe('paused')
    expect(r.state.session?.endsAt).toBe(T0 + 27 * MIN)
  })

  it('only counts time away before the timer ended', () => {
    let s = startFocus(ready(), T0, 25, '')
    s = focusHidden(s, T0 + 25 * MIN - 2000)
    const r = focusVisible(s, T0 + 60 * MIN)
    expect(r.outcome).not.toBe('failed')
  })

  it('detects a killed page via the heartbeat', () => {
    const s = startFocus(ready(), T0, 25, '') // lastBeat = T0, never hidden
    expect(focusVisible(s, T0 + 5 * MIN).outcome).toBe('failed')
  })
})

describe('rewards', () => {
  const done = () => completeFocus(startFocus(ready(), T0, 25, ''), T0 + 25 * MIN)

  it('offers unowned gifts and places the chosen one', () => {
    let s = offer(done(), 'gift', seq(0.3))
    const opts = s.pending!.offer!.options
    expect(opts).toHaveLength(3)
    const r = claim(s, T0, 'gift', opts[0])!
    s = r.state
    expect(s.gifts).toContain(opts[0])
    expect(s.pending).toBeNull()
  })

  it('treats fill the tummy, favourites more', () => {
    const s = done()
    const fav = s.favoriteTreats[0]
    const r = claim({ ...s, tummy: 10 }, T0, 'treat', fav)!
    expect(r.result).toMatchObject({ kind: 'treat', favorite: true, firstFavorite: true })
    expect(r.state.tummy).toBe(55)
  })

  it('new clothes are worn straight away', () => {
    const r = claim(done(), T0, 'clothes', 'frogHat')!
    expect(r.state.equipped.head).toBe('frogHat')
  })

  it('notes land in the mailbox unread', () => {
    const r = claim(done(), T0, 'note', null, seq(0.5))!
    expect(r.result.kind).toBe('note')
    expect(r.state.notes[0].read).toBe(false)
  })

  it('adventures come back with a postcard', () => {
    const r = claim(done(), T0, 'adventure', 'pond', seq(0))!
    expect(r.state.adventure?.id).toBe('pond')
    const later = resolveAdventure(r.state, r.state.adventure!.returnsAt + 1, seq(0))
    expect(later.adventure).toBeNull()
    expect(later.postcardToShow?.adventure).toBe('pond')
  })

  it('rejects bogus choices', () => {
    expect(claim(done(), T0, 'gift', 'spaceship')).toBeNull()
  })
})

describe('secret letters', () => {
  it('delivers letters from gift.ts on milestone sessions, in order', () => {
    const saved = GIFT.secretNotes
    GIFT.secretNotes = ['first letter', 'second letter']
    try {
      let s = completeFocus(startFocus(ready(), T0, 25, ''), T0 + 25 * MIN) // session #1 is a milestone
      expect(s.pending?.foundLetter).toBe(true)
      expect(s.notes[0]).toMatchObject({ kind: 'secret', text: 'first letter', read: false })
      s = completeFocus(startFocus({ ...s, pending: null }, T0 + HOUR, 25, ''), T0 + HOUR + 25 * MIN) // #2 is not
      expect(s.pending?.foundLetter).toBe(false)
      expect(s.secretsDelivered).toBe(1)
    } finally {
      GIFT.secretNotes = saved
    }
  })
})

describe('misc', () => {
  it('counts streaks, tolerating a not-yet-focused today', () => {
    const days = { [dayKey(T0 - 48 * HOUR)]: 25, [dayKey(T0 - 24 * HOUR)]: 25 }
    expect(streak(days, T0)).toBe(2)
    expect(streak({ ...days, [dayKey(T0)]: 10 }, T0)).toBe(3)
  })

  it('caps petting bonus', () => {
    let s = ready({ happiness: 50 })
    for (let i = 0; i < 10; i++) s = pet(s, T0 + i * 1000).state
    expect(s.happiness).toBe(60)
  })

  it('levels up with focus time', () => {
    expect(bondLevel(0)).toBe(1)
    expect(bondLevel(15)).toBe(2)
    expect(bondLevel(60)).toBe(3)
  })
})
