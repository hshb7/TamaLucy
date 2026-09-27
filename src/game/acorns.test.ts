import { describe, expect, it } from 'vitest'
import { freshState, hydrate, type GameState } from './state.ts'
import { acornsFor, completeFocus, doActivity, doCare, refillBowl, refillCost, startFocus } from './logic.ts'

const MIN = 60_000
const T0 = new Date(2026, 8, 1, 12, 0, 0).getTime()
const LOW = { hunger: 20, energy: 80, fun: 20, hygiene: 20, social: 20 }
const ready = (o: Partial<GameState> = {}): GameState => ({ ...freshState(T0), onboarded: true, needs: { ...LOW }, ...o })

describe('acorns', () => {
  it('are earned by focusing: one per 5 minutes, at least one per session', () => {
    expect(acornsFor(25)).toBe(5)
    expect(acornsFor(60)).toBe(12)
    expect(acornsFor(12)).toBe(2)
    expect(acornsFor(0)).toBe(1)
    const s = completeFocus(startFocus(ready({ acorns: 0 }), T0, 25, ''), T0 + 25 * MIN)
    expect(s.acorns).toBe(5)
    expect(s.pending?.acorns).toBe(5)
  })

  it('pay for the things she asks the fox to do', () => {
    const broke = ready({ acorns: 0 })
    expect(doCare(broke, T0, 'cuddle')).toBe(broke)
    expect(doCare(broke, T0, 'bath')).toBe(broke)
    const after = doCare(ready({ acorns: 3 }), T0, 'bath')
    expect(after.acorns).toBe(1)
    expect(after.needs.hygiene).toBe(100)
    expect(doCare(after, T0, 'bath')).toBe(after)
  })

  it('leave petting, naps and earned treats free', () => {
    const broke = ready({ acorns: 0, pantry: { cookie: 1 } })
    expect(doCare(broke, T0, 'pet').needs.social).toBeGreaterThan(20)
    expect(doCare(broke, T0, 'treat', 'cookie').needs.hunger).toBeGreaterThan(20)
    expect(doCare(broke, T0, 'nap').acorns).toBe(0)
  })

  it('don’t charge for what the fox does by itself', () => {
    const s = doActivity(ready({ acorns: 0 }), T0, 'ball')
    expect(s.needs.fun).toBeGreaterThan(20)
    expect(s.acorns).toBe(0)
  })

  it('buy food by the portion', () => {
    expect(refillCost(ready({ bowl: 0 }))).toBe(3)
    expect(refillBowl(ready({ bowl: 0, acorns: 2 })).bowl).toBe(0)
    const filled = refillBowl(ready({ bowl: 0, acorns: 5 }))
    expect([filled.bowl, filled.acorns]).toEqual([3, 2])
    const topped = refillBowl(ready({ bowl: 2, acorns: 1 }))
    expect([topped.bowl, topped.acorns]).toEqual([3, 0])
    const full = ready({ bowl: 3, acorns: 4 })
    expect(refillBowl(full)).toBe(full)
  })

  it('paid cuddles never fade out, since acorns already limit them', () => {
    let s = ready({ acorns: 10, needs: { ...LOW, social: 0 } })
    for (let i = 0; i < 7; i++) s = doCare(s, T0 + i * 1000, 'cuddle')
    expect(s.needs.social).toBe(98)
    expect(s.acorns).toBe(3)
  })

  it('old saves start with a few acorns', () => {
    const { acorns: _a, ...old } = freshState(T0)
    expect(hydrate(old as unknown as Record<string, unknown>, T0).acorns).toBe(5)
  })
})
