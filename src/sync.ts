// One fox, every device: like logging in. Her fox lives in the cloud next to
// her mailbox, and her mailbox code is the login. Signing in on a new device
// loads her fox there (whatever that device had before is replaced).
//
// After that, each device remembers the last version it agreed with the cloud
// (`base`). When the cloud has a newer version, the two are merged
// (src/game/merge.ts) so progress made on both is kept. Saves are
// compare-and-swap, so a device holding a stale copy merges before it can
// overwrite anything.
import { useSyncExternalStore } from 'react'
import { arrive } from './game/logic.ts'
import { loadSave, MailError, saveVersion, storeSave } from './game/remote.ts'
import { meaningfulChange, merge3 } from './game/merge.ts'
import { hydrate, type GameState } from './game/state.ts'
import { getGame, setGame, subscribe } from './game/store.ts'

const META_KEY = 'tamalucy:sync'

interface Meta {
  /** Which mailbox this device synced with. */
  code: string
  /** Cloud version `base` came from (0 = never synced). */
  version: number
  /** The last save this device and the cloud agreed on. */
  base: GameState | null
}

function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (raw) return JSON.parse(raw) as Meta
  } catch {
    // unreadable: start over, which merges safely
  }
  return { code: '', version: 0, base: null }
}

let meta = readMeta()

function writeMeta(next: Meta) {
  meta = next
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next))
  } catch {
    // storage full: it'll re-merge next time
  }
}

/** Forget sync state, e.g. when the mailbox changes. */
export function resetSync() {
  writeMeta({ code: '', version: 0, base: null })
  emit()
}

// ─── status, for the settings screen ────────────────────────────────────────

export type SyncStatus = { state: 'off' | 'syncing' | 'ok' | 'offline' | 'error'; at: number }
let status: SyncStatus = { state: 'off', at: 0 }

const watchers = new Set<() => void>()
const emit = () => watchers.forEach((w) => w())
const watch = (w: () => void) => {
  watchers.add(w)
  return () => {
    watchers.delete(w)
  }
}
const setStatus = (state: SyncStatus['state']) => {
  status = { state, at: Date.now() }
  emit()
}

export const useSyncStatus = () => useSyncExternalStore(watch, () => status)

// ─── the sync itself ────────────────────────────────────────────────────────

/** What goes to the cloud: never a running focus session (that belongs to this device). */
const forCloud = (s: GameState): GameState => ({ ...s, session: null })

/** Take the cloud's fox, keeping this device's own bits, and catch its clock up. */
function adopt(cloud: GameState, here: GameState): GameState {
  // letters that just arrived here are kept (the cloud copy may not have them yet)
  const letters = here.notes.filter((n) => n.kind === 'post' && !cloud.notes.some((c) => c.id === n.id))
  const fox: GameState = {
    ...cloud,
    notes: [...letters, ...cloud.notes].sort((a, b) => b.at - a.at),
    session: here.session,
    mailbox: here.mailbox,
    settings: { ...cloud.settings, leaveMode: here.settings.leaveMode, graceSeconds: here.settings.graceSeconds },
  }
  return fox.onboarded ? arrive(fox, Date.now()) : fox
}

async function pull(code: string): Promise<void> {
  const remoteVersion = await saveVersion(code)
  const known = meta.code === code ? meta.version : 0
  if (remoteVersion === 0 || remoteVersion === known) return
  const row = await loadSave(code)
  if (!row) return
  const cloud = hydrate(row.state, Date.now())
  const here = getGame()
  if (here.mailbox !== code) return
  if (meta.code !== code || !meta.base) {
    // signing in on this device: her fox moves in
    setGame(adopt(cloud, here))
    writeMeta({ code, version: row.version, base: cloud })
    return
  }
  setGame(merge3(meta.base, here, cloud))
  writeMeta({ code, version: row.version, base: cloud })
}

async function push(code: string, keepalive = false): Promise<void> {
  const here = getGame()
  // a fox that hasn't been named yet has nothing to share
  if (here.mailbox !== code || !here.onboarded) return
  const first = meta.code !== code || !meta.base
  if (!first && !meaningfulChange(meta.base!, here)) return
  const save = forCloud(here)
  const version = await storeSave(code, save, first ? 0 : meta.version, keepalive)
  writeMeta({ code, version, base: save })
}

let running: Promise<void> | null = null
let again = false

/** Pull newer progress from the other device, then save ours. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const code = getGame().mailbox
      if (!code) {
        setStatus('off')
        break
      }
      setStatus('syncing')
      try {
        for (let tries = 0; ; tries++) {
          await pull(code)
          try {
            await push(code)
            break
          } catch (e) {
            // the other device saved in the meantime: merge that in, then try again
            if (!(e instanceof MailError && e.problem === 'conflict') || tries >= 3) throw e
          }
        }
        setStatus('ok')
      } catch (e) {
        setStatus(e instanceof MailError && e.problem === 'offline' ? 'offline' : 'error')
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

/** Sync, but don't keep her waiting more than `ms` for it. */
export function syncFor(ms: number): Promise<void> {
  return Promise.race([syncNow(), new Promise<void>((r) => setTimeout(r, ms))])
}

// ─── when to sync ───────────────────────────────────────────────────────────

let started = false
let debounce: ReturnType<typeof setTimeout> | undefined

/** Start syncing in the background: after changes, every minute, and when leaving. */
export function startSync() {
  if (started) return
  started = true
  // she did something: save it a few seconds later (ticks alone don't count)
  subscribe(() => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      const s = getGame()
      if (!s.mailbox || !s.onboarded) return
      const neverSaved = meta.code !== s.mailbox || !meta.base
      if (neverSaved || meaningfulChange(meta.base!, s)) void syncNow()
    }, 4000)
  })
  // the other device may have moved on
  setInterval(() => {
    if (document.visibilityState === 'visible' && getGame().mailbox) void syncNow()
  }, 60_000)
  // going to the background: save what's unsaved right away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    const s = getGame()
    if (!s.mailbox || !meta.base || meta.code !== s.mailbox || !meaningfulChange(meta.base, s)) return
    push(s.mailbox, true).catch(() => {})
  })
}
