import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './state.ts'
import { arrive, available, completeFocus, offer, simulate, startFocus } from './logic.ts'
import { moodOf, moodValue } from './needs.ts'
import { addCard, addExam, daysUntil, deleteCard, dueCards, reviewCard, upcomingExams, BOX_DAYS } from './study.ts'
import { BackupError, decodeBackup, encodeBackup } from './backup.ts'
import { GIFT } from '../gift.ts'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const T0 = new Date(2026, 8, 1, 12, 0, 0).getTime() // 1 Sept 2026, noon
const FULL = { hunger: 80, energy: 80, fun: 80, hygiene: 80, social: 80 }
const ready = (o: Partial<GameState> = {}): GameState => ({ ...freshState(T0), onboarded: true, needs: { ...FULL }, bowl: 0, ...o })
const withCare = (care: 'classic' | 'gentle' | 'paused') => {
  const s = ready()
  return { ...s, settings: { ...s.settings, care } }
}

describe('care levels', () => {
  it('exam week freezes the needs completely', () => {
    const s = simulate(withCare('paused'), T0 + 10 * DAY, true)
    expect(s.needs).toEqual(FULL)
    expect(s.lastTick).toBe(T0 + 10 * DAY)
  })

  it('exam week sends no "missed you" letters', () => {
    const s = arrive({ ...withCare('paused'), lastVisit: T0 }, T0 + 5 * DAY)
    expect(s.notes.filter((n) => n.kind === 'missed')).toHaveLength(0)
  })

  it('gentle care never lets the fox get depressed', () => {
    const g = simulate(withCare('gentle'), T0 + 20 * DAY, true)
    expect(moodOf(moodValue(g.needs))).not.toBe('depressed')
    const c = simulate(withCare('classic'), T0 + 20 * DAY, true)
    expect(moodOf(moodValue(c.needs))).toBe('depressed')
  })
})

describe('her flashcards', () => {
  it('adds, schedules with Leitner boxes, and deletes', () => {
    let s = addCard(ready(), { front: 'Palsgraf', back: 'duty only to foreseeable plaintiffs', subject: 'Torts' }, T0)
    s = addCard(s, { front: '  ', back: 'blank front is ignored', subject: 'Torts' }, T0)
    expect(s.cards).toHaveLength(1)
    const id = s.cards[0].id
    expect(dueCards(s, T0)).toHaveLength(1)
    s = reviewCard(s, id, true, T0)
    expect(s.cards[0].box).toBe(2)
    expect(s.cards[0].due).toBe(T0 + BOX_DAYS[2] * DAY)
    expect(dueCards(s, T0)).toHaveLength(0)
    expect(dueCards(s, T0 + DAY)).toHaveLength(1)
    s = reviewCard(s, id, false, T0 + DAY)
    expect(s.cards[0].box).toBe(1)
    expect(dueCards(s, T0 + DAY, 'Contracts')).toHaveLength(0)
    expect(deleteCard(s, id).cards).toHaveLength(0)
  })
})

describe('exams', () => {
  it('counts days in local calendar days', () => {
    expect(daysUntil('2026-09-01', T0)).toBe(0)
    expect(daysUntil('2026-09-02', T0 + 11 * HOUR)).toBe(1) // 11pm the day before is still "tomorrow"
    expect(daysUntil('2026-08-30', T0)).toBe(-2)
  })

  it('lists upcoming exams in date order and wishes good luck once on the day', () => {
    let s = addExam(ready(), { name: 'Torts final', date: '2026-09-03', subject: 'Torts' }, T0)
    s = addExam(s, { name: 'Civ Pro midterm', date: '2026-09-02', subject: 'Civ Pro' }, T0)
    s = addExam(s, { name: 'bad date', date: 'soon', subject: '' }, T0)
    expect(upcomingExams(s, T0).map((e) => e.name)).toEqual(['Civ Pro midterm', 'Torts final'])
    const examDay = new Date(2026, 8, 3, 8).getTime()
    let later = arrive({ ...s, lastTick: examDay - HOUR, lastVisit: examDay - HOUR }, examDay)
    expect(later.notes[0].kind).toBe('exam')
    expect(later.notes[0].text).toContain('Torts final')
    const count = later.notes.length
    later = arrive(later, examDay + HOUR)
    expect(later.notes.length).toBe(count)
  })
})

