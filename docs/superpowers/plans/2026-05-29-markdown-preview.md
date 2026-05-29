# Markdown Preview Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle-able markdown reading view that renders note content as styled HTML, with clickable `[[wikilinks]]`, while keeping user presence (avatar) active.

**Architecture:** A new `MarkdownPreview` component subscribes to `yText` and renders it via `react-markdown` + `remark-gfm`. A `previewMode` boolean in `App.tsx` switches between `Editor` and `MarkdownPreview`. Mode defaults to `true` on load, is maintained when switching notes, and resets to `false` when a new note is created. Viewers are always in preview mode.

**Tech Stack:** React, `react-markdown` v9, `remark-gfm` v4, `yjs` (Y.Text observe), TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-05-29-markdown-preview-design.md`

**Root directory:** `/mnt/d/Development/Websidian/`

---

## File Structure

```
apps/web/src/
  components/
    MarkdownPreview.tsx     CREATE — renders yText as markdown, handles wikilinks
  App.tsx                   MODIFY — previewMode state, toggle button, createNote resets mode
apps/web/package.json       MODIFY — add react-markdown, remark-gfm
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install packages**

```bash
pnpm --filter @websidian/web add react-markdown remark-gfm
```

Expected output ends with: `Done in ...`

- [ ] **Step 2: Verify TypeScript still passes**

```bash
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add react-markdown and remark-gfm dependencies"
```

---

## Task 2: MarkdownPreview component

**Files:**
- Create: `apps/web/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: Create MarkdownPreview.tsx**

Create `apps/web/src/components/MarkdownPreview.tsx` with this exact content:

```tsx
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
}

