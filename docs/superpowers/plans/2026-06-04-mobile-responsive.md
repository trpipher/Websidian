# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Websidian fully responsive for phone and tablet (full feature parity), using a single-source adaptive approach with a `useBreakpoint()` hook, while componentizing `Sidebar.tsx` and extracting three new UI primitives.

**Architecture:** A `useBreakpoint()` hook is the single source of truth for responsive behavior. `AppLayout` wraps the sidebar in a `Drawer` on mobile/portrait and shows it persistently on landscape tablet/desktop. `Sidebar.tsx` is split into `SidebarHeader`, `SidebarFileTree`, and `SidebarImages` sub-components.

**Tech Stack:** React, Tailwind CSS, `@radix-ui/react-dialog` (for Drawer), CodeMirror 6, `react-force-graph-2d`, dnd-kit, TypeScript, Vite

---

## File Map

**New files:**
- `apps/web/src/hooks/useBreakpoint.ts`
- `apps/web/src/components/ui/drawer.tsx`
- `apps/web/src/components/ui/icon-button.tsx`
- `apps/web/src/components/ui/toolbar.tsx`
- `apps/web/src/lib/sidebarTree.ts`
- `apps/web/src/components/sidebar/SidebarHeader.tsx`
- `apps/web/src/components/sidebar/SidebarImages.tsx`
- `apps/web/src/components/sidebar/SidebarFileTree.tsx`
- `apps/web/src/lib/markdown-toolbar.ts`
- `apps/web/src/components/MarkdownToolbar.tsx`
- `apps/web/src/components/AppLayout.tsx`
- `apps/web/src/components/TopBar.tsx`

**Modified files:**
- `apps/web/src/components/Sidebar.tsx` — becomes thin shell
- `apps/web/src/components/Editor.tsx` — expose EditorView via `onReady` prop
- `apps/web/src/components/NoteGraph.tsx` — responsive size + full-screen mobile modal
- `apps/web/src/components/SidebarItem.tsx` — 44px min touch target
- `apps/web/src/App.tsx` — add drawer state, use AppLayout/TopBar

**Dev command:** `pnpm --filter @websidian/web dev` (from repo root) or `pnpm dev` (from `apps/web`)

---

## Task 1: `useBreakpoint` hook

**Files:**
- Create: `apps/web/src/hooks/useBreakpoint.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/src/hooks/useBreakpoint.ts
import { useState, useEffect } from 'react'

export interface Breakpoint {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isPortrait: boolean
  isLandscape: boolean
}

const QUERIES = {
  mobile:  '(max-width: 767px)',
  tablet:  '(min-width: 768px) and (max-width: 1199px)',
  desktop: '(min-width: 1200px)',
  portrait: '(orientation: portrait)',
}

function snapshot(): Breakpoint {
  const portrait = window.matchMedia(QUERIES.portrait).matches
  return {
    isMobile:  window.matchMedia(QUERIES.mobile).matches,
    isTablet:  window.matchMedia(QUERIES.tablet).matches,
    isDesktop: window.matchMedia(QUERIES.desktop).matches,
    isPortrait:  portrait,
    isLandscape: !portrait,
  }
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(snapshot)

  useEffect(() => {
    const mqs = Object.values(QUERIES).map(q => window.matchMedia(q))
    const handler = () => setBp(snapshot())
    mqs.forEach(mq => mq.addEventListener('change', handler))
    return () => mqs.forEach(mq => mq.removeEventListener('change', handler))
  }, [])

  return bp
}
```

- [ ] **Step 2: Verify by importing in App.tsx temporarily**

Add `const bp = useBreakpoint()` at the top of `App.tsx`, `console.log(bp)`, run `pnpm dev`, and resize the browser window. Confirm `isMobile` flips at 768px. Remove the log when done.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useBreakpoint.ts
git commit -m "feat(mobile): add useBreakpoint hook"
```

---

## Task 2: `IconButton` UI primitive

**Files:**
- Create: `apps/web/src/components/ui/icon-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/ui/icon-button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
IconButton.displayName = 'IconButton'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/icon-button.tsx
git commit -m "feat(mobile): add IconButton UI primitive"
```

---

## Task 3: `Toolbar` UI primitive

**Files:**
- Create: `apps/web/src/components/ui/toolbar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/ui/toolbar.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export function Toolbar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="toolbar" className={cn('flex items-center gap-0.5', className)} {...props}>
      {children}
    </div>
  )
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn('h-5 mx-1', className)} />
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/toolbar.tsx
git commit -m "feat(mobile): add Toolbar UI primitive"
```

---

## Task 4: `Drawer` UI primitive

**Files:**
- Create: `apps/web/src/components/ui/drawer.tsx`

Note: `@radix-ui/react-dialog` is already installed. The drawer is a Dialog variant with slide-in-from-left animation.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/ui/drawer.tsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close
export const DrawerPortal = DialogPrimitive.Portal

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-0 top-0 z-50 h-full w-72 bg-background shadow-xl flex flex-col',
        'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
        'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/drawer.tsx
git commit -m "feat(mobile): add Drawer UI primitive"
```

---

## Task 5: Extract `lib/sidebarTree.ts`

**Files:**
- Create: `apps/web/src/lib/sidebarTree.ts`
- Modify: `apps/web/src/components/Sidebar.tsx`

The pure helper functions and types at the top of `Sidebar.tsx` (lines 31–107) move to a dedicated module.

- [ ] **Step 1: Create `lib/sidebarTree.ts`**

