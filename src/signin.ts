// Back from a sign-in page (Spotify, Google, Microsoft): finish the trip and
// say how it went. App calls this once on load when the address bar carries
// a code.
import { afterCalendarSignIn, setPendingLink } from './calendar.ts'
import { finishGoogleLogin } from './google.ts'
import { finishMicrosoftLogin } from './microsoft.ts'
import type { AuthReturn, OAuthProvider } from './oauth.ts'
import { finishSpotifyLogin } from './spotify.ts'

export interface SignInResult {
  provider: OAuthProvider
  ok: boolean
  message: string
}

export async function finishSignIn(r: AuthReturn): Promise<SignInResult> {
  if (r.provider === 'spotify') {
    const ok = (await finishSpotifyLogin(r)) === 'linked'
    return { provider: r.provider, ok, message: ok ? 'Spotify linked ✓ now pick a playlist' : 'hmm, Spotify didn’t let us in. try again?' }
  }
  const name = r.provider === 'google' ? 'Google Calendar' : 'Outlook'
  const ok = r.provider === 'google' ? await finishGoogleLogin(r) : await finishMicrosoftLogin(r)
  if (!ok) return { provider: r.provider, ok: false, message: `hmm, ${name} didn’t let us in. try again?` }
  setPendingLink(r.provider === 'google' ? 'google' : 'outlook')
  try {
    const n = await afterCalendarSignIn(r.provider)
    return { provider: r.provider, ok: true, message: n ? `${name} linked ✓ ${n} ${n === 1 ? 'calendar is' : 'calendars are'} on the page` : `${name} linked ✓ now pick the calendars with your classes` }
  } catch {
    return { provider: r.provider, ok: true, message: `${name} linked ✓` }
  }
}
