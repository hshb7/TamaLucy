import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './state.ts'
import { GIFT } from '../gift.ts'
import {
  arrive,
  bondLevel,
  celebratePromotion,
  claim,
  completeFocus,
  doActivity,
  focusHidden,
  focusVisible,
  foxMood,
  moodOf,
  moodValue,
  offer,
  ownsClothing,
  pendingPromotion,
  pet,
  resolveAdventure,
  setDecor,
  simulate,
  startFocus,
  streak,
  dayKey,
  toggleWear,
} from './logic.ts'
import { migrate } from './state.ts'
import { LAW_RANKS, rankIn, rankOf, unlocked } from './career.ts'
import { LEGACY_STUDY } from './studySetup.ts'

const HOUR = 3_600_000
const MIN = 60_000
// A fixed local noon so night-time slowdowns are predictable.
const T0 = new Date(2026, 8, 1, 12, 0, 0).getTime()
const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

const FULL = { hunger: 80, energy: 80, fun: 80, hygiene: 80, social: 80 }
function ready(overrides: Partial<GameState> = {}): GameState {
  // these tests were written for the law school edition
  return { ...freshState(T0, seq(0.1, 0.5)), onboarded: true, study: LEGACY_STUDY, needs: { ...FULL }, bowl: 0, ...overrides }
}
const mood = (s: GameState) => moodOf(moodValue(s.needs))