```ts
// apps/web/src/lib/sidebarTree.ts
import type { NoteMeta } from '@websidian/shared'

export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export interface SortConfig { by: SortField; direction: SortDirection }
export interface NoteNode extends NoteMeta { children: NoteNode[]; depth: number }

export const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

export const SORT_STORAGE_KEY = 'ws-sidebar-sort'

export function loadSortConfig(): SortConfig {
  try { return JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? '') }
  catch { return { by: 'title', direction: 'asc' } }
}

export function buildTree(notes: NoteMeta[], sort: SortConfig): NoteNode[] {
  const map = new Map<string, NoteNode>()
  for (const n of notes) map.set(n.id, { ...n, children: [], depth: 0 })

  const sorter = (a: NoteNode, b: NoteNode) => {
    const folderFirst = (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0)
    if (folderFirst !== 0) return folderFirst
    const av = a[sort.by] ?? ''; const bv = b[sort.by] ?? ''
    const cmp = String(av).localeCompare(String(bv))
    return sort.direction === 'asc' ? cmp : -cmp
  }

  const roots: NoteNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  const assignDepth = (nodes: NoteNode[], depth: number) => {
    nodes.sort(sorter)
    for (const n of nodes) { n.depth = depth; assignDepth(n.children, depth + 1) }
  }
  roots.sort(sorter)
  assignDepth(roots, 0)
  return roots
}

export function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  const visit = (node: NoteNode) => {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

export function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const map = new Map(notes.map(n => [n.id, n]))
  const ancestors = new Set<string>()
  let cur = map.get(id)
  while (cur?.parentId) { ancestors.add(cur.parentId); cur = map.get(cur.parentId) }
  return ancestors
}

export function computeDropZone(overId: string, notes: NoteMeta[]): string | null {
  const note = notes.find(n => n.id === overId)
  return note?.isFolder ? note.id : (note?.parentId ?? null)
}

export function countDescendants(notes: NoteMeta[], id: string): number {
  let count = 0
  const visit = (parentId: string) => {
    for (const n of notes) { if (n.parentId === parentId) { count++; if (n.isFolder) visit(n.id) } }
  }
  visit(id)
  return count
}
```

- [ ] **Step 2: Update `Sidebar.tsx` to import from the new module**

Delete lines 31–107 (the sort types, sort fields, storage key, and all helper functions) from `Sidebar.tsx` and replace with:

```ts
import {
  type SortField, type SortDirection, type SortConfig, type NoteNode,
  SORT_FIELDS, SORT_STORAGE_KEY, loadSortConfig,
  buildTree, flattenVisible, getAncestorIds, computeDropZone, countDescendants,
} from '@/lib/sidebarTree'
```

- [ ] **Step 3: Verify the app still compiles and renders correctly**

Run `pnpm --filter @websidian/web dev` and open the sidebar. Confirm notes list renders and sorting still works.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/sidebarTree.ts apps/web/src/components/Sidebar.tsx
git commit -m "refactor(sidebar): extract sidebarTree helpers to lib"
```

---

## Task 6: Extract `SidebarHeader`

**Files:**
- Create: `apps/web/src/components/sidebar/SidebarHeader.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`

`SidebarHeader` takes the header row (sort + new/import dropdowns + file inputs) and owns the feedback state internally.

- [ ] **Step 1: Create `apps/web/src/components/sidebar/SidebarHeader.tsx`**

```tsx
// apps/web/src/components/sidebar/SidebarHeader.tsx
import React, { useState, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SORT_FIELDS, SORT_STORAGE_KEY, type SortConfig } from '@/lib/sidebarTree'
import type { ImageMeta } from '@websidian/shared'

