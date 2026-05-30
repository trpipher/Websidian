import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hocuspocus } from './hocuspocus.js'
import { notesRouter } from './routes/notes.js'
import { imagesRouter } from './routes/images.js'
import { importRouter } from './routes/import.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { invitesRouter } from './routes/invites.js'
import { oauthRouter } from './routes/oauth.js'

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:1235'

const app = new Hono()
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// OAuth 2.1 authorization server metadata (public, no auth)
app.get('/.well-known/oauth-authorization-server', (c) => c.json({
  issuer: BETTER_AUTH_URL,
  authorization_endpoint: `${BETTER_AUTH_URL}/oauth/authorize`,
  token_endpoint: `${BETTER_AUTH_URL}/oauth/token`,
  registration_endpoint: `${BETTER_AUTH_URL}/oauth/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
}))

app.route('/api/auth', authRouter)
app.route('/oauth', oauthRouter)
app.route('/api/projects', projectsRouter)
app.route('/api/invites', invitesRouter)
app.route('/api/projects/:projectId/notes', notesRouter)
app.route('/api/projects/:projectId/images', imagesRouter)
app.route('/api/projects/:projectId/import', importRouter)

serve({ fetch: app.fetch, port: 1235 }, () =>
  console.log('API on http://localhost:1235')
)

hocuspocus.listen()
console.log('Hocuspocus WS on ws://localhost:1234')
