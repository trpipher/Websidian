# Sort Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual drag-to-reorder with automatic category-based sorting (folders-first, then alphabetical/date-created/last-edited asc/desc), persisted in localStorage, controlled by a popover button in the sidebar header.

**Architecture:** Client-side only — no backend changes. A new `SortMenu` component renders a positioned popover. `Sidebar` holds `SortConfig` state, passes it to a `sortNotes()` helper used inside `buildTree`, and removes the reorder branch from `onDragEnd`. `moveNote` in `useNotes` drops the `sortOrder` parameter.

**Tech Stack:** React, TypeScript, `@dnd-kit/sortable` (kept for drag-into-folder), localStorage

---

## File Map

| File | Change |
|------|--------|
| `apps/web/src/components/SortMenu.tsx` | CREATE — sort popover component |
| `apps/web/src/components/Sidebar.tsx` | MODIFY — sort state, sort button, remove reorder logic |
| `apps/web/src/hooks/useNotes.ts` | MODIFY — remove `sortOrder` param from `moveNote` |
| `apps/web/src/App.tsx` | MODIFY — update `onMove` lambda to 2-arg |

No changes to `apps/sync/`, `packages/shared/`, or any test infrastructure.

---

### Task 1: Create `SortMenu.tsx`

**Files:**
- Create: `apps/web/src/components/SortMenu.tsx`

This is a pure presentational component — no side effects, no state. The parent owns `SortConfig`.

- [ ] **Step 1: Create the file with types and component**

```tsx
// apps/web/src/components/SortMenu.tsx
import { useEffect, useRef } from 'react'

export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  by: SortField
  direction: SortDirection
}

interface Props {
  config: SortConfig
  anchorRect: DOMRect
  onChange: (config: SortConfig) => void
  onClose: () => void
}

const FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

export default function SortMenu({ config, anchorRect, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Position: below the anchor button, flush left; clamp if near right edge
  const top = anchorRect.bottom + 4
  const left = Math.min(anchorRect.left, window.innerWidth - 180)

  const handleSelect = (field: SortField) => {
    if (field === config.by) {
      // Toggle direction on current field
      onChange({ by: field, direction: config.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onChange({ by: field, direction: 'asc' })
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 1000,
        background: '#181825',
        border: '1px solid #313244',
        borderRadius: 6,
        padding: '8px 0',
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: 11, color: '#6c7086', padding: '0 12px 6px', fontWeight: 600, letterSpacing: '0.05em' }}>
        SORT BY
      </div>
      {FIELDS.map(({ field, label }) => {
        const isSelected = config.by === field
        return (
          <button
            key={field}
            onClick={() => handleSelect(field)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '5px 12px',
              cursor: 'pointer',
              color: isSelected ? '#cdd6f4' : '#a6adc8',
              fontSize: 13,
              gap: 8,
              textAlign: 'left',
            }}
          >
            <span style={{ width: 12, color: '#89b4fa', fontSize: 10 }}>
              {isSelected ? '●' : '○'}
            </span>
            <span style={{ flex: 1 }}>{label}</span>
            {isSelected && (
              <span style={{ color: '#6c7086', fontSize: 11 }}>
                {config.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: No errors related to `SortMenu.tsx`. (Other pre-existing errors are fine to ignore for now.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SortMenu.tsx
git commit -m "feat(web): add SortMenu popover component"
```

---

### Task 2: Update `useNotes.ts` — remove `sortOrder` from `moveNote`

**Files:**
- Modify: `apps/web/src/hooks/useNotes.ts:64-83`

`moveNote` currently sends `{ parentId, sortOrder }` to the API and updates both fields optimistically. After this change it only sends `{ parentId }`.

- [ ] **Step 1: Replace the `moveNote` implementation**

Find the block starting at line 64:

```typescript
  const moveNote = useCallback(async (
    id: string,
    parentId: string | null,
    sortOrder: number,
  ) => {
    if (!projectId || !token) return
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
```

Replace it with:

```typescript
  const moveNote = useCallback(async (
    id: string,
    parentId: string | null,
  ) => {
    if (!projectId || !token) return
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, parentId } : n
    ))
    const res = await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parentId }),
    })
    if (!res.ok) {
      await refresh()
    }
  }, [projectId, token, authHeaders, refresh])
```

