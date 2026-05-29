import * as Y from 'yjs'
import { db } from './db.js'

export function writeProjection(noteId: string, doc: Y.Doc): void {
  const content = doc.getText('content').toString()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE notes SET content = ?, updated_at = ? WHERE id = ?
  `).run(content, now, noteId)
}
