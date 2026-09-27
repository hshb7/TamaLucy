import { useRef, useState } from 'react'
import { sfx } from '../audio.ts'
import { ADVENTURES } from '../game/content.ts'
import { doActivity, refillBowl } from '../game/logic.ts'
import { statusLine, tapLine } from '../game/lines.ts'
import type { Activity } from '../game/needs.ts'
import { getGame, setGame, useGame } from '../game/store.ts'
import { formatClock, useNow } from '../hooks.ts'
import { Room, type RoomCommand } from './Room.tsx'
import type { Task } from './brain.ts'

const LINES: Partial<Record<string, string[]>> = {
  cuddle: ['i love cuddles!!', '*snuggles*', 'warm... cozy...'],
  chat: [
    'and then the squirrel said...',
    'did you know foxes can hear a mouse under the snow?',
    'what’s your favourite class? mine is snack law.',
    'tell me about your day!',
    'i have a theory about the rule against perpetuities.',
  ],
  brush: ['ooh, that’s the spot', 'so fluffy now!'],
  dance: ['♪ ♫ ♪', 'look at my moves!'],
  play: ['you’re it!', 'can’t catch me!'],
  bath: ['i’m... tolerating this.', 'bubbles!!', 'do i have to?'],
  treat: ['yum!!', 'for me?!'],
  nap: ['just five minutes...', '*yawn*'],
  read: ['"the reasonable fox standard"... hmm', 'so many footnotes...'],
  teddy: ['mr. bear is my best friend (after you)'],
  window: ['the sky is so pretty today'],
  cushion: ['ahh, comfy'],
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
export function LivingRoom({ onStudy, onQuiz }: { onStudy: () => void; onQuiz: () => void }) {
  const game = useGame()
  const now = useNow(1000)
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
      const lines = LINES[t.kind]
      if (lines) say(lines[Math.floor(Math.random() * lines.length)])
    }
  }

  const onDone = (t: Task) => setGame((s) => doActivity(s, Date.now(), t.kind as Activity, t.arg))

  const onCommand = (cmd: RoomCommand) => {
    if (cmd === 'refill') {
      setGame(refillBowl)
      sfx.nom()
      say('thank you!! *happy tail wags*')
    } else if (cmd === 'study') onStudy()
    else onQuiz()
  }

  const adv = game.adventure && ADVENTURES.find((a) => a.id === game.adventure!.id)
  return (
    <>
      <Room game={game} bubble={bubble} onStart={onStart} onDone={onDone} onCommand={onCommand} onWake={() => say(tapLine(getGame(), Date.now()))} onStatus={setStatus} />
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