- [ ] **Step 2: Verify types compile**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: TypeScript will now complain about callers that still pass 3 args (`Sidebar.tsx`, `App.tsx`). That's expected — those are fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useNotes.ts
git commit -m "feat(web): remove sortOrder param from moveNote"
```

---

### Task 3: Update `Sidebar.tsx` — sort logic, sort button, remove reorder

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`

This is the largest change. It:
1. Imports `SortMenu`, `SortConfig` from `./SortMenu`
2. Adds `sortConfig` state (read from localStorage `ws-sort-config` on mount; default `{ by: 'title', direction: 'asc' }`)
3. Adds `showSortMenu` state + a ref for the button's `DOMRect`
4. Adds `sortNotes()` helper
5. Replaces `buildTree`'s `.sort((a, b) => a.sortOrder - b.sortOrder)` with `sortNotes(children, sortConfig)`
6. Removes `verticalListSortingStrategy` import and usage from `SortableContext`
7. Removes the reorder `else` branch in `onDragEnd`
8. Removes the `sortOrder` arg from `onMove` call
9. Updates the `Props` interface: `onMove: (id: string, parentId: string | null) => void`
10. Adds the `⇅` button in the header row

- [ ] **Step 1: Write the full updated `Sidebar.tsx`**

Replace the entire file with:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { SortableContext } from '@dnd-kit/sortable'
import type { NoteMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'
import SortMenu, { type SortConfig } from './SortMenu'

const SORT_STORAGE_KEY = 'ws-sort-config'
const DEFAULT_SORT: SortConfig = { by: 'title', direction: 'asc' }

function loadSortConfig(): SortConfig {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return DEFAULT_SORT
    const parsed = JSON.parse(raw) as Partial<SortConfig>
    const validFields = ['title', 'createdAt', 'updatedAt']
    const validDirs = ['asc', 'desc']
    if (validFields.includes(parsed.by ?? '') && validDirs.includes(parsed.direction ?? '')) {
      return parsed as SortConfig
    }
  } catch { /* ignore */ }
  return DEFAULT_SORT
}

function sortNotes(items: NoteMeta[], config: SortConfig): NoteMeta[] {
  const folders = items.filter(n => n.isFolder)
  const notes = items.filter(n => !n.isFolder)

  const compare = (a: NoteMeta, b: NoteMeta): number => {
    if (config.by === 'title') {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    }
    const aVal = config.by === 'createdAt' ? a.createdAt : a.updatedAt
    const bVal = config.by === 'createdAt' ? b.createdAt : b.updatedAt
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
  }

  const sortedFolders = [...folders].sort(compare)
  const sortedNotes = [...notes].sort(compare)

  if (config.direction === 'desc') {
    sortedFolders.reverse()
    sortedNotes.reverse()
  }

  return [...sortedFolders, ...sortedNotes]
}

interface NoteNode extends NoteMeta {
  children: NoteNode[]
  depth: number
}

