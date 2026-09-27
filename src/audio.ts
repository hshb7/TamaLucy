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

// ─── focus ambience: rain, fireplace, library hum (all generated) ─────────
export type AmbientKind = 'off' | 'rain' | 'fire' | 'hum'

let ambient: { kind: AmbientKind; stop: () => void } | null = null

function noiseBuffer(c: AudioContext, colour: 'white' | 'brown' | 'pink', seconds = 3) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (colour === 'white') d[i] = w
    else if (colour === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else {
      b0 = 0.99765 * b0 + w * 0.099
      b1 = 0.963 * b1 + w * 0.2965
      b2 = 0.57 * b2 + w * 1.0526
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25
    }
  }
  return buf
}

function loop(c: AudioContext, buf: AudioBuffer, to: AudioNode) {
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.connect(to)
  src.start()
  return src
}

/** A short filtered noise burst: raindrops, crackles, page turns. */
function burst(c: AudioContext, buf: AudioBuffer, to: AudioNode, freq: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') {
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = c.createGain()
  const t = c.currentTime
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(to)
  src.start(t, Math.random() * 2, dur + 0.05)
}

export function startAmbient(kind: AmbientKind) {
  if (ambient?.kind === kind) return
  stopAmbient()
  if (kind === 'off') return
  unlockAudio()
  const c = ctx
  if (!c) return
  try {
    // let it play with the ringer switch off (iOS 17+)
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {
    // not supported
  }
  const master = c.createGain()
  master.gain.setValueAtTime(0, c.currentTime)
  master.gain.linearRampToValueAtTime(1, c.currentTime + 1.5)
  master.connect(c.destination)
  const white = noiseBuffer(c, 'white')
  const sources: AudioBufferSourceNode[] = []
  const timers: ReturnType<typeof setTimeout>[] = []
  const every = (min: number, max: number, fn: () => void) => {
    const tick = () => {
      fn()
      timers.push(setTimeout(tick, min + Math.random() * (max - min)))
    }
    timers.push(setTimeout(tick, min))
  }

  if (kind === 'rain') {
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 600
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5500
    const g = c.createGain()
    g.gain.value = 0.16
    hp.connect(lp).connect(g).connect(master)
    sources.push(loop(c, white, hp))
    every(40, 180, () => burst(c, white, master, 1800 + Math.random() * 3000, 0.04, 0.05 + Math.random() * 0.05))
  } else if (kind === 'fire') {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const g = c.createGain()
    g.gain.value = 0.5
    lp.connect(g).connect(master)
    sources.push(loop(c, noiseBuffer(c, 'brown'), lp))
    every(70, 520, () => burst(c, white, master, 2500 + Math.random() * 2500, 0.012 + Math.random() * 0.02, 0.12 + Math.random() * 0.18, 'highpass'))
  } else {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    const g = c.createGain()
    g.gain.value = 0.22
    lp.connect(g).connect(master)
    sources.push(loop(c, noiseBuffer(c, 'pink'), lp))
    every(14_000, 40_000, () => burst(c, white, master, 3200, 0.35, 0.05))
  }

  ambient = {
    kind,
    stop: () => {
      timers.forEach(clearTimeout)
      const t = c.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.6)
      setTimeout(() => {
        sources.forEach((s) => s.stop())
        master.disconnect()
      }, 700)
    },
  }
}

export function stopAmbient() {
  ambient?.stop()
  ambient = null
}