describe('needs & mood', () => {
  it('is fine after a day away, sad after two, depressed after three', () => {
    const s = ready()
    expect(mood(simulate(s, T0 + 24 * HOUR, true))).toMatch(/happy|okay/)
    expect(mood(simulate(s, T0 + 48 * HOUR, true))).toMatch(/sad/)
    expect(mood(simulate(s, T0 + 72 * HOUR, true))).toBe('depressed')
  })

  it('never goes out of bounds', () => {
    const s = simulate(ready(), T0 + 400 * 24 * HOUR)
    expect(Object.values(s.needs).every((v) => v >= 0 && v <= 100)).toBe(true)
    expect(s.needs.hunger).toBe(0)
  })

  it('one very low need drags the mood down', () => {
    expect(moodValue({ ...FULL, hygiene: 5 })).toBeLessThan(60)
    expect(moodValue(FULL)).toBeGreaterThan(75)
  })

  it('eats from the bowl on its own while you are away', () => {
    const hungry = ready({ needs: { ...FULL, hunger: 40 }, bowl: 3 })
    const later = simulate(hungry, T0 + 6 * HOUR, true)
    expect(later.bowl).toBeLessThan(3)
    expect(later.needs.hunger).toBeGreaterThan(simulate({ ...hungry, bowl: 0 }, T0 + 6 * HOUR, true).needs.hunger)
  })

  it('restores energy while sleeping at night', () => {
    const night = new Date(2026, 8, 1, 23, 30).getTime()
    const tired = ready({ needs: { ...FULL, energy: 20 }, lastTick: night })
    expect(simulate(tired, night + 6 * HOUR).needs.energy).toBeGreaterThan(60)
  })

  it('mood helper agrees with the needs', () => {
    expect(foxMood(ready())).toBe(mood(ready()))
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
    expect(r.state.needs.social).toBeLessThan(80)
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

  it('treats fill the tummy (favourites more) and stock the pantry', () => {
    const s = done()
    const fav = s.favoriteTreats[0]
    const r = claim({ ...s, needs: { ...s.needs, hunger: 10 } }, T0, 'treat', fav)!
    expect(r.result).toMatchObject({ kind: 'treat', favorite: true, firstFavorite: true })
    expect(r.state.needs.hunger).toBe(55)
    expect(r.state.pantry[fav]).toBe(2)
    const fed = doActivity(r.state, T0, 'treat', fav)
    expect(fed.pantry[fav]).toBe(1)
    expect(fed.needs.hunger).toBeGreaterThan(r.state.needs.hunger)
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

describe('law career', () => {
  const at = (totalMinutes: number) => ({ study: LEGACY_STUDY, stats: { ...freshState(0).stats, totalMinutes } })
  it('climbs ranks with focus time and unlocks decor + outfits', () => {
    expect(rankOf(at(0))).toBe(0)
    expect(LAW_RANKS[rankOf(at(60))].title).toBe('1L')
    expect(LAW_RANKS[rankOf(at(6600))].title).toBe('Supreme Court Justice')
    expect(unlocked(at(0), 'wall')).not.toContain('gingham')
    expect(unlocked(at(60), 'wall')).toContain('gingham')
    expect(unlocked(at(4800), 'clothes')).toContain('judgeWig')
  })

  it('announces a promotion once', () => {
    let s = ready()
    s = completeFocus(startFocus(s, T0, 60, ''), T0 + 60 * MIN)
    expect(pendingPromotion(s)).toBe(1)
    s = celebratePromotion(s)
    expect(pendingPromotion(s)).toBeNull()
  })

  it('locks decor and career outfits until earned', () => {
    const s = ready()
    expect(setDecor(s, { wall: 'library' }).decor.wall).toBe('stripes')
    expect(setDecor(s, { wall: 'hearts' }).decor.wall).toBe('hearts')
    expect(ownsClothing(s, 'judgeWig')).toBe(false)
    expect(toggleWear(s, 'judgeWig').equipped.head).toBeUndefined()
    const judge = ready({ stats: { ...s.stats, totalMinutes: 5000 } })
    expect(toggleWear(judge, 'judgeWig').equipped.head).toBe('judgeWig')
  })

  it('never offers career outfits as random rewards', () => {
    const s = offer(completeFocus(startFocus(ready(), T0, 25, ''), T0 + 25 * MIN), 'clothes', seq(0.99, 0.01, 0.5))
    expect(s.pending!.offer!.options.some((id) => ['necktie', 'gradCap', 'judgeWig'].includes(id))).toBe(false)
  })
})

describe('save migration', () => {
  it('upgrades a v1 save to needs', () => {
    const v1 = { ...freshState(T0), v: 1, happiness: 40, tummy: 20, stats: { ...freshState(T0).stats, totalMinutes: 300 } } as Record<string, unknown>
    delete v1.needs
    const s = migrate(v1)
    expect(s.v).toBe(2)
    expect(s.needs.hunger).toBe(20)
    expect(s.needs.social).toBe(40)
    expect(s.rankSeen).toBe(rankIn(LAW_RANKS, 300)) // no retroactive promotion spam
    expect('happiness' in s).toBe(false)
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

  it('social actions fade out when spammed', () => {
    let s = ready({ needs: { ...FULL, social: 20 } })
    for (let i = 0; i < 6; i++) s = pet(s, T0 + i * 1000).state
    const afterSix = s.needs.social
    expect(afterSix).toBe(38)
    for (let i = 0; i < 10; i++) s = pet(s, T0 + (10 + i) * 1000).state
    expect(s.needs.social - afterSix).toBeLessThan(10)
  })

  it('bowl only feeds when there is food in it', () => {
    const empty = ready({ needs: { ...FULL, hunger: 20 }, bowl: 0 })
    expect(doActivity(empty, T0, 'eat').needs.hunger).toBe(20)
    const full = doActivity({ ...empty, bowl: 2 }, T0, 'eat')
    expect(full.needs.hunger).toBe(48)
    expect(full.bowl).toBe(1)
  })

  it('records focus time per subject', () => {
    const s = completeFocus(startFocus(ready(), T0, 25, 'Torts'), T0 + 25 * MIN)
    expect(s.stats.subjects).toEqual({ Torts: 25 })
  })

  it('levels up with focus time', () => {
    expect(bondLevel(0)).toBe(1)
    expect(bondLevel(15)).toBe(2)
    expect(bondLevel(60)).toBe(3)
  })
})

describe('flashcards', async () => {
  const { makeRound, CARDS } = await import('./flashcards.ts')
  it('builds rounds with one right answer among four', () => {
    const round = makeRound(8)
    expect(round).toHaveLength(8)
    for (const q of round) {
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices).size).toBe(4)
      expect(q.choices[q.answer]).toBe(q.card.meaning)
    }
    expect(new Set(CARDS.map((c) => c.term)).size).toBe(CARDS.length)
  })
})
