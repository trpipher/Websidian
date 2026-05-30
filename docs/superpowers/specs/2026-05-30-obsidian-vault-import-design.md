# Obsidian Vault Import Design

**Goal:** Allow users to import an Obsidian vault when creating a new project. The vault folder is picked via the browser's File System Access API; notes and images are uploaded to the server and seeded into the project.

---

## User Flow

1. User clicks **+ New project** in the `ProjectSwitcher` dropdown.
2. A **`NewProjectModal`** opens (replaces the old inline form).
3. User types a project name.
4. Optionally clicks **Choose folder** → browser `showDirectoryPicker()` → vault folder selected. Modal shows `📁 MyVault (156 files)`.
5. User clicks **Create**.
6. Modal transitions to a progress view:
   ```
   Creating project... ✓
   Importing notes...  (42 / 156)
   Uploading images... (3 / 12)
   Done ✓
   ```
7. Modal auto-closes and the new project becomes active.

If no vault is selected, the project is created and the modal closes immediately (same as today).

`showDirectoryPicker()` is supported in all modern Chromium-based browsers. If the call is rejected (user cancels or API unavailable), the vault field is simply cleared — project creation proceeds without import.

---

## Client-side Vault Reading

### Entry point

`apps/web/src/lib/vaultImport.ts` — two exported functions:

```typescript
export async function readVault(handle: FileSystemDirectoryHandle): Promise<VaultData>
export function processNoteContent(content: string): string
```

```typescript
export interface VaultData {
  notes: VaultNote[]     // topologically sorted (folders first, then children)
  images: VaultImage[]
}

export interface VaultNote {
  path: string           // relative to vault root, no extension, e.g. "Programming/React/hooks"
  title: string          // last path segment, e.g. "hooks"
  isFolder: boolean
  parentPath: string | null  // e.g. "Programming/React"
  content: string        // empty string for folders
}

export interface VaultImage {
  file: File             // browser File object for upload
  relativePath: string   // e.g. "attachments/cat.png"
}
```

### Directory walking

Walk the directory tree recursively via `handle.values()`. Rules:
- **Skip:** any entry whose name starts with `.` (catches `.obsidian/`, `.git/`, etc.), and `node_modules/`
- **`.md` files:** read as UTF-8 text via `file.text()`; call `processNoteContent()` on the result
- **Image files** (`.png .jpg .jpeg .gif .webp .svg .avif` — case-insensitive): collect as `VaultImage`
- **Other files:** skip

### Folder derivation

Folders are derived from file paths — no need to read empty directories. For a note at `Programming/React/hooks.md`, three entries are produced:
```
{ path: "Programming",       title: "Programming", isFolder: true,  parentPath: null }
{ path: "Programming/React", title: "React",       isFolder: true,  parentPath: "Programming" }
{ path: "Programming/React/hooks", title: "hooks", isFolder: false, parentPath: "Programming/React", content: "..." }
```

Deduplication: a `Set<string>` of already-seen folder paths prevents duplicates across sibling files.

### Sort order

Notes are sorted topologically: root items first, then depth-1, depth-2, etc. Within each level: folders before files, then alphabetical by title.

### Content post-processing — `processNoteContent`

Strips path prefixes from wikilink image references so they resolve against the uploaded filename:

| In vault | After processing |
|---|---|
| `![[attachments/cat.png]]` | `![[cat.png]]` |
| `![[images/photo.jpg]]` | `![[photo.jpg]]` |
| `[[regular wikilink]]` | unchanged |

Regex: replace `!\[\[([^\]\n]*\/)?([^\]\n]+\.(png|jpe?g|gif|webp|svg|avif))\]\]` with `![[filename]]` (keeping only the basename).

---

## Backend — Batch Notes Import Endpoint

### New file: `apps/sync/src/routes/import.ts`

Mounted in `server.ts` at `/api/projects/:projectId/import`.

### `POST /api/projects/:projectId/import/notes`

**Auth:** `requireProjectRole('editor')`

**Request body:**
```json
{
  "notes": [
    { "path": "Programming",              "title": "Programming", "isFolder": true,  "parentPath": null,              "content": "" },
    { "path": "Programming/React",        "title": "React",       "isFolder": true,  "parentPath": "Programming",     "content": "" },
    { "path": "Programming/React/hooks",  "title": "hooks",       "isFolder": false, "parentPath": "Programming/React", "content": "# Hooks\n..." }
  ]
}
```

**Processing (single SQLite transaction):**
1. Maintain a `pathToId: Map<string, string>` as entries are inserted.
2. For each entry in order:
   - Generate `id = randomUUID()`
   - Look up `parentId = pathToId.get(entry.parentPath) ?? null`
   - Generate `path = ${slugify(title)}-${id.slice(0,8)}.md` (same pattern as regular note creation)
   - `sortOrder = index * 1000` (within the full array — parents are always inserted before children so the relative ordering is stable)
   - Insert into `notes` table
   - Store `id` in `pathToId`
   - For non-folder notes: create a `Y.Doc`, call `doc.getText('content').insert(0, entry.content)`, call `storeDocument(noteId, doc)` to seed the Yjs document
3. All inserts run in one `db.transaction(...)` call.

**Response:**
```json
{ "imported": 154 }
```

If any insert throws, the entire DB transaction is rolled back and the endpoint returns 500. The client shows an error and the project remains empty — the user can retry. Yjs `storeDocument` calls happen after the DB transaction commits (they are not transactional but are idempotent).

---

## Image Import

Images use the **existing** `POST /api/projects/:projectId/images` endpoint. The client:

1. After the notes import completes, iterates `vaultData.images`
2. POSTs each image's `File` object via `FormData` (same as the `+ Image` sidebar button)
3. Updates progress: "Uploading images (3 / 12)"
4. Failures are logged to console and skipped — they don't block the rest

No new backend code required.

---

## File Changes

```
apps/sync/src/
  routes/import.ts             CREATE — POST /notes endpoint
  server.ts                    MODIFY — mount import router

apps/web/src/
  lib/vaultImport.ts           CREATE — readVault, processNoteContent, types
  components/
    NewProjectModal.tsx         CREATE — modal: name field, vault picker, progress view
    ProjectSwitcher.tsx         MODIFY — replace inline form with modal trigger
  hooks/useProjects.ts          no change (createProject signature unchanged)
```

`App.tsx` passes `onCreate={createProject}` to `ProjectSwitcher` unchanged — the modal is self-contained and handles the import logic internally.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| User cancels `showDirectoryPicker()` | Vault field cleared; create-without-import continues normally |
| `showDirectoryPicker()` not supported | "Choose folder" button hidden; vault import unavailable |
| Project creation fails | Modal shows error, stays open, no import attempted |
| Notes batch import fails (network) | Modal shows error message; project still exists (user can try again) |
| Individual note fails during import | Added to `skipped` list; rest continue |
| Image upload fails | Logged to console, skipped; progress reflects successful uploads only |
| Vault has 0 notes / 0 images | Import step is skipped entirely |
