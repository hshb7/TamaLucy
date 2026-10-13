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
