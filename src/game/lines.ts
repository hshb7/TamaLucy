import { adventures } from './content.ts'
import { NEED_INFO, foxMood, isAsleep, lowestNeed } from './needs.ts'
import type { GameState } from './state.ts'

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

const TAP: Record<ReturnType<typeof foxMood>, string[]> = {
  joyful: ['i\u2019m so happy!!', 'let\u2019s do our best today!', '*happy tail wags*', 'you\u2019re here! you\u2019re here!', 'best. day. ever.'],
  happy: ['hehe, that tickles!', 'what are we studying today?', 'i feel so cozy.', '*purrs* (foxes can purr. look it up)', 'hi {name}!'],
  okay: ['hi {name}.', 'wanna focus together?', '*stretches*', 'let\u2019s do something fun?'],
  sad: ['i missed you...', 'can we spend some time together?', '*sniffles*', 'will you stay a bit?'],
  depressed: ['...', 'i thought you forgot about me...', '*hides under blanket*', 'i\u2019m okay. (i\u2019m not okay.)'],
}

/** Extra lines on the law track. */
const LAW_TAP: Partial<Record<ReturnType<typeof foxMood>, string[]>> = {
  joyful: ['counsellor! you\u2019re back!'],
  happy: ['i\u2019m studying for the fox bar.'],
  okay: ['objection! not enough pets.'],
}

const NEEDY: Record<string, string[]> = {
  hunger: ['my tummy is rumbling...', 'is it snack time? it feels like snack time.', 'could you fill my bowl?'],
  energy: ['*yaaawn*', 'i could really use a nap...', 'so... sleepy...'],
  fun: ['i\u2019m booored. play with me?', 'wanna throw the ball?', 'let\u2019s dance!'],
  hygiene: ['i might be a little... stinky.', 'bath time? (please say no)', 'i rolled in something. don\u2019t ask.'],
  social: ['hold me?', 'i missed you.', 'can we just hang out?'],
}

const SLEEPY = ['zzz... *mumbles* ...five more minutes...', '*yawn* oh, hi... it\u2019s so late...', 'you should sleep too... zzz']

export function tapLine(s: GameState, now: number): string {
  const vars = (t: string) => t.replace('{name}', s.owner).replace('{fox}', s.foxName)
  if (isAsleep(s, now)) return vars(pick(SLEEPY))
  const low = lowestNeed(s.needs)
  if (s.needs[low] < 35 && Math.random() < 0.6) return vars(pick(NEEDY[low]))
  const mood = foxMood(s)
  return vars(pick([...TAP[mood], ...(s.study.track === 'law' ? (LAW_TAP[mood] ?? []) : [])]))
}

export function statusLine(s: GameState, now: number): string {
  const f = s.foxName
  if (s.adventure) {
    const a = adventures(s).find((x) => x.id === s.adventure!.id)
    return `${f} is out ${a?.verb ?? 'exploring'} at ${a?.place ?? 'somewhere'}`
  }
  if (isAsleep(s, now)) return `${f} is fast asleep`
  const mood = foxMood(s)
  if (mood === 'depressed') return `${f} is feeling really down... spend some time together?`
  const low = lowestNeed(s.needs)
  if (s.needs[low] < 30) return `${f} ${NEED_INFO[low].low}`
  if (mood === 'sad') return `${f} is feeling lonely`
  if (mood === 'okay') return `${f} is doing okay`
  if (mood === 'happy') return `${f} is feeling cozy`
  return `${f} is over the moon`
}
