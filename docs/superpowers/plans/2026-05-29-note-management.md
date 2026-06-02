# Note Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete, rename, drag-to-reorder, and folder organisation to the Websidian sidebar, with folders acting as notes that can contain children.

**Architecture:** Three new columns on `notes` (`parent_id`, `sort_order`, `is_folder`) store the hierarchy and ordering. The sync server's notes API is extended to return these fields and support atomic move + recursive delete. On the frontend, the flat `NoteMeta[]` list is built into a tree client-side; `@dnd-kit/core` + `@dnd-kit/sortable` handle drag-and-drop; a new `SidebarItem` component renders each row; a `ContextMenu` component handles right-click actions.

**Tech Stack:** TypeScript strict mode, better-sqlite3 (recursive CTEs), Hono, React, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-05-29-note-management-design.md`

**Root directory:** `/mnt/d/Development/Websidian/`

---

## File Structure

```
apps/sync/src/
  schema.sql                      MODIFY — add parent_id, sort_order, is_folder
  db.ts                           MODIFY — migration for existing notes
  routes/notes.ts                 MODIFY — new fields in GET/POST, move in PATCH, recursive DELETE

packages/shared/src/
  index.ts                        MODIFY — add parentId, sortOrder, isFolder to NoteMeta

apps/web/src/
  hooks/
    useNotes.ts                   MODIFY — add moveNote, renameNote, deleteNote; update createNote
  components/
    ContextMenu.tsx               CREATE — generic positioned right-click menu
    SidebarItem.tsx               CREATE — single draggable note/folder row
    Sidebar.tsx                   REWRITE — tree builder, DnD context, expand/collapse
  App.tsx                         MODIFY — pass new callbacks, handle note deletion
  package.json                    MODIFY — add @dnd-kit packages
```

---

## Task 1: Schema — add parent_id, sort_order, is_folder

**Files:**
- Modify: `apps/sync/src/schema.sql`
- Modify: `apps/sync/src/db.ts`

- [ ] **Step 1: Add three columns to schema.sql**

Append to the end of `apps/sync/src/schema.sql` (before the OAuth tables, after the notes table definition):

```sql
-- Note hierarchy and ordering sentinels (added via migration in db.ts)
-- parent_id, sort_order, is_folder — see db.ts for ALTER TABLE migration
```

Note: SQLite `CREATE TABLE IF NOT EXISTS` cannot add new columns to existing tables. The columns are added via `ALTER TABLE` in `db.ts` (next step), not in `schema.sql`.

- [ ] **Step 2: Add migration in db.ts**

In `apps/sync/src/db.ts`, append these migrations after the existing orphan-notes migration block:

```typescript
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
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Verify migration runs**

```bash
pnpm --filter @websidian/sync dev &
sleep 4
kill %1 2>/dev/null || true
```

Expected log output: `[db] added parent_id column to notes` etc. (only on first run).

- [ ] **Step 5: Commit**

```bash
git add apps/sync/src/schema.sql apps/sync/src/db.ts
git commit -m "feat(sync): add parent_id, sort_order, is_folder columns to notes"
```

---

## Task 2: Shared types — update NoteMeta

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add three fields to NoteMeta**

Replace the `NoteMeta` interface in `packages/shared/src/index.ts`:

```typescript
export interface NoteMeta {
  id: string
  path: string
  title: string
  updatedAt: string
  createdAt: string
  projectId: string
  parentId: string | null
  sortOrder: number
  isFolder: boolean
}
```

