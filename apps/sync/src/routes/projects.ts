import { Hono } from 'hono'
import { db } from '../db.js'
import { randomUUID } from 'node:crypto'
import type { Project, ProjectMember, InviteInfo, ProjectRole } from '@websidian/shared'
import {
  resolveUserId,
  getUserRole,
  hasRole,
  canReadProject,
  requireProjectRole,
} from '../middleware/project-auth.js'

export const projectsRouter = new Hono()

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
}

function uniqueSlug(base: string): string {
  let slug = base
  let i = 2
  while (db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug)) {
    slug = `${base}-${i++}`
  }
  return slug
}

// GET / — list user's projects
projectsRouter.get('/', (c) => {
  const userId = resolveUserId(c)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const rows = (db.prepare(`
    SELECT p.id, p.name, p.slug, p.description, p.is_public as isPublic,
           p.owner_id as ownerId, p.created_at as createdAt, p.updated_at as updatedAt,
           pm.role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE p.deleted_at IS NULL
    ORDER BY p.updated_at DESC
  `).all(userId) as any[]).map(r => ({ ...r, isPublic: Boolean(r.isPublic) })) as Project[]
  return c.json(rows)
})

// POST / — create project
projectsRouter.post('/', async (c) => {
  const userId = resolveUserId(c)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const { name, description = '', isPublic = false } = await c.req.json<{
    name: string; description?: string; isPublic?: boolean
  }>()
  const id = randomUUID()
  const slug = uniqueSlug(slugify(name))
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO projects (id, name, slug, description, is_public, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, slug, description, isPublic ? 1 : 0, userId, now, now)

  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (?, ?, 'owner', ?)
  `).run(id, userId, now)

  return c.json({ id, name, slug, description, isPublic, ownerId: userId, createdAt: now, updatedAt: now, role: 'owner' }, 201)
})

// GET /:id — get project (public or member)
projectsRouter.get('/:id', (c) => {
  const userId = resolveUserId(c)
  const projectId = c.req.param('id')
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const raw = db.prepare(`
    SELECT p.id, p.name, p.slug, p.description, p.is_public as isPublic,
           p.owner_id as ownerId, p.created_at as createdAt, p.updated_at as updatedAt
    FROM projects p WHERE p.id = ? AND p.deleted_at IS NULL
  `).get(projectId) as any

  if (!raw) return c.json({ error: 'Not found' }, 404)
  const row = { ...raw, isPublic: Boolean(raw.isPublic) } as Omit<Project, 'role'>
  const role = userId ? getUserRole(projectId, userId) ?? undefined : undefined
  return c.json({ ...row, role })
})

// PATCH /:id — update project settings (admin+)
projectsRouter.patch('/:id', requireProjectRole('admin'), async (c) => {
  const projectId = c.req.param('id')
  const updates = await c.req.json<Partial<{ name: string; description: string; isPublic: boolean }>>()
  const now = new Date().toISOString()
  if (updates.name !== undefined)
    db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(updates.name, now, projectId)
  if (updates.description !== undefined)
    db.prepare('UPDATE projects SET description = ?, updated_at = ? WHERE id = ?').run(updates.description, now, projectId)
  if (updates.isPublic !== undefined)
    db.prepare('UPDATE projects SET is_public = ?, updated_at = ? WHERE id = ?').run(updates.isPublic ? 1 : 0, now, projectId)
  return c.json({ ok: true })
})

// DELETE /:id — soft delete (owner only)
projectsRouter.delete('/:id', requireProjectRole('owner'), (c) => {
  db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), c.req.param('id'))
  return c.json({ ok: true })
})

// GET /:id/members — list members (any member)
projectsRouter.get('/:id/members', requireProjectRole('viewer'), (c) => {
  const projectId = c.req.param('id')
  const members = db.prepare(`
    SELECT pm.project_id as projectId, pm.user_id as userId,
           u.name as userName, pm.role, pm.joined_at as joinedAt
    FROM project_members pm
    JOIN "user" u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.joined_at
  `).all(projectId) as ProjectMember[]
  return c.json(members)
})

// PATCH /:id/members/:userId — change role (admin+)
projectsRouter.patch('/:id/members/:userId', requireProjectRole('admin'), async (c) => {
  const projectId = c.req.param('id')!
  const targetUserId = c.req.param('userId')!
  const { role } = await c.req.json<{ role: ProjectRole }>()
  const callerRole = (c as any).get('userRole') as ProjectRole

  if (getUserRole(projectId, targetUserId) === 'owner') return c.json({ error: 'Cannot change owner role' }, 403)
  if (role === 'owner') return c.json({ error: 'Cannot assign owner via this endpoint' }, 400)
  if (role === 'admin' && !hasRole(callerRole, 'owner')) return c.json({ error: 'Only owners can grant admin' }, 403)

  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, projectId, targetUserId)
  return c.json({ ok: true })
})

// DELETE /:id/members/:userId — remove member (admin+)
projectsRouter.delete('/:id/members/:userId', requireProjectRole('admin'), (c) => {
  const projectId = c.req.param('id')!
  const targetUserId = c.req.param('userId')!
  if (getUserRole(projectId, targetUserId) === 'owner') return c.json({ error: 'Cannot remove owner' }, 403)
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, targetUserId)
  return c.json({ ok: true })
})

// POST /:id/invites — generate invite link (admin+)
projectsRouter.post('/:id/invites', requireProjectRole('admin'), async (c) => {
  const projectId = c.req.param('id')
  const userId = (c as any).get('userId') as string
  const { role, maxUses, expiresAt } = await c.req.json<{
    role: ProjectRole; maxUses?: number; expiresAt?: string
  }>()
  if (role === 'owner') return c.json({ error: 'Cannot invite as owner' }, 400)

  const id = randomUUID()
  const token = randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO invite_links (id, project_id, role, token, created_by, created_at, expires_at, max_uses, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, projectId, role, token, userId, now, expiresAt ?? null, maxUses ?? null)

  return c.json({ id, projectId, role, token, createdAt: now, expiresAt, maxUses, useCount: 0 } as InviteInfo, 201)
})

// GET /:id/invites — list invite links (admin+)
projectsRouter.get('/:id/invites', requireProjectRole('admin'), (c) => {
  const invites = db.prepare(`
    SELECT id, project_id as projectId, role, token,
           created_at as createdAt, expires_at as expiresAt,
           max_uses as maxUses, use_count as useCount
    FROM invite_links WHERE project_id = ? ORDER BY created_at DESC
  `).all(c.req.param('id'))
  return c.json(invites)
})

// DELETE /:id/invites/:inviteId — revoke invite (admin+)
projectsRouter.delete('/:id/invites/:inviteId', requireProjectRole('admin'), (c) => {
  db.prepare('DELETE FROM invite_links WHERE id = ? AND project_id = ?').run(c.req.param('inviteId'), c.req.param('id'))
  return c.json({ ok: true })
})
