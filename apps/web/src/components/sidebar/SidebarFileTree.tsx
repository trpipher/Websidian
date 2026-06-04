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
