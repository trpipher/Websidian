# Image Upload & Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload images per-project and render them in markdown preview via `![[filename.ext]]` (Obsidian wikilink) and `![alt](url)` (standard markdown).

**Architecture:** Images are stored on the filesystem at `{DATA_DIR}/images/{projectId}/{imageId}`, metadata in a new `images` SQLite table. A new Hono route handles upload/serve. The web client gets a `useImages` hook (same AbortController pattern as `useNotes`), a `+ Image` sidebar button that copies `![[filename]]` to clipboard, and updated wikilink rendering in `MarkdownPreview`.

**Tech Stack:** Hono multipart parsing, Node.js `fs` module, React, `@websidian/shared` types, react-markdown custom renderers.

---

## File Map

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | ADD `ImageMeta` interface |
| `apps/sync/src/db.ts` | ADD `images` table migration |
| `apps/sync/src/routes/images.ts` | CREATE — POST upload, GET list, GET serve |
| `apps/sync/src/server.ts` | MODIFY — mount images router |
| `apps/web/src/hooks/useImages.ts` | CREATE — polling hook + uploadImage |
| `apps/web/src/components/Sidebar.tsx` | MODIFY — `+ Image` button, `onUploadImage` prop |
| `apps/web/src/components/MarkdownPreview.tsx` | MODIFY — `images` prop, wikilink image detection |
| `apps/web/src/App.tsx` | MODIFY — wire useImages, pass to Sidebar + MarkdownPreview |

---

### Task 1: Add `ImageMeta` to shared package

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add the interface after `LinkEdge`**

Open `packages/shared/src/index.ts` and append after the `LinkEdge` interface (after line 26):

```typescript
export interface ImageMeta {
  id: string
  filename: string    // original upload name, e.g. "cat.png"
  projectId: string
  mimeType: string
  size: number        // bytes
  createdAt: string
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/shared exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add ImageMeta interface"
```

---

### Task 2: DB migration — `images` table

**Files:**
- Modify: `apps/sync/src/db.ts`

- [ ] **Step 1: Append the migration at the end of `db.ts`**

Add after the last `if (!noteColNames.has('is_folder'))` block:

```typescript
// Create images table if not present
const imageTableExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='images'"
).get()
if (!imageTableExists) {
  db.exec(`
    CREATE TABLE images (
      id          TEXT NOT NULL PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id),
      filename    TEXT NOT NULL,
      mimetype    TEXT NOT NULL,
      size        INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES "user"(id),
      created_at  TEXT NOT NULL
    )
  `)
  console.log('[db] created images table')
}
```

- [ ] **Step 2: Verify the sync server still starts**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/sync/src/db.ts
git commit -m "feat(sync): add images table migration"
```

---

### Task 3: Create the images route + mount it

**Files:**
- Create: `apps/sync/src/routes/images.ts`
- Modify: `apps/sync/src/server.ts`

- [ ] **Step 1: Create `apps/sync/src/routes/images.ts`**

```typescript
import { Hono } from 'hono'
import { db } from '../db.js'
import type { ImageMeta } from '@websidian/shared'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveUserId, canReadProject, requireProjectRole } from '../middleware/project-auth.js'

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data')

function imagePath(projectId: string, imageId: string): string {
  return join(DATA_DIR, 'images', projectId, imageId)
}

export const imagesRouter = new Hono()

