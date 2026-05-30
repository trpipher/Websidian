# Links Panel Design

**Goal:** Replace the inline BacklinksPanel with a toggleable right sidebar showing backlinks and forward links for the active note, with a tab bar for switching between them.

---

## Scope

| Feature | Included |
|---|---|
| Toggleable right sidebar with animated collapse | ✅ |
| Tab bar: Backlinks / Forward Links | ✅ |
| Clickable results navigate to that note | ✅ |
| Toggle button in top toolbar (always visible) | ✅ |
| Empty state when no note is open | ✅ |
| Forward links API endpoint | ✅ |
| Remove existing BacklinksPanel from left sidebar | ✅ |
| Additional tabs beyond backlinks/forwardlinks | ❌ (future) |

---

## Architecture

The `LinksPanel` component replaces `BacklinksPanel`. It lives as a third flex child in the main content row (left sidebar | editor | links panel). Width animates between 260px (open) and 0px (closed) via CSS `transition: width`. `showLinks: boolean` state lives in `App.tsx` and is toggled by a toolbar button.

---

## File Changes

```
apps/sync/src/routes/notes.ts         MODIFY — add GET /:id/forwardlinks endpoint
apps/web/src/components/
  BacklinksPanel.tsx                  DELETE — replaced by LinksPanel
  LinksPanel.tsx                      CREATE — tabbed links sidebar
apps/web/src/App.tsx                  MODIFY — add showLinks state, toolbar button,
                                               render LinksPanel, remove BacklinksPanel
```

---

## API — Forward Links Endpoint

New route mirroring the existing backlinks endpoint:

```
GET /api/projects/:projectId/notes/:id/forwardlinks
```

Queries `note_links` where `source_id = :id` (notes the current note links TO), joins `notes` to get metadata. Returns `NoteMeta[]` with `aliases: []`. Same auth/project guards as backlinks.

```sql
SELECT n.id, n.path, n.title, n.project_id as projectId,
       n.created_at as createdAt, n.updated_at as updatedAt,
       n.parent_id as parentId,
       COALESCE(n.sort_order, n.rowid * 1000) as sortOrder,
       COALESCE(n.is_folder, 0) as isFolder
FROM note_links l
JOIN notes n ON n.id = l.target_id
WHERE l.source_id = ? AND n.deleted_at IS NULL
```

---

## LinksPanel Component

**File:** `apps/web/src/components/LinksPanel.tsx`

**Props:**
```typescript
interface Props {
  noteId: string | null
  projectId: string | null
  token: string | null
  onSelect: (id: string) => void
}
```

**Behaviour:**
- `activeTab: 'backlinks' | 'forwardlinks'` local state, defaults to `'backlinks'`
- Fetches on `noteId` change; clears results when `noteId` is null
- Each tab has its own `useEffect` that fires when the tab is active and `noteId` changes
- Clicking a result calls `onSelect(id)`
- Empty note state: "Open a note to see links" centred in grey
- Empty results state: "No [backlinks / forward links]" in grey
- Tab bar at top: two buttons, active tab has solid background (`#313244`), inactive is transparent

**Layout (collapsed panel is hidden via CSS, component always mounts):**
- Full height, `overflow: hidden`, `borderLeft: '1px solid #313244'`
- Tab bar: `display: flex`, each button `flex: 1`, `padding: 6px`, `fontSize: 12`
- Results list: scrollable, each item `padding: 6px 12px`, `cursor: pointer`, hover highlight

---

## App.tsx Changes

1. **Remove** `BacklinksPanel` import and its JSX (currently at bottom of left sidebar column)
2. **Add** `import LinksPanel from './components/LinksPanel'`
3. **Add** `const [showLinks, setShowLinks] = useState(false)`
4. **Add** toolbar button (alongside existing graph/preview buttons):
   ```tsx
   <button
     onClick={() => setShowLinks(s => !s)}
     title="Toggle linked mentions"
     style={{ background: 'none', border: 'none', color: showLinks ? '#89b4fa' : '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
   >
     ⟵⟶
   </button>
   ```
5. **Add** `LinksPanel` as third child of the main flex row, after the editor area:
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

---

## Transition Detail

The wrapper `div` owns the animation (`width` + `overflow: hidden`). `LinksPanel` itself always renders at full width (260px) inside the wrapper — it doesn't know about the collapsed state. This avoids re-mounting the component on toggle, preserving tab selection and scroll position.
