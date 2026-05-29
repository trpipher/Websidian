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
