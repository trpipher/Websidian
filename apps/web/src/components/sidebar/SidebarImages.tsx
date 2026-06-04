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
