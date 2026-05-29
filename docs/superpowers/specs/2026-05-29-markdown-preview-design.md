# Markdown Preview Mode — Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Goal

Add a reading/preview mode to Websidian that renders note content as styled markdown (similar to Obsidian's reading view), with `[[wikilinks]]` remaining clickable, while keeping the user's presence avatar visible to other collaborators. Users toggle between edit and preview with a button in the header.

---

## Behaviour Rules

| Situation | Preview mode |
|---|---|
| App first loads | **On** (preview) |
| Click between existing notes | Unchanged — maintain current mode |
| Create a new note | **Off** (edit) — land straight in the editor |
| User role is viewer | Always preview, toggle hidden |

---

## Architecture

### New file

**`apps/web/src/components/MarkdownPreview.tsx`**

Renders the live Yjs text as markdown. Props:

```typescript
interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
}
```

Internally:
- `useState<string>` holds the current markdown content
- `useEffect` sets content on mount and subscribes to `yText.observe()` so the preview updates live as collaborators type
- Renders via `<ReactMarkdown remarkPlugins={[remarkGfm]}>`
- Custom `components` map intercepts paragraph/text rendering to split on `WIKILINK_RE = /\[\[([^\]]+)\]\]/g` and wrap matches in clickable `<span>` elements that call `onWikilinkClick(title)`
- External links (`[text](url)`) open in a new tab (`target="_blank" rel="noreferrer"`)
- Code blocks styled with dark background matching the Catppuccin palette
- All styles inline (no CSS file) consistent with the rest of the app

### Modified files

**`apps/web/src/App.tsx`**

- Add `previewMode` boolean state, initialised to `true`
- Render `<MarkdownPreview>` instead of `<Editor>` when `previewMode` is `true` and a note is active
- Pass `onWikilinkClick={handleWikilinkClick}` to `MarkdownPreview` (same callback already used by `Editor`)
- `createNote` call: after the new note ID is set, also call `setPreviewMode(false)`
- Viewers (`userRole === 'viewer'`): force `previewMode = true`, do not render the toggle button

**`apps/web/src/components/Editor.tsx`**

No changes needed. When the editor unmounts (mode switch), `yCollab` cleans up its cursor entry in awareness automatically.

---

## Toggle Button

Placed in the header, immediately after the graph (`⬡`) button. Only shown when `activeId` is set and the user is not a viewer.

| State | Label |
|---|---|
| Currently in edit mode | `☰ Preview` |
| Currently in preview mode | `✎ Edit` |

---

## Awareness in Preview Mode

`useProvider` stays connected regardless of mode. Destroying the `Editor` component automatically removes the cursor from awareness (handled by `yCollab` teardown). The user's `{ name, color, image }` field persists, so their avatar continues to appear in other users' presence bars. No extra awareness code needed.

---

## Dependencies

One new package:

```bash
pnpm --filter @websidian/web add react-markdown remark-gfm
```

`react-markdown` v9.x + `remark-gfm` v4.x. No other dependencies.

---

## Files Changed

```
apps/web/src/components/MarkdownPreview.tsx   CREATE
apps/web/src/App.tsx                          MODIFY — previewMode state, toggle button, createNote resets mode
apps/web/package.json                         MODIFY — add react-markdown, remark-gfm
```

---

## Acceptance Criteria

- [ ] App loads with the first note in preview mode
- [ ] Preview renders headings, bold, italic, lists, code blocks, tables, strikethrough (GFM)
- [ ] `[[Title]]` in preview is a clickable blue underlined span — clicking navigates to or creates that note
- [ ] Toggle button shows `☰ Preview` in edit mode, `✎ Edit` in preview mode
- [ ] Switching between existing notes does not change preview/edit mode
- [ ] Creating a new note automatically switches to edit mode
- [ ] Viewer-role users always see preview; toggle button is not shown to them
- [ ] User avatar still appears in the presence bar for other users while in preview mode
- [ ] No cursor visible for the previewing user in other users' editors
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
