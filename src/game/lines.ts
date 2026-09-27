import { ADVENTURES } from './content.ts'
import { HUNGRY, isAsleep, moodOf } from './logic.ts'
import type { GameState } from './state.ts'

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

const TAP: Record<ReturnType<typeof moodOf>, string[]> = {
  joyful: ['i’m so happy!!', 'let’s do our best today!', '*happy tail wags*', 'you’re here! you’re here!', 'best. day. ever.'],
  happy: ['hehe, that tickles!', 'what are we working on today?', 'i feel so cozy.', '*purrs* (foxes can purr. look it up)', 'hi {name}!'],
  okay: ['hi {name}.', 'wanna focus together?', 'i could go for a snack...', '*stretches*', 'let’s do something fun?'],
  sad: ['i missed you...', 'can we spend some time together?', '*sniffles*', 'will you stay a bit?'],
  depressed: ['...', 'i thought you forgot about me...', '*hides under blanket*', 'i’m okay. (i’m not okay.)'],
}

const HUNGRY_LINES = ['my tummy is rumbling...', 'is it snack time? it feels like snack time.', 'i’m sooo hungry. focus for a treat?']
const SLEEPY = ['zzz... *mumbles* ...five more minutes...', '*yawn* oh, hi... it’s so late...', 'you should sleep too... zzz']

export function tapLine(s: GameState, now: number): string {
  const vars = (t: string) => t.replace('{name}', s.owner).replace('{fox}', s.foxName)
  if (isAsleep(s, now)) return vars(pick(SLEEPY))
  if (s.tummy < HUNGRY && Math.random() < 0.5) return vars(pick(HUNGRY_LINES))
  return vars(pick(TAP[moodOf(s.happiness)]))
}

export function statusLine(s: GameState, now: number): string {
  const f = s.foxName
  if (s.adventure) {
    const a = ADVENTURES.find((x) => x.id === s.adventure!.id)
    return `${f} is out ${a?.verb ?? 'exploring'} at ${a?.place ?? 'somewhere'}`
  }
  if (isAsleep(s, now)) return `${f} is fast asleep`
  const mood = moodOf(s.happiness)
  if (mood === 'depressed') return `${f} is feeling really down... spend some time together?`
  if (mood === 'sad') return `${f} is feeling lonely`
  if (s.tummy < HUNGRY) return `${f} is hungry. focus to earn a treat!`
  if (mood === 'okay') return `${f} is doing okay`
  if (mood === 'happy') return `${f} is feeling cozy`
  return `${f} is over the moon`
}
