# Frontmatter & Search Design

**Goal:** Parse YAML frontmatter from note content; extract `tags` and `aliases` into relational tables; surface them in a `Ctrl+K` search modal; resolve aliases in wikilinks; display frontmatter as a styled Properties panel in preview.

---

## Scope

| Feature | Included |
|---|---|
| Parse `tags` and `aliases` from frontmatter | ✅ |
| Store tags/aliases in DB, update on every save | ✅ |
| Wikilink alias resolution (`[[hooks]]` → note with alias "hooks") | ✅ |
| `Ctrl+K` search modal: title, content, tags, aliases | ✅ |
| Properties panel in preview (all frontmatter fields, tags as pills) | ✅ |
| `title` frontmatter field has no special behaviour | ✅ (displayed only) |
| Tag filtering / tag browser | ❌ (future) |
| Per-tag note counts | ❌ (future) |

---

## New Dependencies

| Package | Where | Purpose |
|---|---|---|
| `js-yaml` | `apps/sync` | Parse YAML frontmatter on the server |
| `@types/js-yaml` | `apps/sync` (dev) | TypeScript types |
| `remark-frontmatter` | `apps/web` | Strip `---` block from markdown AST before rendering |

---

## Database Schema

Two new tables, added via idempotent `sqlite_master` migration in `apps/sync/src/db.ts` (same pattern as existing migrations):

```sql
CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id),
  tag     TEXT NOT NULL,
  PRIMARY KEY (note_id, tag)
);

CREATE TABLE note_aliases (
  note_id TEXT NOT NULL REFERENCES notes(id),
  alias   TEXT NOT NULL,
  PRIMARY KEY (note_id, alias)
);
```

---

## Frontmatter Parsing — `apps/sync/src/projection.ts`

### `parseFrontmatter(content: string)`

Extracts the leading `---`…`---` block (must be at the very start of the document). Returns `{ tags: string[], aliases: string[] }`.

```
---
tags: [react, hooks]
aliases: [use-hooks, useHooks]
author: Thomas
---

Note body here...
```

- Uses `js-yaml` to parse the block.
- Normalises `tags` and `aliases` to `string[]`: accepts YAML lists (`[a, b]`) or inline strings.
- All other fields (e.g. `author`, `title`) are parsed but ignored for storage.
- If parsing fails or no frontmatter exists, returns `{ tags: [], aliases: [] }`.

### Changes to `writeProjection`

After updating `notes.content` and extracting wikilinks, also:

1. Call `parseFrontmatter(content)`.
2. `DELETE FROM note_tags WHERE note_id = ?` then `INSERT INTO note_tags` for each tag.
3. `DELETE FROM note_aliases WHERE note_id = ?` then `INSERT INTO note_aliases` for each alias.
4. **Extended link resolution** — the existing `INSERT INTO note_links … WHERE title = ?` is supplemented by a second insert that resolves linked titles via aliases:

```sql
INSERT OR IGNORE INTO note_links (source_id, target_id)
SELECT ?, note_id FROM note_aliases WHERE alias = ?
```

This means `[[hooks]]` creates a backlink to the note that declares `hooks` as an alias.

---

## Shared Type — `packages/shared/src/index.ts`

Add `aliases` to `NoteMeta`:

```typescript
export interface NoteMeta {
  id: string;
  path: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  projectId: string;
  parentId: string | null;
  sortOrder: number;
  isFolder: boolean;
  aliases: string[];  // ← new; empty array when note has no aliases
}
```

Tags are **not** added to `NoteMeta` — they are only used server-side for search.

---

## API Changes — `apps/sync/src/routes/notes.ts`

### Notes list endpoint (`GET /`)

Add a `LEFT JOIN` + `GROUP_CONCAT` to populate `aliases`:

```sql
SELECT n.id, n.path, n.title, n.project_id as projectId,
       n.parent_id as parentId, n.sort_order as sortOrder,
       n.is_folder as isFolder, n.created_at as createdAt, n.updated_at as updatedAt,
       COALESCE(GROUP_CONCAT(a.alias, char(31)), '') as aliasesRaw
FROM notes n
LEFT JOIN note_aliases a ON a.note_id = n.id
WHERE n.project_id = ? AND n.deleted_at IS NULL AND n.is_folder = 0
GROUP BY n.id
ORDER BY n.sort_order
```

In the response mapping, split `aliasesRaw` on `'\x1F'` (ASCII unit separator, safe since aliases never contain control characters) to produce `aliases: string[]`.

### Search endpoint (`GET /search?q=`)

Extended to UNION three sources. The `matchType` field tells the client why each result matched:

