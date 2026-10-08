// Built-in flashcard decks she can switch on (settings → my studies). Her own
// cards always come first; these are extras for when a deck fits what she's
// studying.
import type { Card } from './flashcards.ts'
import { CARDS as LEGAL_LATIN } from './flashcards.ts'
import type { GameState, Track } from './state.ts'

export interface Deck {
  id: string
  name: string
  blurb: string
  cards: Card[]
  /** Suggested for this career track (still available on any). */
  track?: Track
}

export const DECKS: Deck[] = [{ id: 'legalLatin', name: 'Legal Latin', blurb: 'mens rea, stare decisis, res ipsa loquitur… the terms every law student meets', cards: LEGAL_LATIN, track: 'law' }]

export const deckById = (id: string) => DECKS.find((d) => d.id === id)

/** The built-in decks she has turned on. */
export function enabledDecks(s: GameState): Deck[] {
  return s.study.decks.map(deckById).filter((d): d is Deck => !!d)
}

export function toggleDeck(s: GameState, id: string): GameState {
  if (!deckById(id)) return s
  const decks = s.study.decks.includes(id) ? s.study.decks.filter((d) => d !== id) : [...s.study.decks, id]
  return { ...s, study: { ...s.study, decks, asked: true } }
}
