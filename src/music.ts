// Music that starts with the timer. The iPhone plays one of her Apple Music
// playlists; the Mac asks the Music app or Spotify (whichever she picked) to
// play. A browser can't reach either, so there it quietly does nothing.
import { getLinks } from './links.ts'
import { isNativeApp, native, type MusicStatus, type Player, type Playlist } from './native.ts'

export const musicAvailable = () => isNativeApp

export function musicStatus(): Promise<MusicStatus> {
  return native.musicStatus()
}

export function playlists(player: Player): Promise<Playlist[]> {
  return native.musicPlaylists(player)
}

/** A session started: press play, if she set that up. */
export async function playForSession(): Promise<boolean> {
  const { music } = getLinks()
  if (!isNativeApp || music.player === 'none' || !music.playlist || !music.autoplay) return false
  return native.musicPlay(music.player, music.playlist)
}

/** Try the playlist right now (the settings screen's test button). */
export async function playNow(): Promise<boolean> {
  const { music } = getLinks()
  if (!isNativeApp || music.player === 'none' || !music.playlist) return false
  return native.musicPlay(music.player, music.playlist)
}

/** The session ended (done or not): pause, if she set that up. */
export async function pauseAfterSession(): Promise<boolean> {
  const { music } = getLinks()
  if (!isNativeApp || music.player === 'none' || !music.pauseAtEnd) return false
  return native.musicPause(music.player)
}
