import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { db } from '../db.js'
import { randomUUID } from 'node:crypto'
import { signJwt, verifyPkce } from '../lib/jwt.js'

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:1235'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173'
const TOKEN_TTL = 30 * 24 * 60 * 60 // 30 days in seconds
const CODE_TTL_MS = 5 * 60 * 1000    // 5 minutes

export const oauthRouter = new Hono()

// ── Dynamic client registration (RFC 7591) ───────────────────────────────────
oauthRouter.post('/register', async (c) => {
  const body = await c.req.json<{ client_name?: string; redirect_uris?: string[] }>()
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return c.json({ error: 'invalid_client_metadata', error_description: 'redirect_uris required' }, 400)
  }

  // Only allow http/https schemes — reject javascript:, file://, etc.
  const invalidUri = body.redirect_uris.find(uri => {
    try {
      const parsed = new URL(uri)
      return parsed.protocol !== 'http:' && parsed.protocol !== 'https:'
    } catch {
      return true // unparseable URI is invalid
    }
  })
  if (invalidUri) {
    return c.json({ error: 'invalid_client_metadata', error_description: 'redirect_uris must use http or https scheme' }, 400)
  }

  const clientId = randomUUID()
  db.prepare(`
    INSERT INTO oauth_clients (client_id, client_name, redirect_uris, created_at)
    VALUES (?, ?, ?, ?)
  `).run(clientId, body.client_name ?? '', JSON.stringify(body.redirect_uris), new Date().toISOString())

  return c.json({
    client_id: clientId,
    client_name: body.client_name ?? '',
    redirect_uris: body.redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
  }, 201)
})

// ── Authorization endpoint ───────────────────────────────────────────────────
oauthRouter.get('/authorize', async (c) => {
  const q = c.req.query()
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state } = q

  if (response_type !== 'code') {
    return c.json({ error: 'unsupported_response_type' }, 400)
  }
  if (!code_challenge) {
    return c.json({ error: 'invalid_request', error_description: 'code_challenge required' }, 400)
  }
  if (code_challenge_method && code_challenge_method !== 'S256') {
    return c.json({ error: 'invalid_request', error_description: 'Only S256 supported' }, 400)
  }

  // Validate client + redirect_uri
  const client = db.prepare(
    'SELECT redirect_uris FROM oauth_clients WHERE client_id = ?'
  ).get(client_id) as { redirect_uris: string } | undefined

  if (!client) return c.json({ error: 'invalid_client' }, 400)
  let allowedUris: string[]
  try {
    allowedUris = JSON.parse(client.redirect_uris) as string[]
  } catch {
    return c.json({ error: 'invalid_client', error_description: 'malformed client registration' }, 400)
  }
  if (!allowedUris.includes(redirect_uri)) {
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri mismatch' }, 400)
  }

  const loginRedirect = () => {
    const qs = c.req.url.includes('?') ? c.req.url.slice(c.req.url.indexOf('?')) : ''
    const returnUrl = `${BETTER_AUTH_URL}/oauth/authorize${qs}`
    return c.redirect(`${WEB_URL}?redirect=${encodeURIComponent(returnUrl)}`)
  }

  // Check Better Auth session cookie
  const sessionToken = getCookie(c, 'better-auth.session_token')
  if (!sessionToken) return loginRedirect()

  const session = db.prepare(
    'SELECT userId FROM session WHERE token = ? AND expiresAt > ?'
  ).get(sessionToken, new Date().toISOString()) as { userId: string } | undefined

  if (!session) return loginRedirect()

  // Auto-approve: issue authorization code
  const code = randomUUID()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  db.prepare(`
    INSERT INTO oauth_codes (code, client_id, user_id, redirect_uri, code_challenge, expires_at, used)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(code, client_id, session.userId, redirect_uri, code_challenge, expiresAt)

  const dest = new URL(redirect_uri)
  dest.searchParams.set('code', code)
  if (state) dest.searchParams.set('state', state)
  return c.redirect(dest.toString())
})

// ── Token endpoint ───────────────────────────────────────────────────────────
oauthRouter.post('/token', async (c) => {
  // Support both application/json and application/x-www-form-urlencoded
  let params: Record<string, string>
  const ct = c.req.header('content-type') ?? ''
  if (ct.includes('application/json')) {
    params = await c.req.json()
  } else {
    params = await c.req.parseBody() as Record<string, string>
  }

  const { grant_type, code, redirect_uri, client_id, code_verifier } = params

  if (grant_type !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400)
  }
  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return c.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, 400)
  }

  const row = db.prepare(`
    SELECT user_id, redirect_uri, code_challenge, expires_at, used
    FROM oauth_codes WHERE code = ? AND client_id = ?
  `).get(code, client_id) as {
    user_id: string
    redirect_uri: string
    code_challenge: string
    expires_at: string
    used: number
  } | undefined

  if (!row) return c.json({ error: 'invalid_grant' }, 400)
  if (row.used) return c.json({ error: 'invalid_grant', error_description: 'code already used' }, 400)
  if (new Date(row.expires_at) < new Date()) return c.json({ error: 'invalid_grant', error_description: 'code expired' }, 400)
  if (row.redirect_uri !== redirect_uri) return c.json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, 400)

  if (!verifyPkce(code_verifier, row.code_challenge)) {
    return c.json({ error: 'invalid_grant', error_description: 'code_verifier mismatch' }, 400)
  }

  // Atomically mark the code used — if another request already claimed it, changes will be 0
  const result = db.prepare('UPDATE oauth_codes SET used = 1 WHERE code = ? AND used = 0').run(code)
  if (result.changes === 0) {
    return c.json({ error: 'invalid_grant', error_description: 'code already used' }, 400)
  }

  // Look up user name for token payload
  const user = db.prepare('SELECT name FROM "user" WHERE id = ?').get(row.user_id) as { name: string } | undefined

  // Issue JWT
  const now = Math.floor(Date.now() / 1000)
  const accessToken = signJwt({
    sub: row.user_id,
    name: user?.name ?? '',
    iat: now,
    exp: now + TOKEN_TTL,
  })

  return c.json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: TOKEN_TTL,
  })
})
