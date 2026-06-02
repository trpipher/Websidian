# Frontmatter & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse YAML frontmatter from note content; store tags and aliases in the DB; surface them in a `Ctrl+K` search modal; resolve aliases in wikilinks; render a Properties panel in preview.

**Architecture:** Server-side `parseFrontmatter` (using `js-yaml`) is called inside `writeProjection` to keep `note_tags` and `note_aliases` in sync on every save. The notes list endpoint joins aliases via `GROUP_CONCAT`. The search endpoint UNIONs FTS, tag, and alias matches. The web adds a `SearchModal` component triggered by `Ctrl+K`/`Cmd+K` and `remark-frontmatter` strips the raw `---` block from the preview while a new Properties panel renders the parsed fields above the note body.

**Tech Stack:** TypeScript strict, better-sqlite3, js-yaml, Hono, React, remark-frontmatter.

**Spec:** `docs/superpowers/specs/2026-05-30-frontmatter-search-design.md`

**Root directory:** `/mnt/d/Development/Websidian/`

---

## File Structure

```
packages/shared/src/
  index.ts                              MODIFY — add aliases: string[] to NoteMeta

apps/sync/
  package.json                          MODIFY — add js-yaml, @types/js-yaml
  src/db.ts                             MODIFY — migrate note_tags and note_aliases tables
  src/projection.ts                     MODIFY — parseFrontmatter, update tags/aliases in writeProjection, alias link resolution
  src/routes/notes.ts                   MODIFY — list endpoint adds aliases join; search endpoint adds tag+alias UNION

apps/web/
  package.json                          MODIFY — add remark-frontmatter
  src/components/MarkdownPreview.tsx    MODIFY — add remark-frontmatter plugin + Properties panel
  src/components/SearchModal.tsx        CREATE — Ctrl+K search modal
  src/App.tsx                           MODIFY — Ctrl+K handler, showSearch state, alias wikilink lookup
```

---

## Task 1: DB migration — note_tags and note_aliases tables

**Files:**
- Modify: `apps/sync/src/db.ts`

- [ ] **Step 1: Add migrations after the existing `is_folder` migration block**

Open `apps/sync/src/db.ts`. After the block that adds `is_folder` (around line 66), append:

```typescript
// Create note_tags table if not present
const noteTagsExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='note_tags'"
).get()
if (!noteTagsExists) {
  db.exec(`
    CREATE TABLE note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id),
      tag     TEXT NOT NULL,
      PRIMARY KEY (note_id, tag)
    )
  `)
  console.log('[db] created note_tags table')
}

// Create note_aliases table if not present
const noteAliasesExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='note_aliases'"
).get()
if (!noteAliasesExists) {
  db.exec(`
    CREATE TABLE note_aliases (
      note_id TEXT NOT NULL REFERENCES notes(id),
      alias   TEXT NOT NULL,
      PRIMARY KEY (note_id, alias)
    )
  `)
  console.log('[db] created note_aliases table')
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Verify migration runs**

```bash
pnpm --filter @websidian/sync dev &
sleep 4
kill %1 2>/dev/null || true
```

Expected log output includes: `[db] created note_tags table` and `[db] created note_aliases table` (only on first run).

- [ ] **Step 4: Commit**

```bash
git add apps/sync/src/db.ts
git commit -m "feat(sync): migrate note_tags and note_aliases tables"
```

---

## Task 2: Install server-side dependency — js-yaml

**Files:**
- Modify: `apps/sync/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter @websidian/sync add js-yaml
pnpm --filter @websidian/sync add -D @types/js-yaml
```

Expected: `Done in ...`

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/sync/package.json pnpm-lock.yaml
git commit -m "chore(sync): add js-yaml for frontmatter parsing"
```

---

## Task 3: Frontmatter parsing and writeProjection update

**Files:**
- Modify: `apps/sync/src/projection.ts`

- [ ] **Step 1: Rewrite projection.ts**

Replace the full contents of `apps/sync/src/projection.ts`:

```typescript
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
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/sync/src/projection.ts
git commit -m "feat(sync): parseFrontmatter extracts tags/aliases; writeProjection stores them and resolves alias links"
```

---

## Task 4: Shared type — add aliases to NoteMeta

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add aliases field**

Replace the `NoteMeta` interface in `packages/shared/src/index.ts`:

```typescript
export interface NoteMeta {
  id: string;
  path: string;
  title: string;
  updatedAt: string; // ISO 8601
  createdAt: string;
  projectId: string;
  parentId: string | null;
  sortOrder: number;
  isFolder: boolean;
  aliases: string[];  // empty array when no aliases declared
}
```

