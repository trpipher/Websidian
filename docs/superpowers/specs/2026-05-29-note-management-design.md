# Note Management — Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Goal

Add delete, rename, drag-to-reorder, and folder organisation to the Websidian sidebar. Folders are first-class notes (they have markdown content and a Yjs document) that can also contain children. All ordering and hierarchy persist to the database and are shared across all users in a project.

---

## Data Model

### New columns on `notes`

```sql
parent_id  TEXT REFERENCES notes(id) ON DELETE SET NULL  -- NULL = top level
sort_order REAL NOT NULL DEFAULT 0                        -- float ordering within parent
is_folder  INTEGER NOT NULL DEFAULT 0                     -- 1 = folder-note
```

**Ordering strategy:** float values spaced by 1000 (1000, 2000, 3000 …). Inserting between items A and B uses `(A.sort_order + B.sort_order) / 2`. New items at the end get `max(sort_order within parent) + 1000`. Floats have sufficient precision for thousands of re-insertions before a rebalance is needed.

**Folder-notes:** A folder is a `notes` row with `is_folder = 1`. It has its own Yjs document, markdown content, and `id` — exactly like a regular note. The only difference is it can have children and renders differently in the sidebar.

### Migration

Existing notes get `parent_id = NULL`, `sort_order = rowid * 1000`, `is_folder = 0` in a one-time migration in `db.ts` (same pattern as the project migration).

### Updated `NoteMeta` (shared types)

```typescript
export interface NoteMeta {
  id: string
  path: string
  title: string
  updatedAt: string
  createdAt: string
  projectId: string
  parentId: string | null   // NEW
  sortOrder: number          // NEW
  isFolder: boolean          // NEW
}
```

---

## API Changes

### `GET /api/projects/:pid/notes`
Returns `parentId`, `sortOrder`, `isFolder` on every `NoteMeta`. No new endpoint — extend the existing SELECT.

### `POST /api/projects/:pid/notes`
Add optional body fields: `parentId?: string`, `isFolder?: boolean`. Computes `sort_order` as `max(sort_order) + 1000` within the target parent. Editor role required.

### `PATCH /api/projects/:pid/notes/:id` (extend existing)
Allow updating `title` (rename), `parent_id`, and `sort_order` in one call. Validates no cycle when moving a folder: the new `parent_id` must not be a descendant of the folder being moved. Admin role not required — editor can rename/reorder their own notes.

### `DELETE /api/projects/:pid/notes/:id` (extend existing)
When `is_folder = 1`: recursively soft-deletes all descendants (notes and subfolders) in a single transaction before deleting the folder itself. When `is_folder = 0`: existing soft-delete behaviour unchanged.

---

## Frontend Components

### File changes

```
apps/web/src/
  components/
    Sidebar.tsx              REWRITE — builds tree from flat list, owns expandedIds state
    SidebarItem.tsx          CREATE — single draggable row (note or folder)
    ContextMenu.tsx          CREATE — positioned right-click menu
  hooks/
    useNotes.ts              MODIFY — add parentId/isFolder to createNote; add moveNote()
  App.tsx                    MODIFY — pass onRename, onDelete, onMove, onNewFolder to Sidebar
packages/shared/src/
  index.ts                   MODIFY — add parentId, sortOrder, isFolder to NoteMeta
apps/sync/src/
  schema.sql                 MODIFY — add parent_id, sort_order, is_folder columns
  db.ts                      MODIFY — migration for existing notes
  routes/notes.ts            MODIFY — extend GET, POST, PATCH, DELETE
```

---

## Sidebar Component

`Sidebar.tsx` receives the flat `NoteMeta[]` array, builds a tree:

```typescript
type NoteNode = NoteMeta & { children: NoteNode[] }

function buildTree(notes: NoteMeta[]): NoteNode[] {
  // group by parentId, sort each group by sortOrder
  // return top-level items (parentId === null)
}
```

Tracks `expandedIds: Set<string>` as local state (not persisted — folders start collapsed). When `activeId` changes to a note inside a folder, all ancestor folder IDs are automatically added to `expandedIds` so the active note is always visible.

Passes these callbacks to each `SidebarItem`:
- `onSelect(id)` — navigate to note
- `onToggle(id)` — expand/collapse folder
- `onRename(id, newTitle)` — inline rename
- `onDelete(id, isFolder)` — delete with optional confirmation
- `onNewNote(parentId)` — create note inside folder
- `onNewFolder(parentId)` — create folder inside folder
- `onMove(id, newParentId, newSortOrder)` — drag drop result

