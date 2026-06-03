import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import type { NoteMeta, ImageMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Image as ImageIcon, ChevronDown } from 'lucide-react'

// ── Sort types (previously in SortMenu.tsx) ───────────────────────────────────
export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export interface SortConfig { by: SortField; direction: SortDirection }

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

const SORT_STORAGE_KEY = 'ws-sidebar-sort'
function loadSortConfig(): SortConfig {
  try { return JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? '') }
  catch { return { by: 'title', direction: 'asc' } }
}

// ── Tree helpers ──────────────────────────────────────────────────────────────
interface NoteNode extends NoteMeta { children: NoteNode[]; depth: number }

function buildTree(notes: NoteMeta[], sort: SortConfig): NoteNode[] {
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

function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  const visit = (node: NoteNode) => {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const map = new Map(notes.map(n => [n.id, n]))
  const ancestors = new Set<string>()
  let cur = map.get(id)
  while (cur?.parentId) { ancestors.add(cur.parentId); cur = map.get(cur.parentId) }
  return ancestors
}

function computeDropZone(overId: string, notes: NoteMeta[]): string | null {
  const note = notes.find(n => n.id === overId)
  return note?.isFolder ? note.id : (note?.parentId ?? null)
}

function countDescendants(notes: NoteMeta[], id: string): number {
  let count = 0
  const visit = (parentId: string) => {
    for (const n of notes) { if (n.parentId === parentId) { count++; if (n.isFolder) visit(n.id) } }
  }
  visit(id)
  return count
}

// ── Props ─────────────────────────────────────────────────────────────────────
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
  onUploadImage: (file: File) => Promise<ImageMeta | null>
  onImportNotes: (files: FileList) => Promise<number>
  onImportVault: (source: FileSystemDirectoryHandle | FileList) => Promise<{ notes: number; images: number }>
  images: ImageMeta[]
  selectedImageId: string | null
  onSelectImage: (image: ImageMeta) => void
  onRenameImage: (id: string, filename: string) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove, onUploadImage, onImportNotes, onImportVault,
  images, selectedImageId, onSelectImage, onRenameImage,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<string | null | undefined>(undefined)
  const lastDropZoneRef = useRef<string | null | undefined>(undefined)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)
  const [copiedImage, setCopiedImage] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [vaultImportResult, setVaultImportResult] = useState<{ notes: number; images: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [imageRenameValue, setImageRenameValue] = useState('')
  const imageRenameInputRef = useRef<HTMLInputElement>(null)

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

  const handleSortChange = useCallback((config: SortConfig) => {
    setSortConfig(config)
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(config))
  }, [])

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const tree = buildTree(notes, sortConfig)
  const visibleIds = flattenVisible(tree, expanded).map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => setDraggingId(active.id as string)

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(undefined); lastDropZoneRef.current = undefined; return
    }
    const newZone = computeDropZone(over.id as string, notes)
    if (newZone !== lastDropZoneRef.current) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(newZone); lastDropZoneRef.current = newZone
      if (newZone !== null && !expanded.has(newZone)) {
        overFolderTimer.current = setTimeout(() => {
          setExpanded(prev => new Set([...prev, newZone]))
          overFolderTimer.current = null
        }, 600)
      }
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null); setDropZone(undefined); lastDropZoneRef.current = undefined
    if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
    if (!over || active.id === over.id) return
    const draggedId = active.id as string
    const dragged = notes.find(n => n.id === draggedId)
    if (!dragged) return
    const targetId = computeDropZone(over.id as string, notes)
    if (dragged.isFolder && targetId !== null) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => { for (const n of notes) { if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) } } }
      collectDesc(draggedId)
      if (desc.has(targetId)) return
    }
    if ((dragged.parentId ?? null) === targetId) return
    onMove(draggedId, targetId)
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

  const renderNode = (node: NoteNode): React.ReactNode => {
    const isExpanded = expanded.has(node.id)
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
    if (!node.isFolder) return item
    return (
      <div
        key={`zone-${node.id}`}
        className={`rounded-md transition-colors ${dropZone === node.id ? 'bg-primary/10' : ''}`}
      >
        {item}
        {isExpanded && node.children.map(child => renderNode(child))}
      </div>
    )
  }

  return (
    <aside className="p-2 text-foreground flex-1 overflow-y-auto min-h-0">
      {/* Notes header row */}
      <div className="flex items-center mb-2 px-1">
        <span className="font-bold text-[13px] text-muted-foreground flex-1">Notes</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="bg-transparent border-none text-muted-foreground cursor-pointer text-sm px-1 py-px leading-none hover:text-foreground"
              title="Sort notes"
              aria-label="Sort notes"
            >
              ⇅
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground tracking-wide">SORT BY</DropdownMenuLabel>
            {SORT_FIELDS.map(({ field, label }) => (
              <DropdownMenuItem
                key={field}
                onClick={() => handleSortChange({
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

      {/* Action buttons */}
      {canEdit && (
        <>
          <div className="flex gap-1 mb-2">
            {/* New dropdown */}
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

            {/* Import dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 flex-1 py-0.5 px-2 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80 justify-center">
                  Import <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>Image</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => notesInputRef.current?.click()}>Markdown files</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  let source: FileSystemDirectoryHandle | FileList | null = null
                  if ('showDirectoryPicker' in window) {
                    try { source = await (window as any).showDirectoryPicker({ mode: 'read' }) }
                    catch { return }
                  } else {
                    folderInputRef.current?.click()
                    return
                  }
                  if (!source) return
                  const result = await onImportVault(source)
                  setVaultImportResult(result)
                  setTimeout(() => setVaultImportResult(null), 4000)
                }}>Folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Feedback */}
          {copiedImage && <p className="text-[11px] text-ctp-green mb-1 px-1">Image copied to clipboard!</p>}
          {importedCount !== null && <p className="text-[11px] text-ctp-green mb-1 px-1">Imported {importedCount} note{importedCount !== 1 ? 's' : ''}!</p>}
          {vaultImportResult !== null && (
            <p className="text-[11px] text-ctp-green mb-1 px-1">
              Imported {vaultImportResult.notes} note{vaultImportResult.notes !== 1 ? 's' : ''}
              {vaultImportResult.images > 0 ? ` + ${vaultImportResult.images} image${vaultImportResult.images !== 1 ? 's' : ''}` : ''}!
            </p>
          )}

          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <input
            ref={notesInputRef}
            type="file"
            accept=".md,.markdown"
            multiple
            className="hidden"
            onChange={async e => {
              if (!e.target.files?.length) return
              const count = await onImportNotes(e.target.files)
              e.target.value = ''
              setImportedCount(count)
              setTimeout(() => setImportedCount(null), 3000)
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
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

      {/* Note tree */}
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

      {/* Images section */}
      {images.length > 0 && (
        <div className="mt-3">
          <div className="px-1 mb-1">
            <span className="font-bold text-[13px] text-muted-foreground">Images</span>
          </div>
          {images.map(img => {
            const isRenaming = renamingImageId === img.id
            const commitImageRename = () => {
              const trimmed = imageRenameValue.trim()
              if (trimmed && trimmed !== img.filename) onRenameImage(img.id, trimmed)
              setRenamingImageId(null)
            }
            const startRename = () => {
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
                        onBlur={commitImageRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitImageRename()
                          if (e.key === 'Escape') setRenamingImageId(null)
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
                  </ContextMenuContent>
                )}
              </ContextMenu>
            )
          })}
        </div>
      )}
    </aside>
  )
}
