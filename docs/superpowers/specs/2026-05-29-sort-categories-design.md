# Sort Categories Design

**Goal:** Replace manual drag-to-reorder with automatic category-based sorting in the sidebar. Folders always appear above notes at every tree level. A sort button opens a popover where the user picks a sort field and direction. The preference persists across reloads. Drag-into-folder is kept; drag-to-reorder is removed.

---

## State & Persistence

```typescript
type SortField = 'title' | 'createdAt' | 'updatedAt'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  by: SortField
  direction: SortDirection
}
```

- Stored in `localStorage` under the key `ws-sort-config`.
- Default: `{ by: 'title', direction: 'asc' }`.
- Folders-first is always on; it is not part of `SortConfig`.
- Read once on mount; written on every change.

---

## Sorting Logic

**`sortNotes(items: NoteMeta[], config: SortConfig): NoteMeta[]`**

1. Split `items` into `folders` and `notes`.
2. Sort each group by `config.by`:
   - `title`: `localeCompare` (case-insensitive).
   - `createdAt` / `updatedAt`: ISO string comparison (lexicographic, valid for ISO 8601).
3. If `config.direction === 'desc'`, reverse each sorted group.
4. Return `[...folders, ...notes]`.

Applied inside `buildTree` at every level of the tree so the same comparator governs root items and children of any folder.

---

## Components

### New: `SortMenu.tsx`

A positioned popover, same placement pattern as `ContextMenu` (fixed, top/left from button bounds, closes on outside-click and Escape).

UI:

```
─────────────────────
 Sort by

 ● Alphabetical   ↑
 ○ Date created
 ○ Last edited
─────────────────────
```

- Clicking the currently-selected option toggles `asc` ↔ `desc`.
- Clicking a different option selects it at `asc`.
- Selecting any option immediately updates `sortConfig` and writes to `localStorage`.

Props:

```typescript
interface Props {
  config: SortConfig
  anchorRect: DOMRect
  onChange: (config: SortConfig) => void
  onClose: () => void
}
```

### Modified: `Sidebar.tsx`

- Adds `sortConfig` state (initialised from `localStorage`).
- Adds a `⇅` icon button in the header row next to the "Notes" label; clicking it toggles `SortMenu`.
- `buildTree` passes `sortNotes(children, sortConfig)` instead of `.sort((a, b) => a.sortOrder - b.sortOrder)`.
- `onDragEnd`: removes the reorder branch entirely. Only the drop-into-folder branch (`overNote.isFolder && overFolderId === overId`) remains.
- `SortableContext` stays (required for `useSortable` in children) but `verticalListSortingStrategy` is removed — `items` prop is still passed so DnD context is valid.

### Modified: `SidebarItem.tsx`

No changes needed. `useSortable` continues to provide the drag handle and transform; the item just no longer reorders.

### Modified: `useNotes.ts`

`moveNote` signature changes:

```typescript
// Before
moveNote(id: string, parentId: string | null, sortOrder: number): Promise<void>

// After
moveNote(id: string, parentId: string | null): Promise<void>
```

- Removes the `sortOrder` parameter.
- PATCH body becomes `{ parentId }` only.
- Optimistic update: `setNotes(prev => prev.map(n => n.id === id ? { ...n, parentId } : n))`.

---

## Data Flow

```
notes[] (flat, from API)
  → buildTree(notes, sortNotes, config)   ← sortNotes applied at every level
  → flattenVisible(tree, expanded)
  → <SidebarItem> list
```

On drag-into-folder:
```
onDragEnd → moveNote(id, folderId)
  → PATCH /notes/:id { parentId: folderId }
  → optimistic update → re-sort via sortConfig → note appears in correct position
```

---

## Backend

No changes. `sort_order` column stays in the DB. The GET endpoint continues to return `sortOrder` on each note. The frontend ignores `sortOrder` for display. `sortOrder` is no longer written on any drag operation.

---

## File Changes

```
apps/web/src/
  components/
    SortMenu.tsx          CREATE
    Sidebar.tsx           MODIFY — sort button, SortConfig state, remove reorder from onDragEnd,
                                   update onMove prop signature to (id, parentId) — no sortOrder
  hooks/
    useNotes.ts           MODIFY — remove sortOrder param from moveNote
  App.tsx                 MODIFY — update onMove lambda to match new 2-arg signature
```

No changes to `apps/sync/`, `packages/shared/`, or any other file.