interface Props {
  canEdit: boolean
  sortConfig: SortConfig
  onSortChange: (config: SortConfig) => void
  onNewNote: (parentId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onUploadImage: (file: File) => Promise<ImageMeta | null>
  onImportNotes: (files: FileList) => Promise<number>
  onImportVault: (source: FileSystemDirectoryHandle | FileList) => Promise<{ notes: number; images: number }>
}

export default function SidebarHeader({
  canEdit, sortConfig, onSortChange,
  onNewNote, onNewFolder, onUploadImage, onImportNotes, onImportVault,
}: Props) {
  const [copiedImage, setCopiedImage] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [vaultImportResult, setVaultImportResult] = useState<{ notes: number; images: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const image = await onUploadImage(file)
    if (image) {
      await navigator.clipboard.writeText(`![[${image.filename}]]`)
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [onUploadImage])

  return (
    <>
      {/* Notes header row */}
      <div className="flex items-center mb-2 px-1">
        <span className="font-bold text-[13px] text-muted-foreground flex-1">Notes</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="bg-transparent border-none text-muted-foreground cursor-pointer text-sm px-1 py-px leading-none hover:text-foreground"
              title="Sort notes" aria-label="Sort notes"
            >
              ⇅
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground tracking-wide">SORT BY</DropdownMenuLabel>
            {SORT_FIELDS.map(({ field, label }) => (
              <DropdownMenuItem
                key={field}
                onClick={() => onSortChange({
                  by: field,
                  direction: sortConfig.by === field
                    ? (sortConfig.direction === 'asc' ? 'desc' : 'asc')
                    : 'asc',
                })}
                className="flex items-center gap-2 text-[13px]"
              >
                <span className="w-3 text-primary text-[10px]">{sortConfig.by === field ? '●' : '○'}</span>
                <span className="flex-1">{label}</span>
                {sortConfig.by === field && (
                  <span className="text-muted-foreground text-[11px]">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {canEdit && (
        <>
          <div className="flex gap-1 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 flex-1 py-0.5 px-2 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80 justify-center">
                  + New <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onNewNote(null)}>Note</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNewFolder(null)}>Folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 flex-1 py-0.5 px-2 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80 justify-center">
                  Import <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>Image</DropdownMenuItem>
                <DropdownMenuItem onClick={() => notesInputRef.current?.click()}>Markdown files</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  let source: FileSystemDirectoryHandle | FileList | null = null
                  if ('showDirectoryPicker' in window) {
                    try { source = await (window as any).showDirectoryPicker({ mode: 'read' }) }
                    catch { return }
                  } else {
                    folderInputRef.current?.click(); return
                  }
                  if (!source) return
                  const result = await onImportVault(source)
                  setVaultImportResult(result)
                  setTimeout(() => setVaultImportResult(null), 4000)
                }}>Folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {copiedImage && <p className="text-[11px] text-ctp-green mb-1 px-1">Image copied to clipboard!</p>}
          {importedCount !== null && <p className="text-[11px] text-ctp-green mb-1 px-1">Imported {importedCount} note{importedCount !== 1 ? 's' : ''}!</p>}
          {vaultImportResult !== null && (
            <p className="text-[11px] text-ctp-green mb-1 px-1">
              Imported {vaultImportResult.notes} note{vaultImportResult.notes !== 1 ? 's' : ''}
              {vaultImportResult.images > 0 ? ` + ${vaultImportResult.images} image${vaultImportResult.images !== 1 ? 's' : ''}` : ''}!
            </p>
          )}

          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <input ref={notesInputRef} type="file" accept=".md,.markdown" multiple className="hidden"
            onChange={async e => {
              if (!e.target.files?.length) return
              const count = await onImportNotes(e.target.files)
              e.target.value = ''
              setImportedCount(count)
              setTimeout(() => setImportedCount(null), 3000)
            }}
          />
          <input ref={folderInputRef} type="file" multiple className="hidden"
            // @ts-expect-error webkitdirectory not in React types
            webkitdirectory="true"
            onChange={async e => {
              if (!e.target.files?.length) return
              const result = await onImportVault(e.target.files)
              e.target.value = ''
              setVaultImportResult(result)
              setTimeout(() => setVaultImportResult(null), 4000)
            }}
          />
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run `pnpm --filter @websidian/web typecheck`. Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sidebar/SidebarHeader.tsx
git commit -m "refactor(sidebar): extract SidebarHeader component"
```

---

## Task 7: Extract `SidebarImages`

**Files:**
- Create: `apps/web/src/components/sidebar/SidebarImages.tsx`

- [ ] **Step 1: Create `apps/web/src/components/sidebar/SidebarImages.tsx`**

```tsx
// apps/web/src/components/sidebar/SidebarImages.tsx
import { useState, useRef } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { ImageMeta } from '@websidian/shared'

interface Props {
  images: ImageMeta[]
  selectedImageId: string | null
  canEdit: boolean
  onSelectImage: (image: ImageMeta) => void
  onRenameImage: (id: string, filename: string) => void
  onDeleteImage: (id: string) => Promise<boolean>
}

export default function SidebarImages({
  images, selectedImageId, canEdit, onSelectImage, onRenameImage, onDeleteImage,
}: Props) {
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [imageRenameValue, setImageRenameValue] = useState('')
  const imageRenameInputRef = useRef<HTMLInputElement>(null)
  const imageRenameActiveRef = useRef(false)

  if (images.length === 0) return null

  return (
    <div className="mt-3">
      <div className="px-1 mb-1">
        <span className="font-bold text-[13px] text-muted-foreground">Images</span>
      </div>
      {images.map(img => {
        const isRenaming = renamingImageId === img.id
        const startRename = () => {
          imageRenameActiveRef.current = true
          setImageRenameValue(img.filename)
          setRenamingImageId(img.id)
          setTimeout(() => imageRenameInputRef.current?.select(), 10)
        }
        return (
          <ContextMenu key={img.id}>
            <ContextMenuTrigger asChild>
              <div
                onClick={() => { if (!isRenaming) onSelectImage(img) }}
                className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-[13px] text-foreground overflow-hidden ${selectedImageId === img.id ? 'bg-card' : 'hover:bg-card/50'}`}
                title={img.filename}
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                {isRenaming ? (
                  <input
                    ref={imageRenameInputRef}
                    value={imageRenameValue}
                    onChange={e => setImageRenameValue(e.target.value)}
                    onBlur={() => {
                      if (!imageRenameActiveRef.current) return
                      imageRenameActiveRef.current = false
                      const trimmed = imageRenameValue.trim()
                      if (trimmed && trimmed !== img.filename) onRenameImage(img.id, trimmed)
                      setRenamingImageId(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); imageRenameInputRef.current?.blur() }
                      if (e.key === 'Escape') { imageRenameActiveRef.current = false; setRenamingImageId(null) }
                    }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                    className="flex-1 bg-card border border-primary rounded-sm text-foreground text-[13px] px-1 py-px focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{img.filename}</span>
                )}
              </div>
            </ContextMenuTrigger>
            {canEdit && (
              <ContextMenuContent>
                <ContextMenuItem onClick={startRename}>Rename</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onDeleteImage(img.id)} className="text-destructive focus:text-destructive">
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/sidebar/SidebarImages.tsx
git commit -m "refactor(sidebar): extract SidebarImages component"
```

---

## Task 8: Extract `SidebarFileTree`

**Files:**
- Create: `apps/web/src/components/sidebar/SidebarFileTree.tsx`

`SidebarFileTree` owns the DnD state, expanded state, and `renderNode` logic entirely. The parent (`Sidebar`) just passes data and callbacks.

- [ ] **Step 1: Create `apps/web/src/components/sidebar/SidebarFileTree.tsx`**

```tsx
// apps/web/src/components/sidebar/SidebarFileTree.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import type { NoteMeta } from '@websidian/shared'
import SidebarItem from '@/components/SidebarItem'
import {
  buildTree, flattenVisible, getAncestorIds, computeDropZone, countDescendants,
  type SortConfig, type NoteNode,
} from '@/lib/sidebarTree'

interface Props {
  notes: NoteMeta[]
  activeId: string | null
  canEdit: boolean
  sortConfig: SortConfig
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => Promise<string | null>
  onDelete: (id: string) => void
  onNewNote: (parentId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onMove: (id: string, parentId: string | null, sortOrder?: number) => void
}

export default function SidebarFileTree({
  notes, activeId, canEdit, sortConfig,
  onSelect, onRename, onDelete, onNewNote, onNewFolder, onMove,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<string | null | undefined>(undefined)
  const lastDropZoneRef = useRef<string | null | undefined>(undefined)
  const [insertionPoint, setInsertionPoint] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeId) return
    const ancestors = getAncestorIds(notes, activeId)
    if (ancestors.size > 0) setExpanded(prev => new Set([...prev, ...ancestors]))
  }, [activeId, notes])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const handleDelete = useCallback((id: string, isFolder: boolean, childCount: number) => {
    if (isFolder && childCount > 0) {
      const note = notes.find(n => n.id === id)
      if (!window.confirm(`Delete "${note?.title}" and all ${childCount} items inside?`)) return
    }
    onDelete(id)
  }, [notes, onDelete])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const tree = buildTree(notes, sortConfig)
  const visibleIds = flattenVisible(tree, expanded).map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
    setInsertionPoint(null)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(undefined); lastDropZoneRef.current = undefined
      setInsertionPoint(null); return
    }
    const overId = over.id as string
    const overNote = notes.find(n => n.id === overId)

    if (overNote?.isFolder) {
      setInsertionPoint(null)
      const newZone = overNote.id
      if (newZone !== lastDropZoneRef.current) {
        if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
        setDropZone(newZone); lastDropZoneRef.current = newZone
        if (!expanded.has(newZone)) {
          overFolderTimer.current = setTimeout(() => {
            setExpanded(prev => new Set([...prev, newZone]))
            overFolderTimer.current = null
          }, 600)
        }
      }
    } else {
      const translated = active.rect.current.translated
      if (translated) {
        const activeCenter = translated.top + translated.height / 2
        const overCenter = over.rect.top + over.rect.height / 2
        const position: 'before' | 'after' = activeCenter < overCenter ? 'before' : 'after'
        setInsertionPoint(prev =>
          prev?.id === overId && prev.position === position ? prev : { id: overId, position }
        )
      }
      const parentZone = overNote?.parentId ?? null
      if (parentZone !== lastDropZoneRef.current) {
        if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
        setDropZone(parentZone); lastDropZoneRef.current = parentZone
      }
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const ip = insertionPoint
    setDraggingId(null); setDropZone(undefined); lastDropZoneRef.current = undefined
    setInsertionPoint(null)
    if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const dragged = notes.find(n => n.id === draggedId)
    if (!dragged) return

    const overNote = notes.find(n => n.id === (over.id as string))
    let targetParentId: string | null
    let targetSortOrder: number | undefined

    if (overNote?.isFolder) {
      targetParentId = overNote.id
    } else if (ip) {
      const anchor = notes.find(n => n.id === ip.id)
      targetParentId = anchor?.parentId ?? null
      const siblings = notes
        .filter(n => (n.parentId ?? null) === targetParentId && n.id !== draggedId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      const idx = siblings.findIndex(n => n.id === ip.id)
      if (idx !== -1) {
        if (ip.position === 'before') {
          const prev = siblings[idx - 1]; const curr = siblings[idx]
          targetSortOrder = prev ? (prev.sortOrder + curr.sortOrder) / 2 : curr.sortOrder - 500
        } else {
          const curr = siblings[idx]; const next = siblings[idx + 1]
          targetSortOrder = next ? (curr.sortOrder + next.sortOrder) / 2 : curr.sortOrder + 500
        }
      }
    } else {
      targetParentId = computeDropZone(over.id as string, notes)
    }

    if (dragged.isFolder && targetParentId !== null) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => { for (const n of notes) { if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) } } }
      collectDesc(draggedId)
      if (desc.has(targetParentId)) return
    }

    if ((dragged.parentId ?? null) === targetParentId && targetSortOrder === undefined) return
    onMove(draggedId, targetParentId, targetSortOrder)
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null
  const insertLine = <div className="h-0.5 bg-primary mx-1 my-px rounded-full pointer-events-none" />

  const renderNode = (node: NoteNode): React.ReactNode => {
    const isExpanded = expanded.has(node.id)
    const isFolderTarget = dropZone === node.id && node.isFolder
    const insertBefore = insertionPoint?.id === node.id && insertionPoint.position === 'before'
    const insertAfter = insertionPoint?.id === node.id && insertionPoint.position === 'after'

    const item = (
      <SidebarItem
        key={node.id}
        note={node}
        depth={node.depth}
        isActive={node.id === activeId}
        isExpanded={isExpanded}
        canEdit={canEdit}
        onSelect={onSelect}
        onToggle={toggle}
        onRename={onRename}
        onDelete={handleDelete}
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        childCount={countDescendants(notes, node.id)}
      />
    )

    if (!node.isFolder) {
      return (
        <React.Fragment key={node.id}>
          {insertBefore && insertLine}
          {item}
          {insertAfter && insertLine}
        </React.Fragment>
      )
    }

    return (
      <div
        key={`zone-${node.id}`}
        className={`rounded-md transition-colors ${isFolderTarget ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : ''}`}
      >
        {insertBefore && insertLine}
        {item}
        {isExpanded && node.children.map(child => renderNode(child))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <SortableContext items={visibleIds}>
        {tree.map(node => renderNode(node))}
      </SortableContext>
      <DragOverlay>
        {draggingNote && (
          <div className="px-2 py-1 rounded bg-card text-foreground text-[13px] opacity-90 border border-[#45475a]">
            {draggingNote.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/sidebar/SidebarFileTree.tsx
git commit -m "refactor(sidebar): extract SidebarFileTree component"
```

---

## Task 9: Refactor `Sidebar.tsx` into a thin shell

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`

Replace the entire file with a thin shell that composes `SidebarHeader`, `SidebarFileTree`, and `SidebarImages`.

- [ ] **Step 1: Replace `Sidebar.tsx`**

```tsx
// apps/web/src/components/Sidebar.tsx
import { useState, useCallback } from 'react'
import type { NoteMeta, ImageMeta } from '@websidian/shared'
import { loadSortConfig, SORT_STORAGE_KEY, type SortConfig } from '@/lib/sidebarTree'
import SidebarHeader from './sidebar/SidebarHeader'
import SidebarFileTree from './sidebar/SidebarFileTree'
import SidebarImages from './sidebar/SidebarImages'

interface Props {
  notes: NoteMeta[]
  activeId: string | null
  canEdit: boolean
  onSelect: (id: string) => void
  onNewNote: (parentId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onRename: (id: string, title: string) => Promise<string | null>
  onDelete: (id: string) => void
  onMove: (id: string, parentId: string | null, sortOrder?: number) => void
  onUploadImage: (file: File) => Promise<ImageMeta | null>
  onImportNotes: (files: FileList) => Promise<number>
  onImportVault: (source: FileSystemDirectoryHandle | FileList) => Promise<{ notes: number; images: number }>
  images: ImageMeta[]
  selectedImageId: string | null
  onSelectImage: (image: ImageMeta) => void
  onRenameImage: (id: string, filename: string) => void
  onDeleteImage: (id: string) => Promise<boolean>
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
  onUploadImage, onImportNotes, onImportVault,
  images, selectedImageId, onSelectImage, onRenameImage, onDeleteImage,
}: Props) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)

  const handleSortChange = useCallback((config: SortConfig) => {
    setSortConfig(config)
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(config))
  }, [])

  return (
    <aside className="p-2 text-foreground flex-1 overflow-y-auto min-h-0">
      <SidebarHeader
        canEdit={canEdit}
        sortConfig={sortConfig}
        onSortChange={handleSortChange}
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        onUploadImage={onUploadImage}
        onImportNotes={onImportNotes}
        onImportVault={onImportVault}
      />
      <SidebarFileTree
        notes={notes}
        activeId={activeId}
        canEdit={canEdit}
        sortConfig={sortConfig}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        onMove={onMove}
      />
      <SidebarImages
        images={images}
        selectedImageId={selectedImageId}
        canEdit={canEdit}
        onSelectImage={onSelectImage}
        onRenameImage={onRenameImage}
        onDeleteImage={onDeleteImage}
      />
    </aside>
  )
}
```

Note: `App.tsx` currently passes `onDelete` as `id => { deleteNote(id); if (activeId === id) setActiveId(null) }`. The new `Sidebar` interface changes `onDelete` from `(id: string, isFolder: boolean, childCount: number) => void` (the old wrapped version) to `(id: string) => void` (plain delete). Update the `App.tsx` call site accordingly — the old `onDelete` prop already matched `(id: string) => void` from App's perspective.

- [ ] **Step 2: Verify the app compiles and sidebar works**

Run `pnpm --filter @websidian/web typecheck`. Then `pnpm dev` and test: create a note, rename it, drag it, delete it, import an image. All should work identically to before.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx
git commit -m "refactor(sidebar): collapse Sidebar.tsx into thin shell"
```

---

## Task 10: `lib/markdown-toolbar.ts`

**Files:**
- Create: `apps/web/src/lib/markdown-toolbar.ts`

- [ ] **Step 1: Create the formatter library**

```ts
// apps/web/src/lib/markdown-toolbar.ts
import { EditorView } from '@codemirror/view'

export type FormatAction = 'bold' | 'italic' | 'heading' | 'wikilink' | 'link' | 'code' | 'divider'

export function formatMarkdown(view: EditorView, action: FormatAction): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  switch (action) {
    case 'bold': {
      const text = selected || 'bold text'
      view.dispatch({
        changes: { from, to, insert: `**${text}**` },
        selection: { anchor: from + 2, head: from + 2 + text.length },
      })
      break
    }
    case 'italic': {
      const text = selected || 'italic text'
      view.dispatch({
        changes: { from, to, insert: `*${text}*` },
        selection: { anchor: from + 1, head: from + 1 + text.length },
      })
      break
    }
    case 'heading': {
      const line = view.state.doc.lineAt(from)
      const lineText = view.state.sliceDoc(line.from, line.to)
      if (lineText.startsWith('# ')) {
        view.dispatch({ changes: { from: line.from, to: line.from + 2, insert: '' } })
      } else {
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '# ' } })
      }
      break
    }
    case 'wikilink': {
      const text = selected || 'note name'
      view.dispatch({
        changes: { from, to, insert: `[[${text}]]` },
        selection: { anchor: from + 2, head: from + 2 + text.length },
      })
      break
    }
    case 'link': {
      if (selected) {
        view.dispatch({
          changes: { from, to, insert: `[${selected}](url)` },
          selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
        })
      } else {
        view.dispatch({
          changes: { from, to, insert: '[text](url)' },
          selection: { anchor: from + 1, head: from + 5 },
        })
      }
      break
    }
    case 'code': {
      const text = selected || 'code'
      view.dispatch({
        changes: { from, to, insert: `\`${text}\`` },
        selection: { anchor: from + 1, head: from + 1 + text.length },
      })
      break
    }
    case 'divider': {
      const lineEnd = view.state.doc.lineAt(from).to
      view.dispatch({ changes: { from: lineEnd, to: lineEnd, insert: '\n---\n' } })
      break
    }
  }
  view.focus()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/markdown-toolbar.ts
git commit -m "feat(mobile): add markdown formatting toolbar lib"
```

---

## Task 11: `MarkdownToolbar` component

**Files:**
- Create: `apps/web/src/components/MarkdownToolbar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/MarkdownToolbar.tsx
import type { EditorView } from '@codemirror/view'
import { Bold, Italic, Heading1, Link, Code, Minus } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { Toolbar, ToolbarSeparator } from '@/components/ui/toolbar'
import { formatMarkdown, type FormatAction } from '@/lib/markdown-toolbar'

interface ToolbarItem { action: FormatAction; icon: React.ReactNode; label: string }

const ITEMS: ToolbarItem[] = [
  { action: 'bold',     icon: <Bold className="w-4 h-4" />,    label: 'Bold' },
  { action: 'italic',   icon: <Italic className="w-4 h-4" />,  label: 'Italic' },
  { action: 'heading',  icon: <Heading1 className="w-4 h-4" />, label: 'Heading' },
  { action: 'wikilink', icon: <span className="text-xs font-mono font-bold">[[</span>, label: 'Wikilink' },
  { action: 'link',     icon: <Link className="w-4 h-4" />,    label: 'Link' },
  { action: 'code',     icon: <Code className="w-4 h-4" />,    label: 'Code' },
  { action: 'divider',  icon: <Minus className="w-4 h-4" />,   label: 'Divider' },
]

interface Props { view: EditorView | null }

export default function MarkdownToolbar({ view }: Props) {
  const { isMobile, isTablet, isPortrait } = useBreakpoint()
  if (!view || (!isMobile && !(isTablet && isPortrait))) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-2 py-1 flex items-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Toolbar className="flex-1 justify-around">
        {ITEMS.map((item, i) => (
          <button
            key={item.action}
            aria-label={item.label}
            onPointerDown={e => {
              e.preventDefault()
              if (view) formatMarkdown(view, item.action)
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {item.icon}
          </button>
        ))}
      </Toolbar>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/MarkdownToolbar.tsx
git commit -m "feat(mobile): add MarkdownToolbar component"
```

---

## Task 12: Wire MarkdownToolbar into Editor

**Files:**
- Modify: `apps/web/src/components/Editor.tsx`
- Modify: `apps/web/src/App.tsx`

`Editor` gets an `onReady` callback so the parent can hold a reference to the `EditorView` and pass it to `MarkdownToolbar`. The editor container gains a `className` prop for padding-bottom on mobile.

- [ ] **Step 1: Update `Editor.tsx`**

```tsx
// apps/web/src/components/Editor.tsx
import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { type Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { buildExtensions } from '../lib/codemirror'

interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick?: (title: string) => void
  onReady?: (view: EditorView | null) => void
  className?: string
}

export default function Editor({ yText, awareness, onWikilinkClick, onReady, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const undoManager = new Y.UndoManager(yText)
    let view: EditorView
    try {
      view = new EditorView({
        state: EditorState.create({
          doc: yText.toString(),
          extensions: [
            ...buildExtensions(onWikilinkClick),
            yCollab(yText, awareness, { undoManager }),
            keymap.of(yUndoManagerKeymap),
          ],
        }),
        parent: containerRef.current,
      })
    } catch (e) { undoManager.destroy(); throw e }
    viewRef.current = view
    onReady?.(view)
    return () => {
      onReady?.(null)
      ;(view as any).dispatch = () => {}
      view.destroy()
      viewRef.current = null
      undoManager.destroy()
    }
  }, [yText, awareness])

  return <div ref={containerRef} className={`flex-1 h-full overflow-auto ${className ?? ''}`} />
}
```

- [ ] **Step 2: Add `editorView` state and `MarkdownToolbar` to `App.tsx`**

Add these imports near the top of `App.tsx`:
```tsx
import { type EditorView } from '@codemirror/view'
import MarkdownToolbar from './components/MarkdownToolbar'
import { useBreakpoint } from './hooks/useBreakpoint'
```

Inside the `App` component, add:
```tsx
const [editorView, setEditorView] = useState<EditorView | null>(null)
const { isMobile, isTablet, isPortrait } = useBreakpoint()
const showMobileToolbar = isMobile || (isTablet && isPortrait)
```

Update the `<Editor>` usage in the JSX to pass `onReady` and a `className` for bottom padding:
```tsx
<Editor
  yText={yText}
  awareness={awareness}
  onWikilinkClick={handleWikilinkClick}
  onReady={setEditorView}
  className={showMobileToolbar ? 'pb-14' : ''}
/>
```

Add `<MarkdownToolbar view={editorView} />` just before the closing `</TooltipProvider>` tag.

- [ ] **Step 3: Verify**

Run `pnpm dev`. On a narrow viewport (DevTools mobile simulation), open a note in edit mode. The toolbar should appear at the bottom. Tap **B** — `**bold text**` should be inserted. Tap **[[** — `[[note name]]` should appear. Verify it does not render on desktop.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Editor.tsx apps/web/src/App.tsx
git commit -m "feat(mobile): wire MarkdownToolbar into Editor"
```

---

## Task 13: Responsive `NoteGraph`

**Files:**
- Modify: `apps/web/src/components/NoteGraph.tsx`

Make the graph fill the available screen on mobile instead of using hardcoded `1000×700`. Also make the modal use the full screen on mobile.

- [ ] **Step 1: Update `NoteGraph.tsx`**

```tsx
// apps/web/src/components/NoteGraph.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import type { NoteMeta, LinkEdge } from '@websidian/shared'
import { X } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props { notes: NoteMeta[]; projectId: string; token: string | null; onSelect: (id: string) => void; onClose: () => void }

export default function NoteGraph({ notes, projectId, token, onSelect, onClose }: Props) {
  const [links, setLinks] = useState<LinkEdge[]>([])
  const { isMobile, isTablet } = useBreakpoint()

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/graph`, { headers })
      .then(r => r.ok ? r.json() : []).then(setLinks).catch(() => {})
  }, [projectId, token])

  const graphWidth = isMobile
    ? window.innerWidth - 16
    : isTablet ? Math.min(window.innerWidth - 48, 800)
    : 1000
  const graphHeight = isMobile
    ? window.innerHeight - 80
    : isTablet ? Math.min(window.innerHeight - 80, 600)
    : 700

  const nodesKey = notes.map(n => `${n.id}:${n.title}`).join('\n')
  const linksKey = links.map(l => `${l.sourceId}>${l.targetId}`).join('\n')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graphData = useMemo(() => {
    const nodeIds = new Set(notes.map(n => n.id))
    const validLinks = links.filter(l => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId))
    const linkCount = new Map<string, number>()
    for (const l of validLinks) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1)
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1)
    }
    return {
      nodes: notes.map(n => ({ id: n.id, name: n.title, val: 3 + (linkCount.get(n.id) ?? 0) * 0.66 })),
      links: validLinks.map(l => ({ source: l.sourceId, target: l.targetId })),
    }
  }, [nodesKey, linksKey])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-400).distanceMax(150)
    fg.d3Force('center')?.strength(0.1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('collide', forceCollide((node: any) => Math.sqrt((node.val ?? 1) * 4) + 25))
    fg.d3ReheatSimulation()
  }, [graphData])

  const handleClick = useCallback((node: { id?: string | number }) => {
    if (node.id) onSelect(String(node.id))
  }, [onSelect])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300]">
      <div className="relative bg-background rounded-lg overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2.5 right-3.5 z-10 bg-transparent border-none text-muted-foreground cursor-pointer hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={() => '#89b4fa'}
          nodeRelSize={4}
          linkColor={() => '#45475a'}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          backgroundColor="#1e1e2e"
          onNodeClick={handleClick}
          cooldownTicks={400}
          warmupTicks={50}
          width={graphWidth}
          height={graphHeight}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run `pnpm dev`. Open the graph view in DevTools mobile simulation. Confirm the graph fills the screen rather than being clipped. Pinch-to-zoom and pan should work (handled natively by the ForceGraph2D canvas + D3 zoom).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/NoteGraph.tsx