- [ ] **Step 2: TypeScript check across all packages**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit && \
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: errors in the sync notes route (SELECT doesn't return new fields yet) and web files. These will be fixed in subsequent tasks — verify only that the shared package itself compiles.

```bash
pnpm --filter @websidian/shared exec tsc --noEmit 2>/dev/null || pnpm -C packages/shared exec tsc --noEmit 2>/dev/null || echo "shared types OK (no tsconfig in shared)"
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add parentId, sortOrder, isFolder to NoteMeta"
```

---

## Task 3: Notes API — extend all four endpoints

**Files:**
- Modify: `apps/sync/src/routes/notes.ts`

- [ ] **Step 1: Rewrite notes.ts**

Replace the full contents of `apps/sync/src/routes/notes.ts`:

```typescript
import { Hono } from 'hono'
import { db } from '../db.js'
import type { NoteMeta, LinkEdge } from '@websidian/shared'
import { randomUUID } from 'node:crypto'
import { resolveUserId, canReadProject, requireProjectRole } from '../middleware/project-auth.js'

export const notesRouter = new Hono()

// ── List notes ────────────────────────────────────────────────────────────────
notesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const notes = db.prepare(`
    SELECT id, path, title, project_id as projectId,
           created_at as createdAt, updated_at as updatedAt,
           parent_id as parentId,
           COALESCE(sort_order, rowid * 1000) as sortOrder,
           COALESCE(is_folder, 0) as isFolder
    FROM notes
    WHERE project_id = ? AND deleted_at IS NULL
    ORDER BY COALESCE(sort_order, rowid * 1000) ASC
  `).all(projectId) as (NoteMeta & { isFolder: number })[]

  return c.json(notes.map(n => ({ ...n, isFolder: Boolean(n.isFolder) })))
})

// ── Create note or folder ─────────────────────────────────────────────────────
notesRouter.post('/', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')
  const body = await c.req.json<{
    path: string
    title: string
    parentId?: string | null
    isFolder?: boolean
  }>()
  const { path, title, parentId = null, isFolder = false } = body
  const id = randomUUID()
  const now = new Date().toISOString()

  // Compute sort_order: max within parent + 1000
  const maxRow = db.prepare(`
    SELECT MAX(COALESCE(sort_order, 0)) as m FROM notes
    WHERE project_id = ? AND COALESCE(parent_id, '') = COALESCE(?, '') AND deleted_at IS NULL
  `).get(projectId, parentId) as { m: number | null }
  const sortOrder = (maxRow.m ?? 0) + 1000

  db.prepare(`
    INSERT INTO notes (id, path, title, content, project_id, parent_id, sort_order, is_folder, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
  `).run(id, path, title, projectId, parentId, sortOrder, isFolder ? 1 : 0, now, now)

  return c.json({
    id, path, title, projectId, createdAt: now, updatedAt: now,
    parentId, sortOrder, isFolder,
  } as NoteMeta, 201)
})

// ── FTS search ────────────────────────────────────────────────────────────────
notesRouter.get('/search', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const q = c.req.query('q') ?? ''
  const rows = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder
    FROM notes_fts fts
    JOIN notes n ON n.rowid = fts.rowid
    WHERE notes_fts MATCH ? AND n.project_id = ? AND n.deleted_at IS NULL
    ORDER BY rank LIMIT 20
  `).all(q, projectId) as (NoteMeta & { isFolder: number })[]
  return c.json(rows.map(n => ({ ...n, isFolder: Boolean(n.isFolder) })))
})

// ── Update note (rename, move, reorder) ───────────────────────────────────────
notesRouter.patch('/:id', requireProjectRole('editor'), async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json<Partial<{
    title: string
    path: string
    parentId: string | null
    sortOrder: number
  }>>()
  const now = new Date().toISOString()

  // Cycle check: if moving a folder, ensure the new parentId is not a descendant
  if (updates.parentId !== undefined) {
    const note = db.prepare('SELECT is_folder FROM notes WHERE id = ?').get(id) as { is_folder: number } | undefined
    if (note?.is_folder) {
      const isCycle = db.prepare(`
        WITH RECURSIVE desc(id) AS (
          SELECT id FROM notes WHERE id = ?
          UNION ALL
          SELECT n.id FROM notes n JOIN desc d ON n.parent_id = d.id WHERE n.deleted_at IS NULL
        )
        SELECT COUNT(*) as cnt FROM desc WHERE id = ?
      `).get(id, updates.parentId) as { cnt: number }
      if (isCycle.cnt > 0) return c.json({ error: 'Cannot move a folder into its own descendant' }, 400)
    }
  }

  if (updates.title !== undefined)
    db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, id)
  if (updates.path !== undefined)
    db.prepare('UPDATE notes SET path = ?, updated_at = ? WHERE id = ?').run(updates.path, now, id)
  if (updates.parentId !== undefined || updates.sortOrder !== undefined) {
    const fields: string[] = []
    const vals: unknown[] = []
    if (updates.parentId !== undefined) { fields.push('parent_id = ?'); vals.push(updates.parentId) }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); vals.push(updates.sortOrder) }
    fields.push('updated_at = ?'); vals.push(now)
    vals.push(id)
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  }

  return c.json({ ok: true })
})

