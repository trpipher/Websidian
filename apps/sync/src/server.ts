import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hocuspocus } from './hocuspocus.js'
import { notesRouter } from './routes/notes.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { invitesRouter } from './routes/invites.js'

const app = new Hono()
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))
app.route('/api/auth', authRouter)
app.route('/api/projects', projectsRouter)
app.route('/api/invites', invitesRouter)
app.route('/api/projects/:projectId/notes', notesRouter)

serve({ fetch: app.fetch, port: 1235 }, () =>
  console.log('API on http://localhost:1235')
)

hocuspocus.listen()
console.log('Hocuspocus WS on ws://localhost:1234')
