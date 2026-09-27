import { hydrate, type GameState } from './state.ts'

// Backup codes: the whole save, gzipped when the browser can, as base64 text
// that can be copied into Notes or saved as a file.
const PREFIX_GZ = 'TAMALUCY1z:'
const PREFIX_RAW = 'TAMALUCY1:'

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>))
  return new Uint8Array(await res.arrayBuffer())
}

export async function encodeBackup(s: GameState): Promise<string> {
  // an in-progress session can't survive a restore, so don't carry it over
  const json = new TextEncoder().encode(JSON.stringify({ ...s, session: null }))
  if (typeof CompressionStream !== 'undefined') return PREFIX_GZ + toB64(await pipe(json, new CompressionStream('gzip')))
  return PREFIX_RAW + toB64(json)
}

export class BackupError extends Error {}

export async function decodeBackup(code: string, now: number): Promise<GameState> {
  const text = code.replace(/\s+/g, '')
  let bytes: Uint8Array
  try {
    if (text.startsWith(PREFIX_GZ)) {
      if (typeof DecompressionStream === 'undefined') throw new BackupError('this browser can’t open compressed backups. try a newer browser.')
      bytes = await pipe(fromB64(text.slice(PREFIX_GZ.length)), new DecompressionStream('gzip'))
    } else if (text.startsWith(PREFIX_RAW)) bytes = fromB64(text.slice(PREFIX_RAW.length))
    else throw new BackupError('that doesn’t look like a TamaLucy backup code. it should start with “TAMALUCY1”.')
  } catch (e) {
    if (e instanceof BackupError) throw e
    throw new BackupError('this backup code is incomplete. copy the whole thing and try again.')
  }
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new BackupError('this backup code is damaged. copy the whole thing and try again.')
  }
  if (typeof raw !== 'object' || !raw || typeof raw.foxName !== 'string' || typeof raw.stats !== 'object') {
    throw new BackupError('this backup is missing the fox’s details, so it can’t be restored.')
  }
  return { ...hydrate(raw, now), session: null, lastTick: now, lastVisit: now }
}

/** When the backup was made, for the confirmation message. */
export function backupSummary(s: GameState) {
  return { fox: s.foxName, minutes: s.stats.totalMinutes, notes: s.notes.length, created: s.createdAt }
}