describe('birthday', () => {
  it('delivers a birthday letter and party hat once a year', () => {
    const bday = new Date(2026, 8, 5, 9).getTime()
    let s = arrive({ ...ready(), birthday: '09-05', lastTick: bday - HOUR, lastVisit: bday - HOUR }, bday)
    expect(s.notes[0].kind).toBe('birthday')
    expect(s.equipped.head).toBe('partyHat')
    expect(s.wardrobe).toContain('partyHat')
    s = arrive(s, bday + 2 * HOUR)
    expect(s.notes.filter((n) => n.kind === 'birthday')).toHaveLength(1)
  })

  it('uses your own birthday letter from gift.ts when there is one', () => {
    const saved = { letter: GIFT.birthdayLetter, from: GIFT.from }
    GIFT.birthdayLetter = 'happy birthday from me'
    GIFT.from = 'you know who'
    try {
      const bday = new Date(2026, 8, 5, 9).getTime()
      const s = arrive({ ...ready(), birthday: '09-05', lastTick: bday, lastVisit: bday }, bday)
      expect(s.notes[0].text).toBe('happy birthday from me\n\n— you know who')
    } finally {
      GIFT.birthdayLetter = saved.letter
      GIFT.from = saved.from
    }
  })
})

describe('seasons', () => {
  const done = (t: number) => completeFocus(startFocus({ ...ready(), lastTick: t }, t, 25, ''), t + 25 * 60_000)
  it('offers the pumpkin hat only in October', () => {
    const oct = new Date(2026, 9, 10, 12).getTime()
    const octOffer = offer(done(oct), 'clothes', Math.random, oct).pending!.offer!.options
    expect(octOffer).toContain('pumpkinHat')
    const juneOffer = offer(done(T0), 'clothes', Math.random, new Date(2026, 5, 1).getTime()).pending!.offer!.options
    expect(juneOffer).not.toContain('pumpkinHat')
    expect(juneOffer).not.toContain('partyHat')
  })

  it('does not count out-of-season outfits as available', () => {
    const everything = ready({ wardrobe: ['beret', 'flowerCrown', 'beanie', 'frogHat', 'bow', 'strawberryHat', 'roundGlasses', 'heartShades', 'scarf', 'bellCollar', 'bandana'] })
    expect(available(everything, 'clothes', new Date(2026, 5, 1).getTime())).toBe(false)
    expect(available(everything, 'clothes', new Date(2026, 9, 1).getTime())).toBe(true)
  })
})

describe('backup codes', () => {
  it('round-trips a save and drops any running session', async () => {
    let s = addCard(ready({ foxName: 'Hazel', owner: 'Lucy' }), { front: 'mens rea', back: 'guilty mind', subject: 'Crim Law' }, T0)
    s = startFocus(s, T0, 25, 'Torts')
    const code = await encodeBackup(s)
    expect(code.startsWith('TAMALUCY1')).toBe(true)
    const back = await decodeBackup('\n' + code + '  \n', T0 + DAY)
    expect(back.foxName).toBe('Hazel')
    expect(back.cards[0].front).toBe('mens rea')
    expect(back.session).toBeNull()
    expect(back.lastTick).toBe(T0 + DAY)
  })

  it('explains what went wrong with a bad code', async () => {
    await expect(decodeBackup('hello', T0)).rejects.toBeInstanceOf(BackupError)
    const code = await encodeBackup(ready())
    await expect(decodeBackup(code.slice(0, 40), T0)).rejects.toThrow(/incomplete|damaged/)
  })

  it('restores an old v1 save', async () => {
    const v1 = { ...freshState(T0), v: 1, happiness: 50, tummy: 40 } as Record<string, unknown>
    delete v1.needs
    const code = 'TAMALUCY1:' + btoa(JSON.stringify(v1))
    const s = await decodeBackup(code, T0)
    expect(s.v).toBe(2)
    expect(s.needs.hunger).toBe(40)
    expect(s.cards).toEqual([])
  })
})