git commit -m "feat(mobile): make NoteGraph responsive"
```

---

## Task 14: Extract `TopBar`

**Files:**
- Create: `apps/web/src/components/TopBar.tsx`
- Modify: `apps/web/src/App.tsx`

Extract the `<header>` from `App.tsx` into a standalone component. Add an `onOpenDrawer` prop (hamburger button, mobile-only) and accept `isMobile`/`isTablet`/`isPortrait` from the caller.

- [ ] **Step 1: Create `apps/web/src/components/TopBar.tsx`**

```tsx
// apps/web/src/components/TopBar.tsx
import { Settings, Hexagon, PencilLine, BookOpen, PanelRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ProjectSwitcher from './ProjectSwitcher'
import PresenceBar from './PresenceBar'
import type { Project } from '@websidian/shared'
import type { Awareness } from 'y-protocols/awareness'

interface Props {
  userName: string
  userImage: string | null
  activeProject: Project | null
  projects: Project[]
  token: string | null
  isOwnerOrAdmin: boolean
  canEdit: boolean
  activeId: string | null
  previewMode: boolean
  showLinks: boolean
  synced: boolean
  awareness: Awareness | null
  isMobile: boolean
  onOpenDrawer: () => void
  onSelectProject: (p: Project | null) => void
  onRefreshProjects: () => void
  onShowSettings: () => void
  onShowGraph: () => void
  onTogglePreview: () => void
  onToggleLinks: () => void
  onLogout: () => void
}

export default function TopBar({
  userName, userImage, activeProject, projects, token,
  isOwnerOrAdmin, canEdit, activeId, previewMode, showLinks, synced, awareness,
  isMobile, onOpenDrawer, onSelectProject, onRefreshProjects,
  onShowSettings, onShowGraph, onTogglePreview, onToggleLinks, onLogout,
}: Props) {
  return (
    <header className="h-10 flex items-center bg-[#181825] border-b border-border px-3 gap-3 shrink-0">
      {isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground shrink-0" onClick={onOpenDrawer}>
              <Menu className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open sidebar</TooltipContent>
        </Tooltip>
      )}

      {!isMobile && <span className="text-foreground font-bold shrink-0">Websidian</span>}

      {!isMobile && (
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          token={token}
          onSelect={onSelectProject}
          onRefreshProjects={onRefreshProjects}
        />
      )}

      {isMobile && activeProject && (
        <span className="text-foreground text-sm font-medium truncate flex-1">{activeProject.name}</span>
      )}

      {isOwnerOrAdmin && activeProject && !isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onShowSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Project settings</TooltipContent>
        </Tooltip>
      )}

      {activeProject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onShowGraph}>
              <Hexagon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Graph view</TooltipContent>
        </Tooltip>
      )}

      {activeId && canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onTogglePreview}>
              {previewMode ? <PencilLine className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}</TooltipContent>
        </Tooltip>
      )}

      {!isMobile && <PresenceBar awareness={awareness} />}
      {!isMobile && !synced && activeId && <span className="text-muted-foreground text-xs">syncing…</span>}

      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={`w-7 h-7 ${showLinks ? 'text-primary' : 'text-muted-foreground'}`} onClick={onToggleLinks}>
              <PanelRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle links panel</TooltipContent>
        </Tooltip>
        {!isMobile && userImage && <img src={userImage} alt={userName} className="w-[22px] h-[22px] rounded-full object-cover" />}
        {!isMobile && <span className="text-muted-foreground text-xs">{userName}</span>}
        <Button variant="outline" size="sm" className="h-6 text-xs text-muted-foreground" onClick={onLogout}>Sign out</Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "refactor: extract TopBar component from App"
