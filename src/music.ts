// Music that starts with the timer. The iPhone plays one of her Apple Music
// playlists; the Mac asks the Music app or the Spotify app (whichever she
// picked) to play; and anywhere at all, a linked Spotify account starts her
// playlist on whatever device Spotify is open on (spotify.ts).
import { getLinks } from './links.ts'
import { isNativeApp, native, type MusicStatus, type Player, type Playlist } from './native.ts'
import { hasSpotify, spotifyConnected, spotifyPause, spotifyPlay, spotifyPlaylists, type PlayOutcome } from './spotify.ts'

export const musicAvailable = () => isNativeApp || hasSpotify()

/** Players this device drives itself: Apple Music on the iPhone; Music and/or the Spotify app on the Mac. */
let onDevice: Player[] | null = null

async function devicePlayers(): Promise<Player[]> {
  if (onDevice) return onDevice
  if (!isNativeApp) return (onDevice = [])
  return (onDevice = (await native.musicStatus()).players)
}

/** What this device can play with: its own apps, plus Spotify through her account if a key is set up. */
export async function musicStatus(): Promise<MusicStatus> {
  const st = isNativeApp ? await native.musicStatus() : { available: false, players: [] as Player[], authorized: false }
  onDevice = st.players
  const players = hasSpotify() && !st.players.includes('spotify') ? [...st.players, 'spotify' as const] : st.players
  return { ...st, available: st.available || hasSpotify(), players }
}

/** The Spotify app is on this Mac: it's asked directly (which also launches it). Otherwise her account does the asking. */
export const spotifyOnDevice = () => !!onDevice?.includes('spotify')
const throughAccount = async () => spotifyConnected() && !(await devicePlayers()).includes('spotify')

export async function playlists(player: Player): Promise<Playlist[]> {
  if (player === 'spotify' && spotifyConnected()) return spotifyPlaylists()
  return isNativeApp ? native.musicPlaylists(player) : []
}

async function play(): Promise<PlayOutcome> {
  const { music } = getLinks()
  if (music.player === 'none' || !music.playlist) return 'failed'
  if (music.player === 'spotify' && (await throughAccount())) return spotifyPlay(music.playlist)
  if (!isNativeApp) return music.player === 'spotify' ? 'not-linked' : 'failed'
  return (await native.musicPlay(music.player, music.playlist)) ? 'playing' : 'failed'
}

/** A session started: press play, if she set that up. Never opens another app (she may be in strict mode). */
export async function playForSession(): Promise<PlayOutcome | null> {
  if (!getLinks().music.autoplay) return null
  return play()
}

/** Try the playlist right now (the settings screen's test button). */
export const playNow = (): Promise<PlayOutcome> => play()

/** The session ended (done or not): pause, if she set that up. */
export async function pauseAfterSession(): Promise<boolean> {
  const { music } = getLinks()
  if (music.player === 'none' || !music.pauseAtEnd) return false
  if (music.player === 'spotify' && (await throughAccount())) return spotifyPause()
  if (!isNativeApp) return false
  return native.musicPause(music.player)
}
