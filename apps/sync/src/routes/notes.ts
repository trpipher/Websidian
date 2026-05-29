import { Hono } from 'hono'
import { db } from '../db.js'
import type { NoteMeta } from '@websidian/shared'
import { randomUUID } from 'node:crypto'

export const notesRouter = new Hono()

notesRouter.get('/', (c) => {
  const notes = db.prepare(`
    SELECT id, path, title, created_at as createdAt, updated_at as updatedAt
    FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC
  `).all() as NoteMeta[]
  return c.json(notes)
})

notesRouter.post('/', async (c) => {
  const { path, title } = await c.req.json<{ path: string; title: string }>()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO notes (id, path, title, content, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?)
  `).run(id, path, title, now, now)
  return c.json({ id, path, title, createdAt: now, updatedAt: now }, 201)
})

notesRouter.get('/search', (c) => {
  const q = c.req.query('q') ?? ''
  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.created_at as createdAt, n.updated_at as updatedAt
    FROM notes_fts fts JOIN notes n ON n.rowid = fts.rowid
    WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
    ORDER BY rank LIMIT 20
  `).all(q)
  return c.json(rows)
})

notesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json<Partial<{ path: string; title: string }>>()
  const now = new Date().toISOString()
  if (updates.title) db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id)
  if (updates.path) db.prepare('UPDATE notes SET path = ?, updated_at = ? WHERE id = ?').run(updates.path, now, id)
  return c.json({ ok: true })
})

notesRouter.delete('/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('UPDATE notes SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  return c.json({ ok: true })
})
