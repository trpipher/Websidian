import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET is not set')
  return s
}

export function signJwt(payload: Record<string, unknown>): string {
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body   = b64urlEncode(Buffer.from(JSON.stringify(payload)))
  const sig    = b64urlEncode(createHmac('sha256', secret()).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export function verifyJwt(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')
  const [header, body, sig] = parts
  const expected = b64urlEncode(createHmac('sha256', secret()).update(`${header}.${body}`).digest())
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid JWT signature')
  }
  const payload = JSON.parse(b64urlDecode(body).toString()) as Record<string, unknown>
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired')
  }
  return payload
}

/** Verify PKCE S256: SHA256(verifier) encoded as base64url must equal challenge */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest()
  return b64urlEncode(hash) === codeChallenge
}
