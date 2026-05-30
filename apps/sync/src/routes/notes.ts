import { Hono } from 'hono'
import { db } from '../db.js'
import type { NoteMeta, LinkEdge } from '@websidian/shared'
import { randomUUID } from 'node:crypto'
import { resolveUserId, canReadProject, requireProjectRole } from '../middleware/project-auth.js'

export const notesRouter = new Hono()

// ── List notes ────────────────────────────────────────────────────────────────
notesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder,
           COALESCE(GROUP_CONCAT(a.alias, char(31)), '') as aliasesRaw
    FROM notes n
    LEFT JOIN note_aliases a ON a.note_id = n.id
    WHERE n.project_id = ? AND n.deleted_at IS NULL
    GROUP BY n.id
    ORDER BY COALESCE(n.sort_order, n.rowid * 1000) ASC
  `).all(projectId) as (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number; aliasesRaw: string })[]

  return c.json(rows.map(({ aliasesRaw, isFolder, ...n }) => ({
    ...n,
    isFolder: Boolean(isFolder),
    aliases: aliasesRaw ? aliasesRaw.split('\x1F') : [],
  })))
})

// ── Create note or folder ─────────────────────────────────────────────────────
notesRouter.post('/', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')
  const body = await c.req.json<{
    title: string
    parentId?: string | null
    isFolder?: boolean
  }>()
  const { title, parentId = null, isFolder = false } = body
  const id = randomUUID()
  // Path is server-generated using the UUID so duplicate titles never collide
  const path = `${title.replace(/[^a-z0-9]+/gi, '-')}-${id.slice(0, 8)}.md`
  const now = new Date().toISOString()

  // Compute sort_order: max within parent + 1000
  const maxRow = db.prepare(`
    SELECT MAX(COALESCE(sort_order, 0)) as m FROM notes
    WHERE project_id = ? AND COALESCE(parent_id, '') = COALESCE(?, '') AND deleted_at IS NULL
  `).get(projectId, parentId) as { m: number | null }
  const sortOrder = (maxRow.m ?? 0) + 1000

  db.prepare(`
    INSERT INTO notes (id, path, title, content, project_id, parent_id, sort_order, is_folder, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
  `).run(id, path, title, projectId, parentId, sortOrder, isFolder ? 1 : 0, now, now)

  return c.json({
    id, path, title, projectId, createdAt: now, updatedAt: now,
    parentId, sortOrder, isFolder, aliases: [],
  } as NoteMeta, 201)
})

// ── FTS + tag + alias search ──────────────────────────────────────────────────
notesRouter.get('/search', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const q = (c.req.query('q') ?? '').trim()
  if (!q) return c.json([])

  const ftsTerm = q.replace(/[^a-zA-Z0-9 ]/g, ' ').trim() + '*'
  const likeTerm = `%${q}%`

  // _rank: 0 = title match, 1 = body-only FTS, 2 = alias, 3 = tag
  const rows = db.prepare(`
    SELECT id, path, title, projectId, createdAt, updatedAt, parentId, sortOrder, isFolder, matchType
    FROM (
      SELECT n.id, n.path, n.title, n.project_id as projectId,
             n.created_at as createdAt, n.updated_at as updatedAt,
             n.parent_id as parentId,
             COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
             COALESCE(n.is_folder, 0) as isFolder,
             'fts' as matchType,
             (CASE WHEN n.title LIKE ? THEN 0 ELSE 1 END) as _rank
      FROM notes_fts fts
      JOIN notes n ON n.rowid = fts.rowid
      WHERE notes_fts MATCH ? AND n.project_id = ? AND n.deleted_at IS NULL

      UNION

      SELECT n.id, n.path, n.title, n.project_id as projectId,
             n.created_at as createdAt, n.updated_at as updatedAt,
             n.parent_id as parentId,
             COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
             COALESCE(n.is_folder, 0) as isFolder,
             'alias' as matchType,
             2 as _rank
      FROM notes n
      JOIN note_aliases a ON a.note_id = n.id
      WHERE a.alias LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL

      UNION

      SELECT n.id, n.path, n.title, n.project_id as projectId,
             n.created_at as createdAt, n.updated_at as updatedAt,
             n.parent_id as parentId,
             COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
             COALESCE(n.is_folder, 0) as isFolder,
             'tag' as matchType,
             3 as _rank
      FROM notes n
      JOIN note_tags t ON t.note_id = n.id
      WHERE t.tag LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL
    )
    ORDER BY _rank ASC
    LIMIT 20
  `).all(likeTerm, ftsTerm, projectId, likeTerm, projectId, likeTerm, projectId) as
    (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number; matchType: string })[]

  return c.json(rows.map(n => ({
    ...n,
    isFolder: Boolean(n.isFolder),
    aliases: [] as string[],
  })))
})

// ── Update note (rename, move, reorder) ───────────────────────────────────────
notesRouter.patch('/:id', requireProjectRole('editor'), async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json<Partial<{
    title: string
    path: string
    parentId: string | null
    sortOrder: number
  }>>()
  const now = new Date().toISOString()

  // Cycle check: if moving a folder, ensure the new parentId is not a descendant
  if (updates.parentId !== undefined) {
    const note = db.prepare('SELECT is_folder FROM notes WHERE id = ?').get(id) as { is_folder: number } | undefined
    if (note?.is_folder) {
      const isCycle = db.prepare(`
        WITH RECURSIVE desc(id) AS (
          SELECT id FROM notes WHERE id = ?
          UNION ALL
          SELECT n.id FROM notes n JOIN desc d ON n.parent_id = d.id WHERE n.deleted_at IS NULL
        )
        SELECT COUNT(*) as cnt FROM desc WHERE id = ?
      `).get(id, updates.parentId) as { cnt: number }
      if (isCycle.cnt > 0) return c.json({ error: 'Cannot move a folder into its own descendant' }, 400)
    }
  }

  if (updates.title !== undefined)
    db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id)
  if (updates.path !== undefined)
    db.prepare('UPDATE notes SET path = ?, updated_at = ? WHERE id = ?').run(updates.path, now, id)
  if (updates.parentId !== undefined || updates.sortOrder !== undefined) {
    const fields: string[] = []
    const vals: unknown[] = []
    if (updates.parentId !== undefined) { fields.push('parent_id = ?'); vals.push(updates.parentId) }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); vals.push(updates.sortOrder) }
    fields.push('updated_at = ?'); vals.push(now)
    vals.push(id)
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  }

  return c.json({ ok: true })
})

// ── Delete note or folder (editor+, recursive for folders) ────────────────────
notesRouter.delete('/:id', requireProjectRole('editor'), (c) => {
  const id = c.req.param('id')
  const now = new Date().toISOString()

  // Recursively soft-delete all descendants then the note itself
  db.transaction(() => {
    db.prepare(`
      WITH RECURSIVE desc(id) AS (
        SELECT id FROM notes WHERE id = ?
        UNION ALL
        SELECT n.id FROM notes n JOIN desc d ON n.parent_id = d.id WHERE n.deleted_at IS NULL
      )
      UPDATE notes SET deleted_at = ? WHERE id IN (SELECT id FROM desc)
    `).run(id, now)
  })()

  return c.json({ ok: true })
})

// ── Backlinks ─────────────────────────────────────────────────────────────────
notesRouter.get('/:id/backlinks', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const id = c.req.param('id')
  const links = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder
    FROM note_links l
    JOIN notes n ON n.id = l.source_id
    WHERE l.target_id = ? AND n.project_id = ? AND n.deleted_at IS NULL
  `).all(id, projectId) as (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number })[]
  return c.json(links.map(n => ({ ...n, isFolder: Boolean(n.isFolder), aliases: [] as string[] })))
})

// ── Forward links ──────────────────────────────────────────────────────────────
notesRouter.get('/:id/forwardlinks', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const id = c.req.param('id')
  const links = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder
    FROM note_links l
    JOIN notes n ON n.id = l.target_id
    WHERE l.source_id = ? AND n.project_id = ? AND n.deleted_at IS NULL
  `).all(id, projectId) as (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number })[]
  return c.json(links.map(n => ({ ...n, isFolder: Boolean(n.isFolder), aliases: [] as string[] })))
})

// ── Graph ─────────────────────────────────────────────────────────────────────
notesRouter.get('/graph', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const links = db.prepare(`
    SELECT nl.source_id as sourceId, nl.target_id as targetId
    FROM note_links nl
    JOIN notes src ON src.id = nl.source_id AND src.deleted_at IS NULL AND src.project_id = ?
    JOIN notes tgt ON tgt.id = nl.target_id AND tgt.deleted_at IS NULL
  `).all(projectId) as LinkEdge[]
  return c.json(links)
})