```

---

## Task 15: Create `AppLayout`

**Files:**
- Create: `apps/web/src/components/AppLayout.tsx`

`AppLayout` handles the adaptive layout: drawer on mobile/portrait, persistent sidebar on landscape tablet/desktop.

- [ ] **Step 1: Create `apps/web/src/components/AppLayout.tsx`**

```tsx
// apps/web/src/components/AppLayout.tsx
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { Drawer, DrawerContent } from '@/components/ui/drawer'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
  linksPanel?: React.ReactNode
  showLinks: boolean
  isDrawerOpen: boolean
  onCloseDrawer: () => void
}

export default function AppLayout({
  sidebar, children, linksPanel,
  showLinks, isDrawerOpen, onCloseDrawer,
}: Props) {
  const { isMobile, isTablet, isPortrait } = useBreakpoint()
  const useDrawer = isMobile || (isTablet && isPortrait)

  return (
    <div className="flex flex-1 overflow-hidden">
      {useDrawer ? (
        <Drawer open={isDrawerOpen} onOpenChange={open => { if (!open) onCloseDrawer() }}>
          <DrawerContent>
            {sidebar}
          </DrawerContent>
        </Drawer>
      ) : (
        <div className="flex flex-col w-60 shrink-0 border-r border-border bg-background overflow-hidden">
          {sidebar}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>

      {linksPanel && (
        <div
          className="overflow-hidden shrink-0 transition-[width] duration-200"
          style={{ width: showLinks ? 260 : 0 }}
        >
          {linksPanel}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/AppLayout.tsx
git commit -m "feat(mobile): add AppLayout with adaptive drawer/sidebar"
```

---

## Task 16: Slim down `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

Replace the header and body JSX with `<TopBar />` and `<AppLayout />`. Add `isDrawerOpen` state. Remove the now-unused `Settings` import (moved to TopBar).

- [ ] **Step 1: Add imports and state to `App.tsx`**

Add at top:
```tsx
import TopBar from './components/TopBar'
import AppLayout from './components/AppLayout'
```

Remove from imports: `Settings, Hexagon, PencilLine, BookOpen, PanelRight` (now in TopBar). Keep `Button` if used elsewhere, otherwise remove.

Add inside the `App` component (alongside existing state):
```tsx
const [isDrawerOpen, setIsDrawerOpen] = useState(false)
```

- [ ] **Step 2: Replace the JSX body**

Replace the current `return (...)` block from `<TooltipProvider>` onwards with:

```tsx
return (
  <TooltipProvider>
    <div className="flex flex-col h-screen bg-background">
      <TopBar
        userName={userName}
        userImage={userImage}
        activeProject={activeProject}
        projects={projects}
        token={authToken}
        isOwnerOrAdmin={isOwnerOrAdmin}
        canEdit={canEdit}
        activeId={activeId}
        previewMode={previewMode}
        showLinks={showLinks}
        synced={synced}
        awareness={awareness}
        isMobile={isMobile}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onSelectProject={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
        onRefreshProjects={refreshProjects}
        onShowSettings={() => setShowSettings(true)}
        onShowGraph={() => setShowGraph(true)}
        onTogglePreview={() => setPreviewMode(m => !m)}
        onToggleLinks={() => setShowLinks(s => !s)}
        onLogout={handleLogout}
      />

      <AppLayout
        sidebar={
          <Sidebar
            notes={notes}
            activeId={activeId}
            canEdit={canEdit}
            onSelect={id => { setActiveId(id); setSelectedImage(null); setIsDrawerOpen(false) }}
            onNewNote={parentId => {
              if (!canEdit) return
              createNote('Untitled', { parentId }).then(note => { if (note?.id) { setActiveId(note.id); setSelectedImage(null) } })
              setPreviewMode(false)
              setIsDrawerOpen(false)
            }}
            onNewFolder={parentId => { if (!canEdit) return; createNote('New Folder', { parentId, isFolder: true }) }}
            onRename={(id, title) => renameNote(id, title)}
            onDelete={id => { deleteNote(id); if (activeId === id) setActiveId(null) }}
            onMove={(id, parentId, sortOrder) => moveNote(id, parentId, sortOrder)}
            onUploadImage={uploadImage}
            onImportNotes={importNotes}
            onImportVault={async source => {
              if (!activeProject || !authToken) return { notes: 0, images: 0 }
              const vault = source instanceof FileList
                ? await readVaultFromFileList(source)
                : await readVault(source)

              let importedNotes = 0
              if (vault.notes.length > 0) {
                const res = await fetch(`${API}/api/projects/${activeProject.id}/import/notes`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                  body: JSON.stringify({ notes: vault.notes }),
                })
                if (res.ok) importedNotes = vault.notes.filter(n => !n.isFolder).length
              }

              let importedImages = 0
              for (const { file } of vault.images) {
                const fd = new FormData()
                fd.append('file', file)
                const res = await fetch(`${API}/api/projects/${activeProject.id}/images`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${authToken}` },
                  body: fd,
                })
                if (res.ok) importedImages++
              }

              return { notes: importedNotes, images: importedImages }
            }}
            images={images}
            selectedImageId={selectedImage?.id ?? null}
            onSelectImage={img => { setSelectedImage(img); setActiveId(null) }}
            onRenameImage={async (id, filename) => {
              const ok = await renameImage(id, filename)
              if (ok && selectedImage?.id === id) setSelectedImage({ ...selectedImage, filename })
            }}
            onDeleteImage={async (id) => {
              const ok = await deleteImage(id)
              if (ok && selectedImage?.id === id) setSelectedImage(null)
              return ok
            }}
          />
        }
        linksPanel={
          <LinksPanel
            noteId={activeId}
            projectId={activeProject?.id ?? null}
            token={authToken}
            onSelect={id => { setActiveId(id); setSelectedImage(null) }}
          />
        }
        showLinks={showLinks}
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={() => setIsDrawerOpen(false)}
      >
        {selectedImage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <p className="text-muted-foreground text-xs mb-3">{selectedImage.filename}</p>
            <img
              src={`/api/projects/${selectedImage.projectId}/images/${selectedImage.id}`}
              alt={selectedImage.filename}
              className="max-w-full max-h-[80vh] rounded-md block"
            />
          </div>
        ) : activeId && yText ? (
          previewMode
            ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} images={images} />
            : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} onReady={setEditorView} className={showMobileToolbar ? 'pb-14' : ''} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
          </div>
        )}
      </AppLayout>

      {showSettings && activeProject && authToken && (
        <ProjectSettings project={activeProject} token={authToken} onClose={() => setShowSettings(false)}
          onUpdated={updates => setActiveProject({ ...activeProject, ...updates } as Project)} />
      )}
      {showGraph && activeProject && (
        <NoteGraph notes={notes} projectId={activeProject.id} token={authToken}
          onSelect={id => { setActiveId(id); setShowGraph(false) }} onClose={() => setShowGraph(false)} />
      )}
      {showSearch && activeProject && (
        <SearchModal projectId={activeProject.id} token={authToken} notes={notes}
          onSelect={id => { setActiveId(id); setSelectedImage(null); setShowSearch(false) }} onClose={() => setShowSearch(false)} />
      )}

      <MarkdownToolbar view={editorView} />
    </div>
  </TooltipProvider>
)
```

Also add to the `App` component (using the `useBreakpoint` hook added in Task 12):
```tsx
const { isMobile, isTablet, isPortrait } = useBreakpoint()
const showMobileToolbar = isMobile || (isTablet && isPortrait)
```

- [ ] **Step 3: Typecheck and verify**

Run `pnpm --filter @websidian/web typecheck`. Fix any errors.

Then run `pnpm dev` and test:
- Desktop (> 1200px): sidebar visible, header unchanged
- Tablet portrait (768px, portrait in DevTools): hamburger icon visible, tapping it slides in the sidebar drawer, selecting a note closes the drawer
- Mobile (375px): same as tablet portrait
- Tablet landscape: sidebar visible without drawer

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "refactor: slim App.tsx — use TopBar and AppLayout"
```

