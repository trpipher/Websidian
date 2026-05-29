import type { Context } from 'hono'
import { db } from '../db.js'
import type { ProjectRole } from '@websidian/shared'

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

/** Returns the user's role in a project, or null if not a member. */
export function getUserRole(projectId: string, userId: string): ProjectRole | null {
  const row = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId) as { role: ProjectRole } | undefined
  return row?.role ?? null
}

/** Returns true if userRole meets or exceeds minRole. */
export function hasRole(userRole: ProjectRole | null, minRole: ProjectRole): boolean {
  if (!userRole) return false
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole]
}

/** Resolves userId from the Bearer token in the Authorization header. */
export function resolveUserId(c: Context): string | null {
  const authHeader = c.req.header('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return null
  const row = db.prepare(
    'SELECT userId FROM session WHERE token = ? AND expiresAt > ?'
  ).get(token, new Date().toISOString()) as { userId: string } | undefined
  return row?.userId ?? null
}

/**
 * Checks whether a request can READ a project.
 * Public projects: anyone can read. Private: must be a member.
 */
export function canReadProject(projectId: string, userId: string | null): boolean {
  const project = db.prepare(
    'SELECT is_public FROM projects WHERE id = ? AND deleted_at IS NULL'
  ).get(projectId) as { is_public: number } | undefined
  if (!project) return false
  if (project.is_public) return true
  if (!userId) return false
  return getUserRole(projectId, userId) !== null
}

/**
 * Hono middleware: requires user to have at least minRole in the project.
 * Reads projectId from route param 'projectId'.
 * Sets 'userId' and 'userRole' in context for downstream handlers.
 */
export function requireProjectRole(minRole: ProjectRole) {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = resolveUserId(c)
    const projectId = c.req.param('projectId') ?? c.req.param('id')
    if (!projectId) return c.json({ error: 'Missing project ID' }, 400)
    const role = userId ? getUserRole(projectId, userId) : null
    if (!hasRole(role, minRole)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    c.set('userId', userId)
    c.set('userRole', role)
    await next()
  }
}
