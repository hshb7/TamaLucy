import { useRef, useState } from 'react'
import { sfx } from '../audio.ts'
import { adventures } from '../game/content.ts'
import { doActivity, doCare, refillBowl, refillCost } from '../game/logic.ts'
import { statusLine, tapLine } from '../game/lines.ts'
import type { Activity } from '../game/needs.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { formatClock, useNow, useWide } from '../hooks.ts'
import { Room, type RoomCommand } from './Room.tsx'
import type { Task } from './brain.ts'

const LINES: Partial<Record<string, string[]>> = {
  cuddle: ['i love cuddles!!', '*snuggles*', 'warm... cozy...'],
  chat: [
    'and then the squirrel said...',
    'did you know foxes can hear a mouse under the snow?',
    'what’s your favourite class? mine is snack science.',
    'tell me about your day!',
    'i have a theory about where lost socks go.',
  ],
  brush: ['ooh, that’s the spot', 'so fluffy now!'],
  dance: ['♪ ♫ ♪', 'look at my moves!'],
  play: ['you’re it!', 'can’t catch me!'],
  bath: ['i’m... tolerating this.', 'bubbles!!', 'do i have to?'],
  treat: ['yum!!', 'for me?!'],
  nap: ['just five minutes...', '*yawn*'],
  read: ['chapter seven... hmm', 'so many footnotes...'],
  teddy: ['mr. bear is my best friend (after you)'],
  window: ['the sky is so pretty today'],
  cushion: ['ahh, comfy'],
}

/** The law track's versions. */
const LAW_LINES: Partial<Record<string, string[]>> = {
  chat: ['what’s your favourite class? mine is snack law.', 'i have a theory about the rule against perpetuities.', 'tell me about your day!'],
  read: ['"the reasonable fox standard"... hmm', 'so many footnotes...'],
}

const SOUND: Partial<Record<string, () => void>> = {
  pet: sfx.pet,
  cuddle: sfx.pet,
  chat: sfx.tap,
  brush: sfx.sparkle,
  dance: sfx.start,
  play: sfx.tap,
  bath: sfx.sparkle,
  treat: sfx.nom,
  eat: sfx.nom,
}

/** The room plus everything that makes it tick: effects, sounds, speech and status. */
export function LivingRoom({ onStudy, onQuiz, onShelf }: { onStudy: () => void; onQuiz: () => void; onShelf: (add?: boolean) => void }) {
  const game = useGame()
  const now = useNow(1000)
  // on a wide screen the whole room fits, so there's nothing to swipe
  const wide = useWide()
  const [bubble, setBubble] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const say = (text: string) => {
    setBubble(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBubble(null), 3200)
  }

  const onStart = (t: Task) => {
    if (!t.user) return
    SOUND[t.kind]?.()
    if (t.kind === 'pet') say(tapLine(getGame(), Date.now()))
    else {
      const lines = (getGame().study.track === 'law' && LAW_LINES[t.kind]) || LINES[t.kind]
      if (lines) say(lines[Math.floor(Math.random() * lines.length)])
    }
  }

  // what she asks for costs acorns; what the fox does by itself is free
  const onDone = (t: Task) => setGame((s) => (t.user ? doCare : doActivity)(s, Date.now(), t.kind as Activity, t.arg))

  const onBroke = (cost: number) => {
    sfx.tap()
    const have = getGame().acorns
    say(
      have
        ? `that’s ${cost} acorns and we only have ${have}... focus with me and we’ll earn more?`
        : `we’re out of acorns! focus with me for a bit and we’ll earn some ✿`,
    )
  }

  const onCommand = (cmd: RoomCommand) => {
    if (cmd === 'refill') {
      if (refillCost(getGame()) > getGame().acorns) return onBroke(refillCost(getGame()))
      setGame(refillBowl)
      sfx.nom()
      say('thank you!! *happy tail wags*')
    } else if (cmd === 'study') onStudy()
    else if (cmd === 'shelf' || cmd === 'addClass') onShelf(cmd === 'addClass')
    else onQuiz()
  }

  const adv = game.adventure && adventures(game).find((a) => a.id === game.adventure!.id)
  return (
    <>
      <Room game={game} bubble={bubble} onStart={onStart} onDone={onDone} onCommand={onCommand} onBroke={onBroke} wide={wide} onWake={() => say(tapLine(getGame(), Date.now()))} onStatus={setStatus} />
      <p className="status">
        {adv
          ? `${game.foxName} is out ${adv.verb} at ${adv.place} · back in ${formatClock(game.adventure!.returnsAt - now)}`
          : status && status !== 'hanging out' && status !== 'wandering around'
            ? `${game.foxName} is ${status}`
            : statusLine(game, now)}
      </p>
    </>
  )
}
