/** `?debug` (or `#debug`) unlocks seconds-long sessions, breaks and adventures for testing. */
export const DEBUG =
  typeof location !== 'undefined' && (new URLSearchParams(location.search).has('debug') || location.hash === '#debug')