function parseWikilinks(text: string, onClick: (title: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const title = match[1]
    parts.push(
      <span
        key={match.index}
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

export default function MarkdownPreview({ yText, onWikilinkClick }: Props) {
  const [content, setContent] = useState(() => yText.toString())

  useEffect(() => {
    const handler = () => setContent(yText.toString())
    yText.observe(handler)
    return () => yText.unobserve(handler)
  }, [yText])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 32px',
      color: '#cdd6f4',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 15,
      lineHeight: 1.75,
      maxWidth: 760,
      alignSelf: 'flex-start',
      width: '100%',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Intercept text nodes inside paragraphs to handle [[wikilinks]]
          p({ children }) {
            const processed = processChildren(children, onWikilinkClick)
            return <p style={{ marginBottom: '1em' }}>{processed}</p>
          },
          h1: ({ children }) => <h1 style={{ fontSize: '1.8em', fontWeight: 700, borderBottom: '1px solid #313244', paddingBottom: '0.3em', marginBottom: '0.8em', fontFamily: 'system-ui, sans-serif' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '1.4em', fontWeight: 700, marginBottom: '0.6em', fontFamily: 'system-ui, sans-serif' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.2em', fontWeight: 700, marginBottom: '0.5em', fontFamily: 'system-ui, sans-serif' }}>{children}</h3>,
          // react-markdown v9: code blocks are rendered via `pre > code`; inline code is just `code` with no `pre` parent
          code({ children, className }: { children?: React.ReactNode; className?: string }) {
            const isBlock = Boolean(className) // fenced code blocks have a language className
            return isBlock
              ? <pre style={{ background: '#181825', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', fontSize: '0.88em', marginBottom: '1em' }}><code style={{ fontFamily: 'monospace' }}>{children}</code></pre>
              : <code style={{ background: '#313244', borderRadius: 3, padding: '1px 5px', fontSize: '0.88em', fontFamily: 'monospace' }}>{children}</code>
          },
          blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #45475a', paddingLeft: 16, color: '#6c7086', margin: '0 0 1em 0' }}>{children}</blockquote>,
          ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '0.25em' }}>{children}</li>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#89b4fa' }}>{children}</a>,
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #313244', margin: '1.5em 0' }} />,
          table: ({ children }) => <table style={{ borderCollapse: 'collapse', marginBottom: '1em', width: '100%' }}>{children}</table>,
          th: ({ children }) => <th style={{ border: '1px solid #313244', padding: '6px 12px', background: '#181825', textAlign: 'left' }}>{children}</th>,
          td: ({ children }) => <td style={{ border: '1px solid #313244', padding: '6px 12px' }}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function processChildren(children: React.ReactNode, onClick: (title: string) => void): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) =>
      typeof child === 'string'
        ? <span key={i}>{parseWikilinks(child, onClick)}</span>
        : child
    )}</>
  }
  return children
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no output. If you get errors about missing `React` imports, add `import React from 'react'` at the top.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MarkdownPreview.tsx
git commit -m "feat(web): add MarkdownPreview component with wikilink support"
```

---

## Task 3: Wire preview mode into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

This task makes four changes to `App.tsx`:
1. Import `MarkdownPreview`
2. Add `previewMode` state (defaults `true`)
3. Add toggle button in header (hidden for viewers, hidden when no note active)
4. Swap `<Editor>` for `<MarkdownPreview>` based on `previewMode`
5. Reset `previewMode` to `false` when a new note is created

- [ ] **Step 1: Add the MarkdownPreview import**

In `apps/web/src/App.tsx`, find the import block at the top and add after the `Editor` import:

```typescript
import MarkdownPreview from './components/MarkdownPreview'
```

- [ ] **Step 2: Add previewMode state**

Find this line in App.tsx:
```typescript
  const [showGraph, setShowGraph] = useState(false)
```

Add immediately after it:
```typescript
  const [previewMode, setPreviewMode] = useState(true)
```

- [ ] **Step 3: Reset previewMode to false when creating a new note**

Find the `onNewNote` prop on the `Sidebar` component:
```typescript
onNewNote={canEdit ? () => createNote(`Untitled-${Date.now()}`) : undefined}
```

Replace with:
```typescript
onNewNote={canEdit ? () => { createNote(`Untitled-${Date.now()}`); setPreviewMode(false) } : undefined}
```

- [ ] **Step 4: Add the toggle button in the header**

Find this block in the header JSX (after the graph button):
```typescript
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

Add immediately after it:
```typescript
        {activeId && canEdit && (
          <button
            onClick={() => setPreviewMode(m => !m)}
            style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
            title={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
          >
            {previewMode ? '✎ Edit' : '☰ Preview'}
          </button>
        )}
```

- [ ] **Step 5: Replace the Editor render with a preview/edit conditional**

Find this block in the main content area:
```typescript
        {activeId && yText
          ? <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
          : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c7086' }}>
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )
        }
```

Replace with:
```typescript
        {activeId && yText
          ? (previewMode
              ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
              : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
            )
          : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c7086' }}>
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )
        }
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm --filter @websidian/web exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): add preview/edit toggle with previewMode state"
```

---

## Task 4: Manual verification

Start the servers and verify the feature works end-to-end.

```bash
pnpm --filter @websidian/sync dev &
pnpm --filter @websidian/web dev &
sleep 4
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 1: App loads in preview mode**

After logging in and selecting a project, the note should render as styled markdown (not a CodeMirror editor). Confirm the `☰ Preview` button is NOT shown (you're already in preview). You should see a `✎ Edit` button instead.

- [ ] **Step 2: Toggle to edit mode**

Click `✎ Edit`. The CodeMirror editor should appear. The button should now show `☰ Preview`.

- [ ] **Step 3: Toggle back to preview**

Click `☰ Preview`. The rendered markdown view should return.

- [ ] **Step 4: Switch notes — mode is preserved**

While in preview mode, click a different note in the sidebar. The new note should also open in preview mode (mode was not reset).

- [ ] **Step 5: GFM features render correctly**

In a note, type (in edit mode):
```markdown
# Heading 1

**bold** and *italic*

- item one
- item two

| Col A | Col B |
|---|---|
| cell | cell |

`inline code` and:

\```
code block
\```
```

Switch to preview. Verify heading, bold, italic, list, table, and code blocks all render with dark-theme styling.

- [ ] **Step 6: Wikilinks are clickable in preview**

Type `[[Some Note]]` in edit mode. Switch to preview. The wikilink should render as a blue underlined span. Clicking it should navigate to (or create) "Some Note".

- [ ] **Step 7: New note opens in edit mode**

Click `+ New Note`. The new note should open directly in edit mode (no toggle needed).

- [ ] **Step 8: Viewer role stays in preview**

If you have a second account with viewer role on a project: log in as that user. The `✎ Edit` button should not be visible. The note renders in preview only.

- [ ] **Step 9: Final commit if any fixups were made**

```bash
git add -A
git status
# Only commit if there are changes
git diff --cached --quiet || git commit -m "fix(web): markdown preview fixups from manual testing"
```

---

## Acceptance Checklist

- [ ] App loads with first note in preview mode
- [ ] Preview renders headings, bold, italic, lists, code blocks, tables, strikethrough
- [ ] `[[Title]]` in preview is a clickable blue underlined span — navigates or creates note
- [ ] Toggle button shows `✎ Edit` in preview mode, `☰ Preview` in edit mode
- [ ] Switching between existing notes does not change preview/edit mode
- [ ] Creating a new note automatically switches to edit mode
- [ ] Viewer-role users always see preview; toggle button not shown
- [ ] User avatar still appears in presence bar for other users while in preview mode
- [ ] `pnpm --filter @websidian/web exec tsc --noEmit` passes
