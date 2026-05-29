import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../websidian.db')

export const db: BetterSqlite3.Database = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

// Add project_id column to notes if not present
const cols = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
if (!cols.find(c => c.name === 'project_id')) {
  db.exec('ALTER TABLE notes ADD COLUMN project_id TEXT')
  console.log('[db] added project_id column to notes')
}

// Migration: assign orphan notes to a default "Personal" project
const orphanCount = (db.prepare('SELECT COUNT(*) as n FROM notes WHERE project_id IS NULL').get() as { n: number }).n
if (orphanCount > 0) {
  const existing = db.prepare("SELECT id FROM projects WHERE slug = 'personal-default' LIMIT 1").get() as { id: string } | undefined
  const projectId = existing?.id ?? randomUUID()
  const now = new Date().toISOString()
  if (!existing) {
    // Get the first real user from the user table, or use 'system'
    const firstUser = db.prepare("SELECT id FROM \"user\" LIMIT 1").get() as { id: string } | undefined
    const ownerId = firstUser?.id ?? 'system'
    db.prepare(`
      INSERT INTO projects (id, name, slug, description, is_public, owner_id, created_at, updated_at)
      VALUES (?, 'Personal', 'personal-default', '', 0, ?, ?, ?)
    `).run(projectId, ownerId, now, now)
    if (firstUser) {
      db.prepare(`
        INSERT OR IGNORE INTO project_members (project_id, user_id, role, joined_at)
        VALUES (?, ?, 'owner', ?)
      `).run(projectId, firstUser.id, now)
    }
  }
  db.prepare('UPDATE notes SET project_id = ? WHERE project_id IS NULL').run(projectId)
  console.log(`[db] migrated ${orphanCount} orphan notes to project ${projectId}`)
}

// Add parent_id, sort_order, is_folder to notes if not present
const noteCols = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
const noteColNames = new Set(noteCols.map(c => c.name))

if (!noteColNames.has('parent_id')) {
  db.exec('ALTER TABLE notes ADD COLUMN parent_id TEXT REFERENCES notes(id)')
  console.log('[db] added parent_id column to notes')
}
if (!noteColNames.has('sort_order')) {
  db.exec('ALTER TABLE notes ADD COLUMN sort_order REAL NOT NULL DEFAULT 0')
  // Assign initial sort order based on rowid so existing notes keep a stable order
  const rows = db.prepare('SELECT id, rowid FROM notes WHERE sort_order = 0').all() as { id: string; rowid: number }[]
  const update = db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?')
  db.transaction(() => { for (const r of rows) update.run(r.rowid * 1000, r.id) })()
  console.log(`[db] initialised sort_order for ${rows.length} notes`)
}
if (!noteColNames.has('is_folder')) {
  db.exec('ALTER TABLE notes ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0')
  console.log('[db] added is_folder column to notes')
}
