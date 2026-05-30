import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import type { NoteMeta } from '@websidian/shared'

interface Props {
  note: NoteMeta
  depth: number
  isActive: boolean
  isExpanded: boolean
  canEdit: boolean

  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string, isFolder: boolean, childCount: number) => void
  onNewNote: (parentId: string) => void
  onNewFolder: (parentId: string) => void
  childCount: number
}

export default function SidebarItem({
  note, depth, isActive, isExpanded, canEdit,
  onSelect, onToggle, onRename, onDelete, onNewNote, onNewFolder, childCount,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, disabled: !canEdit })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== note.title) onRename(note.id, trimmed)
    setIsRenaming(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEdit) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const menuItems: ContextMenuItem[] = note.isFolder
    ? [
        { label: 'Rename', onClick: () => { setRenameValue(note.title); setIsRenaming(true); setTimeout(() => inputRef.current?.select(), 10) } },
        { label: 'New note inside', onClick: () => onNewNote(note.id) },
        { label: 'New folder inside', onClick: () => onNewFolder(note.id) },
        { label: 'Delete folder', onClick: () => onDelete(note.id, true, childCount), danger: true },
      ]
    : [
        { label: 'Rename', onClick: () => { setRenameValue(note.title); setIsRenaming(true); setTimeout(() => inputRef.current?.select(), 10) } },
        { label: 'Delete', onClick: () => onDelete(note.id, false, 0), danger: true },
      ]

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          paddingLeft: 8 + depth * 16,
          borderRadius: 4,
          cursor: 'pointer',
          background: isActive ? '#313244' : 'transparent',
          marginBottom: 1,
          fontSize: 13,
          color: '#cdd6f4',
          userSelect: 'none',
          gap: 2,
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Chevron for folders, spacer for notes */}
        {note.isFolder ? (
          <span
            onClick={e => { e.stopPropagation(); onToggle(note.id) }}
            style={{ width: 16, flexShrink: 0, color: '#6c7086', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            style={{
              flex: 1,
              background: '#313244',
              border: '1px solid #89b4fa',
              borderRadius: 3,
              color: '#cdd6f4',
              fontSize: 13,
              padding: '1px 4px',
            }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onClick={() => onSelect(note.id)}
          >
            {note.isFolder ? '📁 ' : ''}{note.title}
          </span>
        )}

        {/* Drag handle — only for editors */}
        {canEdit && !isRenaming && (
          <span
            {...attributes}
            {...listeners}
            style={{
              color: '#45475a',
              cursor: 'grab',
              fontSize: 14,
              padding: '0 2px',
              flexShrink: 0,
            }}
            className="drag-handle"
          >
            ⠿
          </span>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}

      <style>{`.drag-handle { opacity: 0 } div:hover > .drag-handle { opacity: 1 }`}</style>
    </>
  )
}