function buildTree(notes: NoteMeta[], config: SortConfig, parentId: string | null = null, depth = 0): NoteNode[] {
  const children = notes.filter(n => (n.parentId ?? null) === parentId)
  const sorted = sortNotes(children, config)
  return sorted.map(n => ({ ...n, depth, children: buildTree(notes, config, n.id, depth + 1) }))
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
  onMove: (id: string, parentId: string | null) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)

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

  const handleSortChange = useCallback((config: SortConfig) => {
    setSortConfig(config)
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(config))
  }, [])

  const handleSortButtonClick = () => {
    if (showSortMenu) {
      setShowSortMenu(false)
    } else {
      setSortAnchorRect(sortButtonRef.current?.getBoundingClientRect() ?? null)
      setShowSortMenu(true)
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(notes, sortConfig)
  const visible = flattenVisible(tree, expanded)
  const visibleIds = visible.map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) { setOverFolderId(null); return }
    const overNote = notes.find(n => n.id === over.id)
    if (overNote?.isFolder && over.id !== overFolderId) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = setTimeout(() => {
        setOverFolderId(over.id as string)
        setExpanded(prev => new Set([...prev, over.id as string]))
      }, 600)
    } else if (!overNote?.isFolder) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = null
      setOverFolderId(null)
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setOverFolderId(null)
    if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
    overFolderTimer.current = null

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

    // Only support drop INTO a folder (hover-to-expand, then release)
    if (overNote.isFolder && overFolderId === overId) {
      onMove(draggedId, overId)
    }
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

  return (
    <aside style={{ padding: 8, color: '#cdd6f4', flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#6c7086', flex: 1 }}>Notes</span>
        <button
          ref={sortButtonRef}
          onClick={handleSortButtonClick}
          title="Sort notes"
          style={{
            background: 'none',
            border: 'none',
            color: showSortMenu ? '#89b4fa' : '#6c7086',
            cursor: 'pointer',
            fontSize: 14,
            padding: '1px 4px',
            lineHeight: 1,
          }}
        >
          ⇅
        </button>
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
        <SortableContext items={visibleIds}>
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

      {showSortMenu && sortAnchorRect && (
        <SortMenu
          config={sortConfig}
          anchorRect={sortAnchorRect}
          onChange={handleSortChange}
          onClose={() => setShowSortMenu(false)}
        />
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors in Sidebar**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: The only remaining error should be in `App.tsx` where `onMove` still passes 3 args. That's fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx
git commit -m "feat(web): sort categories — folders-first, sort button, remove reorder"
```

---

### Task 4: Update `App.tsx` — fix `onMove` call site

**Files:**
- Modify: `apps/web/src/App.tsx:260`

The `onMove` lambda on line 260 currently passes 3 args. Change it to 2.

- [ ] **Step 1: Update the `onMove` lambda**

Find:

```tsx
            onMove={(id, parentId, sortOrder) => moveNote(id, parentId, sortOrder)}
```

Replace with:

```tsx
            onMove={(id, parentId) => moveNote(id, parentId)}
```

- [ ] **Step 2: Verify zero TypeScript errors**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: Clean — no errors.

- [ ] **Step 3: Run a production build to confirm the bundle compiles**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web build
```

Expected: Build succeeds with no errors. Warnings about chunk size are fine.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): update onMove call site to 2-arg signature"
```

---

### Task 5: Smoke-test via API

This task verifies the backend integration still works correctly (notes fetch, move into folder) without needing a browser.

- [ ] **Step 1: Start the sync server in the background**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/sync dev &
sleep 3
```

- [ ] **Step 2: Sign in and capture token**

```bash
TOKEN=$(curl -s -X POST http://localhost:1235/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"trpipher@gmail.com","password":"YOUR_PASSWORD"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."
```

(Replace `YOUR_PASSWORD` with the actual password, or skip this task and test manually in the browser.)

- [ ] **Step 3: Get the first project ID**

```bash
PROJECT_ID=$(curl -s http://localhost:1235/api/projects \
  -H "Authorization: Bearer $TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Project: $PROJECT_ID"
```

- [ ] **Step 4: Create a test folder and a test note, then move note into folder**

```bash
# Create folder
FOLDER_ID=$(curl -s -X POST "http://localhost:1235/api/projects/$PROJECT_ID/notes" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"path":"smoke-folder.md","title":"Smoke Folder","isFolder":true}' \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Folder: $FOLDER_ID"

# Create note
NOTE_ID=$(curl -s -X POST "http://localhost:1235/api/projects/$PROJECT_ID/notes" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"path":"smoke-note.md","title":"Smoke Note"}' \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Note: $NOTE_ID"

# Move note into folder (2-arg — only parentId)
curl -s -X PATCH "http://localhost:1235/api/projects/$PROJECT_ID/notes/$NOTE_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"parentId\":\"$FOLDER_ID\"}" | python3 -m json.tool
```

Expected: PATCH response includes `"parentId": "<FOLDER_ID>"`.

- [ ] **Step 5: Clean up test data**

```bash
curl -s -X DELETE "http://localhost:1235/api/projects/$PROJECT_ID/notes/$FOLDER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

(Deleting the folder cascades to the note inside it.)

- [ ] **Step 6: Stop the sync server**

```bash
pkill -f 'tsx watch' || true
```

- [ ] **Step 7: Commit any stray changes (there should be none)**

```bash
git status
# Expected: nothing to commit
```

---

## Post-Implementation

After all 5 tasks are complete and committed, push to GitHub:

```bash
git push origin master
```

Verify on GitHub that all 4 commits appear in `master`.
