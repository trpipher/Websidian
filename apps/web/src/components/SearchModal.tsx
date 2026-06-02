import { useState, useEffect, useRef, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from '@/components/ui/command'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface SearchResult {
  id: string
  title: string
  parentId: string | null
  matchType: 'fts' | 'tag' | 'alias' | string
}

interface Props {
  projectId: string
  token: string | null
  notes: NoteMeta[]
  onSelect: (id: string) => void
  onClose: () => void
}

function getFolderPath(notes: NoteMeta[], id: string): string {
  const noteMap = new Map(notes.map(n => [n.id, n]))
  const note = noteMap.get(id)
  if (!note?.parentId) return ''
  const segments: string[] = []
  let cur = noteMap.get(note.parentId)
  while (cur) { segments.unshift(cur.title); cur = cur.parentId ? noteMap.get(cur.parentId) : undefined }
  return segments.join(' / ')
}

export default function SearchModal({ projectId, token, notes, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/search?q=${encodeURIComponent(q)}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((data: SearchResult[]) => setResults(data))
      .catch(() => {})
  }, [projectId, token])

  const handleValueChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 150)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <CommandDialog open onOpenChange={open => !open && onClose()}>
      <CommandInput
        placeholder="Search notes, tags, aliases…"
        value={query}
        onValueChange={handleValueChange}
      />
      <CommandList>
        {query.trim() && results.length === 0 && <CommandEmpty>No results</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup>
            {results.map(r => {
              const folderPath = getFolderPath(notes, r.id)
              return (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => { onSelect(r.id); onClose() }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm text-foreground truncate">{r.title}</div>
                    {folderPath && <div className="text-[11px] text-muted-foreground mt-0.5">{folderPath}</div>}
                  </div>
                  {r.matchType !== 'fts' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 text-background font-medium ${r.matchType === 'tag' ? 'bg-ctp-green' : 'bg-primary'}`}>
                      {r.matchType}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