// ── Upload image ───────────────────────────────────────────────────────────────
imagesRouter.post('/', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = c.get('userId') as string

  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 10 MB)' }, 413)
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!mimeType.startsWith('image/')) {
    return c.json({ error: 'Only image files are allowed' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const dir = join(DATA_DIR, 'images', projectId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(imagePath(projectId, id), Buffer.from(await file.arrayBuffer()))

  db.prepare(`
    INSERT INTO images (id, project_id, filename, mimetype, size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, file.name, mimeType, file.size, userId, now)

  return c.json({
    id,
    filename: file.name,
    projectId,
    mimeType,
    size: file.size,
    createdAt: now,
  } as ImageMeta, 201)
})

// ── List images ────────────────────────────────────────────────────────────────
imagesRouter.get('/', async (c) => {
  const projectId = c.req.param('projectId')!
  const userId = resolveUserId(c)
  if (!canReadProject(projectId, userId)) return c.json({ error: 'Not found' }, 404)

  const rows = db.prepare(`
    SELECT id, filename, project_id as projectId, mimetype as mimeType, size, created_at as createdAt
    FROM images
    WHERE project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as ImageMeta[]

  return c.json(rows)
})

// ── Serve image bytes ──────────────────────────────────────────────────────────
imagesRouter.get('/:imageId', async (c) => {
  const projectId = c.req.param('projectId')!
  const imageId = c.req.param('imageId')!

  const row = db.prepare(
    'SELECT mimetype FROM images WHERE id = ? AND project_id = ?'
  ).get(imageId, projectId) as { mimetype: string } | undefined

  if (!row) return c.json({ error: 'Not found' }, 404)

  const filePath = imagePath(projectId, imageId)
  if (!existsSync(filePath)) return c.json({ error: 'File missing' }, 404)

  const data = readFileSync(filePath)
  return new Response(data, {
    headers: {
      'Content-Type': row.mimetype,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
```

- [ ] **Step 2: Mount the router in `server.ts`**

Open `apps/sync/src/server.ts`. Add the import after the existing route imports:

```typescript
import { imagesRouter } from './routes/images.js'
```

Add the route mount after the notes route line:

```typescript
app.route('/api/projects/:projectId/images', imagesRouter)
```

- [ ] **Step 3: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the upload endpoint**

Start the sync server:
```bash
pnpm --filter @websidian/sync dev &
sleep 4
```

Sign in and upload a test image:
```bash
TOKEN=$(curl -s -X POST http://localhost:1235/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"trpipher@gmail.com","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or d.get('session',{}).get('token',''))")

PROJECT_ID=$(curl -s http://localhost:1235/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Create a 1x1 pixel PNG (base64 encoded)
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' \
  | base64 -d > /tmp/test.png

curl -s -X POST "http://localhost:1235/api/projects/$PROJECT_ID/images" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.png" | python3 -m json.tool
```

Expected: JSON with `id`, `filename: "test.png"`, `mimeType: "image/png"`, `createdAt`.

Stop the server:
```bash
pkill -f 'tsx watch' || true
```

- [ ] **Step 5: Commit**

```bash
git add apps/sync/src/routes/images.ts apps/sync/src/server.ts
git commit -m "feat(sync): image upload, list, and serve endpoints"
```

---

### Task 4: Create `useImages` hook

**Files:**
- Create: `apps/web/src/hooks/useImages.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ImageMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useImages(projectId: string | null, token: string | null) {
  const [images, setImages] = useState<ImageMeta[]>([])
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  useEffect(() => {
    setImages([])
    if (!projectId || !token) return

    const controller = new AbortController()
    const headers: HeadersInit = { Authorization: `Bearer ${token}` }

    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/images`, {
          headers,
          signal: controller.signal,
        })
        if (res.ok) setImages(await res.json())
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { /* network error, ignore */ }
      }
    }

    poll()
    const id = setInterval(poll, 30_000)
    return () => { controller.abort(); clearInterval(id) }
  }, [projectId, token])

  const uploadImage = useCallback(async (file: File): Promise<ImageMeta | null> => {
    if (!projectId || !token) return null
    const fetchingFor = projectId
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/api/projects/${projectId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) return null
    const image = await res.json() as ImageMeta
    // Add to local state immediately; don't wait for next poll
    if (fetchingFor === projectIdRef.current) {
      setImages(prev => [image, ...prev])
    }
    return image
  }, [projectId, token])

  return { images, uploadImage }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useImages.ts
git commit -m "feat(web): useImages hook — poll + upload"
```

---

### Task 5: Add `+ Image` button to Sidebar

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`

The `+ Image` button sits in the same action row as `+ Note` and `+ Folder`. It triggers a hidden file input, uploads the image, and copies `![[filename]]` to clipboard for 2 seconds.

- [ ] **Step 1: Add `onUploadImage` to the Props interface**

Find the Props interface (around line 102):

```typescript
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
```

Replace with:

```typescript
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
  onUploadImage: (file: File) => Promise<import('@websidian/shared').ImageMeta | null>
}
```

- [ ] **Step 2: Add `onUploadImage` to the destructuring**

Find:
```typescript
export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
}: Props) {
```

Replace with:
```typescript
export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove, onUploadImage,
}: Props) {
```

- [ ] **Step 3: Add `imageInputRef` and `copiedImage` state**

Find the state declarations block (near the top of the Sidebar function, around where `const [expanded, setExpanded]` is). Add after the existing state declarations:

```typescript
  const [copiedImage, setCopiedImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
```

(The `useRef` import is already present; `useState` is already imported.)

- [ ] **Step 4: Add the upload handler**

Add this `useCallback` after `handleSortChange`:

```typescript
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''  // reset so same file can be re-selected
    const image = await onUploadImage(file)
    if (image) {
      await navigator.clipboard.writeText(`![[${image.filename}]]`)
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [onUploadImage])
```

- [ ] **Step 5: Add the button and hidden input to the action row**

Find the canEdit action row JSX:

```tsx
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
```

Replace with:

```tsx
      {canEdit && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
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
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => imageInputRef.current?.click()}
              style={{ padding: '3px 8px', background: '#313244', color: '#cdd6f4', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
            >
              + Image
            </button>
            {copiedImage && (
              <span style={{ fontSize: 11, color: '#a6e3a1' }}>Copied!</span>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </>
      )}
```

- [ ] **Step 6: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: error in `App.tsx` only — `onUploadImage` prop not yet passed. No errors in `Sidebar.tsx` itself.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx
git commit -m "feat(web): + Image button in sidebar with clipboard copy"
```

---

### Task 6: Update `MarkdownPreview` — image rendering

**Files:**
- Modify: `apps/web/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: Add the `images` prop and imports**

Find the imports at the top:
```typescript
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
```

Replace with:
```typescript
import { useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { ImageMeta } from '@websidian/shared'
```

- [ ] **Step 2: Add `images` to the Props interface**

Find:
```typescript
interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
}
```

Replace with:
```typescript
interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
  images: ImageMeta[]
}
```

- [ ] **Step 3: Add `images` to destructuring and build lookup map**

Find:
```typescript
export default function MarkdownPreview({ yText, awareness: _awareness, onWikilinkClick }: Props) {
  const [content, setContent] = useState(() => yText.toString())
```

Replace with:
```typescript
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i

export default function MarkdownPreview({ yText, awareness: _awareness, onWikilinkClick, images }: Props) {
  const [content, setContent] = useState(() => yText.toString())

  const imagesByName = useMemo(
    () => new Map(images.map(img => [img.filename, img])),
    [images]
  )
```

- [ ] **Step 4: Update `parseWikilinks` to detect image embeds**

Find the entire `parseWikilinks` function:

```typescript
function parseWikilinks(text: string, onClick: (title: string) => void, baseKey: number = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let count = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const title = match[1]
    parts.push(
      <span
        key={`wl-${baseKey}-${count++}`}
        onClick={() => onClick(title)}
        style={{ color: '#89b4fa', cursor: 'pointer', textDecoration: 'underline dotted' }}
      >
        {`[[${title}]]`}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
```

Replace with (note: `parseWikilinks` now requires `imagesByName` — pass it as a parameter):

```typescript
function parseWikilinks(
  text: string,
  onClick: (title: string) => void,
  imagesByName: Map<string, ImageMeta>,
  baseKey: number = 0,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let count = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const title = match[1]
    const isEmbed = match.index > 0 && text[match.index - 1] === '!'
    const startIdx = isEmbed ? match.index - 1 : match.index

    if (startIdx > last) parts.push(text.slice(last, startIdx))

    if (isEmbed && IMAGE_EXT_RE.test(title)) {
      const img = imagesByName.get(title)
      if (img) {
        parts.push(
          <img
            key={`img-${baseKey}-${count++}`}
            src={`/api/projects/${img.projectId}/images/${img.id}`}
            alt={title}
            style={{ maxWidth: '100%', borderRadius: 4, display: 'block', margin: '0.5em 0' }}
          />
        )
      } else {
        parts.push(`![[${title}]]`)
      }
    } else {
      parts.push(
        <span
          key={`wl-${baseKey}-${count++}`}
          onClick={() => onClick(title)}
          style={{ color: '#89b4fa', cursor: 'pointer', textDecoration: 'underline dotted' }}
        >
          {isEmbed ? `![[${title}]]` : `[[${title}]]`}
        </span>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
```

- [ ] **Step 5: Update all `parseWikilinks` call sites to pass `imagesByName`**

There are multiple call sites inside the component — inside the `ReactMarkdown` `components` prop for `p`, `h1`, `h2`, `h3`, `li`, etc. They all call `processChildren(children, onWikilinkClick)`, which calls `parseWikilinks(text, onClick)` or `parseWikilinks(child, onClick, i)`.

Update `processChildren` to accept and forward `imagesByName`:

Find:
```typescript
function processChildren(children: React.ReactNode, onClick: (title: string) => void): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) =>
      typeof child === 'string'
        ? <span key={`text-${i}`}>{parseWikilinks(child, onClick, i)}</span>
        : child
    )}</>
  }
  return children
}
```

Replace with:

```typescript
function processChildren(
  children: React.ReactNode,
  onClick: (title: string) => void,
  imagesByName: Map<string, ImageMeta>,
): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick, imagesByName)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) =>
      typeof child === 'string'
        ? <span key={`text-${i}`}>{parseWikilinks(child, onClick, imagesByName, i)}</span>
        : child
    )}</>
  }
  return children
}
```

- [ ] **Step 6: Update all `processChildren` call sites inside the `ReactMarkdown` components**

Every call like `processChildren(children, onWikilinkClick)` must become `processChildren(children, onWikilinkClick, imagesByName)`. There are approximately 6 call sites inside the `ReactMarkdown` `components` prop (for `p`, `h1`, `h2`, `h3`, `li`).

Find every occurrence of:
```typescript
processChildren(children, onWikilinkClick)
```

Replace all with:
```typescript
processChildren(children, onWikilinkClick, imagesByName)
```

Use your editor's find-and-replace (replace all) for this step.

- [ ] **Step 7: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: error only in `App.tsx` where `MarkdownPreview` is not yet passed `images`. No errors in `MarkdownPreview.tsx` itself.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/MarkdownPreview.tsx
git commit -m "feat(web): render ![[image.ext]] wikilinks as images in preview"
```

---

### Task 7: Wire everything up in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Import `useImages`**

Find the existing hook imports near the top of `App.tsx`:
```typescript
import { useNotes } from './hooks/useNotes'
```

Add after it:
```typescript
import { useImages } from './hooks/useImages'
```

- [ ] **Step 2: Call `useImages` next to `useNotes`**

Find:
```typescript
  const { notes, createNote, renameNote, deleteNote, moveNote } = useNotes(activeProject?.id ?? null, authToken)
```

Add after it:
```typescript
  const { images, uploadImage } = useImages(activeProject?.id ?? null, authToken)
```

- [ ] **Step 3: Pass `onUploadImage` to `<Sidebar>`**

Find the `<Sidebar>` JSX. Add the prop:
```tsx
            onUploadImage={uploadImage}
```

The full Sidebar props block should look like:
```tsx
          <Sidebar
            notes={notes}
            activeId={activeId}
            canEdit={canEdit}
            onSelect={setActiveId}
            onNewNote={(parentId) => {
              if (!canEdit) return
              createNote('Untitled', { parentId }).then(note => {
                if (note?.id) setActiveId(note.id)
              })
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
            onMove={(id, parentId) => moveNote(id, parentId)}
            onUploadImage={uploadImage}
          />
```

- [ ] **Step 4: Pass `images` to `<MarkdownPreview>`**

Find:
```tsx
              ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
```

Replace with:
```tsx
              ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} images={images} />
```

- [ ] **Step 5: Type-check — expect zero errors**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: **zero errors**.

- [ ] **Step 6: Production build — confirm no bundler errors**

```bash
pnpm --filter @websidian/web build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — chunk size warnings are fine.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): wire image upload and preview into App"
```

- [ ] **Step 8: Push**

```bash
git push origin master
```

---

## Post-Implementation Verification

Start both servers and verify manually:

```bash
# Terminal 1
pnpm --filter @websidian/sync dev

# Terminal 2
pnpm --filter @websidian/web dev
```

1. Log in and open a project
2. Click `+ Image` in the sidebar — file picker opens
3. Select a `.png` or `.jpg` — notification says "Copied!"
4. Open a note in preview mode, switch to edit mode, paste → `![[filename.png]]` appears
5. Switch back to preview — image renders
6. Type `![alt text](https://placekitten.com/200/200)` in edit mode — external image renders in preview
