// Which kind of device the app is running on. On a phone, leaving the app
// during focus is the thing to avoid; on a Mac she studies in other apps
// (Word, PDFs, the casebook), so there the timer just keeps going.

/** A computer with a mouse/trackpad: a Mac (iPads report as Macs but have touch). */
export const isDesktop = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.maxTouchPoints === 'number' &&
  navigator.maxTouchPoints < 2 &&
  !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent ?? '')

export const defaultLeaveMode = () => (isDesktop() ? 'free' : 'strict') as 'free' | 'strict'
