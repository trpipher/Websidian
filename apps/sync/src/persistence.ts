import * as Y from 'yjs'
import { db } from './db.js'
import { writeProjection } from './projection.js'

export function fetchDocument(noteId: string): Uint8Array | null {
  const row = db.prepare('SELECT data FROM yjs_documents WHERE note_id = ?').get(noteId) as
    | { data: Buffer }
    | undefined
  return row ? new Uint8Array(row.data) : null
}

export function storeDocument(noteId: string, doc: Y.Doc): void {
  const data = Y.encodeStateAsUpdate(doc)
  db.prepare(`
    INSERT INTO yjs_documents (note_id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(note_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(noteId, Buffer.from(data), new Date().toISOString())

  writeProjection(noteId, doc)
}
