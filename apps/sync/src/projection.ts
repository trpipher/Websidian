import * as Y from 'yjs'
import { db } from './db.js'

// Group 1: target (path or title); Group 2: optional alias — ignored for link resolution
const WIKILINK_RE = /\[\[([^\]\n|]+?)(?:\|[^\]\n]+)?\]\]/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i

function extractWikilinks(content: string): string[] {
  const titles: string[] = []
  WIKILINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    const target = m[1].trim()
    // Skip image embeds
    if (IMAGE_EXT_RE.test(target)) continue
    // For path-qualified links (e.g. "Folder/Note"), use the last segment as title
    const title = target.includes('/') ? target.split('/').pop()! : target
    titles.push(title)
  }
  return titles
}

export function writeProjection(noteId: string, doc: Y.Doc): void {
  const content = doc.getText('content').toString()
  const now = new Date().toISOString()

  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(content, now, noteId)

  const linkedTitles = extractWikilinks(content)
  db.prepare('DELETE FROM note_links WHERE source_id = ?').run(noteId)
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO note_links (source_id, target_id)
    SELECT ?, id FROM notes WHERE title = ? AND deleted_at IS NULL
  `)
  db.transaction(() => {
    for (const title of linkedTitles) {
      insertLink.run(noteId, title)
    }
  })()
}
