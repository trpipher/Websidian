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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { NoteMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'

interface NoteNode extends NoteMeta {
  children: NoteNode[]
  depth: number
}

function buildTree(notes: NoteMeta[], parentId: string | null = null, depth = 0): NoteNode[] {
  return notes
    .filter(n => (n.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(n => ({ ...n, depth, children: buildTree(notes, n.id, depth + 1) }))
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
  onMove: (id: string, parentId: string | null, sortOrder: number) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(notes)
  const visible = flattenVisible(tree, expanded)
  const visibleIds = visible.map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) { setOverFolderId(null); return }
    const overNote = notes.find(n => n.id === over.id)
    if (overNote?.isFolder && over.id !== overFolderId) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = setTimeout(() => {
        setOverFolderId(over.id as string)
        setExpanded(prev => new Set([...prev, over.id as string]))
      }, 600)
    } else if (!overNote?.isFolder) {
      if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
      overFolderTimer.current = null
      setOverFolderId(null)
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setOverFolderId(null)
    if (overFolderTimer.current) clearTimeout(overFolderTimer.current)
    overFolderTimer.current = null

    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const overId = over.id as string
    const dragged = notes.find(n => n.id === draggedId)
    const overNote = notes.find(n => n.id === overId)
    if (!dragged || !overNote) return

    // Prevent moving folder into its own descendant
    if (dragged.isFolder) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => {
        for (const n of notes) {
          if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) }
        }
      }
      collectDesc(draggedId)
      if (desc.has(overId)) return
    }

    if (overNote.isFolder && overFolderId === overId) {
      // Drop INTO folder — place as last child
      const siblings = notes.filter(n => n.parentId === overId)
      const newSortOrder = siblings.length > 0
        ? Math.max(...siblings.map(n => n.sortOrder)) + 1000
        : 1000
      onMove(draggedId, overId, newSortOrder)
    } else {
      // Reorder within same parent level
      const siblings = notes
        .filter(n => (n.parentId ?? null) === (overNote.parentId ?? null))
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const overIdx = siblings.findIndex(n => n.id === overId)
      const prev = siblings[overIdx - 1]?.sortOrder ?? 0
      const next = siblings[overIdx]?.sortOrder ?? prev + 2000
      const newSortOrder = (prev + next) / 2
      onMove(draggedId, overNote.parentId ?? null, newSortOrder)
    }
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

  return (
    <aside style={{ padding: 8, color: '#cdd6f4', flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: '#6c7086', padding: '0 4px' }}>
        Notes
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
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
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
    </aside>
  )
}
