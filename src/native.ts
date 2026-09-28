// The bridge to the native iPhone app (ios/). In a browser none of this
// exists and every call quietly does nothing, so the web app is unchanged.
//
// JS → native: window.webkit.messageHandlers.tamalucy.postMessage({ id, cmd, ...args })
// native → JS: window.__tamalucyNative.reply(id, result)

interface Handler {
  postMessage(msg: unknown): void
}

const handler = (): Handler | undefined =>
  (window as unknown as { webkit?: { messageHandlers?: { tamalucy?: Handler } } }).webkit?.messageHandlers?.tamalucy

/** Running inside the native iPhone app. */
export const isNativeApp = typeof window !== 'undefined' && !!handler()

let nextId = 1
const waiting = new Map<number, (result: unknown) => void>()

if (isNativeApp) {
  ;(window as unknown as { __tamalucyNative: unknown }).__tamalucyNative = {
    reply(id: number, result: unknown) {
      waiting.get(id)?.(result)
      waiting.delete(id)
    },
  }
}

function call<T>(cmd: string, args: Record<string, unknown> = {}, fallback: T): Promise<T> {
  const h = handler()
  if (!h) return Promise.resolve(fallback)
  const id = nextId++
  return new Promise<T>((resolve) => {
    waiting.set(id, (r) => resolve((r ?? fallback) as T))
    // a native side that never answers shouldn't hang the game
    setTimeout(() => {
      if (waiting.delete(id)) resolve(fallback)
    }, 60_000)
    h.postMessage({ id, cmd, ...args })
  })
}

export interface BlockingStatus {
  /** Screen Time is available (native app, iOS 16+). */
  available: boolean
  /** She allowed Screen Time access. */
  authorized: boolean
  /** How many apps, categories and websites she chose to block. */
  count: number
}

const NONE: BlockingStatus = { available: false, authorized: false, count: 0 }

export const native = {
  /**
   * A focus session is running (or its end time moved): show it in the
   * Dynamic Island, block her chosen apps until it ends, and schedule the
   * "time's up" notification. Safe to call again with the same session.
   */
  focusStarted(s: { startedAt: number; endsAt: number; label: string; fox: string }) {
    return call<boolean>('focus.start', s, false)
  },
  /** The session is over: done, given up, or failed. */
  focusEnded(reason: 'done' | 'gaveUp' | 'failed') {
    return call<boolean>('focus.end', { reason }, false)
  },
  /** When she last tapped "use it anyway" on a blocked app (ms), or 0. Clears it. */
  brokeFocusAt() {
    return call<number>('focus.broke', {}, 0)
  },
  blockingStatus() {
    return call<BlockingStatus>('blocking.status', {}, NONE)
  },
  /** Ask for Screen Time access if needed, then let her pick apps to block. */
  chooseBlockedApps() {
    return call<BlockingStatus>('blocking.choose', {}, NONE)
  },
  haptic(style: 'light' | 'success' | 'warning') {
    void call<boolean>('haptic', { style }, false)
  },
}
