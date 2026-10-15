// Back from a sign-in page (Spotify, Google, Microsoft): finish the trip and
// say how it went. App calls this once on load when the address bar carries
// a code.
import { attachAccount, finishAccountLogin } from './account.ts'
import { afterCalendarSignIn, setPendingLink } from './calendar.ts'
import { finishGoogleLogin, googleProblem } from './google.ts'
import { finishMicrosoftLogin } from './microsoft.ts'
import type { AuthReturn, OAuthProvider } from './oauth.ts'
import { cantReach } from './preview.ts'
import { finishSpotifyLogin } from './spotify.ts'

export interface SignInResult {
  provider: OAuthProvider
  ok: boolean
  message: string
}

/** A sign-in button: on the web this leaves the page (App finishes the trip); in the apps it finishes right here. */
export async function runSignIn(start: () => Promise<AuthReturn | null>): Promise<SignInResult | null> {
  const r = await start()
  return r ? finishSignIn(r) : null
}

export async function finishSignIn(r: AuthReturn): Promise<SignInResult> {
  if (r.provider === 'account') {
    if (!(await finishAccountLogin(r))) return { provider: r.provider, ok: false, message: 'hmm, the sign-in didn’t go through. try again?' }
    try {
      const o = await attachAccount()
      return {
        provider: r.provider,
        ok: true,
        message:
          o === 'fetched'
            ? 'welcome back! your fox is here ✓'
            : o === 'claimed'
              ? 'signed in ✓ your fox now follows you to any device: just sign in there.'
              : o === 'connected'
                ? 'signed in ✓ your mailbox is connected, but no fox is saved in it yet. set one up here and it’ll be on your other devices too.'
                : 'signed in ✓ but no fox is saved under this account yet. set one up here, or sign in on the device that has your fox.',
      }
    } catch {
      return { provider: r.provider, ok: true, message: cantReach('the post office', 'signed in ✓ but couldn’t reach the post office to find your fox. try again in a bit?') }
    }
  }
  if (r.provider === 'spotify') {
    const ok = (await finishSpotifyLogin(r)) === 'linked'
    return { provider: r.provider, ok, message: ok ? 'Spotify linked ✓ now pick a playlist' : 'hmm, Spotify didn’t let us in. try again?' }
  }
  const name = r.provider === 'google' ? 'Google Calendar' : 'Outlook'
  if (r.provider === 'google') {
    try {
      await finishGoogleLogin(r)
    } catch (e) {
      return { provider: r.provider, ok: false, message: googleProblem(e) }
    }
  } else if (!(await finishMicrosoftLogin(r))) return { provider: r.provider, ok: false, message: `hmm, ${name} didn’t let us in. try again?` }
  setPendingLink(r.provider === 'google' ? 'google' : 'outlook')
  try {
    const n = await afterCalendarSignIn(r.provider)
    return { provider: r.provider, ok: true, message: n ? `${name} linked ✓ ${n} ${n === 1 ? 'calendar is' : 'calendars are'} on the page` : `${name} linked ✓ now pick the calendars with your classes` }
  } catch {
    return { provider: r.provider, ok: true, message: `${name} linked ✓` }
  }
}
