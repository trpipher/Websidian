import * as Y from 'yjs'
import * as yaml from 'js-yaml'
import { db } from './db.js'

const WIKILINK_RE = /\[\[([^\]\n\[|]+?)(?:\|[^\]\n\[]+)?\]\]/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

function extractWikilinks(content: string): string[] {
  const titles: string[] = []
  WIKILINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    const target = m[1].trim()
    if (IMAGE_EXT_RE.test(target)) continue
    const title = target.includes('/') ? target.split('/').pop()! : target
    titles.push(title)
  }
  return titles
}

export function parseFrontmatter(content: string): { tags: string[]; aliases: string[] } {
  const match = FRONTMATTER_RE.exec(content)
  if (!match) return { tags: [], aliases: [] }
  try {
    const parsed = yaml.load(match[1]) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return { tags: [], aliases: [] }

    const toStringArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.map(String).filter(Boolean)
      if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean)
      return []
    }

    return {
      tags: toStringArray(parsed['tags']),
      aliases: toStringArray(parsed['aliases']),
    }
  } catch {
    return { tags: [], aliases: [] }
  }
}

export function writeProjection(noteId: string, doc: Y.Doc): void {
  const content = doc.getText('content').toString()
  const now = new Date().toISOString()

  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?').run(content, now, noteId)

  // Wikilinks → note_links
  const linkedTitles = extractWikilinks(content)
  db.prepare('DELETE FROM note_links WHERE source_id = ?').run(noteId)
  const insertLinkByTitle = db.prepare(`
    INSERT OR IGNORE INTO note_links (source_id, target_id)
    SELECT ?, id FROM notes WHERE title = ? AND deleted_at IS NULL
  `)
  const insertLinkByAlias = db.prepare(`
    INSERT OR IGNORE INTO note_links (source_id, target_id)
    SELECT ?, note_id FROM note_aliases WHERE alias = ?
  `)
  db.transaction(() => {
    for (const title of linkedTitles) {
      insertLinkByTitle.run(noteId, title)
      insertLinkByAlias.run(noteId, title)
    }
  })()

  // Frontmatter → note_tags, note_aliases
  const { tags, aliases } = parseFrontmatter(content)
  const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)')
  const insertAlias = db.prepare('INSERT OR IGNORE INTO note_aliases (note_id, alias) VALUES (?, ?)')
  db.transaction(() => {
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
    for (const tag of tags) insertTag.run(noteId, tag)
    db.prepare('DELETE FROM note_aliases WHERE note_id = ?').run(noteId)
    for (const alias of aliases) insertAlias.run(noteId, alias)
  })()
}
