import { describe, expect, it } from 'vitest'
import { b64url, challenge, tokensFrom } from './oauth.ts'

describe('pkce', () => {
  it('makes the S256 challenge from RFC 7636’s example', async () => {
    expect(await challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
  it('encodes url-safe base64 without padding', () => {
    expect(b64url(new Uint8Array([251, 255, 254]))).toBe('-__-')
    expect(b64url(new Uint8Array([1]))).toBe('AQ')
  })
  it('keeps the old refresh token when the reply has none', () => {
    const t = tokensFrom({ access_token: 'a', expires_in: 10 }, 'r0')
    expect(t.refresh).toBe('r0')
    expect(t.exp).toBeGreaterThan(Date.now() + 9000)
    expect(tokensFrom({ access_token: 'a', refresh_token: 'r1', expires_in: 10 }, 'r0').refresh).toBe('r1')
  })
})