---

## Task 17: `SidebarItem` touch targets

**Files:**
- Modify: `apps/web/src/components/SidebarItem.tsx`

- [ ] **Step 1: Find the item's root element in `SidebarItem.tsx`**

Open `apps/web/src/components/SidebarItem.tsx`. Locate the element rendered by `useSortable`'s `setNodeRef` — typically the outermost `<div>` with the `listeners` and `attributes` spread. It should have a `className` containing something like `flex items-center`.

- [ ] **Step 2: Add `min-h-[44px]` to the item root**

Add `min-h-[44px]` to the className of that element. For example, if the current className includes `flex items-center gap-1 px-2 py-1`, change `py-1` to `py-0` and add `min-h-[44px]`. The goal is that the tap target is at least 44px tall on all screen sizes.

- [ ] **Step 3: Verify**

Run `pnpm dev`. In DevTools mobile simulation, confirm sidebar items are comfortably tappable with no text truncation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SidebarItem.tsx
git commit -m "feat(mobile): increase SidebarItem touch targets to 44px"
```

---

## Self-Review Notes

- `useBreakpoint` uses `window.matchMedia` which is undefined during SSR. This app is client-only (Vite SPA), so no issue.
- `formatMarkdown` uses `view.focus()` after each action — this re-focuses the editor so the virtual keyboard stays open.
- `MarkdownToolbar` uses `onPointerDown` + `e.preventDefault()` to prevent the tap from blurring the editor and dismissing the keyboard.
- `AppLayout` closes the drawer on `onOpenChange(false)` which catches both overlay-click and swipe-to-dismiss.
- The `Sidebar` interface change (`onDelete: (id: string) => void`) is backward-compatible — `App.tsx` already passes `id => { deleteNote(id); ... }` which matches the new signature.
- On `App.tsx` Task 16: make sure `isMobile` is derived from `useBreakpoint()` (added in Task 12). If it was added inline for Task 12, consolidate — only one `useBreakpoint()` call in `App.tsx`.
