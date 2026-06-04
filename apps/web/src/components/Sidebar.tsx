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
