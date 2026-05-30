import { Hono } from 'hono'
import { db } from '../db.js'
import type { ImageMeta } from '@websidian/shared'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveUserId, canReadProject, requireProjectRole } from '../middleware/project-auth.js'

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data')

function imagePath(projectId: string, imageId: string): string {
  return join(DATA_DIR, 'images', projectId, imageId)
}

export const imagesRouter = new Hono()

// ── Upload image ───────────────────────────────────────────────────────────────
imagesRouter.post('/', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c) as string

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 10 MB)' }, 413)
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!mimeType.startsWith('image/')) {
    return c.json({ error: 'Only image files are allowed' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const dir = join(DATA_DIR, 'images', projectId)
  mkdirSync(dir, { recursive: true })
  const filePath = imagePath(projectId, id)
  writeFileSync(filePath, Buffer.from(await file.arrayBuffer()))

  try {
    db.prepare(`
      INSERT INTO images (id, project_id, filename, mimetype, size, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, file.name, mimeType, file.size, userId, now)
  } catch {
    // Remove orphaned file if DB insert fails
    try { unlinkSync(filePath) } catch { /* best effort */ }
    return c.json({ error: 'Upload failed' }, 500)
  }

  return c.json({
    id,
    filename: file.name,
    projectId,
    mimeType,
    size: file.size,
    createdAt: now,
  } as ImageMeta, 201)
})

// ── List images ────────────────────────────────────────────────────────────────
imagesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const rows = db.prepare(`
    SELECT id, filename, project_id as projectId, mimetype as mimeType, size, created_at as createdAt
    FROM images
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as ImageMeta[]

  return c.json(rows)
})

// ── Rename image ───────────────────────────────────────────────────────────────
imagesRouter.patch('/:imageId', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')!
  const imageId = c.req.param('imageId')!
  const { filename } = await c.req.json<{ filename: string }>()
  if (!filename?.trim()) return c.json({ error: 'filename required' }, 400)

  const result = db.prepare(
    'UPDATE images SET filename = ? WHERE id = ? AND project_id = ?'
  ).run(filename.trim(), imageId, projectId)

  if (result.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ id: imageId, filename: filename.trim() })
})

// ── Serve image bytes ──────────────────────────────────────────────────────────
imagesRouter.get('/:imageId', async (c) => {
  const projectId = c.req.param('projectId')!
  const imageId = c.req.param('imageId')!

  const row = db.prepare(
    'SELECT mimetype FROM images WHERE id = ? AND project_id = ?'
  ).get(imageId, projectId) as { mimetype: string } | undefined

  if (!row) return c.json({ error: 'Not found' }, 404)

  const filePath = imagePath(projectId, imageId)
  if (!existsSync(filePath)) return c.json({ error: 'File missing' }, 404)

  const data = readFileSync(filePath)
  return new Response(data, {
    headers: {
      'Content-Type': row.mimetype,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
