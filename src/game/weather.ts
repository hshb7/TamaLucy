// The weather outside her window, from the WMO weather codes Open-Meteo uses.
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export function weatherKind(code: number): WeatherKind {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 2) return 'cloudy'
  return 'clear'
}

export const WEATHER_WORDS: Record<WeatherKind, string> = {
  clear: 'clear',
  cloudy: 'cloudy',
  fog: 'foggy',
  drizzle: 'drizzling',
  rain: 'raining',
  snow: 'snowing',
  storm: 'stormy',
}

/** The handful of places that still think in Fahrenheit. */
export const usesFahrenheit = (locale: string) => /^en-(US|BS|BZ|KY|LR|PW|FM|MH)$/i.test(locale.trim())

export function weatherLine(kind: WeatherKind, tempC: number, fahrenheit: boolean) {
  const t = fahrenheit ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC)
  return `${WEATHER_WORDS[kind]} · ${t}°`
}

/** Rain outside goes well with rain in the headphones. */
export const ambientFor = (kind: WeatherKind): 'rain' | null => (kind === 'rain' || kind === 'drizzle' || kind === 'storm' ? 'rain' : null)

// ─── finding a place by name ────────────────────────────────────────────────

const US_STATES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
}

/** "Charlotte, NC" → the town to search for, and a hint about where ("nc", "north carolina", "france"). */
export function parsePlace(text: string): { name: string; hint: string } {
  const t = text.trim().replace(/\s+/g, ' ')
  const comma = t.indexOf(',')
  if (comma > 0) return { name: t.slice(0, comma).trim(), hint: t.slice(comma + 1).trim().toLowerCase() }
  // "Charlotte NC": a two-letter tail is a state
  const m = /^(.+?)\s+([A-Za-z]{2})$/.exec(t)
  if (m && US_STATES[m[2].toLowerCase()]) return { name: m[1], hint: m[2].toLowerCase() }
  return { name: t, hint: '' }
}

export interface PlaceHit {
  name: string
  admin1?: string
  country?: string
  country_code?: string
  latitude: number
  longitude: number
  population?: number
}

/** Of several places with that name, the one in the state or country she meant; else the first (the geocoder puts the biggest first). */
export function bestPlace<T extends PlaceHit>(hits: T[], hint: string): T | undefined {
  if (!hits.length) return undefined
  if (!hint) return hits[0]
  const want = [hint, US_STATES[hint] ?? ''].filter(Boolean)
  const matches = (h: T) => [h.admin1, h.country, h.country_code].some((v) => v && want.some((w) => v.toLowerCase() === w || v.toLowerCase().includes(w)))
  return hits.find(matches) ?? hits[0]
}
