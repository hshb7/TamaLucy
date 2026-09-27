// Tiny chiptune sound effects synthesised with WebAudio (no audio files).
let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

/** Must be called from a user gesture at least once (iOS requirement). */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

type Note = [freq: number, at: number, dur: number]

function play(notes: Note[], type: OscillatorType = 'square', vol = 0.04) {
  if (!enabled || !ctx) return
  const t0 = ctx.currentTime + 0.01
  for (const [f, at, dur] of notes) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0, t0 + at)
    g.gain.linearRampToValueAtTime(vol, t0 + at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur)
    o.connect(g).connect(ctx.destination)
    o.start(t0 + at)
    o.stop(t0 + at + dur + 0.02)
  }
}

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568

export const sfx = {
  tap: () => play([[A5, 0, 0.05]], 'square', 0.025),
  pet: () => play([[E5, 0, 0.07], [A5, 0.07, 0.1]], 'triangle', 0.08),
  start: () => play([[C5, 0, 0.08], [E5, 0.08, 0.08], [G5, 0.16, 0.14]], 'triangle', 0.08),
  fanfare: () =>
    play([[C5, 0, 0.1], [E5, 0.1, 0.1], [G5, 0.2, 0.1], [C6, 0.3, 0.18], [G5, 0.5, 0.08], [C6, 0.58, 0.3]], 'square', 0.035),
  chime: () => play([[E6, 0, 0.25], [C6, 0.18, 0.25], [G6, 0.36, 0.4]], 'triangle', 0.07),
  sad: () => play([[G5, 0, 0.18], [E5, 0.18, 0.18], [D5, 0.36, 0.18], [C5, 0.54, 0.4]], 'triangle', 0.07),
  nom: () => play([[330, 0, 0.06], [262, 0.12, 0.06], [330, 0.24, 0.06]], 'square', 0.03),
  sparkle: () => play([[C6, 0, 0.06], [E6, 0.06, 0.06], [G6, 0.12, 0.1]], 'triangle', 0.06),
}

export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // unsupported (iOS): ignore
  }
}
