// A small relay so the app can talk to her school's Canvas from a browser
// (Canvas doesn't allow cross-origin requests). It forwards exactly one GET to
// /api/v1/... on the host she typed, with her own token, and nothing else: no
// other hosts, no other paths, no writes. Her mailbox code keeps it from being
// an open proxy, and a daily cap keeps it polite.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LIMIT = Number(Deno.env.get('CANVAS_DAILY_LIMIT') ?? 600)
const HOST = /^https:\/\/[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/i
const BLOCKED = /\.(local|internal|localhost|lan|home|corp)$|^https:\/\/\d+\.\d+\.\d+\.\d+$/i

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
  const base = typeof body.base === 'string' ? body.base.trim().replace(/\/+$/, '').toLowerCase() : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const path = typeof body.path === 'string' ? body.path : ''
  if (!code || !token) return json({ error: 'bad-request' }, 400)
  if (!HOST.test(base) || BLOCKED.test(base) || base.length > 120) return json({ error: 'bad-url' }, 400)
  if (!path.startsWith('/api/v1/') || path.includes('..') || path.includes('//') || /[\s#]/.test(path) || path.length > 2000) return json({ error: 'bad-path' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: left, error } = await sb.rpc('tl_usage_tick', { p_code: code, p_bucket: 'canvas', p_limit: LIMIT })
  if (error) return json({ error: error.code === '28000' ? 'no-mailbox' : 'server' }, error.code === '28000' ? 403 : 500)
  if (typeof left !== 'number' || left < 0) return json({ error: 'limit' }, 429)

  try {
    const res = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
    })
    // Canvas pages long lists through the Link header; hand back the next page's path
    let next: string | null = null
    const m = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')
    if (m) {
      try {
        const u = new URL(m[1])
        if (u.origin === base) next = u.pathname + u.search
      } catch {
        // not a link we can follow
      }
    }
    const data = await res.json().catch(() => null)
    return json({ status: res.status, data, next })
  } catch {
    return json({ error: 'offline' }, 502)
  }
})
