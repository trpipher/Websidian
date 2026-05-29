import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hocuspocus } from './hocuspocus.js'
import { notesRouter } from './routes/notes.js'
import { authRouter } from './routes/auth.js'

const app = new Hono()
app.use('*', cors({ origin: '*' }))
app.route('/api/notes', notesRouter)
app.route('/api/auth', authRouter)

serve({ fetch: app.fetch, port: 1235 }, () =>
  console.log('API on http://localhost:1235')
)

hocuspocus.listen()
console.log('Hocuspocus WS on ws://localhost:1234')
