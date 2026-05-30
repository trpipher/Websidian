# Links Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-of-sidebar BacklinksPanel with a toggleable animated right sidebar containing Backlinks and Forward Links tabs.

**Architecture:** A wrapper `div` in App.tsx owns the `width` CSS transition (260px ↔ 0px, `overflow: hidden`), so `LinksPanel` always renders at full width and never remounts on toggle. A toolbar button sets `showLinks` state. The new `GET /:id/forwardlinks` endpoint mirrors the backlinks endpoint. `BacklinksPanel.tsx` is deleted.

**Tech Stack:** TypeScript strict, React, Hono/better-sqlite3.

**Spec:** `docs/superpowers/specs/2026-05-30-links-panel-design.md`

**Root directory:** `/mnt/d/Development/Websidian/`

---

## File Structure

```
apps/sync/src/routes/notes.ts           MODIFY — add GET /:id/forwardlinks endpoint
apps/web/src/components/
  BacklinksPanel.tsx                    DELETE
  LinksPanel.tsx                        CREATE — tabbed backlinks + forwardlinks panel
apps/web/src/App.tsx                    MODIFY — showLinks state, toolbar button,
                                                 LinksPanel render, remove BacklinksPanel
```

---

## Task 1: Forward links API endpoint

**Files:**
- Modify: `apps/sync/src/routes/notes.ts`

- [ ] **Step 1: Add the forwardlinks route**

Open `apps/sync/src/routes/notes.ts`. After the backlinks handler (which ends around line 213 with `return c.json(...)`), add:

```typescript
// ── Forward links ──────────────────────────────────────────────────────────────
notesRouter.get('/:id/forwardlinks', async (c) => {
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
    JOIN notes n ON n.id = l.target_id
    WHERE l.source_id = ? AND n.deleted_at IS NULL
  `).all(id) as (Omit<NoteMeta, 'isFolder' | 'aliases'> & { isFolder: number })[]
  return c.json(links.map(n => ({ ...n, isFolder: Boolean(n.isFolder), aliases: [] as string[] })))
})
```

Insert it between the `// ── Backlinks` block and the `// ── Graph` block.

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/sync/src/routes/notes.ts
git commit -m "feat(sync): add GET /:id/forwardlinks endpoint"
```

---

## Task 2: Create LinksPanel component

**Files:**
- Create: `apps/web/src/components/LinksPanel.tsx`

- [ ] **Step 1: Create LinksPanel.tsx**

Create `apps/web/src/components/LinksPanel.tsx` with this exact content:

```tsx
import { useState, useEffect } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

type Tab = 'backlinks' | 'forwardlinks'

interface Props {
  noteId: string | null
  projectId: string | null
  token: string | null
  onSelect: (id: string) => void
}