- [ ] **Step 2: Check shared compiles**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit 2>&1 | head -20
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | head -20
```

Expected: errors in `notes.ts` (list endpoint doesn't return `aliases` yet) and `App.tsx`/`useNotes.ts` (same). These are fixed in the next task — continue.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add aliases: string[] to NoteMeta"
```

---

## Task 5: Notes API — add aliases to list, extend search

**Files:**
- Modify: `apps/sync/src/routes/notes.ts`

- [ ] **Step 1: Update the list endpoint**

Replace the `notesRouter.get('/')` handler (lines 10–27):

```typescript
notesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder,
           COALESCE(GROUP_CONCAT(a.alias, char(31)), '') as aliasesRaw
    FROM notes n
    LEFT JOIN note_aliases a ON a.note_id = n.id
    WHERE n.project_id = ? AND n.deleted_at IS NULL
    GROUP BY n.id
    ORDER BY COALESCE(n.sort_order, n.rowid * 1000) ASC
  `).all(projectId) as (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number; aliasesRaw: string })[]

  return c.json(rows.map(({ aliasesRaw, isFolder, ...n }) => ({
    ...n,
    isFolder: Boolean(isFolder),
    aliases: aliasesRaw ? aliasesRaw.split('\x1F') : [],
  })))
})
```

- [ ] **Step 2: Replace the search endpoint**

Replace the `notesRouter.get('/search', ...)` handler (lines 61–79):

```typescript
notesRouter.get('/search', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const q = (c.req.query('q') ?? '').trim()
  if (!q) return c.json([])

  const ftsTerm = q.replace(/[^a-zA-Z0-9 ]/g, ' ').trim() + '*'
  const likeTerm = `%${q}%`

  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder,
           'fts' as matchType
    FROM notes_fts fts
    JOIN notes n ON n.rowid = fts.rowid
    WHERE notes_fts MATCH ? AND n.project_id = ? AND n.deleted_at IS NULL

    UNION

    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder,
           'tag' as matchType
    FROM notes n
    JOIN note_tags t ON t.note_id = n.id
    WHERE t.tag LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL

    UNION

    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder,
           'alias' as matchType
    FROM notes n
    JOIN note_aliases a ON a.note_id = n.id
    WHERE a.alias LIKE ? AND n.project_id = ? AND n.deleted_at IS NULL

    LIMIT 20
  `).all(ftsTerm, projectId, likeTerm, projectId, likeTerm, projectId) as
    (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number; matchType: string })[]

  return c.json(rows.map(n => ({
    ...n,
    isFolder: Boolean(n.isFolder),
    aliases: [] as string[],
  })))
})
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/sync/src/routes/notes.ts
git commit -m "feat(sync): notes list includes aliases; search UNIONs FTS + tag + alias matches"
```

---

## Task 6: Install web dependency — remark-frontmatter

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter @websidian/web add remark-frontmatter
```

Expected: `Done in ...`

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep -v "App.tsx" | head -20
```

Expected: no new errors from remark-frontmatter.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add remark-frontmatter"
```

---

## Task 7: MarkdownPreview — strip frontmatter + Properties panel

**Files:**
- Modify: `apps/web/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: Read current MarkdownPreview.tsx imports and remarkPlugins usage**

Find the line that starts with `import remarkGfm` and the `remarkPlugins` array in the `<ReactMarkdown>` element. They look like:

```typescript
import remarkGfm from 'remark-gfm'
// ...
<ReactMarkdown remarkPlugins={[remarkGfm]} ...>
```

- [ ] **Step 2: Add remark-frontmatter import and parseFrontmatter helper**

After the existing imports, add:

```typescript
import remarkFrontmatter from 'remark-frontmatter'
```

Then add a client-side `parseFrontmatter` function (needed here because the browser doesn't call the server to read frontmatter). Add this before the component function:

```typescript
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

interface ParsedFrontmatter {
  tags: string[]
  aliases: string[]
  rest: Record<string, unknown>
}

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = FRONTMATTER_RE.exec(content)
  if (!match) return null
  try {
    // Simple line-by-line YAML parser — avoids a heavy browser bundle
    const lines = match[1].split('\n')
    const result: Record<string, unknown> = {}
    for (const line of lines) {
      const colon = line.indexOf(':')
      if (colon === -1) continue
      const key = line.slice(0, colon).trim()
      const raw = line.slice(colon + 1).trim()
      if (raw.startsWith('[') && raw.endsWith(']')) {
        result[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      } else {
        result[key] = raw
      }
    }
    const toArr = (v: unknown) => Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []
    const { tags, aliases, ...rest } = result
    return { tags: toArr(tags), aliases: toArr(aliases), rest }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Update remarkPlugins and add Properties panel**

Find the section of the component function where the content string is derived from `yText`. The component uses `yText.toString()` or similar. After deriving `content`, add:

```typescript
const fm = parseFrontmatter(content)
```

Find the `return (` statement. Wrap the existing `<ReactMarkdown ...>` output in a fragment and prepend the Properties panel:

```tsx
return (
  <div style={{ padding: '0 16px 16px' }}>
    {fm && (
      <div style={{
        border: '1px solid #313244',
        borderRadius: 6,
        padding: '8px 12px',
        marginBottom: 12,
        fontSize: 12,
        color: '#a6adc8',
      }}>
        {fm.tags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ minWidth: 60, color: '#6c7086' }}>tags</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {fm.tags.map(tag => (
                <span key={tag} style={{
                  background: '#313244', color: '#cdd6f4',
                  borderRadius: 4, padding: '1px 6px', fontSize: 11,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        )}
        {fm.aliases.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ minWidth: 60, color: '#6c7086' }}>aliases</span>
            <span>{fm.aliases.join(', ')}</span>
          </div>
        )}
        {Object.entries(fm.rest).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ minWidth: 60, color: '#6c7086' }}>{key}</span>
            <span>{String(val)}</span>
          </div>
        ))}
      </div>
    )}
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkFrontmatter]}
      // ... keep all existing props unchanged
    >
      {content}
    </ReactMarkdown>
  </div>
)
```

**Important:** Keep all existing props on `<ReactMarkdown>` (`components`, `urlTransform`, etc.) — only add `remarkFrontmatter` to the `remarkPlugins` array and wrap with the outer `<div>`.

- [ ] **Step 4: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep "MarkdownPreview" | head -10
```

