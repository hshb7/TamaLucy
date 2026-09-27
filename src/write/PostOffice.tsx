// The post office (open the app with #write at the end of the address):
// where letters are written, scheduled and taken back. It never touches the
// game on this device.
import { useCallback, useEffect, useState } from 'react'
import { GIFT } from '../gift.ts'
import { deleteLetter, listLetters, MailError, sendLetter, type SentLetter } from '../game/remote.ts'

const KEY_STORE = 'tamalucy:writer'
const SIGN_STORE = 'tamalucy:writer-sign'
const MAX = 2000

function stored(k: string) {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function store(k: string, v: string) {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  } catch {
    // private mode: they'll just type it again next time
  }
}

function problem(e: unknown) {
  const p = e instanceof MailError ? e.problem : 'server'
  if (p === 'wrong-code') return 'that key doesn’t open this post office. check it and try again?'
  if (p === 'offline') return 'couldn’t reach the post office. are you online?'
  if (p === 'full') return 'the mailbox is full (1000 letters!). delete a few old ones first.'
  return `something went wrong: ${e instanceof Error ? e.message : String(e)}`
}

const pad = (n: number) => String(n).padStart(2, '0')
/** A Date as the value of an <input type="datetime-local">. */
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function at(hour: number, days: number, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d
}
function nextBirthday(mmdd: string) {
  const [m, d] = mmdd.split('-').map(Number)
  if (!m || !d) return null
  const now = new Date()
  let b = new Date(now.getFullYear(), m - 1, d, 8)
  if (b.getTime() < now.getTime()) b = new Date(now.getFullYear() + 1, m - 1, d, 8)
  return b
}
function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function PostOffice() {
  const [key, setKey] = useState(() => stored(KEY_STORE))
  const [letters, setLetters] = useState<SentLetter[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = `post office · ${GIFT.appName}`
  }, [])

  const refresh = useCallback(
    async (k: string) => {
      try {
        setLetters(await listLetters(k))
        setError('')
        return true
      } catch (e) {
        setError(problem(e))
        if (e instanceof MailError && e.problem === 'wrong-code') {
          store(KEY_STORE, '')
          setKey('')
        }
        return false
      }
    },
    [],
  )

  useEffect(() => {
    if (key) void refresh(key)
  }, [key, refresh])

  return (
    <main className="screen post-office">
      <header className="po-head">
        <h1>the post office ✉</h1>
        <p className="muted">
          letters for {GIFT.recipientName}, delivered by {GIFT.foxName}
        </p>
      </header>
      {!key ? (
        <Unlock
          error={error}
          onOpen={async (k) => {
            if (await refresh(k)) {
              store(KEY_STORE, k)
              setKey(k)
            }
          }}
        />
      ) : (
        <>
          <Compose writerKey={key} onSent={() => refresh(key)} />
          <Mailbox
            writerKey={key}
            letters={letters}
            error={error}
            onChange={() => refresh(key)}
            onForget={() => {
              store(KEY_STORE, '')
              setKey('')
              setLetters(null)
            }}
          />
        </>
      )}
    </main>
  )
}

function Unlock({ error, onOpen }: { error: string; onOpen: (key: string) => Promise<void> }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="px-box card po-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!draft.trim() || busy) return
        setBusy(true)
        await onOpen(draft.trim())
        setBusy(false)
      }}
    >
      <label>
        your writer key
        <input
          id="writer-key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="writer-xxxx-xxxx-…"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button className="btn btn-pink" disabled={busy || !draft.trim()}>
        {busy ? 'unlocking…' : 'open the post office'}
      </button>
      {error && <p className="error">{error}</p>}
      <p className="muted">it’s only remembered on this device. keep it secret: anyone with it can write to {GIFT.recipientName}.</p>
    </form>
  )
}

