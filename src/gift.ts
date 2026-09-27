// ─────────────────────────────────────────────────────────────────────────────
//  Personalise the app here before you share it. 💌
//  Everything in this file is optional; the app works fine with the defaults.
//
//  If this repository is public, put anything personal (your name, the secret
//  letters, her birthday) in src/gift.local.ts instead. Git ignores that file,
//  so it never gets pushed, but it's baked into the app when you build:
//
//    // src/gift.local.ts
//    export const GIFT = {
//      from: 'Sam',
//      secretNotes: ['hi! if you are reading this...'],
//    }
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULTS = {
  /** Name shown on the home screen icon and title bar. */
  appName: 'TamaLucy',
  /** Pre-filled in onboarding ("what's your name?"). They can change it. */
  recipientName: 'Lucy',
  /** Suggested fox name. They can change it. */
  foxName: 'Mochi',
  /** Your name. Signs the secret letters below (leave '' to stay mysterious). */
  from: '',
  /** Optional message shown once, on the very first screen. */
  welcome: '',
  /**
   * Secret letters. Every so often, when the fox writes a note, it will
   * instead deliver one of these (in order), saying it "found it tucked under
   * the rug". A couple are also guaranteed on focus milestones.
   *
   * Example:
   *   secretNotes: [
   *     "hi! if you're reading this, you've been working hard. proud of you.",
   *     "remember the day we got bubble tea in the rain? best day.",
   *   ],
   */
  secretNotes: [] as string[],
  /** Her birthday as 'MM-DD' (e.g. '03-14'), for a surprise on the day. She can also set it in settings. */
  birthday: '',
  /** Optional letter delivered on her birthday (the fox writes one if this is empty). */
  birthdayLetter: '',
  /** One-tap subject chips on the focus screen (study time is tracked per subject). */
  subjects: ['Torts', 'Contracts', 'Civ Pro', 'Crim Law', 'Con Law', 'Property', 'Evidence', 'Legal Writing', 'Reading', 'Outlining', 'Bar Prep'],
}

let local: Partial<typeof DEFAULTS> | undefined
try {
  local = Object.values(import.meta.glob<{ GIFT?: Partial<typeof DEFAULTS> }>('./gift.local.ts', { eager: true }))[0]?.GIFT
} catch {
  // vite.config.ts reads this file too, outside the app, where there's no import.meta.glob
}

export const GIFT: typeof DEFAULTS = { ...DEFAULTS, ...local }
