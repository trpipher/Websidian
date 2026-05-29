import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type BetterSqlite3 from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../websidian.db')

export const db: BetterSqlite3.Database = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)
