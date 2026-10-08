// Legal Latin (and law French) flashcards. Short, standard definitions.
export interface Card {
  term: string
  meaning: string
}

export const CARDS: Card[] = [
  { term: 'mens rea', meaning: 'the guilty mind: the mental state a crime requires' },
  { term: 'actus reus', meaning: 'the guilty act: the physical part of a crime' },
  { term: 'stare decisis', meaning: 'standing by decided cases: following precedent' },
  { term: 'res judicata', meaning: 'a matter already decided can’t be litigated again' },
  { term: 'habeas corpus', meaning: 'a writ to challenge unlawful detention' },
  { term: 'prima facie', meaning: 'on its face: enough evidence unless rebutted' },
  { term: 'amicus curiae', meaning: 'friend of the court: a non-party who files a brief' },
  { term: 'certiorari', meaning: 'a higher court’s order agreeing to review a case' },
  { term: 'de novo', meaning: 'anew: review with no deference to the lower court' },
  { term: 'per curiam', meaning: 'an opinion by the whole court, no named author' },
  { term: 'sua sponte', meaning: 'on its own motion, without a party asking' },
  { term: 'ex parte', meaning: 'with only one side present' },
  { term: 'voir dire', meaning: 'questioning potential jurors before trial' },
  { term: 'obiter dictum', meaning: 'a remark in an opinion that isn’t binding' },
  { term: 'ratio decidendi', meaning: 'the reasoning essential to the decision' },
  { term: 'ultra vires', meaning: 'beyond the powers: acting without authority' },
  { term: 'in camera', meaning: 'in private, in the judge’s chambers' },
  { term: 'res ipsa loquitur', meaning: 'the thing speaks for itself: negligence inferred' },
  { term: 'pro bono', meaning: 'legal work done for free, for the public good' },
  { term: 'pro se', meaning: 'representing yourself, without a lawyer' },
  { term: 'quid pro quo', meaning: 'something for something: an exchange' },
  { term: 'nolo contendere', meaning: 'a plea of no contest' },
  { term: 'bona fide', meaning: 'in good faith, genuine' },
  { term: 'inter alia', meaning: 'among other things' },
  { term: 'locus standi', meaning: 'standing: the right to bring a case' },
  { term: 'forum non conveniens', meaning: 'a court declines a case better heard elsewhere' },
]

export interface Question {
  card: Card
  choices: string[]
  answer: number
}

/** A round of `n` questions, each with four choices. */
export function makeRound(n = 8, rng: () => number = Math.random, deck: readonly Card[] = CARDS): Question[] {
  const shuffled = <T,>(a: readonly T[]) => a.map((x) => [rng(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x)
  return shuffled(deck)
    .slice(0, Math.min(n, deck.length))
    .map((card) => {
      const wrong = shuffled(deck.filter((c) => c !== card)).slice(0, 3).map((c) => c.meaning)
      const choices = shuffled([card.meaning, ...wrong])
      return { card, choices, answer: choices.indexOf(card.meaning) }
    })
}
