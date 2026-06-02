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
import SortMenu, { type SortConfig } from './SortMenu'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'

const SORT_STORAGE_KEY = 'ws-sort-config'
const DEFAULT_SORT: SortConfig = { by: 'title', direction: 'asc' }

function loadSortConfig(): SortConfig {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return DEFAULT_SORT
    const parsed = JSON.parse(raw) as Partial<SortConfig>
    const validFields = ['title', 'createdAt', 'updatedAt']
    const validDirs = ['asc', 'desc']
    if (validFields.includes(parsed.by ?? '') && validDirs.includes(parsed.direction ?? '')) {
      return parsed as SortConfig
    }
  } catch { /* ignore */ }
  return DEFAULT_SORT
}

function sortNotes(items: NoteMeta[], config: SortConfig): NoteMeta[] {
  const folders = items.filter(n => n.isFolder)
  const notes = items.filter(n => !n.isFolder)

  const compare = (a: NoteMeta, b: NoteMeta): number => {
    if (config.by === 'title') {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    }
    const aVal = config.by === 'createdAt' ? a.createdAt : a.updatedAt
    const bVal = config.by === 'createdAt' ? b.createdAt : b.updatedAt
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
  }

  const sortedFolders = [...folders].sort(compare)
  const sortedNotes = [...notes].sort(compare)

  if (config.direction === 'desc') {
    sortedFolders.reverse()
    sortedNotes.reverse()
  }

  return [...sortedFolders, ...sortedNotes]
}

// Zone = folder to drop into (null = root). Derived purely from the over item.
function computeDropZone(overId: string, notes: NoteMeta[]): string | null {
  const over = notes.find(n => n.id === overId)
  if (!over) return null
  return over.isFolder ? overId : (over.parentId ?? null)
}

interface NoteNode extends NoteMeta {
  children: NoteNode[]
  depth: number
}

function buildTree(notes: NoteMeta[], config: SortConfig, parentId: string | null = null, depth = 0): NoteNode[] {
  const children = notes.filter(n => (n.parentId ?? null) === parentId)
  const sorted = sortNotes(children, config)
  return sorted.map(n => ({ ...n, depth, children: buildTree(notes, config, n.id, depth + 1) }))
}

function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) {
      result.push(...flattenVisible(node.children, expanded))
    }
  }
  return result
}

function countDescendants(notes: NoteMeta[], id: string): number {
  const children = notes.filter(n => n.parentId === id)
  return children.reduce((acc, c) => acc + 1 + countDescendants(notes, c.id), 0)
}

