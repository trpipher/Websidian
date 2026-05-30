import { useState, useEffect, useCallback, useRef } from 'react'
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
import type { NoteMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'
import SortMenu, { type SortConfig } from './SortMenu'

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
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const overFolderIdRef = useRef<string | null>(null)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sortAnchorRect, setSortAnchorRect] = useState<DOMRect | null>(null)
  const sortButtonRef = useRef<HTMLButtonElement>(null)
  const sortMenuJustClosed = useRef(false)

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

  const handleSortButtonClick = useCallback(() => {
    if (sortMenuJustClosed.current) return
    setSortAnchorRect(sortButtonRef.current?.getBoundingClientRect() ?? null)
    setShowSortMenu(prev => !prev)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(notes, sortConfig)
  const visible = flattenVisible(tree, expanded)
  const visibleIds = visible.map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = null
      setOverFolderId(null)
      overFolderIdRef.current = null
      return
    }
    const overNote = notes.find(n => n.id === over.id)
    if (overNote?.isFolder && over.id !== overFolderIdRef.current) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = setTimeout(() => {
        const fid = over.id as string
        setOverFolderId(fid)
        overFolderIdRef.current = fid
        setExpanded(prev => new Set([...prev, fid]))
      }, 600)
    } else if (!overNote?.isFolder) {
      // Don't clear if hovering over a child of the currently tracked folder —
      // dnd-kit shifts `over` to children after auto-expand, which would cancel the drop
      const ancestors = getAncestorIds(notes, over.id as string)
      if (!overFolderIdRef.current || !ancestors.has(overFolderIdRef.current)) {
        if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
        overFolderTimer.current = null
        setOverFolderId(null)
        overFolderIdRef.current = null
      }
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // Capture before clearing — state may be stale in closure if onDragOver cleared it
    const targetFolderId = overFolderIdRef.current
    setDraggingId(null)
    setOverFolderId(null)
    overFolderIdRef.current = null
    if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
    overFolderTimer.current = null

    if (!over || active.id === over.id || !targetFolderId) return

    const draggedId = active.id as string
    const dragged = notes.find(n => n.id === draggedId)
    if (!dragged) return

    // Prevent moving folder into its own descendant
    if (dragged.isFolder) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => {
        for (const n of notes) {
          if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) }
        }
      }
      collectDesc(draggedId)
      if (desc.has(targetFolderId)) return
    }

    onMove(draggedId, targetFolderId)
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

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

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds}>
          {visible.map(note => (
            <SidebarItem
              key={note.id}
              note={note}
              depth={note.depth}
              isActive={note.id === activeId}
              isExpanded={expanded.has(note.id)}
              canEdit={canEdit}
              onSelect={onSelect}
              onToggle={toggle}
              onRename={onRename}
              onDelete={handleDelete}
              onNewNote={onNewNote}
              onNewFolder={onNewFolder}
              childCount={countDescendants(notes, note.id)}
            />
          ))}
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