function Compose({ writerKey, onSent }: { writerKey: string; onSent: () => void }) {
  const [body, setBody] = useState('')
  const [signed, setSigned] = useState(() => stored(SIGN_STORE))
  const [later, setLater] = useState(false)
  const [date, setDate] = useState(() => toLocalInput(at(8, 1)))
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const birthday = GIFT.birthday ? nextBirthday(GIFT.birthday) : null
  const presets: [string, Date][] = [
    ['tomorrow morning', at(8, 1)],
    ['in a week', at(8, 7)],
    ...(birthday ? ([['her birthday', birthday]] as [string, Date][]) : []),
  ]

  const send = async () => {
    setError('')
    setSent('')
    const deliver = later ? new Date(date) : null
    if (deliver && (isNaN(deliver.getTime()) || deliver.getTime() < Date.now() - 60_000))
      return setError('that time has already passed. pick one in the future, or send it right away.')
    setBusy(true)
    try {
      await sendLetter(writerKey, body.trim(), signed.trim(), deliver)
      store(SIGN_STORE, signed.trim())
      setBody('')
      setPreview(false)
      setSent(deliver ? `sealed ✉ it’ll arrive ${when(deliver.toISOString())}.` : `sent ✉ ${GIFT.foxName} will bring it to her the next time she opens the app.`)
      onSent()
    } catch (e) {
      setError(problem(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-box card po-form">
      <h2>write a letter</h2>
      {preview ? (
        <article className="letter px-box post">
          <p className="letter-intro">(this one came in the mail ✉)</p>
          {body.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : null))}
          {signed.trim() && <p className="sign">— {signed.trim()}</p>}
        </article>
      ) : (
        <textarea
          id="letter-body"
          value={body}
          maxLength={MAX}
          rows={9}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`dear ${GIFT.recipientName.toLowerCase()},\n\n`}
        />
      )}
      <p className="muted po-count">
        {body.length}/{MAX}
      </p>
      <label>
        signed
        <input id="letter-signed" value={signed} maxLength={60} onChange={(e) => setSigned(e.target.value)} placeholder="(leave empty to stay mysterious)" />
      </label>

      <h3>deliver</h3>
      <div className="chips">
        <button className={`chip-btn ${!later ? 'on' : ''}`} onClick={() => setLater(false)}>
          right away
        </button>
        <button className={`chip-btn ${later ? 'on' : ''}`} onClick={() => setLater(true)}>
          on a day I pick
        </button>
      </div>
      {later && (
        <>
          <input id="letter-when" type="datetime-local" value={date} min={toLocalInput(new Date())} onChange={(e) => setDate(e.target.value)} />
          <div className="chips">
            {presets.map(([label, d]) => (
              <button key={label} className={`chip-btn ${date === toLocalInput(d) ? 'on' : ''}`} onClick={() => setDate(toLocalInput(d))}>
                {label}
              </button>
            ))}
          </div>
          <p className="muted">
            in your time zone ({zone}). it stays hidden until then, and {GIFT.foxName} brings it the next time she opens the app.
          </p>
        </>
      )}

      <div className="row">
        <button className="btn" disabled={!body.trim()} onClick={() => setPreview((p) => !p)}>
          {preview ? 'edit' : 'preview'}
        </button>
        <button className="btn btn-pink" disabled={busy || !body.trim()} onClick={send}>
          {busy ? 'sending…' : later ? 'seal & schedule' : 'send ✉'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {sent && <p className="po-sent">{sent}</p>}
    </section>
  )
}

function Mailbox({
  writerKey,
  letters,
  error,
  onChange,
  onForget,
}: {
  writerKey: string
  letters: SentLetter[] | null
  error: string
  onChange: () => void
  onForget: () => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const now = Date.now()
  const waiting = (letters ?? []).filter((l) => Date.parse(l.deliver_at) > now).reverse()
  const delivered = (letters ?? []).filter((l) => Date.parse(l.deliver_at) <= now)

  const remove = async (id: string) => {
    try {
      await deleteLetter(writerKey, id)
    } finally {
      setConfirm(null)
      onChange()
    }
  }

  const item = (l: SentLetter, future: boolean) => (
    <li key={l.id} className="px-box po-letter">
      <button className="po-letter-top" onClick={() => setOpen(open === l.id ? null : l.id)}>
        <span className="list-title">{future ? `arrives ${when(l.deliver_at)}` : `sent ${when(l.deliver_at)}`}</span>
        <span className="list-sub">{open === l.id ? '' : l.body.slice(0, 60) + (l.body.length > 60 ? '…' : '')}</span>
      </button>
      {open === l.id && (
        <div className="po-letter-body">
          {l.body.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : null))}
          {l.signed && <p className="sign">— {l.signed}</p>}
          {confirm === l.id ? (
            <p className="muted">
              {future ? 'take this letter back?' : 'if she’s opened the app since, it’s already in her album and stays there. remove it anyway?'}{' '}
              <button className="link inline danger" onClick={() => remove(l.id)}>
                yes
              </button>{' '}
              <button className="link inline" onClick={() => setConfirm(null)}>
                no
              </button>
            </p>
          ) : (
            <button className="link danger" onClick={() => setConfirm(l.id)}>
              {future ? 'take it back…' : 'remove…'}
            </button>
          )}
        </div>
      )}
    </li>
  )

  return (
    <section className="px-box card">
      <h2>the mailbox</h2>
      {letters == null ? (
        <p className="muted">{error || 'opening…'}</p>
      ) : (
        <>
          {waiting.length > 0 && (
            <>
              <h3>waiting for their day ({waiting.length})</h3>
              <ul className="list">{waiting.map((l) => item(l, true))}</ul>
            </>
          )}
          <h3>sent ({delivered.length})</h3>
          {delivered.length ? <ul className="list">{delivered.map((l) => item(l, false))}</ul> : <p className="muted">nothing yet. write the first one ♡</p>}
        </>
      )}
      <button className="link" onClick={onForget}>
        forget the key on this device
      </button>
    </section>
  )
}
