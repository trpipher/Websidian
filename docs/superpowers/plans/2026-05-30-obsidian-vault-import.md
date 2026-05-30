# Obsidian Vault Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users import an Obsidian vault when creating a new project — the browser reads the vault directory, uploads notes in one batch and images one-by-one, showing live progress in a modal.

**Architecture:** Browser File System Access API reads the vault recursively into a `VaultData` object; a new `POST /api/projects/:projectId/import/notes` endpoint inserts all notes in one SQLite transaction and seeds Yjs documents; images reuse the existing image upload endpoint. `ProjectSwitcher` opens a `NewProjectModal` instead of an inline form.

**Tech Stack:** TypeScript, React, Hono, better-sqlite3, Yjs (`y-codemirror.next` text model), File System Access API (`showDirectoryPicker`), existing `/api/projects/:projectId/images` endpoint.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/src/lib/vaultImport.ts` | CREATE — `readVault`, `processNoteContent`, shared types |
| `apps/sync/src/routes/import.ts` | CREATE — `POST /notes` batch endpoint |
| `apps/sync/src/server.ts` | MODIFY — mount import router |
| `apps/web/src/components/NewProjectModal.tsx` | CREATE — modal: name field, vault picker, progress view |
| `apps/web/src/components/ProjectSwitcher.tsx` | MODIFY — replace inline form with modal trigger |
| `apps/web/src/App.tsx` | MODIFY — update ProjectSwitcher props |

---

### Task 1: Create `vaultImport.ts` — vault reading utility

**Files:**
- Create: `apps/web/src/lib/vaultImport.ts`

- [ ] **Step 1: Create the file with types and `processNoteContent`**

```typescript
// apps/web/src/lib/vaultImport.ts

export interface VaultNote {
  path: string           // relative to vault root, no extension, e.g. "Programming/React/hooks"
  title: string          // last path segment, e.g. "hooks"
  isFolder: boolean
  parentPath: string | null  // e.g. "Programming/React", or null for root items
  content: string        // markdown text; empty string for folders
}

export interface VaultImage {
  file: File
  relativePath: string   // e.g. "attachments/cat.png"
}

export interface VaultData {
  notes: VaultNote[]     // topologically sorted: folders by depth first, then notes
  images: VaultImage[]
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])
const SKIP_DIRS = new Set(['.obsidian', 'node_modules'])

// Strip folder path from wikilink image refs so they resolve by filename after upload.
// ![[attachments/cat.png]] → ![[cat.png]]
// ![[images/photo.jpg]]    → ![[photo.jpg]]
// [[regular wikilink]]     → unchanged
const IMAGE_PATH_RE = /!\[\[([^\]\n]*\/)?([^\]\n]+\.(png|jpe?g|gif|webp|svg|avif))\]\]/gi

export function processNoteContent(content: string): string {
  return content.replace(IMAGE_PATH_RE, (_match, _dir, filename) => `![[${filename}]]`)
}
```

- [ ] **Step 2: Add `readVault` — recursive directory walker**

Append to the same file:

```typescript
async function walkDir(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  seenFolders: Set<string>,
  notes: VaultNote[],
  images: VaultImage[],
): Promise<void> {
  for await (const [name, entry] of (handle as any).entries()) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue

    if (entry.kind === 'directory') {
      await walkDir(
        entry as FileSystemDirectoryHandle,
        prefix ? `${prefix}/${name}` : name,
        seenFolders,
        notes,
        images,
      )
    } else {
      const lower = name.toLowerCase()
      const dotIdx = lower.lastIndexOf('.')
      const ext = dotIdx >= 0 ? lower.slice(dotIdx) : ''

      if (lower.endsWith('.md')) {
        const file = await (entry as FileSystemFileHandle).getFile()
        const raw = await file.text()
        const titleFromFile = name.slice(0, -3)
        const notePath = prefix ? `${prefix}/${titleFromFile}` : titleFromFile

        // Ensure ancestor folder entries exist (folders before children)
        if (prefix) {
          const parts = prefix.split('/')
          for (let i = 0; i < parts.length; i++) {
            const folderPath = parts.slice(0, i + 1).join('/')
            if (!seenFolders.has(folderPath)) {
              seenFolders.add(folderPath)
              notes.push({
                path: folderPath,
                title: parts[i],
                isFolder: true,
                parentPath: i > 0 ? parts.slice(0, i).join('/') : null,
                content: '',
              })
            }
          }
        }

        notes.push({
          path: notePath,
          title: titleFromFile,
          isFolder: false,
          parentPath: prefix || null,
          content: processNoteContent(raw),
        })
      } else if (IMAGE_EXTS.has(ext)) {
        const file = await (entry as FileSystemFileHandle).getFile()
        images.push({
          file,
          relativePath: prefix ? `${prefix}/${name}` : name,
        })
      }
    }
  }
}

