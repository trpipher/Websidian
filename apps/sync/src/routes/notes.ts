import { Hono } from 'hono'
import { db } from '../db.js'
import type { NoteMeta } from '@websidian/shared'
import { randomUUID } from 'node:crypto'
import { resolveUserId, canReadProject, requireProjectRole } from '../middleware/project-auth.js'

export const notesRouter = new Hono()

// GET / — list notes in project
notesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const notes = db.prepare(`
    SELECT id, path, title, project_id as projectId,
           created_at as createdAt, updated_at as updatedAt
    FROM notes
    WHERE project_id = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `).all(projectId) as NoteMeta[]
  return c.json(notes)
})

// POST / — create note (editor+)
notesRouter.post('/', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')
  const { path, title } = await c.req.json<{ path: string; title: string }>()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO notes (id, path, title, content, project_id, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?)
  `).run(id, path, title, projectId, now, now)
  return c.json({ id, path, title, projectId, createdAt: now, updatedAt: now } as NoteMeta, 201)
})

// GET /search — FTS search within project
notesRouter.get('/search', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const q = c.req.query('q') ?? ''
  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt
    FROM notes_fts fts
    JOIN notes n ON n.rowid = fts.rowid
    WHERE notes_fts MATCH ? AND n.project_id = ? AND n.deleted_at IS NULL
    ORDER BY rank LIMIT 20
  `).all(q, projectId)
  return c.json(rows)
})

// PATCH /:id — rename note (editor+)
notesRouter.patch('/:id', requireProjectRole('editor'), async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json<Partial<{ path: string; title: string }>>()
  const now = new Date().toISOString()
  if (updates.title) db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id)
  if (updates.path) db.prepare('UPDATE notes SET path = ?, updated_at = ? WHERE id = ?').run(updates.path, now, id)
  return c.json({ ok: true })
})

// DELETE /:id — soft delete (admin+)
notesRouter.delete('/:id', requireProjectRole('admin'), (c) => {
  db.prepare('UPDATE notes SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), c.req.param('id'))
  return c.json({ ok: true })
})
