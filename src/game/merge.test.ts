import { describe, expect, it } from 'vitest'
import { freshState, type GameState, type Note } from './state.ts'
import { completeFocus, doCare, startFocus } from './logic.ts'
import { meaningfulChange, merge3, same } from './merge.ts'

const MIN = 60_000
const HOUR = 60 * MIN
const T0 = new Date(2026, 8, 1, 9, 0, 0).getTime()
const base = (): GameState => ({ ...freshState(T0), onboarded: true, acorns: 10 })
const note = (id: string, at: number, read = false): Note => ({ id, at, read, kind: 'fox', text: id })

describe('merging her iPhone and Mac', () => {
  it('adds up what both devices earned', () => {
    const b = base()
    const phone = completeFocus(startFocus(b, T0, 25, 'Torts'), T0 + 25 * MIN)
    const mac = completeFocus(startFocus(b, T0 + HOUR, 50, 'Contracts'), T0 + HOUR + 50 * MIN)
    const m = merge3(b, mac, phone)
    expect(m.acorns).toBe(10 + 5 + 10)
    expect(m.stats.totalMinutes).toBe(75)
    expect(m.stats.sessions).toBe(2)
    expect(m.stats.subjects).toEqual({ Torts: 25, Contracts: 50 })
  })

  it('counts acorns spent on either side', () => {
    const b = base()
    const phone = doCare(b, T0, 'bath') // -2
    const mac = doCare(doCare(b, T0, 'cuddle'), T0, 'chat') // -2
    expect(merge3(b, mac, phone).acorns).toBe(6)
  })

  it('keeps letters from both, and remembers which were read', () => {
    const b = { ...base(), notes: [note('a', 1)] }
    const phone = { ...b, notes: [note('p', 3), note('a', 1, true)] }
    const mac = { ...b, notes: [note('m', 2), note('a', 1)] }
    const m = merge3(b, mac, phone)
    expect(m.notes.map((n) => n.id)).toEqual(['p', 'm', 'a'])
    expect(m.notes.find((n) => n.id === 'a')?.read).toBe(true)
  })

  it('keeps clothes won on either device, and honours deletions', () => {
    const b = { ...base(), wardrobe: ['beret'], cards: [{ id: 'c1', front: 'x', back: 'y', subject: 'Torts', box: 1, due: 0, created: 0 }] }
    const phone = { ...b, wardrobe: ['beret', 'scarf'] }
    const mac = { ...b, wardrobe: ['beret', 'frog'], cards: [] }
    const m = merge3(b, mac, phone)
    expect([...m.wardrobe].sort()).toEqual(['beret', 'frog', 'scarf'])
    expect(m.cards).toEqual([])
  })

  it('lets whichever side changed a setting win, field by field', () => {
    const b = base()
    const phone = { ...b, settings: { ...b.settings, sound: false }, foxName: 'Hazel' }
    const mac = { ...b, settings: { ...b.settings, ambient: 'rain' as const }, decor: { ...b.decor, wall: 'gingham' } }
    const m = merge3(b, mac, phone)
    expect([m.settings.sound, m.settings.ambient, m.foxName, m.decor.wall]).toEqual([false, 'rain', 'Hazel', 'gingham'])
  })

  it('never takes the other device’s focus session or leave rule', () => {
    const b = base()
    const phone = startFocus({ ...b, settings: { ...b.settings, leaveMode: 'strict' } }, T0, 25, '')
    const mac = { ...b, settings: { ...b.settings, leaveMode: 'free' as const } }
    const onMac = merge3(b, mac, { ...phone, session: null })
    expect(onMac.session).toBeNull()
    expect(onMac.settings.leaveMode).toBe('free')
    const onPhone = merge3(b, phone, { ...mac, settings: { ...mac.settings, sound: false } })
    expect(onPhone.session).toEqual(phone.session)
    expect(onPhone.settings.leaveMode).toBe('strict')
  })

  it('takes the needs and their clock from the cloud, so time away isn’t counted twice', () => {
    const b = base()
    const phone = { ...b, needs: { ...b.needs, social: 90 }, lastTick: T0 + HOUR }
    const mac = { ...b, needs: { ...b.needs, social: 10 }, lastTick: T0 + 5 * HOUR }
    const m = merge3(b, mac, phone)
    expect(m.needs.social).toBe(90)
    expect(m.lastTick).toBe(T0 + HOUR)
  })

  it('tidies the pantry and ignores the cloud’s key order', () => {
    const b = { ...base(), pantry: { cookie: 1 } }
    const phone = { ...b, pantry: {} }
    const mac = { ...b, pantry: { cookie: 1, peach: 2 } }
    expect(merge3(b, mac, phone).pantry).toEqual({ peach: 2 })
    expect(same({ a: 1, b: { c: 2, d: undefined } }, { b: { c: 2 }, a: 1 })).toBe(true)
  })

  it('only pushes when she actually did something', () => {
    const b = base()
    expect(meaningfulChange(b, { ...b, lastTick: T0 + HOUR, needs: { ...b.needs, hunger: 3 } })).toBe(false)
    expect(meaningfulChange(b, doCare(b, T0, 'cuddle'))).toBe(true)
  })
})
