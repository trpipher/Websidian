import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NoteMeta } from '@websidian/shared'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface Props {
  note: NoteMeta
  depth: number
  isActive: boolean
  isExpanded: boolean
  canEdit: boolean
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onRename: (id: string, title: string) => Promise<string | null>
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
  const [renameError, setRenameError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: note.id,
    disabled: !canEdit,
  })

  const commitRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === note.title) { setIsRenaming(false); setRenameError(null); return }
    const err = await onRename(note.id, trimmed)
    if (err) {
      setRenameError(err)
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setIsRenaming(false)
      setRenameError(null)
    }
  }

  const startRename = () => {
    setRenameValue(note.title)
    setRenameError(null)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...(canEdit ? { ...attributes, ...listeners } : {})}
          style={{ opacity: isDragging ? 0 : 1, paddingLeft: 8 + depth * 16 }}
          className={`flex items-center pr-2 py-1 rounded cursor-pointer mb-px text-[13px] text-foreground gap-0.5 select-none min-h-[44px] md:min-h-0 ${isActive ? 'bg-card' : 'hover:bg-card/50'}`}
          onClick={() => { if (!isRenaming) onSelect(note.id); onToggle(note.id) }}
        >
          {note.isFolder ? (
            <span
              className="w-4 shrink-0 text-muted-foreground text-[10px] flex items-center justify-center"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={e => { setRenameValue(e.target.value); setRenameError(null) }}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setIsRenaming(false); setRenameError(null) }
              }}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              autoFocus
              title={renameError ?? undefined}
              className={`flex-1 bg-card rounded-sm text-foreground text-[13px] px-1 py-px focus:outline-none border ${renameError ? 'border-destructive' : 'border-primary'}`}
            />
          ) : (
            <span
              className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              onClick={() => onSelect(note.id)}
            >
              {note.title}
            </span>
          )}

        </div>
      </ContextMenuTrigger>

      {canEdit && (
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>Rename</ContextMenuItem>
          {note.isFolder ? (
            <>
              <ContextMenuItem onClick={() => onNewNote(note.id)}>New note inside</ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(note.id)}>New folder inside</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onDelete(note.id, true, childCount)}
                className="text-destructive focus:text-destructive"
              >
                Delete folder
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem
              onClick={() => onDelete(note.id, false, 0)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
