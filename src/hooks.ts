import { useEffect, useState } from 'react'

/** Re-render every `ms` and return the current time. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export type WakeState = 'pending' | 'on' | 'unavailable'

/** Keep the screen awake while `active` (so the phone doesn't auto-lock mid-focus). */
export function useWakeLock(active: boolean): WakeState {
  const [state, setState] = useState<WakeState>(() => ('wakeLock' in navigator ? 'pending' : 'unavailable'))
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (alive) {
          lock = l
          setState('on')
        } else void l.release()
      } catch {
        // denied (low battery, unsupported in this context): the timer still works
        if (alive) setState('unavailable')
      }
    }
    void request()
    const onVis = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [active])
  return state
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `${h}h ${min % 60}m` : `${h}h`
}
