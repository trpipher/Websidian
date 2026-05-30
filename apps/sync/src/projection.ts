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

const stmtUpdateContent = db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
const stmtDeleteLinks = db.prepare('DELETE FROM note_links WHERE source_id = ?')
const stmtInsertLinkByTitle = db.prepare(`
  INSERT OR IGNORE INTO note_links (source_id, target_id)
  SELECT ?, id FROM notes WHERE title = ? AND deleted_at IS NULL
`)
const stmtInsertLinkByAlias = db.prepare(`
  INSERT OR IGNORE INTO note_links (source_id, target_id)
  SELECT ?, note_id FROM note_aliases WHERE alias = ?
`)
const stmtDeleteTags = db.prepare('DELETE FROM note_tags WHERE note_id = ?')
const stmtInsertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)')
const stmtDeleteAliases = db.prepare('DELETE FROM note_aliases WHERE note_id = ?')
const stmtInsertAlias = db.prepare('INSERT OR IGNORE INTO note_aliases (note_id, alias) VALUES (?, ?)')

export function writeProjection(noteId: string, doc: Y.Doc): void {
  const content = doc.getText('content').toString()
  const now = new Date().toISOString()
  const linkedTitles = extractWikilinks(content)
  const { tags, aliases } = parseFrontmatter(content)

  db.transaction(() => {
    stmtUpdateContent.run(content, now, noteId)

    stmtDeleteLinks.run(noteId)
    for (const title of linkedTitles) {
      stmtInsertLinkByTitle.run(noteId, title)
      stmtInsertLinkByAlias.run(noteId, title)
    }

    stmtDeleteTags.run(noteId)
    for (const tag of tags) stmtInsertTag.run(noteId, tag)

    stmtDeleteAliases.run(noteId)
    for (const alias of aliases) stmtInsertAlias.run(noteId, alias)
  })()
}