```sql
-- Title/content FTS match
SELECT n.id, n.title, n.project_id as projectId,
       n.parent_id as parentId, n.sort_order as sortOrder,
       n.is_folder as isFolder, n.created_at as createdAt, n.updated_at as updatedAt,
       'fts' as matchType
FROM notes_fts fts
JOIN notes n ON n.rowid = fts.rowid
WHERE notes_fts MATCH ? AND n.project_id = ? AND n.deleted_at IS NULL

UNION

-- Tag match
SELECT n.id, n.title, n.project_id as projectId,
       n.parent_id as parentId, n.sort_order as sortOrder,
       n.is_folder as isFolder, n.created_at as createdAt, n.updated_at as updatedAt,
       'tag' as matchType
FROM notes n
JOIN note_tags t ON t.note_id = n.id
WHERE t.tag LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL

UNION

-- Alias match
SELECT n.id, n.title, n.project_id as projectId,
       n.parent_id as parentId, n.sort_order as sortOrder,
       n.is_folder as isFolder, n.created_at as createdAt, n.updated_at as updatedAt,
       'alias' as matchType
FROM notes n
JOIN note_aliases a ON a.note_id = n.id
WHERE a.alias LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL
```

Response type: `Array<NoteMeta & { matchType: 'fts' | 'tag' | 'alias' }>`. Limit 20 results.

The FTS query uses `MATCH ?` (FTS5 prefix search: append `*` to the term). The tag/alias queries use `LIKE '%term%'`.

---

## Wikilink Alias Resolution — `apps/web/src/App.tsx`

In `handleWikilinkClick`, add a third lookup after the existing path and title lookups:

```typescript
// 1. Path-qualified (existing)
// 2. Title (existing)
// 3. Alias (new)
if (!existing) existing = notes.find(n => n.aliases.some(a => a.toLowerCase() === target.toLowerCase()))
```

Case-insensitive alias match. If an alias matches, navigate to that note. If still not found and `canEdit`, create a new note titled `target` as before.

---

## Vault Import — `apps/sync/src/routes/import.ts`

After `storeDocument` seeds the Yjs doc, call `writeProjection` on the note. Since `writeProjection` already handles frontmatter extraction (after this feature is built), imported notes with frontmatter automatically get their tags and aliases stored.

No separate import-time change needed — it's free.

---

## Frontend — MarkdownPreview

### New dependency: `remark-frontmatter`

Added to `apps/web`.

### `MarkdownPreview.tsx` changes

1. Add `remarkFrontmatter` to the `remarkPlugins` array so the `---` block is parsed out of the AST and never rendered as markdown text.
2. Extract frontmatter from the raw `content` string using the same `parseFrontmatter` logic (a client-side copy that runs in the browser).
3. Render a **Properties panel** above the `<ReactMarkdown>` output if the parsed frontmatter has any fields.

**Properties panel layout:**

```
┌─────────────────────────────────┐
│ tags     [react] [hooks]        │
│ aliases  use-hooks, useHooks    │
│ author   Thomas                 │
└─────────────────────────────────┘
```

- `tags` values render as small pill badges (coloured `#313244` background, `#cdd6f4` text)
- All other fields (including `aliases`) render as comma-separated plain text
- Panel only shown if the frontmatter block is non-empty
- Panel is visually distinct from the note body (subtle border, smaller font)

---

## Frontend — SearchModal

### New file: `apps/web/src/components/SearchModal.tsx`

Props:
```typescript
interface Props {
  projectId: string
  token: string | null
  notes: NoteMeta[]          // for folder-path display
  onSelect: (id: string) => void
  onClose: () => void
}
```

Behaviour:
- Text input autofocused on mount
- Debounced 150ms API call to `/api/projects/:projectId/notes/search?q=`
- Results list below input: note title, folder path (derived from `parentId` chain in `notes`), match hint badge (`tag: react`, `alias: hooks`, or empty for FTS)
- Keyboard: `↑`/`↓` moves active result, `Enter` selects, `Escape` closes
- Click selects
- Max 20 results displayed
- Empty query: show nothing (no results)
- Backdrop click closes

### `Ctrl+K` / `Cmd+K` trigger in `App.tsx`

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setShowSearch(s => !s)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

`showSearch` state renders `<SearchModal>` when true.

---

## File Changes

```
packages/shared/src/index.ts              MODIFY — add aliases to NoteMeta

apps/sync/
  package.json                            MODIFY — add js-yaml, @types/js-yaml
  src/db.ts                               MODIFY — migrate note_tags, note_aliases tables
  src/projection.ts                       MODIFY — parseFrontmatter, update tags/aliases, alias link resolution
  src/routes/notes.ts                     MODIFY — list endpoint joins aliases, search endpoint UNION

apps/web/
  package.json                            MODIFY — add remark-frontmatter
  src/components/MarkdownPreview.tsx      MODIFY — remark-frontmatter plugin, properties panel
  src/components/SearchModal.tsx          CREATE — search modal component
  src/App.tsx                             MODIFY — Ctrl+K handler, showSearch state, alias wikilink lookup
```
