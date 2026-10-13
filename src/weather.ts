// The real weather at her window, from Open-Meteo (free, no key, no account).
// Where she is comes from a place name she types or the browser's location;
// only the coordinates are kept, and only on her devices.
import { useSyncExternalStore } from 'react'
import { weatherKind, type WeatherKind } from './game/weather.ts'
import type { WeatherPlace } from './game/state.ts'

export interface Conditions {
  code: number
  kind: WeatherKind
  /** °C */
  temp: number
  isDay: boolean
  at: number
  lat: number
  lon: number
}

const KEY = 'tamalucy:weather'
/** How long a forecast is good for. */
const FRESH = 30 * 60_000

let current: Conditions | null = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as Conditions) : null
  } catch {
    return null
  }
})()
const watchers = new Set<() => void>()
const emit = () => watchers.forEach((w) => w())

export const currentWeather = () => current

export function useWeather(): Conditions | null {
  return useSyncExternalStore(
    (w) => {
      watchers.add(w)
      return () => watchers.delete(w)
    },
    () => current,
  )
}

function remember(c: Conditions | null) {
  current = c
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c))
    else localStorage.removeItem(KEY)
  } catch {
    // fine
  }
  emit()
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

/** Fresh conditions for a place, or the cached ones if they're recent. Null when offline with nothing cached. */
export async function refreshWeather(place: WeatherPlace, force = false): Promise<Conditions | null> {
  if (!place.lat && !place.lon) {
    if (current) remember(null)
    return null
  }
  if (!force && current && near(current.lat, place.lat) && near(current.lon, place.lon) && Date.now() - current.at < FRESH) return current
  try {
    const q = new URLSearchParams({ latitude: String(place.lat), longitude: String(place.lon), current: 'weather_code,temperature_2m,is_day' })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return current
    const data = (await res.json()) as { current?: { weather_code?: number; temperature_2m?: number; is_day?: number } }
    const code = data.current?.weather_code ?? 0
    const c: Conditions = { code, kind: weatherKind(code), temp: data.current?.temperature_2m ?? 0, isDay: (data.current?.is_day ?? 1) === 1, at: Date.now(), lat: place.lat, lon: place.lon }
    remember(c)
    return c
  } catch {
    return current
  }
}

export interface Place {
  name: string
  lat: number
  lon: number
}

/** "boston" → Boston, Massachusetts and its coordinates. */
export async function findPlace(text: string): Promise<Place | null> {
  const name = text.trim()
  if (!name) return null
  const q = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error('offline')
  const data = (await res.json()) as { results?: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }[] }
  const r = data.results?.[0]
  if (!r) return null
  const where = [r.name, r.admin1, r.country_code].filter(Boolean)
  return { name: where.slice(0, 2).join(', ').slice(0, 40), lat: Math.round(r.latitude * 100) / 100, lon: Math.round(r.longitude * 100) / 100 }
}

/** Where the browser says she is (asks once). */
export function herePlace(): Promise<Place | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'where you are', lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 600_000 },
    )
  })
}
