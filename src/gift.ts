// ─────────────────────────────────────────────────────────────────────────────
//  Personalise the app here before you share it. 💌
//  Everything in this file is optional; the app works fine with the defaults.
// ─────────────────────────────────────────────────────────────────────────────
export const GIFT = {
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
  /** One-tap subject chips on the focus screen (study time is tracked per subject). */
  subjects: ['Torts', 'Contracts', 'Civ Pro', 'Crim Law', 'Con Law', 'Property', 'Evidence', 'Legal Writing', 'Reading', 'Outlining', 'Bar Prep'],
}
