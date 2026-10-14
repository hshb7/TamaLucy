// The token step of "sign in with Google" for the web app. Google wants the
// client secret when a code is traded for tokens, so that one call happens
// here instead of in the browser: the app sends the code (and the PKCE
// verifier) it got back from Google, or a refresh token, and gets tokens.
// Nothing else: no calendar data passes through here. Her mailbox code keeps
// it from being used by anyone else, and a daily cap keeps it polite.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LIMIT = Number(Deno.env.get('AUTH_DAILY_LIMIT') ?? 120)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
  if (!clientId || !clientSecret) return json({ error: 'not-set-up' }, 503)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const grant = body.grant
  if (!code || (grant !== 'code' && grant !== 'refresh')) return json({ error: 'bad-request' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: left, error } = await sb.rpc('tl_usage_tick', { p_code: code, p_bucket: 'auth', p_limit: LIMIT })
  if (error) return json({ error: error.code === '28000' ? 'no-mailbox' : 'server' }, error.code === '28000' ? 403 : 500)
  if (typeof left !== 'number' || left < 0) return json({ error: 'limit' }, 429)

  const form: Record<string, string> = { client_id: clientId, client_secret: clientSecret }
  if (grant === 'code') {
    const authCode = typeof body.auth_code === 'string' ? body.auth_code : ''
    const verifier = typeof body.verifier === 'string' ? body.verifier : ''
    const redirect = typeof body.redirect_uri === 'string' ? body.redirect_uri : ''
    if (!authCode || !verifier || !/^(https:\/\/|tamalucy:\/\/)/.test(redirect)) return json({ error: 'bad-request' }, 400)
    Object.assign(form, { grant_type: 'authorization_code', code: authCode, code_verifier: verifier, redirect_uri: redirect })
  } else {
    const refresh = typeof body.refresh_token === 'string' ? body.refresh_token : ''
    if (!refresh) return json({ error: 'bad-request' }, 400)
    Object.assign(form, { grant_type: 'refresh_token', refresh_token: refresh })
  }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.access_token) return json({ error: 'refused', detail: data?.error ?? res.status }, 401)
    return json({ access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in })
  } catch {
    return json({ error: 'offline' }, 502)
  }
})
