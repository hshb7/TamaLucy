// The study buddy's brain: the fox turns her notes into flashcards, asks
// questions and checks answers, with help from Claude. This function holds the
// API key (as a secret), checks her mailbox code, and keeps a daily cap, so
// the app itself holds no secret and nobody else can run up the bill.
//
// Secrets (supabase secrets set ...):
//   ANTHROPIC_API_KEY   required; without it every call answers "not-set-up"
//   BUDDY_MODEL         optional, default claude-opus-5-5 (claude-haiku-5-5 is the cheap choice)
//   BUDDY_DAILY_LIMIT   optional, calls per mailbox per day, default 80
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MODEL = Deno.env.get('BUDDY_MODEL') ?? 'claude-opus-5-5'
const LIMIT = Number(Deno.env.get('BUDDY_DAILY_LIMIT') ?? 80)
const MAX_NOTES = 12_000

type Task = 'cards' | 'ask' | 'check'

const SCHEMAS: Record<Task, Record<string, unknown>> = {
  cards: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'], additionalProperties: false },
      },
    },
    required: ['cards'],
    additionalProperties: false,
  },
  ask: {
    type: 'object',
    properties: { question: { type: 'string' }, hint: { type: 'string' } },
    required: ['question', 'hint'],
    additionalProperties: false,
  },
  check: {
    type: 'object',
    properties: { verdict: { type: 'string', enum: ['yes', 'almost', 'no'] }, feedback: { type: 'string' }, answer: { type: 'string' } },
    required: ['verdict', 'feedback', 'answer'],
    additionalProperties: false,
  },
}

const SYSTEM =
  'You are a study buddy inside a small pomodoro app, speaking as the student’s pet fox. You turn their notes into flashcards, ask them study questions, and check their answers. Be accurate first, then warm and brief. Use the student’s own terminology. Plain sentences, no markdown, no emoji.'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function prompt(task: Task, b: Record<string, unknown>): string {
  const fox = str(b.fox, 20) || 'the fox'
  const subject = str(b.subject, 60) || 'their studies'
  if (task === 'cards') {
    const count = Math.min(30, Math.max(3, Number(b.count) || 15))
    return `Make up to ${count} flashcards for the class "${subject}" from these notes. Each card: a short front (a term, a rule, a case, a question) and a back that answers it in one to three sentences. Use only what the notes say; skip anything trivial or repeated. Your name is ${fox}.\n\n<notes>\n${str(b.notes, MAX_NOTES)}\n</notes>`
  }
  if (task === 'ask') {
    const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 40).map((c: Record<string, unknown>) => `- ${str(c.front, 120)}: ${str(c.back, 400)}`).join('\n')
    const recent = (Array.isArray(b.recent) ? b.recent : []).slice(-6).map((q: unknown) => `- ${str(q, 300)}`).join('\n')
    return `Ask the student one good study question about "${subject}": something they could be tested on, answerable in a few sentences. ${
      cards ? `Pick from, or build on, their own flashcards:\n${cards}` : 'They have no flashcards for it yet, so pick something central to the subject.'
    }${recent ? `\nDon't repeat these recent questions:\n${recent}` : ''}\nAlso give a one-line hint that nudges without giving the answer away. Speak as ${fox}.`
  }
  return `The student was asked, about "${subject}": "${str(b.question, 600)}"\nThey answered: "${str(b.answer, 1500)}"\nSay whether it is right ("yes"), partly right ("almost") or wrong ("no"). Give two or three sentences of feedback in ${fox}'s voice that name what was right and what was missing, kindly. Then give a model answer in one to three sentences.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return json({ error: 'not-set-up' }, 503)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const code = str(body.code, 80)
  const task = body.task as Task
  if (!code || !(task in SCHEMAS)) return json({ error: 'bad-request' }, 400)
  if (task === 'cards' && (typeof body.notes !== 'string' || body.notes.length > MAX_NOTES || body.notes.trim().length < 20)) return json({ error: 'too-long' }, 400)

  // her mailbox code is the login; the cap is per mailbox per day
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: left, error } = await sb.rpc('tl_usage_tick', { p_code: code, p_bucket: 'buddy', p_limit: LIMIT })
  if (error) return json({ error: error.code === '28000' ? 'wrong-code' : 'server' }, error.code === '28000' ? 403 : 500)
  if (typeof left !== 'number' || left < 0) return json({ error: 'limit' }, 429)

  const client = new Anthropic({ apiKey: key })
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMAS[task] } },
      messages: [{ role: 'user', content: prompt(task, body) }],
    })
    if (res.stop_reason === 'refusal') return json({ error: 'refused' }, 422)
    const text = res.content.find((b) => b.type === 'text')?.text ?? ''
    return json({ ...JSON.parse(text), left })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'limit' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'not-set-up' }, 503)
    console.error('study-buddy', e)
    return json({ error: 'server' }, 502)
  }
})