---

## SidebarItem Component

Each row renders:

```
[indent][chevron or spacer][name text][drag handle ⠿]
```

- **Indent**: `depth * 16px` left padding
- **Chevron** (folders only): `▶` collapsed / `▼` expanded. Click calls `onToggle` — does NOT navigate
- **Spacer** (notes): 16px to align with folder names
- **Name text**: click calls `onSelect`. If `isRenaming`, renders `<input>` instead
- **Drag handle `⠿`**: visible on hover. Only shown when `canEdit`

Right-click on the row opens `ContextMenu` at cursor position.

### Context menu actions

| Item type | Actions |
|---|---|
| Note (editor+) | Rename, Delete |
| Folder (editor+) | Rename, Delete, New note inside, New subfolder inside |
| Any item (viewer) | No context menu |

---

## ContextMenu Component

A `position: fixed` overlay div that:
- Renders at `{ x, y }` passed as props (cursor position from the `contextmenu` event)
- Closes on click outside or Escape
- Items are plain `<div>` buttons with hover highlight

---

## Rename Flow

1. User right-clicks → selects "Rename"
2. `SidebarItem` enters rename mode: title replaced by `<input autoFocus defaultValue={title}>`
3. Confirm: `Enter` or blur → calls `PATCH .../notes/:id` with `{ title }` → exits rename mode
4. Cancel: `Escape` → exits rename mode without saving

---

## Delete Flow

- **Note**: right-click → Delete → immediate soft-delete via `DELETE .../notes/:id` → note removed from list
- **Folder**: right-click → Delete → browser `confirm("Delete \"FolderName\" and all X items inside?")` → on confirm: `DELETE .../notes/:id` (server recursively deletes descendants)

---

## Drag-and-Drop

Library: `@dnd-kit/core` + `@dnd-kit/sortable`.

Each `SidebarItem` is wrapped in a `useSortable` hook. The `DndContext` lives in `Sidebar.tsx`.

**Drop zones:**
- **Between items**: `SortableContext` with vertical list strategy. A thin blue line appears between rows at the drop position.
- **Into a folder**: hovering a dragged item over a folder row for 600ms highlights the folder. Dropping moves the item into that folder as the last child.

**On drop:**
1. Compute `newSortOrder`: midpoint of the two surrounding items in the target parent (or `max + 1000` if dropped at end)
2. Optimistically update local `notes` state
3. Call `PATCH .../notes/:id` with `{ parentId: newParentId, sortOrder: newSortOrder }`
4. On error: revert optimistic update, show no UI error (silent, state refreshes on next poll)

**Cycle prevention:** before allowing a drop, check if the drag target's `id` is an ancestor of the dragged folder. If so, ignore the drop.

**Viewer constraint:** drag handles not rendered for viewers; `onMove` is undefined.

---

## `useNotes` hook changes

```typescript
// Updated createNote signature
createNote(title: string, options?: { parentId?: string; isFolder?: boolean }): Promise<void>

// New
moveNote(id: string, parentId: string | null, sortOrder: number): Promise<void>

// New (used by Sidebar)
renameNote(id: string, title: string): Promise<void>

// New
deleteNote(id: string): Promise<void>
```

---

## App.tsx changes

- Pass `onRename`, `onDelete`, `onMove`, `onNewNote`, `onNewFolder` to `Sidebar`
- `onNewNote` and `onNewFolder` accept an optional `parentId`
- When the active note is deleted: `setActiveId(null)`

---

## Acceptance Criteria

- [ ] Notes and folders display in a tree with correct indentation
- [ ] Chevron click expands/collapses without navigating
- [ ] Folder name click navigates to folder note content
- [ ] Right-click on note shows: Rename, Delete
- [ ] Right-click on folder shows: Rename, Delete, New note inside, New subfolder inside
- [ ] Rename enters inline edit mode; Enter confirms, Escape cancels
- [ ] Delete note: immediate, no confirmation
- [ ] Delete folder: `confirm()` dialog mentions count of items inside; recursive delete on confirm
- [ ] Drag note/folder to reorder within same level — order persists after page reload
- [ ] Drag note/folder into a folder — moves it; persists after reload
- [ ] Cannot drag a folder into its own descendant
- [ ] Viewers see no drag handles and no context menu
- [ ] New note/folder inside a folder appears nested under it
- [ ] `pnpm --filter @websidian/sync exec tsc --noEmit` passes
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
