import { describe, expect, it } from 'vitest'
import { freshState, hydrate, type GameState } from './state.ts'
import { GENERAL_RANKS, LAW_RANKS, RUNGS, currentRank, ladder, shortOf, unlocked } from './career.ts'
import { adventures } from './content.ts'
import { addCourse, draftCourse, shelfIndex, shelfTags, workShelf } from './shelf.ts'
import { STUDY_PRESETS, applyPreset, setRungs, setShelves, setStudy, shelvesFromNames, tagFor } from './studySetup.ts'
import { enabledDecks, toggleDeck } from './decks.ts'
import { parseCardList } from './study.ts'

const T0 = new Date(2026, 9, 1, 9, 0, 0).getTime()
const preset = (id: string) => STUDY_PRESETS.find((p) => p.id === id)!
const setUp = (id: string): GameState => applyPreset({ ...freshState(T0), onboarded: true }, preset(id), T0)

describe('setting up what she studies', () => {
  it('makes brass plates from shelf names', () => {
    expect(tagFor('2L')).toBe('2L')
    expect(tagFor('3 L')).toBe('3L')
    expect(tagFor('Fall 2026')).toBe('F2')
    expect(tagFor('clinicals')).toBe('CL')
    expect(tagFor('work')).toBe('WO')
    expect(tagFor('   ')).toBe('··')
  })

  it('builds up to three shelves from what she types, skipping blanks and repeats', () => {
    const shelves = shelvesFromNames(['year 1', '', 'Year 1', 'year 2', 'year 3', 'year 4'], T0)
    expect(shelves.map((s) => s.name)).toEqual(['year 1', 'year 2', 'year 3'])
    expect(new Set(shelves.map((s) => s.id)).size).toBe(3)
  })

  it('a preset sets the track, shelves and decks, all changeable', () => {
    const law = setUp('law')
    expect(law.study.track).toBe('law')
    expect(shelfTags(law)).toEqual(['1L', '2L', '3L'])
    expect(enabledDecks(law).map((d) => d.id)).toEqual(['legalLatin'])
    const college = setUp('college')
    expect(college.study.track).toBe('general')
    expect(enabledDecks(college)).toEqual([])
    const switched = setStudy(toggleDeck(college, 'legalLatin'), { track: 'law', program: '  the bar  ' })
    expect(switched.study).toMatchObject({ track: 'law', program: 'the bar', decks: ['legalLatin'], asked: true })
  })

  it('puts new classes on her shelves, and work on the shelf that sounds like work', () => {
    let s = setUp('grad') // year 1 · year 2 · research
    s = addCourse(s, { ...draftCourse(s, 'class'), name: 'Stats' }, T0)
    expect(shelfIndex(s, s.courses[0])).toBe(0)
    expect(workShelf(s)?.name).toBe('research')
    s = addCourse(s, { ...draftCourse(s, 'work'), name: 'Lab' }, T0)
    expect(shelfIndex(s, s.courses[1])).toBe(2)
  })

  it('renaming or removing shelves keeps every book on the bookcase', () => {
    let s = setUp('college')
    const [y1, y2, y3] = s.study.shelves
    s = addCourse(s, { ...draftCourse(s, 'class'), name: 'Bio', year: y3.id }, T0)
    s = setShelves(s, [{ ...y1, name: 'freshman', tag: '' }, y2])
    expect(s.study.shelves.map((x) => `${x.name}/${x.tag}`)).toEqual(['freshman/FR', 'year 2/Y2'])
    expect(s.courses[0].year).toBe(y1.id)
    // never fewer than one shelf, never more than three
    expect(setShelves(s, []).study.shelves).toHaveLength(2)
    expect(setShelves(s, [y1, y2, y3, { id: 'x', name: 'extra', tag: 'EX' }]).study.shelves).toHaveLength(3)
  })

  it('the two tracks share the rungs but not the titles, prizes or places', () => {
    const law = { ...setUp('law'), stats: { ...freshState(T0).stats, totalMinutes: 3600 } }
    const school = { ...setUp('college'), stats: law.stats }
    expect(ladder(law)).toEqual(LAW_RANKS)
    expect(ladder(school).map((r) => r.unlocks)).toEqual(GENERAL_RANKS.map((r) => r.unlocks))
    expect(currentRank(law).title).toBe('Partner')
    expect(currentRank(school).title).toBe('Lecturer')
    expect(unlocked(law, 'law')).toEqual(['diploma', 'scales'])
    expect(unlocked(school, 'law')).toEqual(['diploma', 'trophy'])
    expect(unlocked(school, 'clothes')).not.toContain('judgeWig')
    expect(adventures(law).find((a) => a.id === 'library')?.place).toBe('the Law Library')
    expect(adventures(school).find((a) => a.id === 'library')?.place).toBe('the Old Library')
    expect(adventures(school).map((a) => a.id)).toEqual(adventures(law).map((a) => a.id))
  })

  it('a save from before the choice assumes nothing: general track, no decks, asked on the home screen', () => {
    const old = { ...freshState(T0), onboarded: true } as unknown as Record<string, unknown>
    delete old.study
    const s = hydrate(old, T0)
    expect(s.study).toEqual({ program: '', track: 'general', shelves: [], decks: [], rungs: [], asked: false })
    expect(setStudy(s, { program: 'law' }).study.asked).toBe(true)
    // a save an earlier build stamped with the old law default, never answered: neutral too
    const stamped = { ...old, study: { program: 'law school', track: 'law', shelves: [{ id: '2L', name: '2L', tag: '2L' }], decks: ['legalLatin'], asked: false } }
    expect(hydrate(stamped, T0).study).toEqual({ program: '', track: 'general', shelves: [], decks: [], rungs: [], asked: false })
    // but what she chose herself stays
    const chosen = { ...old, study: { ...stamped.study, asked: true } }
    expect(hydrate(chosen, T0).study.track).toBe('law')
    // books already standing on the shipped shelves keep those shelves
    const withBooks = { ...old, courses: [{ id: 'c', name: 'Evidence', kind: 'class', year: '2L', color: 'navy', goalHours: 100, priorHours: 0, doneAt: 0, created: 1 }] }
    expect(shelfTags(hydrate(withBooks, T0))).toEqual(['2L'])
    // a brand-new save waits for the setup screen
    const fresh = hydrate({ ...freshState(T0) } as unknown as Record<string, unknown>, T0)
    expect(fresh.study.shelves).toEqual([])
  })

  it('the rungs are hers to name', () => {
    for (const p of STUDY_PRESETS) expect(p.rungs).toHaveLength(RUNGS)
    const nurse = { ...setUp('nursing'), stats: { ...freshState(T0).stats, totalMinutes: 6600 } }
    expect(currentRank(nurse).title).toBe('Chief Nursing Officer')
    expect(currentRank(nurse).short).toBe('CNO')
    expect(shortOf('RN')).toBe('RN')
    expect(shortOf('Supercalifragilistic')).toBe('Supercali.')
    // a rung she leaves blank keeps the plain name; the law extras switch keeps her rungs
    let s = setRungs(nurse, ['', 'Baby Nurse', ...Array(RUNGS - 2).fill('')])
    expect(ladder(s)[0].title).toBe('Curious Kit')
    expect(ladder(s)[1]).toMatchObject({ title: 'Baby Nurse', short: 'Baby Nurse' })
    expect(ladder(s)[2].title).toBe('Learner')
    s = setStudy(s, { track: 'law' })
    expect(ladder(s)[1].title).toBe('Baby Nurse')
    expect(ladder(s)[0].short).toBe('Kit') // a shipped title keeps its short form on either ladder
    expect(unlocked({ ...s, stats: nurse.stats }, 'law')).toContain('scales')
    // no rungs saved yet (an old save): the plain ladder
    expect(ladder({ study: { ...s.study, rungs: [] } })).toEqual(LAW_RANKS)
  })

  it('reads pasted card lists with dashes, colons or tabs', () => {
    const list = parseCardList('mitochondria — the powerhouse of the cell\nosmosis: water across a membrane\nfront\tback\njust a word\nmens rea - the guilty mind\n')
    expect(list).toEqual([
      { front: 'mitochondria', back: 'the powerhouse of the cell' },
      { front: 'osmosis', back: 'water across a membrane' },
      { front: 'front', back: 'back' },
      { front: 'mens rea', back: 'the guilty mind' },
    ])
  })
})