export async function readVault(handle: FileSystemDirectoryHandle): Promise<VaultData> {
  const rawNotes: VaultNote[] = []
  const images: VaultImage[] = []
  const seenFolders = new Set<string>()

  await walkDir(handle, '', seenFolders, rawNotes, images)

  // Sort topologically: shallower folders first, then deeper folders, then notes
  const folders = rawNotes
    .filter(n => n.isFolder)
    .sort((a, b) => {
      const da = a.path.split('/').length
      const db = b.path.split('/').length
      return da !== db ? da - db : a.path.localeCompare(b.path)
    })
  const notes = rawNotes
    .filter(n => !n.isFolder)
    .sort((a, b) => a.path.localeCompare(b.path))

  return { notes: [...folders, ...notes], images }
}
```

- [ ] **Step 3: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manually verify `processNoteContent` output**

In browser console (or a quick Node snippet), confirm:

```
processNoteContent('![[attachments/cat.png]]')  // → '![[cat.png]]'
processNoteContent('![[photo.jpg]]')             // → '![[photo.jpg]]'  (no change, no slash)
processNoteContent('[[regular link]]')           // → '[[regular link]]'
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/vaultImport.ts
git commit -m "feat(web): vault reading utility — readVault, processNoteContent"
```

---

### Task 2: Create backend batch notes import endpoint

**Files:**
- Create: `apps/sync/src/routes/import.ts`
- Modify: `apps/sync/src/server.ts`

- [ ] **Step 1: Create `apps/sync/src/routes/import.ts`**

```typescript
import { Hono } from 'hono'
import { db } from '../db.js'
import { randomUUID } from 'node:crypto'
import * as Y from 'yjs'
import { storeDocument } from '../persistence.js'
import { requireProjectRole } from '../middleware/project-auth.js'

interface ImportNote {
  path: string
  title: string
  isFolder: boolean
  parentPath: string | null
  content: string
}

export const importRouter = new Hono()

