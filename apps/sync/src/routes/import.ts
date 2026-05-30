import { Hono } from 'hono'
import { db } from '../db.js'
import { randomUUID } from 'node:crypto'
import * as Y from 'yjs'
import { storeDocument } from '../persistence.js'
import { requireProjectRole } from '../middleware/project-auth.js'

interface ImportNote {
  path: string
  title: string
  isFolder: boolean
  parentPath: string | null
  content: string
}

export const importRouter = new Hono()

importRouter.post('/notes', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ notes: ImportNote[] }>()
  const notes = body.notes

  if (!Array.isArray(notes) || notes.length === 0) {
    return c.json({ imported: 0 }, 200)
  }

  const pathToId = new Map<string, string>()
  const now = new Date().toISOString()
  // Collect Yjs seeding work to do after the DB transaction commits
  const yjsQueue: Array<{ noteId: string; content: string }> = []

  db.transaction(() => {
    notes.forEach((note, index) => {
      const id = randomUUID()
      const parentId = note.parentPath ? (pathToId.get(note.parentPath) ?? null) : null
      const path = `${note.title.replace(/[^a-z0-9]+/gi, '-')}-${id.slice(0, 8)}.md`
      const sortOrder = index * 1000

      db.prepare(`
        INSERT INTO notes (id, path, title, content, project_id, parent_id, sort_order, is_folder, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, path, note.title, note.content, projectId, parentId, sortOrder, note.isFolder ? 1 : 0, now, now)

      pathToId.set(note.path, id)

      if (!note.isFolder && note.content) {
        yjsQueue.push({ noteId: id, content: note.content })
      }
    })
  })()

  // Seed Yjs documents after the DB transaction has committed.
  // storeDocument also updates the notes.content projection and note_links.
  for (const { noteId, content } of yjsQueue) {
    const doc = new Y.Doc()
    doc.getText('content').insert(0, content)
    storeDocument(noteId, doc)
  }

  return c.json({ imported: notes.length }, 201)
})
