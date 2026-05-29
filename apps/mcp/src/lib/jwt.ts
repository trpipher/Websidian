import { createHmac, timingSafeEqual } from 'node:crypto'

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

export interface JwtPayload {
  sub: string
  name: string
  iat: number
  exp: number
}

export function verifyJwt(token: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')
  const [header, body, sig] = parts
  const expected = b64urlEncode(createHmac('sha256', secret()).update(`${header}.${body}`).digest())
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid JWT signature')
  }
  const payload = JSON.parse(b64urlDecode(body).toString()) as JwtPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired')
  return payload
}
