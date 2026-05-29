import { Hono } from 'hono'
import { db } from '../db.js'
import { resolveUserId, getUserRole } from '../middleware/project-auth.js'

export const invitesRouter = new Hono()

// GET /:token — get invite info (public)
invitesRouter.get('/:token', (c) => {
  const token = c.req.param('token')
  const row = db.prepare(`
    SELECT il.id, il.project_id as projectId, p.name as projectName,
           il.role, il.token, il.created_at as createdAt,
           il.expires_at as expiresAt, il.max_uses as maxUses, il.use_count as useCount
    FROM invite_links il
    JOIN projects p ON p.id = il.project_id
    WHERE il.token = ? AND p.deleted_at IS NULL
  `).get(token) as any

  if (!row) return c.json({ error: 'Invite not found' }, 404)
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return c.json({ error: 'Invite expired' }, 410)
  if (row.maxUses !== null && row.useCount >= row.maxUses) return c.json({ error: 'Invite at capacity' }, 410)
  return c.json(row)
})

// POST /:token/join — join via invite (auth required)
invitesRouter.post('/:token/join', async (c) => {
  const userId = resolveUserId(c)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const token = c.req.param('token')
  const invite = db.prepare(`
    SELECT il.id, il.project_id as projectId, il.role,
           il.expires_at as expiresAt, il.max_uses as maxUses, il.use_count as useCount
    FROM invite_links il
    JOIN projects p ON p.id = il.project_id
    WHERE il.token = ? AND p.deleted_at IS NULL
  `).get(token) as any

  if (!invite) return c.json({ error: 'Invite not found' }, 404)
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return c.json({ error: 'Invite expired' }, 410)
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return c.json({ error: 'Invite at capacity' }, 410)

  const existing = getUserRole(invite.projectId, userId)
  if (existing) return c.json({ projectId: invite.projectId, role: existing, alreadyMember: true })

  const now = new Date().toISOString()
  db.prepare('INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(invite.projectId, userId, invite.role, now)
  db.prepare('UPDATE invite_links SET use_count = use_count + 1 WHERE id = ?').run(invite.id)

  return c.json({ projectId: invite.projectId, role: invite.role, alreadyMember: false }, 201)
})