importRouter.post('/notes', requireProjectRole('editor'), async (c) => {
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ notes: ImportNote[] }>()
  const notes = body.notes

  if (!Array.isArray(notes) || notes.length === 0) {
    return c.json({ imported: 0 }, 200)
  }

  const pathToId = new Map<string, string>()
  const now = new Date().toISOString()
  // Collect Yjs seeding work to do after the DB transaction commits
  const yjsQueue: Array<{ noteId: string; content: string }> = []

  db.transaction(() => {
    notes.forEach((note, index) => {
      const id = randomUUID()
      const parentId = note.parentPath ? (pathToId.get(note.parentPath) ?? null) : null
      const path = `${note.title.replace(/[^a-z0-9]+/gi, '-')}-${id.slice(0, 8)}.md`
      const sortOrder = index * 1000

      db.prepare(`
        INSERT INTO notes (id, path, title, content, project_id, parent_id, sort_order, is_folder, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, path, note.title, note.content, projectId, parentId, sortOrder, note.isFolder ? 1 : 0, now, now)

      pathToId.set(note.path, id)

      if (!note.isFolder && note.content) {
        yjsQueue.push({ noteId: id, content: note.content })
      }
    })
  })()

  // Seed Yjs documents after the DB transaction has committed.
  // storeDocument also updates the notes.content projection and note_links.
  for (const { noteId, content } of yjsQueue) {
    const doc = new Y.Doc()
    doc.getText('content').insert(0, content)
    storeDocument(noteId, doc)
  }

  return c.json({ imported: notes.length }, 201)
})
```

- [ ] **Step 2: Mount the router in `apps/sync/src/server.ts`**

Read the file, then add after the imagesRouter line (line 39):

```typescript
import { importRouter } from './routes/import.js'
```

```typescript
app.route('/api/projects/:projectId/import', importRouter)
```

The import line goes with the other route imports at the top. The `app.route` line goes after line 39 (`app.route('/api/projects/:projectId/images', imagesRouter)`).

- [ ] **Step 3: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the endpoint**

Start the sync server:
```bash
cd /mnt/d/Development/Websidian && pnpm --filter @websidian/sync dev &
sleep 5
```

Sign in and get a token + project ID:
```bash
TOKEN=$(curl -s -X POST http://localhost:1235/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"trpipher@gmail.com","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','') or (d.get('session') or {}).get('token',''))")

PROJECT_ID=$(curl -s http://localhost:1235/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; arr=json.load(sys.stdin); print(arr[0]['id'] if arr else '')")
```

POST a minimal vault:
```bash
curl -s -X POST "http://localhost:1235/api/projects/$PROJECT_ID/import/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": [
      {"path":"Folder","title":"Folder","isFolder":true,"parentPath":null,"content":""},
      {"path":"Folder/Test Note","title":"Test Note","isFolder":false,"parentPath":"Folder","content":"# Hello\n\nWorld"}
    ]
  }' | python3 -m json.tool
```

Expected: `{"imported": 2}`

Stop server:
```bash
pkill -f 'tsx watch' 2>/dev/null || kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add apps/sync/src/routes/import.ts apps/sync/src/server.ts
git commit -m "feat(sync): batch notes import endpoint with Yjs seeding"
```

---

### Task 3: Create `NewProjectModal.tsx`

**Files:**
- Create: `apps/web/src/components/NewProjectModal.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useState } from 'react'
import type { Project } from '@websidian/shared'
import { readVault } from '../lib/vaultImport'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  token: string | null
  onCreated: (project: Project) => void
  onClose: () => void
}

type Step = 'form' | 'importing' | 'error'

export default function NewProjectModal({ token, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [notesTotal, setNotesTotal] = useState(0)
  const [notesDone, setNotesDone] = useState(false)
  const [imagesTotal, setImagesTotal] = useState(0)
  const [imagesDone, setImagesDone] = useState(0)

  const supportsFilePicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  const handlePickVault = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
      setVaultHandle(handle)
    } catch {
      // User cancelled or permission denied — do nothing
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !token) return
    setStep('importing')
    setErrorMsg('')

    // Step 1: Create project
    const projRes = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!projRes.ok) {
      setErrorMsg('Failed to create project.')
      setStep('error')
      return
    }
    const project = await projRes.json() as Project

    if (vaultHandle) {
      // Step 2: Read vault from disk
      const vaultData = await readVault(vaultHandle)
      setNotesTotal(vaultData.notes.length)

      if (vaultData.notes.length > 0) {
        // Step 3: Batch import notes
        const importRes = await fetch(`${API}/api/projects/${project.id}/import/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notes: vaultData.notes }),
        })
        if (!importRes.ok) {
          setErrorMsg('Project created but notes import failed. You can add notes manually.')
          setStep('error')
          onCreated(project)
          return
        }
      }
      setNotesDone(true)

      // Step 4: Upload images one by one
      setImagesTotal(vaultData.images.length)
      for (const { file } of vaultData.images) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`${API}/api/projects/${project.id}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }).catch(() => {})
        setImagesDone(d => d + 1)
      }
    }

    onCreated(project)
  }

  const inputStyle = {
    flex: 1, background: '#313244', border: 'none', borderRadius: 4,
    color: '#cdd6f4', fontSize: 13, padding: '6px 8px', outline: 'none',
  } as const

  const btnPrimary = {
    background: '#89b4fa', border: 'none', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, padding: '5px 14px', color: '#1e1e2e', fontWeight: 600,
  } as const

  const btnSecondary = {
    background: '#313244', border: 'none', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, padding: '5px 14px', color: '#cdd6f4',
  } as const

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
      }}
    >
      <div style={{
        background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8,
        padding: 24, minWidth: 340, maxWidth: 480, width: '100%',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#cdd6f4', marginBottom: 18 }}>
          New Project
        </div>

        {(step === 'form' || step === 'error') && (
          <>
            <div style={{ marginBottom: 12 }}>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
                placeholder="Project name"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {supportsFilePicker && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 6 }}>
                  Import from Obsidian vault (optional)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={handlePickVault} style={btnSecondary}>
                    Choose folder
                  </button>
                  {vaultHandle && (
                    <span style={{ fontSize: 12, color: '#a6e3a1' }}>
                      📁 {vaultHandle.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {step === 'error' && (
              <div style={{ color: '#f38ba8', fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreate} disabled={!name.trim()} style={{
                ...btnPrimary,
                opacity: name.trim() ? 1 : 0.4,
                cursor: name.trim() ? 'pointer' : 'default',
              }}>
                {vaultHandle ? 'Create & Import' : 'Create'}
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={{ fontSize: 13, color: '#cdd6f4', lineHeight: 2 }}>
            <div>Creating project… ✓</div>
            {notesTotal > 0 && (
              <div>
                Importing notes… {notesDone ? '✓' : `(${notesTotal} notes)`}
              </div>
            )}
            {notesDone && imagesTotal > 0 && (
              <div>
                Uploading images… {imagesDone >= imagesTotal
                  ? '✓'
                  : `(${imagesDone} / ${imagesTotal})`}
              </div>
            )}
            {notesDone && (imagesTotal === 0 || imagesDone >= imagesTotal) && (
              <div style={{ color: '#a6e3a1' }}>Done ✓</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no errors. (ProjectSwitcher will still have the old `onCreate` prop — that's fine until Task 4.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/NewProjectModal.tsx
git commit -m "feat(web): NewProjectModal with vault import and progress"
```

---

### Task 4: Wire `NewProjectModal` into `ProjectSwitcher` and `App.tsx`

**Files:**
- Modify: `apps/web/src/components/ProjectSwitcher.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Rewrite `ProjectSwitcher.tsx`**

Replace the entire file:

```typescript
import { useState } from 'react'
import type { Project } from '@websidian/shared'
import NewProjectModal from './NewProjectModal'

interface Props {
  projects: Project[]
  activeProject: Project | null
  token: string | null
  onSelect: (project: Project) => void
  onRefreshProjects: () => void
}

export default function ProjectSwitcher({ projects, activeProject, token, onSelect, onRefreshProjects }: Props) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const handleProjectCreated = (project: Project) => {
    setShowModal(false)
    setOpen(false)
    onRefreshProjects()
    onSelect(project)
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'transparent',
            border: '1px solid #313244',
            borderRadius: 4,
            color: '#cdd6f4',
            cursor: 'pointer',
            fontSize: 13,
            padding: '2px 8px',
          }}
        >
          {activeProject?.name ?? 'Select project'} ▾
        </button>

        {open && (
          <div style={{
            position: 'absolute',
            top: 32,
            left: 0,
            background: '#181825',
            border: '1px solid #313244',
            borderRadius: 6,
            minWidth: 200,
            zIndex: 100,
            padding: 8,
          }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false) }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: p.id === activeProject?.id ? '#89b4fa' : '#cdd6f4',
                  background: p.id === activeProject?.id ? '#313244' : 'transparent',
                }}
              >
                {p.name}
                {p.isPublic && <span style={{ fontSize: 10, color: '#6c7086', marginLeft: 6 }}>public</span>}
              </div>
            ))}

            <div style={{ borderTop: '1px solid #313244', marginTop: 6, paddingTop: 6 }}>
              <div
                onClick={() => { setShowModal(true); setOpen(false) }}
                style={{ color: '#89b4fa', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
              >
                + New project
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          token={token}
          onCreated={handleProjectCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update `ProjectSwitcher` props in `App.tsx`**

Find (around line 191):
```tsx
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          onSelect={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
          onCreate={createProject}
        />
```

Replace with:
```tsx
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          token={authToken}
          onSelect={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
          onRefreshProjects={refreshProjects}
        />
```

- [ ] **Step 3: Type-check — expect zero errors**

```bash
cd /mnt/d/Development/Websidian
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: **zero errors**.

- [ ] **Step 4: Production build — confirm no bundler errors**

```bash
pnpm --filter @websidian/web build 2>&1 | tail -8
```

Expected: `✓ built in Xs`

- [ ] **Step 5: Manual smoke test**

Start both servers:
```bash
# Terminal 1
pnpm --filter @websidian/sync dev

# Terminal 2
pnpm --filter @websidian/web dev
```

Open `http://localhost:3000`, log in, then:
1. Click the project dropdown — verify "+ New project" still appears
2. Click "+ New project" — modal opens with a name field
3. Type a name, click Create (no vault) — project created, modal closes, new project selected ✓
4. Click "+ New project" again, type a name, click "Choose folder", pick a folder with some `.md` files
5. Vault name appears next to "Choose folder"
6. Click "Create & Import" — progress lines appear
7. After import, modal closes, new project is selected, notes appear in sidebar ✓

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ProjectSwitcher.tsx apps/web/src/App.tsx
git commit -m "feat(web): wire NewProjectModal into ProjectSwitcher — replaces inline form"
```

- [ ] **Step 7: Push**

```bash
git push origin master
```

---

## Post-Implementation Verification

1. Create a project without vault — confirm it works exactly as before
2. Create a project with a vault that has nested folders — confirm the folder hierarchy matches in the sidebar
3. Open an imported note in preview mode — confirm `![[image.png]]` embeds resolve (if images were uploaded)
4. Open an imported note in edit mode — confirm content is present (Yjs seeded correctly)
5. Check that `![[attachments/cat.png]]` in the vault became `![[cat.png]]` in the imported note
