CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS yjs_documents (
  note_id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_links (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, content, content='notes', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
