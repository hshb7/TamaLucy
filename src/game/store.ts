import { useSyncExternalStore } from 'react'
import { loadState, saveState, type GameState } from './state.ts'
import { arrive } from './logic.ts'

// A tiny external store: one game state, saved to localStorage on every change.
let state: GameState = arrive(loadState(Date.now()), Date.now())
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