// ── Delete note or folder (editor+, recursive for folders) ────────────────────
notesRouter.delete('/:id', requireProjectRole('editor'), (c) => {
  const id = c.req.param('id')
  const now = new Date().toISOString()

  // Recursively soft-delete all descendants then the note itself
  db.transaction(() => {
    db.prepare(`
      WITH RECURSIVE desc(id) AS (
        SELECT id FROM notes WHERE id = ?
        UNION ALL
        SELECT n.id FROM notes n JOIN desc d ON n.parent_id = d.id WHERE n.deleted_at IS NULL
      )
      UPDATE notes SET deleted_at = ? WHERE id IN (SELECT id FROM desc)
    `).run(id, now)
  })()

  return c.json({ ok: true })
})

// ── Backlinks ─────────────────────────────────────────────────────────────────
notesRouter.get('/:id/backlinks', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const id = c.req.param('id')
  const links = db.prepare(`
    SELECT n.id, n.path, n.title, n.project_id as projectId,
           n.created_at as createdAt, n.updated_at as updatedAt,
           n.parent_id as parentId,
           COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
           COALESCE(n.is_folder, 0) as isFolder
    FROM note_links l
    JOIN notes n ON n.id = l.source_id
    WHERE l.target_id = ? AND n.deleted_at IS NULL
  `).all(id) as (NoteMeta & { isFolder: number })[]
  return c.json(links.map(n => ({ ...n, isFolder: Boolean(n.isFolder) })))
})

// ── Graph ─────────────────────────────────────────────────────────────────────
notesRouter.get('/graph', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)
  const links = db.prepare(`
    SELECT nl.source_id as sourceId, nl.target_id as targetId
    FROM note_links nl
    JOIN notes src ON src.id = nl.source_id AND src.deleted_at IS NULL AND src.project_id = ?
    JOIN notes tgt ON tgt.id = nl.target_id AND tgt.deleted_at IS NULL
  `).all(projectId) as LinkEdge[]
  return c.json(links)
})
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Smoke-test the API**

```bash
pnpm --filter @websidian/sync dev &
sleep 4

# Start sync server and verify notes list returns new fields
# (Replace PROJECT_ID with a real one from your DB)
sqlite3 /mnt/d/Development/Websidian/websidian.db "SELECT id FROM projects LIMIT 1;"
# Copy the id and set:
# PROJECT_ID=<id from above>
# TOKEN=<your ws-token from sessionStorage>
# Then: curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1235/api/projects/$PROJECT_ID/notes | python3 -m json.tool | head -30

kill %1 2>/dev/null || true
```

Expected: each note object now includes `parentId`, `sortOrder`, `isFolder` fields.

- [ ] **Step 4: Commit**

```bash
git add apps/sync/src/routes/notes.ts
git commit -m "feat(sync): extend notes API — parentId/sortOrder/isFolder, recursive delete, folder move"
```

---

## Task 4: useNotes hook — add mutations

**Files:**
- Modify: `apps/web/src/hooks/useNotes.ts`

- [ ] **Step 1: Rewrite useNotes.ts**