export default function LinksPanel({ noteId, projectId, token, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('backlinks')
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([])
  const [forwardlinks, setForwardlinks] = useState<NoteMeta[]>([])

  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!noteId || !projectId) { setBacklinks([]); return }
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/backlinks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
  }, [noteId, projectId, token])

  useEffect(() => {
    if (!noteId || !projectId) { setForwardlinks([]); return }
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/forwardlinks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setForwardlinks)
      .catch(() => setForwardlinks([]))
  }, [noteId, projectId, token])

  const results = activeTab === 'backlinks' ? backlinks : forwardlinks
  const emptyLabel = activeTab === 'backlinks' ? 'No backlinks' : 'No forward links'

  return (
    <div style={{
      width: 260,
      height: '100%',
      borderLeft: '1px solid #313244',
      background: '#1e1e2e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #313244', flexShrink: 0 }}>
        {(['backlinks', 'forwardlinks'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '7px 4px',
              background: activeTab === tab ? '#313244' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #89b4fa' : '2px solid transparent',
              color: activeTab === tab ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'backlinks' ? 'Backlinks' : 'Forward Links'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!noteId ? (
          <div style={{ color: '#45475a', fontSize: 12, textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
            Open a note to see links
          </div>
        ) : results.length === 0 ? (
          <div style={{ color: '#45475a', fontSize: 12, textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
            {emptyLabel}
          </div>
        ) : (
          results.map(n => (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: '#bac2de',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#313244')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {n.title}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit 2>&1 | grep "LinksPanel" | head -10
```

Expected: no errors for LinksPanel.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/LinksPanel.tsx
git commit -m "feat(web): add LinksPanel with Backlinks and Forward Links tabs"
```

---

## Task 3: Wire LinksPanel into App.tsx, remove BacklinksPanel

**Files:**
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/components/BacklinksPanel.tsx`

- [ ] **Step 1: Replace BacklinksPanel import with LinksPanel**

Find line 9 in `apps/web/src/App.tsx`:
```typescript
import BacklinksPanel from './components/BacklinksPanel'
```

Replace with:
```typescript
import LinksPanel from './components/LinksPanel'
```

- [ ] **Step 2: Add showLinks state**

Find the existing state declarations near the top of the component. After:
```typescript
const [showSearch, setShowSearch] = useState(false)
```

Add:
```typescript
const [showLinks, setShowLinks] = useState(false)
```

- [ ] **Step 3: Add toolbar toggle button**

Find the toolbar buttons block. The graph button looks like:
```tsx
{activeProject && (
  <button
    onClick={() => setShowGraph(true)}
    style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
    title="Graph view"
  >
    ⬡
  </button>
)}
```

Add the links toggle button immediately after it:
```tsx
<button
  onClick={() => setShowLinks(s => !s)}
  title="Toggle linked mentions"
  style={{ background: 'none', border: 'none', color: showLinks ? '#89b4fa' : '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
>
  ⟵⟶
</button>
```

- [ ] **Step 4: Remove BacklinksPanel from the left sidebar**

Find and remove the entire `<BacklinksPanel ... />` block (currently at the bottom of the left sidebar column, around lines 339–344):
```tsx
<BacklinksPanel
  noteId={activeId}
  projectId={activeProject?.id ?? null}
  token={authToken}
  onSelect={setActiveId}
/>
```

Delete these lines entirely.

- [ ] **Step 5: Add LinksPanel as third flex child**

Find the closing tag of the editor/preview area. The main content row ends around line 368:
```tsx
      </div>

      {showSettings && activeProject && authToken && (
```

Add the LinksPanel wrapper div between the closing `</div>` of the editor area and the `{showSettings ...}` block:

```tsx
        <div style={{
          width: showLinks ? 260 : 0,
          transition: 'width 200ms ease',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <LinksPanel
            noteId={activeId}
            projectId={activeProject?.id ?? null}
            token={authToken}
            onSelect={id => { setActiveId(id); setSelectedImage(null) }}
          />
        </div>
```

- [ ] **Step 6: TypeScript check — both packages**

```bash
pnpm --filter @websidian/web exec tsc --noEmit && \
pnpm --filter @websidian/sync exec tsc --noEmit
```

Expected: no output from either.

- [ ] **Step 7: Delete BacklinksPanel.tsx**

```bash
git rm apps/web/src/components/BacklinksPanel.tsx
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): toggleable LinksPanel right sidebar; remove BacklinksPanel"
```

---

## Task 4: Manual verification

Start the servers:
```bash
pnpm --filter @websidian/sync dev &
pnpm --filter @websidian/web dev &
sleep 5
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 1: Toggle button visible with no note open**

The `⟵⟶` button is visible in the toolbar before any note is selected.

- [ ] **Step 2: Panel opens and closes with animation**

Click `⟵⟶`. A 260px panel slides in from the right over ~200ms. Click again — it collapses back. No page reflow jank on the left sidebar or editor.

- [ ] **Step 3: Tab bar works**

Open a note that has both backlinks and forward links. Click `⟵⟶` to open the panel. Both "Backlinks" and "Forward Links" tabs are visible. Click between them — the active tab shows a blue underline and the list updates.

- [ ] **Step 4: Backlinks correct**

With the Backlinks tab active, the list shows notes that link TO the current note. Click one — navigates to that note.

- [ ] **Step 5: Forward links correct**

With the Forward Links tab active, the list shows notes that the current note links TO (via `[[wikilinks]]`). Click one — navigates to that note.

- [ ] **Step 6: Empty states**

Open a note with no backlinks — "No backlinks" shown in grey. Switch to Forward Links tab on a note with no wikilinks — "No forward links" shown in grey.

- [ ] **Step 7: No note open state**

Close the note (or open a fresh browser tab before selecting any note). Click `⟵⟶` — panel opens showing "Open a note to see links" in both tabs.

- [ ] **Step 8: BacklinksPanel gone from left sidebar**

Confirm the old "Linked mentions" section no longer appears at the bottom of the left note list.

- [ ] **Step 9: Final commit**

```bash
git add -A
git diff --cached --quiet || git commit -m "feat: links panel — backlinks and forward links right sidebar complete"
```

---

## Acceptance Checklist

- [ ] `⟵⟶` toggle button always visible in toolbar
- [ ] Button colour: `#89b4fa` when open, `#6c7086` when closed
- [ ] Panel animates open/closed (200ms ease width transition)
- [ ] Panel does not remount on toggle (tab selection preserved)
- [ ] Backlinks tab lists notes that link to the current note
- [ ] Forward Links tab lists notes the current note links to
- [ ] Clicking a result navigates to that note and clears selected image
- [ ] "Open a note to see links" when no note is active
- [ ] "No backlinks" / "No forward links" when list is empty
- [ ] Hover highlight on result rows
- [ ] Old BacklinksPanel removed from left sidebar
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
- [ ] `pnpm --filter @websidian/sync exec tsc --noEmit` passes
