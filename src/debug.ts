/** `?debug` in the URL unlocks seconds-long sessions, breaks and adventures for testing. */
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')
