// apps/web/src/components/sidebar/SidebarHeader.tsx
import React, { useState, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SORT_FIELDS, type SortConfig } from '@/lib/sidebarTree'
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
