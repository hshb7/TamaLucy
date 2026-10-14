// The logos on the "link a calendar" buttons, drawn inline so they work offline.
import type { CSSProperties } from 'react'

const box: CSSProperties = { width: 28, height: 28, flex: 'none', display: 'block' }

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function ICloudLogo() {
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <defs>
        <linearGradient id="icl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fb4ff" />
          <stop offset="1" stopColor="#1e7be6" />
        </linearGradient>
      </defs>
      <path fill="url(#icl)" d="M37.5 38H13a9 9 0 0 1-1.6-17.86A12 12 0 0 1 34.3 16.6 10.5 10.5 0 0 1 37.5 38z" />
    </svg>
  )
}

export function OutlookLogo() {
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <rect x="18" y="8" width="26" height="32" rx="3" fill="#1490df" />
      <path d="M18 20h26v18a2 2 0 0 1-2 2H18z" fill="#28a8ea" />
      <path d="M18 20l13 9 13-9" fill="none" stroke="#0f78d4" strokeWidth="2" />
      <rect x="4" y="12" width="24" height="24" rx="3" fill="#0f6cbd" />
      <ellipse cx="16" cy="24" rx="6.5" ry="7.5" fill="none" stroke="#fff" strokeWidth="3.2" />
    </svg>
  )
}

export function CanvasLogo() {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return <circle key={i} cx={24 + 14.5 * Math.cos(a)} cy={24 + 14.5 * Math.sin(a)} r="2.6" fill="#fff" />
  })
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e4433b" />
      <circle cx="24" cy="24" r="7.5" fill="#fff" />
      {dots}
    </svg>
  )
}

/** The device's own calendar app: a white tile with a red top, today's date on it. */
export function DeviceCalendarLogo({ day }: { day: number }) {
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#fff" stroke="#d9d9de" strokeWidth="1.5" />
      <path d="M4 13a9 9 0 0 1 9-9h22a9 9 0 0 1 9 9v3H4z" fill="#ff3b30" />
      <text x="24" y="37" textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize="19" fontWeight="500" fill="#1c1c1e">
        {day}
      </text>
    </svg>
  )
}

/** Any other calendar: a link. */
export function LinkLogo() {
  return (
    <svg viewBox="0 0 48 48" style={box} aria-hidden="true">
      <path d="M20 28l8-8" stroke="#9b7667" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M17 31l-3 3a6 6 0 0 1-8.5-8.5l7-7A6 6 0 0 1 21 19" stroke="#5b3a31" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M31 17l3-3a6 6 0 0 1 8.5 8.5l-7 7A6 6 0 0 1 27 29" stroke="#5b3a31" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}
