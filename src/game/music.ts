// A Spotify link or URI she pasted, turned into what the Spotify app wants.
export function spotifyUri(text: string): string | null {
  const t = text.trim()
  const m = /spotify:(playlist|album|track|artist):([A-Za-z0-9]{10,})/.exec(t) ?? /open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(playlist|album|track|artist)\/([A-Za-z0-9]{10,})/i.exec(t)
  return m ? `spotify:${m[1]}:${m[2]}` : null
}
