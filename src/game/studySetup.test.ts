import { describe, expect, it } from 'vitest'
import { freshState, hydrate, type GameState } from './state.ts'
import { GENERAL_RANKS, LAW_RANKS, currentRank, ladder, unlocked } from './career.ts'
import { adventures } from './content.ts'
import { addCourse, draftCourse, shelfIndex, shelfTags, workShelf } from './shelf.ts'
import { LEGACY_STUDY, STUDY_PRESETS, applyPreset, setShelves, setStudy, shelvesFromNames, tagFor } from './studySetup.ts'
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
    expect(ladder(law)).toBe(LAW_RANKS)
    expect(ladder(school)).toBe(GENERAL_RANKS)
    expect(currentRank(law).title).toBe('Partner')
    expect(currentRank(school).title).toBe('Doctor')
    expect(unlocked(law, 'law')).toEqual(['diploma', 'scales'])
    expect(unlocked(school, 'law')).toEqual(['diploma', 'trophy'])
    expect(unlocked(school, 'clothes')).not.toContain('judgeWig')
    expect(adventures(law).find((a) => a.id === 'library')?.place).toBe('the Law Library')
    expect(adventures(school).find((a) => a.id === 'library')?.place).toBe('the Old Library')
    expect(adventures(school).map((a) => a.id)).toEqual(adventures(law).map((a) => a.id))
  })

  it('a save from before the choice is the law school edition it always was', () => {
    const old = { ...freshState(T0), onboarded: true } as unknown as Record<string, unknown>
    delete old.study
    const s = hydrate(old, T0)
    expect(s.study).toEqual(LEGACY_STUDY)
    expect(s.study.asked).toBe(false)
    expect(setStudy(s, { program: 'law' }).study.asked).toBe(true)
    expect(shelfTags(s)).toEqual(['2L', '3L', 'WK'])
    // a brand-new save waits for the setup screen
    const fresh = hydrate({ ...freshState(T0) } as unknown as Record<string, unknown>, T0)
    expect(fresh.study.shelves).toEqual([])
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