Replace the full contents of `apps/web/src/hooks/useNotes.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useNotes(projectId: string | null, token: string | null) {
  const [notes, setNotes] = useState<NoteMeta[]>([])

  const refresh = useCallback(async () => {
    if (!projectId) return
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API}/api/projects/${projectId}/notes`, { headers })
    if (res.ok) setNotes(await res.json())
  }, [projectId, token])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const createNote = useCallback(async (
    title: string,
    options?: { parentId?: string | null; isFolder?: boolean },
  ) => {
    if (!projectId || !token) return
    await fetch(`${API}/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        path: `${title.replace(/[^a-z0-9]+/gi, '-')}.md`,
        title,
        parentId: options?.parentId ?? null,
        isFolder: options?.isFolder ?? false,
      }),
    })
    await refresh()
  }, [projectId, token, authHeaders, refresh])

  const renameNote = useCallback(async (id: string, title: string) => {
    if (!token) return
    await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    })
    await refresh()
  }, [projectId, token, authHeaders, refresh])

  const deleteNote = useCallback(async (id: string) => {
    if (!token) return
    await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    await refresh()
  }, [projectId, token, refresh])

  const moveNote = useCallback(async (
    id: string,
    parentId: string | null,
    sortOrder: number,
  ) => {
    if (!token) return
    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, parentId, sortOrder } : n
    ))
    const res = await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parentId, sortOrder }),
    })
    if (!res.ok) {
      // Revert on failure
      await refresh()
    }
  }, [projectId, token, authHeaders, refresh])

  return { notes, refresh, createNote, renameNote, deleteNote, moveNote }
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: errors only in `Sidebar.tsx` and `App.tsx` (they still use the old hook signature). Proceed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useNotes.ts
git commit -m "feat(web): extend useNotes — createNote options, renameNote, deleteNote, moveNote"
```

---

## Task 5: Install @dnd-kit packages

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter @websidian/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: `Done in ...`

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep -v "Sidebar\|App.tsx" | head -20
```

Expected: no new errors from dnd-kit.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @dnd-kit packages for drag-and-drop"
```

---

## Task 6: ContextMenu component

**Files:**
- Create: `apps/web/src/components/ContextMenu.tsx`

- [ ] **Step 1: Create ContextMenu.tsx**

Create `apps/web/src/components/ContextMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  // Adjust position so menu doesn't overflow viewport
  const menuWidth = 180
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: adjustedX,
        background: '#181825',
        border: '1px solid #313244',
        borderRadius: 6,
        zIndex: 1000,
        minWidth: menuWidth,
        padding: '4px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            color: item.danger ? '#f38ba8' : '#cdd6f4',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#313244')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep "ContextMenu" | head -5
```

Expected: no errors for ContextMenu.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ContextMenu.tsx
git commit -m "feat(web): add ContextMenu component"
```

---

## Task 7: SidebarItem component

**Files:**
- Create: `apps/web/src/components/SidebarItem.tsx`

- [ ] **Step 1: Create SidebarItem.tsx**

Create `apps/web/src/components/SidebarItem.tsx`:

```tsx
import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import type { NoteMeta } from '@websidian/shared'

interface Props {
  note: NoteMeta
  depth: number
  isActive: boolean
  isExpanded: boolean
  canEdit: boolean
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string, isFolder: boolean, childCount: number) => void
  onNewNote: (parentId: string) => void
  onNewFolder: (parentId: string) => void
  childCount: number
}

export default function SidebarItem({
  note, depth, isActive, isExpanded, canEdit,
  onSelect, onToggle, onRename, onDelete, onNewNote, onNewFolder, childCount,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, disabled: !canEdit })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== note.title) onRename(note.id, trimmed)
    setIsRenaming(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEdit) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const menuItems: ContextMenuItem[] = note.isFolder
    ? [
        { label: 'Rename', onClick: () => { setRenameValue(note.title); setIsRenaming(true); setTimeout(() => inputRef.current?.select(), 10) } },
        { label: 'New note inside', onClick: () => onNewNote(note.id) },
        { label: 'New folder inside', onClick: () => onNewFolder(note.id) },
        { label: 'Delete folder', onClick: () => onDelete(note.id, true, childCount), danger: true },
      ]
    : [
        { label: 'Rename', onClick: () => { setRenameValue(note.title); setIsRenaming(true); setTimeout(() => inputRef.current?.select(), 10) } },
        { label: 'Delete', onClick: () => onDelete(note.id, false, 0), danger: true },
      ]

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          paddingLeft: 8 + depth * 16,
          borderRadius: 4,
          cursor: 'pointer',
          background: isActive ? '#313244' : 'transparent',
          marginBottom: 1,
          fontSize: 13,
          color: '#cdd6f4',
          userSelect: 'none',
          gap: 2,
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Chevron for folders, spacer for notes */}
        {note.isFolder ? (
          <span
            onClick={e => { e.stopPropagation(); onToggle(note.id) }}
            style={{ width: 16, flexShrink: 0, color: '#6c7086', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            style={{
              flex: 1,
              background: '#313244',
              border: '1px solid #89b4fa',
              borderRadius: 3,
              color: '#cdd6f4',
              fontSize: 13,
              padding: '1px 4px',
            }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onClick={() => onSelect(note.id)}
          >
            {note.isFolder ? '📁 ' : ''}{note.title}
          </span>
        )}

        {/* Drag handle — only for editors */}
        {canEdit && !isRenaming && (
          <span
            {...attributes}
            {...listeners}
            style={{
              color: '#45475a',
              cursor: 'grab',
              fontSize: 14,
              padding: '0 2px',
              flexShrink: 0,
              opacity: 0,
            }}
            className="drag-handle"
          >
            ⠿
          </span>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}

      <style>{`.drag-handle { opacity: 0 } div:hover > .drag-handle { opacity: 1 }`}</style>
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep "SidebarItem" | head -10
```

Expected: no errors for SidebarItem.tsx itself.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SidebarItem.tsx
git commit -m "feat(web): add SidebarItem with drag handle, rename, context menu"
```

---

## Task 8: Sidebar rewrite

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Rewrite Sidebar.tsx**

Replace the full contents of `apps/web/src/components/Sidebar.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { NoteMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'

interface NoteNode extends NoteMeta {
  children: NoteNode[]
  depth: number
}

function buildTree(notes: NoteMeta[], parentId: string | null = null, depth = 0): NoteNode[] {
  return notes
    .filter(n => (n.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(n => ({ ...n, depth, children: buildTree(notes, n.id, depth + 1) }))
}

function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) {
      result.push(...flattenVisible(node.children, expanded))
    }
  }
  return result
}

function countDescendants(notes: NoteMeta[], id: string): number {
  const children = notes.filter(n => n.parentId === id)
  return children.reduce((acc, c) => acc + 1 + countDescendants(notes, c.id), 0)
}

function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const ancestors = new Set<string>()
  let current = notes.find(n => n.id === id)
  while (current?.parentId) {
    ancestors.add(current.parentId)
    current = notes.find(n => n.id === current!.parentId)
  }
  return ancestors
}

interface Props {
  notes: NoteMeta[]
  activeId: string | null
  canEdit: boolean
  onSelect: (id: string) => void
  onNewNote: (parentId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, parentId: string | null, sortOrder: number) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const [overFolderTimer, setOverFolderTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Auto-expand ancestors of the active note
  useEffect(() => {
    if (!activeId) return
    const ancestors = getAncestorIds(notes, activeId)
    if (ancestors.size > 0) {
      setExpanded(prev => new Set([...prev, ...ancestors]))
    }
  }, [activeId, notes])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string, isFolder: boolean, childCount: number) => {
    if (isFolder && childCount > 0) {
      const note = notes.find(n => n.id === id)
      if (!window.confirm(`Delete "${note?.title}" and all ${childCount} items inside?`)) return
    }
    onDelete(id)
  }, [notes, onDelete])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(notes)
  const visible = flattenVisible(tree, expanded)
  const visibleIds = visible.map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) { setOverFolderId(null); return }
    const overNote = notes.find(n => n.id === over.id)
    if (overNote?.isFolder && over.id !== overFolderId) {
      if (overFolderTimer) clearTimeout(overFolderTimer)
      const t = setTimeout(() => {
        setOverFolderId(over.id as string)
        setExpanded(prev => new Set([...prev, over.id as string]))
      }, 600)
      setOverFolderTimer(t)
    } else if (!overNote?.isFolder) {
      if (overFolderTimer) clearTimeout(overFolderTimer)
      setOverFolderId(null)
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setOverFolderId(null)
    if (overFolderTimer) clearTimeout(overFolderTimer)

    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const overId = over.id as string
    const dragged = notes.find(n => n.id === draggedId)
    const overNote = notes.find(n => n.id === overId)
    if (!dragged || !overNote) return

    // Prevent moving folder into its own descendant
    if (dragged.isFolder) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => {
        for (const n of notes) {
          if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) }
        }
      }
      collectDesc(draggedId)
      if (desc.has(overId)) return
    }

    if (overNote.isFolder && overFolderId === overId) {
      // Drop INTO folder — place as last child
      const siblings = notes.filter(n => n.parentId === overId)
      const newSortOrder = siblings.length > 0
        ? Math.max(...siblings.map(n => n.sortOrder)) + 1000
        : 1000
      onMove(draggedId, overId, newSortOrder)
    } else {
      // Reorder within same parent level
      const siblings = notes
        .filter(n => (n.parentId ?? null) === (overNote.parentId ?? null))
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const overIdx = siblings.findIndex(n => n.id === overId)
      const prev = siblings[overIdx - 1]?.sortOrder ?? 0
      const next = siblings[overIdx]?.sortOrder ?? prev + 2000
      const newSortOrder = (prev + next) / 2
      onMove(draggedId, overNote.parentId ?? null, newSortOrder)
    }
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

  return (
    <aside style={{ padding: 8, color: '#cdd6f4', flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: '#6c7086', padding: '0 4px' }}>
        Notes
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            onClick={() => onNewNote(null)}
            style={{ flex: 1, padding: '3px 6px', background: '#313244', color: '#cdd6f4', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
          >
            + Note
          </button>
          <button
            onClick={() => onNewFolder(null)}
            style={{ flex: 1, padding: '3px 6px', background: '#313244', color: '#cdd6f4', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
          >
            + Folder
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          {visible.map(note => (
            <SidebarItem
              key={note.id}
              note={note}
              depth={note.depth}
              isActive={note.id === activeId}
              isExpanded={expanded.has(note.id)}
              canEdit={canEdit}
              onSelect={onSelect}
              onToggle={toggle}
              onRename={onRename}
              onDelete={handleDelete}
              onNewNote={onNewNote}
              onNewFolder={onNewFolder}
              childCount={countDescendants(notes, note.id)}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {draggingNote && (
            <div style={{
              padding: '4px 8px',
              borderRadius: 4,
              background: '#313244',
              fontSize: 13,
              color: '#cdd6f4',
              opacity: 0.9,
              border: '1px solid #45475a',
            }}>
              {draggingNote.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </aside>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: errors only in `App.tsx` (Sidebar props changed). Proceed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx
git commit -m "feat(web): rewrite Sidebar with tree view, DnD, context menu integration"
```

---

## Task 9: App.tsx — wire new Sidebar props

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Update useNotes destructure**

Find:
```typescript
  const { notes, createNote } = useNotes(activeProject?.id ?? null, authToken)
```

Replace with:
```typescript
  const { notes, createNote, renameNote, deleteNote, moveNote } = useNotes(activeProject?.id ?? null, authToken)
```

- [ ] **Step 2: Update Sidebar usage**

Find the entire `<Sidebar ... />` block:
```typescript
          <Sidebar
            notes={notes}
            activeId={activeId}
            onSelect={setActiveId}
            onNewNote={canEdit ? () => { createNote(`Untitled-${Date.now()}`); setPreviewMode(false) } : undefined}
          />
```

Replace with:
```typescript
          <Sidebar
            notes={notes}
            activeId={activeId}
            canEdit={canEdit}
            onSelect={setActiveId}
            onNewNote={(parentId) => {
              if (!canEdit) return
              createNote(`Untitled-${Date.now()}`, { parentId })
              setPreviewMode(false)
            }}
            onNewFolder={(parentId) => {
              if (!canEdit) return
              createNote(`New Folder`, { parentId, isFolder: true })
            }}
            onRename={(id, title) => renameNote(id, title)}
            onDelete={(id) => {
              deleteNote(id)
              if (activeId === id) setActiveId(null)
            }}
            onMove={(id, parentId, sortOrder) => moveNote(id, parentId, sortOrder)}
          />
```

- [ ] **Step 3: Remove the old "+ New Note" button logic from header if present**

The Sidebar now has its own "+ Note" and "+ Folder" buttons. Search for any remaining `onNewNote` usage in the header area and remove it. The toggle button (`✎ Edit` / `☰ Preview`) stays.

- [ ] **Step 4: TypeScript check — all packages**

```bash
pnpm --filter @websidian/web exec tsc --noEmit && \
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output from either.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): wire note management callbacks — rename, delete, move, new folder"
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

- [ ] **Step 1: Create a folder**

Click `+ Folder` in the sidebar. A new "New Folder" item appears with a 📁 icon. Verify it renders.

- [ ] **Step 2: Create note inside folder**

Right-click the folder → "New note inside". A new note appears indented under the folder. Click the folder's chevron to collapse/expand.

- [ ] **Step 3: Click folder name navigates to folder note**

Click the folder's name text (not the chevron). The preview/editor should open the folder's own content (empty markdown). You can write notes in it.

- [ ] **Step 4: Rename via context menu**

Right-click any note → Rename. An inline input appears. Type a new name and press Enter. The name updates in the sidebar.

- [ ] **Step 5: Delete a note**

Right-click a regular note → Delete. It disappears immediately. If the note was active, the editor/preview clears.

- [ ] **Step 6: Delete a folder with contents**

Create a folder, put a note inside. Right-click the folder → "Delete folder". A confirm dialog appears mentioning the count of items inside. Click OK. Both the folder and its child are gone.

- [ ] **Step 7: Drag to reorder**

Drag a note by its `⠿` handle to a different position. Release. The order changes. Reload the page — the new order persists.

- [ ] **Step 8: Drag into a folder**

Drag a note and hold it over a folder for a moment (the folder highlights). Drop it. The note moves inside the folder. Reload — persists.

- [ ] **Step 9: Final commit**

```bash
git add -A
git diff --cached --quiet || git commit -m "feat: note management — folders, rename, delete, drag-reorder complete"
```

---

## Acceptance Checklist

- [ ] Notes and folders display in a tree with correct indentation
- [ ] Chevron click expands/collapses without navigating
- [ ] Folder name click navigates to folder note content
- [ ] Right-click on note shows: Rename, Delete
- [ ] Right-click on folder shows: Rename, Delete, New note inside, New subfolder inside
- [ ] Rename enters inline edit; Enter confirms, Escape cancels
- [ ] Delete note: immediate, no confirmation
- [ ] Delete folder: confirm dialog with item count; recursive delete on confirm
- [ ] Drag note/folder to reorder within same level — persists after reload
- [ ] Drag note/folder into a folder — moves it; persists after reload
- [ ] Cannot drag a folder into its own descendant
- [ ] Viewers see no drag handles and no context menu
- [ ] New note/folder inside a folder appears nested under it
- [ ] Active note's parent folders are auto-expanded on load
- [ ] `pnpm --filter @websidian/sync exec tsc --noEmit` passes
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
