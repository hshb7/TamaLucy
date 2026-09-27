import { useSyncExternalStore } from 'react'
import { loadState, saveState, type GameState } from './state.ts'
import { arrive } from './logic.ts'

// A tiny external store: one game state, saved to localStorage on every change.
// With a cloud save, the clock waits for the other device's progress before
// catching up (the app does that right after syncing), so time spent on the
// other device isn't counted as time away.
const loaded = loadState(Date.now())
let state: GameState = loaded.mailbox ? loaded : arrive(loaded, Date.now())
const listeners = new Set<() => void>()
saveState(state)

export function getGame() {
  return state
}

export function setGame(next: GameState | ((s: GameState) => GameState)) {
  const value = typeof next === 'function' ? next(state) : next
  if (value === state) return
  state = value
  saveState(state)
  listeners.forEach((l) => l())
}

export function useGame(): GameState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Be told about every change (the cloud save listens). Returns an unsubscribe function. */
export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
