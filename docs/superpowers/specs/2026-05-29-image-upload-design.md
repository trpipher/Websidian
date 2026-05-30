# Image Upload & Rendering Design

**Goal:** Allow users to upload images per-project and render them in markdown preview using both `![[filename.ext]]` (Obsidian wikilink) and `![alt](url)` (standard markdown) syntax.

---

## Storage

Images are stored on the **filesystem** at:

```
{DATA_DIR}/images/{projectId}/{imageId}
```

- `DATA_DIR` defaults to `./data`, configurable via env var `DATA_DIR`
- Extension is not appended to the stored file — MIME type in the DB is the source of truth
- Directory is created on first upload if it does not exist

---

## Database

Migration added in `apps/sync/src/db.ts` (same idempotent `PRAGMA table_info` pattern as existing migrations):

```sql
CREATE TABLE IF NOT EXISTS images (
  id          TEXT NOT NULL PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  filename    TEXT NOT NULL,   -- original filename e.g. "cat.png"
  mimetype    TEXT NOT NULL,   -- "image/png", "image/jpeg", etc.
  size        INTEGER NOT NULL, -- bytes
  uploaded_by TEXT NOT NULL REFERENCES "user"(id),
  created_at  TEXT NOT NULL
)
```

---

## Shared Type

Added to `packages/shared/src/index.ts`:

```typescript
export interface ImageMeta {
  id: string
  filename: string    // "cat.png" — original upload name
  projectId: string
  mimeType: string
  size: number        // bytes
  createdAt: string
}
```

Image URL is derived client-side, never stored in the DB:
`` `/api/projects/${projectId}/images/${id}` ``

---

## API Routes

New file: `apps/sync/src/routes/images.ts`  
Mounted in `server.ts` at `/api/projects/:projectId/images`.

### `POST /`
- Auth: requires `editor` role (`requireProjectRole('editor')`)
- Body: `multipart/form-data` with a single `file` field
- Limit: 10 MB
- Saves file bytes to `{DATA_DIR}/images/{projectId}/{id}` (creates dirs as needed)
- Inserts row into `images` table
- Returns `201 ImageMeta`

### `GET /`
- Auth: requires project read access (`canReadProject`)
- Returns `ImageMeta[]` sorted by `created_at DESC`

### `GET /:imageId`
- Auth: **none required** — UUID provides sufficient entropy (unguessable without both `projectId` and `imageId`)
- Streams file bytes from disk with correct `Content-Type` header
- Returns `404` if row not found in DB

---

## Frontend: Image Registry Hook

New file: `apps/web/src/hooks/useImages.ts`

- Fetches `GET /api/projects/:projectId/images` on mount and every 30 seconds
- Uses `AbortController` (same pattern as `useNotes`) — aborts in-flight fetches on project switch
- Clears `images` to `[]` immediately when `projectId` changes
- Exposes:

```typescript
function useImages(projectId: string | null, token: string | null): {
  images: ImageMeta[]
  uploadImage: (file: File) => Promise<ImageMeta | null>
}
```

`uploadImage` posts `multipart/form-data` with `Authorization: Bearer {token}`, returns the created `ImageMeta` or `null` on failure.

---

## Upload UI

A **`+ Image`** button is added to the sidebar action row (alongside `+ Note` and `+ Folder`), shown only when `canEdit` is true.

Clicking it triggers a hidden `<input type="file" accept="image/*">`. On file select:

1. Calls `uploadImage(file)`
2. On success: copies `![[filename.png]]` to the clipboard via `navigator.clipboard.writeText`
3. Shows a brief inline confirmation label next to the button: `"Copied!"` for 2 seconds, then disappears

`uploadImage` is passed from `App.tsx` → `Sidebar` as a new prop:
```typescript
onUploadImage: (file: File) => Promise<ImageMeta | null>
```

---

## Rendering

### MarkdownPreview

New prop: `images: ImageMeta[]`

Builds a name → `ImageMeta` map on each change:
```typescript
const imagesByName = useMemo(
  () => new Map(images.map(i => [i.filename, i])),
  [images]
)
```

**`![[filename.ext]]` wikilink images:**  
The wikilink renderer checks whether the title matches an image extension before rendering a link:

Recognised extensions: `.png .jpg .jpeg .gif .webp .svg .avif`

- **Found in registry** → render:
  ```tsx
  <img
    src={`/api/projects/${img.projectId}/images/${img.id}`}
    alt={title}
    style={{ maxWidth: '100%', borderRadius: 4, display: 'block', margin: '0.5em 0' }}
  />
  ```
- **Not found** → render raw text `![[filename.ext]]` (image not yet uploaded)

**Standard `![alt](url)` markdown:**  
react-markdown handles this already. Internal image URLs (`/api/...`) are served without auth so standard `<img>` works fine. No changes required.

### Editor (CodeMirror, edit mode)

No image rendering. `![[filename.png]]` appears as raw text while editing — same as Obsidian.

---

## File Changes

```
apps/sync/src/
  db.ts                         MODIFY — add images table migration
  server.ts                     MODIFY — mount images router
  routes/
    images.ts                   CREATE — POST, GET /, GET /:imageId

packages/shared/src/
  index.ts                      MODIFY — add ImageMeta interface

apps/web/src/
  hooks/
    useImages.ts                CREATE — polling hook + uploadImage
  components/
    Sidebar.tsx                 MODIFY — add + Image button, onUploadImage prop
    MarkdownPreview.tsx         MODIFY — images prop, wikilink image detection
  App.tsx                       MODIFY — wire useImages, pass to Sidebar + MarkdownPreview
```

No changes to `Editor.tsx`, `SidebarItem.tsx`, or any other file.