function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const ancestors = new Set<string>()
  let current = notes.find(n => n.id === id)
  while (current?.parentId) {
    ancestors.add(current.parentId)
    current = notes.find(n => n.id === current!.parentId)
  }
  return ancestors
}

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
  images: ImageMeta[]
  selectedImageId: string | null
  onSelectImage: (image: ImageMeta) => void
  onRenameImage: (id: string, filename: string) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove, onUploadImage,
  images, selectedImageId, onSelectImage, onRenameImage,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // undefined = not dragging; null = root zone; string = folder zone
  const [dropZone, setDropZone] = useState<string | null | undefined>(undefined)
  const lastDropZoneRef = useRef<string | null | undefined>(undefined)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)
  const sortMenuJustClosed = useRef(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [imageRenameValue, setImageRenameValue] = useState('')
  const [imageMenu, setImageMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const imageRenameInputRef = useRef<HTMLInputElement>(null)

  // Auto-expand ancestors of the active note
  useEffect(() => {
    if (!activeId) return
    const ancestors = getAncestorIds(notes, activeId)
    if (ancestors.size > 0) {
      setExpanded(prev => new Set([...prev, ...ancestors]))
    }
  }, [activeId, notes])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
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

  const handleCloseSortMenu = useCallback(() => {
    setShowSortMenu(false)
    sortMenuJustClosed.current = true
    setTimeout(() => { sortMenuJustClosed.current = false }, 0)
    sortButtonRef.current?.focus()
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

  const handleSortButtonClick = useCallback(() => {
    if (sortMenuJustClosed.current) return
    setSortAnchorRect(sortButtonRef.current?.getBoundingClientRect() ?? null)
    setShowSortMenu(prev => !prev)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(notes, sortConfig)
  const visibleIds = flattenVisible(tree, expanded).map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(undefined)
      lastDropZoneRef.current = undefined
      return
    }
    const newZone = computeDropZone(over.id as string, notes)
    if (newZone !== lastDropZoneRef.current) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(newZone)
      lastDropZoneRef.current = newZone
      // Auto-expand collapsed folder target after a short delay
      if (newZone !== null && !expanded.has(newZone)) {
        overFolderTimer.current = setTimeout(() => {
          setExpanded(prev => new Set([...prev, newZone]))
          overFolderTimer.current = null
        }, 600)
      }
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setDropZone(undefined)
    lastDropZoneRef.current = undefined
    if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }

    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const dragged = notes.find(n => n.id === draggedId)
    if (!dragged) return

    const targetId = computeDropZone(over.id as string, notes)

    // Prevent moving folder into its own descendant
    if (dragged.isFolder && targetId !== null) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => {
        for (const n of notes) { if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) } }
      }
      collectDesc(draggedId)
      if (desc.has(targetId)) return
    }

    if ((dragged.parentId ?? null) === targetId) return  // already there

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
        style={{
          background: dropZone === node.id ? 'rgba(137, 180, 250, 0.12)' : 'transparent',
          borderRadius: 6,
        }}
      >
        {item}
        {isExpanded && node.children.map(child => renderNode(child))}
      </div>
    )
  }

  return (
    <aside style={{ padding: 8, color: '#cdd6f4', flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#6c7086', flex: 1 }}>Notes</span>
        <button
          ref={sortButtonRef}
          onClick={handleSortButtonClick}
          title="Sort notes"
          aria-label="Sort notes"
          aria-haspopup="menu"
          aria-expanded={showSortMenu}
          style={{
            background: 'none',
            border: 'none',
            color: showSortMenu ? '#89b4fa' : '#6c7086',
            cursor: 'pointer',
            fontSize: 14,
            padding: '1px 4px',
            lineHeight: 1,
          }}
        >
          ⇅
        </button>
      </div>
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

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds}>
          {tree.map(node => renderNode(node))}
        </SortableContext>

        <DragOverlay>
          {draggingNote && (
            <div style={{
              padding: '4px 8px',
              borderRadius: 4,
              background: '#313244',
              fontSize: 13,
              color: '#cdd6f4',
              opacity: 0.9,
              border: '1px solid #45475a',
            }}>
              {draggingNote.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {images.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '0 4px', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#6c7086' }}>Images</span>
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
            const imageMenuItems: ContextMenuItem[] = [
              { label: 'Rename', onClick: startRename },
            ]
            return (
              <div key={img.id}>
                <div
                  onClick={() => { if (!isRenaming) onSelectImage(img) }}
                  onContextMenu={e => { if (!canEdit) return; e.preventDefault(); setImageMenu({ id: img.id, x: e.clientX, y: e.clientY }) }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#cdd6f4',
                    background: selectedImageId === img.id ? '#313244' : 'transparent',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={img.filename}
                >
                  <span style={{ flexShrink: 0 }}>🖼</span>
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
                      style={{
                        flex: 1,
                        background: '#313244',
                        border: '1px solid #89b4fa',
                        borderRadius: 3,
                        color: '#cdd6f4',
                        fontSize: 13,
                        padding: '1px 4px',
                      }}
                    />
                  ) : (
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.filename}
                    </span>
                  )}
                </div>
                {imageMenu?.id === img.id && (
                  <ContextMenu
                    x={imageMenu.x}
                    y={imageMenu.y}
                    items={imageMenuItems}
                    onClose={() => setImageMenu(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {showSortMenu && sortAnchorRect && (
        <SortMenu
          config={sortConfig}
          anchorRect={sortAnchorRect}
          onChange={handleSortChange}
          onClose={handleCloseSortMenu}
        />
      )}
    </aside>
  )
}
