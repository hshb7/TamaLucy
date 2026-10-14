// A small relay that fetches one calendar feed (an .ics address from iCloud,
// Google, Outlook, Canvas, a school...) for the app, because browsers can't
// read those addresses across origins. It fetches exactly the https address
// she pasted, follows a couple of redirects to public hosts only, and hands
// the text back: no other methods, no private networks, a size cap. Her
// mailbox code keeps it from being an open proxy, and a daily cap keeps it
// polite.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LIMIT = Number(Deno.env.get('FEED_DAILY_LIMIT') ?? 400)
const MAX_BYTES = 3 * 1024 * 1024
const HOST = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/i
const BLOCKED = /\.(local|internal|localhost|lan|home|corp|arpa)$|^\d+\.\d+\.\d+\.\d+$|^\[/i

function publicUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'))
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.username || u.password || raw.length > 2000) return null
  if (!HOST.test(u.hostname) || BLOCKED.test(u.hostname)) return null
  return u
}

/** Read at most MAX_BYTES of a body as text; null if it's bigger. */
async function readCapped(res: Response): Promise<string | null> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(all)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const url = typeof body.url === 'string' ? publicUrl(body.url) : null
  if (!code) return json({ error: 'bad-request' }, 400)
  if (!url) return json({ error: 'bad-url' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: left, error } = await sb.rpc('tl_usage_tick', { p_code: code, p_bucket: 'feed', p_limit: LIMIT })
  if (error) return json({ error: error.code === '28000' ? 'no-mailbox' : 'server' }, error.code === '28000' ? 403 : 500)
  if (typeof left !== 'number' || left < 0) return json({ error: 'limit' }, 429)

  try {
    let at = url
    let res: Response | null = null
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(at, { headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'User-Agent': 'TamaLucy/1 (calendar feed)' }, redirect: 'manual', signal: AbortSignal.timeout(20_000) })
      if (res.status < 300 || res.status >= 400) break
      const next = res.headers.get('location')
      const to = next ? publicUrl(new URL(next, at).toString()) : null
      await res.body?.cancel()
      if (!to) return json({ error: 'bad-url' }, 400)
      at = to
      res = null
    }
    if (!res) return json({ error: 'bad-url' }, 400)
    if (!res.ok) return json({ status: res.status, text: '' })
    const text = await readCapped(res)
    if (text === null) return json({ error: 'too-big' }, 413)
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) return json({ error: 'not-a-calendar' }, 422)
    return json({ status: res.status, text })
  } catch {
    return json({ error: 'offline' }, 502)
  }
})