Expected: no errors for MarkdownPreview.tsx.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/MarkdownPreview.tsx
git commit -m "feat(web): strip frontmatter from preview; render Properties panel"
```

---

## Task 8: SearchModal component

**Files:**
- Create: `apps/web/src/components/SearchModal.tsx`

- [ ] **Step 1: Create SearchModal.tsx**

Create `apps/web/src/components/SearchModal.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface SearchResult {
  id: string
  title: string
  parentId: string | null
  matchType: 'fts' | 'tag' | 'alias' | string
}

interface Props {
  projectId: string
  token: string | null
  notes: NoteMeta[]
  onSelect: (id: string) => void
  onClose: () => void
}

function getFolderPath(notes: NoteMeta[], id: string): string {
  const noteMap = new Map(notes.map(n => [n.id, n]))
  const note = noteMap.get(id)
  if (!note?.parentId) return ''
  const segments: string[] = []
  let cur = noteMap.get(note.parentId)
  while (cur) {
    segments.unshift(cur.title)
    cur = cur.parentId ? noteMap.get(cur.parentId) : undefined
  }
  return segments.join(' / ')
}

export default function SearchModal({ projectId, token, notes, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/search?q=${encodeURIComponent(q)}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((data: SearchResult[]) => { setResults(data); setActiveIdx(0) })
      .catch(() => {})
  }, [projectId, token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIdx]) { onSelect(results[activeIdx].id); onClose() }
    else if (e.key === 'Escape') onClose()
  }

  const matchBadgeColor = (t: string) => t === 'tag' ? '#a6e3a1' : t === 'alias' ? '#89b4fa' : 'transparent'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e2e',
        border: '1px solid #313244',
        borderRadius: 10,
        width: 520,
        maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search notes, tags, aliases…"
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #313244',
            color: '#cdd6f4',
            fontSize: 15,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, i) => {
              const folderPath = getFolderPath(notes, r.id)
              return (
                <div
                  key={r.id}
                  onClick={() => { onSelect(r.id); onClose() }}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: i === activeIdx ? '#313244' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, color: '#cdd6f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.title}
                    </div>
                    {folderPath && (
                      <div style={{ fontSize: 11, color: '#6c7086', marginTop: 2 }}>{folderPath}</div>
                    )}
                  </div>
                  {r.matchType !== 'fts' && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: matchBadgeColor(r.matchType),
                      color: '#1e1e2e', flexShrink: 0,
                    }}>
                      {r.matchType}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#6c7086', fontSize: 13, textAlign: 'center' }}>
            No results
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep "SearchModal" | head -10
```

Expected: no errors for SearchModal.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SearchModal.tsx
git commit -m "feat(web): add SearchModal with debounced search, keyboard nav, match badges"
```

---

## Task 9: App.tsx — Ctrl+K, showSearch state, alias wikilink lookup

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Import SearchModal**

Add to the imports at the top of `apps/web/src/App.tsx`:

```typescript
import SearchModal from './components/SearchModal'
```

- [ ] **Step 2: Add showSearch state**

In the component body, after the other `useState` calls, add:

```typescript
const [showSearch, setShowSearch] = useState(false)
```

- [ ] **Step 3: Add Ctrl+K/Cmd+K keyboard handler**

Add a new `useEffect` in the component body (alongside the existing keyboard handlers):

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

- [ ] **Step 4: Add alias lookup to handleWikilinkClick**

In `handleWikilinkClick`, after the title lookup line:

```typescript
if (!existing) existing = notes.find(n => !n.isFolder && n.title === target)
```

Add:

```typescript
if (!existing) existing = notes.find(n => n.aliases.some(a => a.toLowerCase() === target.toLowerCase()))
```

- [ ] **Step 5: Render SearchModal**

In the JSX return, just before the closing `</div>` of the outermost element, add:

```tsx
{showSearch && activeProject && (
  <SearchModal
    projectId={activeProject.id}
    token={authToken}
    notes={notes}
    onSelect={id => { setActiveId(id); setSelectedImage(null); setShowSearch(false) }}
    onClose={() => setShowSearch(false)}
  />
)}
```

- [ ] **Step 6: TypeScript check — all packages**

```bash
pnpm --filter @websidian/web exec tsc --noEmit && \
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output from either.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): Ctrl+K search modal, alias wikilink resolution"
```

---

## Task 10: Manual verification

Start the servers:

```bash
pnpm --filter @websidian/sync dev &
pnpm --filter @websidian/web dev &
sleep 5
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 1: Frontmatter parsing — tags and aliases stored**

Open or create a note. In the editor, type:

```
---
tags: [react, hooks]
aliases: [useHooks, use-hooks]
---

Some note body.
```

Wait 3 seconds (next poll cycle). In the SQLite DB:

```bash
sqlite3 /mnt/d/Development/Websidian/websidian.db "SELECT * FROM note_tags LIMIT 5; SELECT * FROM note_aliases LIMIT 5;"
```

Expected: rows for `react`, `hooks` in `note_tags`; `useHooks`, `use-hooks` in `note_aliases`.

- [ ] **Step 2: Properties panel renders in preview**

Switch to Preview mode (toggle button). The note should show:
- A bordered Properties panel above the body with `tags [react] [hooks]` as pills and `aliases  useHooks, use-hooks` as plain text.
- The `---` block does NOT appear as markdown text.

- [ ] **Step 3: Ctrl+K opens search modal**

Press `Ctrl+K`. A search modal appears over the page with an autofocused input.

- [ ] **Step 4: Search by content (FTS)**

Type a word that appears in a note body. Results appear within ~200ms. Click one — navigates to the note and closes the modal.

- [ ] **Step 5: Search by tag**

Type `react`. Notes with `tags: [react]` in their frontmatter should appear with a green `tag` badge.

- [ ] **Step 6: Search by alias**

Type `useHooks`. The note with `aliases: [useHooks]` should appear with a blue `alias` badge.

- [ ] **Step 7: Keyboard navigation**

Press `Ctrl+K`, type a query, use `↓`/`↑` to move the active highlight, press `Enter` to select. Press `Ctrl+K` again to close.

- [ ] **Step 8: Alias wikilink resolution**

In another note, type `[[useHooks]]`. Ctrl+click the link (in editor) or click it in preview. It should navigate to the note that declares `useHooks` as an alias.

- [ ] **Step 9: Escape closes modal**

Press `Ctrl+K`, then `Escape`. Modal closes.

- [ ] **Step 10: Backdrop click closes modal**

Press `Ctrl+K`, click outside the modal box. Modal closes.

- [ ] **Step 11: Final commit**

```bash
git add -A
git diff --cached --quiet || git commit -m "feat: frontmatter parsing, tag/alias search, Properties panel, Ctrl+K modal complete"
```

---

## Acceptance Checklist

- [ ] YAML frontmatter with `tags` and `aliases` is parsed on every note save
- [ ] `note_tags` and `note_aliases` are populated in the DB after saves
- [ ] `GET /notes` returns `aliases: string[]` on every NoteMeta
- [ ] `GET /notes/search?q=` returns FTS, tag, and alias matches with `matchType`
- [ ] `[[alias]]` wikilinks resolve to the aliased note
- [ ] Ctrl+K / Cmd+K opens the search modal
- [ ] Search modal autofocuses input, debounces at 150ms
- [ ] Results show folder path and match-type badge for tag/alias matches
- [ ] ↑/↓/Enter/Escape all work in the modal
- [ ] Backdrop click closes the modal
- [ ] Preview shows Properties panel when frontmatter is present
- [ ] Tags display as pill badges in Properties panel
- [ ] `---` block does not render as markdown text
- [ ] `pnpm --filter @websidian/sync exec tsc --noEmit` passes
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
