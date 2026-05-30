import { useState, useEffect, useRef, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'

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
  while (cur) {
    segments.unshift(cur.title)
    cur = cur.parentId ? noteMap.get(cur.parentId) : undefined
  }
  return segments.join(' / ')
}

export default function SearchModal({ projectId, token, notes, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/search?q=${encodeURIComponent(q)}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((data: SearchResult[]) => { setResults(data); setActiveIdx(0) })
      .catch(() => {})
  }, [projectId, token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[activeIdx]) { onSelect(results[activeIdx].id); onClose() }
    else if (e.key === 'Escape') onClose()
  }

  const matchBadgeColor = (t: string) => t === 'tag' ? '#a6e3a1' : t === 'alias' ? '#89b4fa' : 'transparent'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e2e',
        border: '1px solid #313244',
        borderRadius: 10,
        width: 520,
        maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search notes, tags, aliases…"
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #313244',
            color: '#cdd6f4',
            fontSize: 15,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, i) => {
              const folderPath = getFolderPath(notes, r.id)
              return (
                <div
                  key={r.id}
                  onClick={() => { onSelect(r.id); onClose() }}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: i === activeIdx ? '#313244' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, color: '#cdd6f4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.title}
                    </div>
                    {folderPath && (
                      <div style={{ fontSize: 11, color: '#6c7086', marginTop: 2 }}>{folderPath}</div>
                    )}
                  </div>
                  {r.matchType !== 'fts' && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: matchBadgeColor(r.matchType),
                      color: '#1e1e2e', flexShrink: 0,
                    }}>
                      {r.matchType}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#6c7086', fontSize: 13, textAlign: 'center' }}>
            No results
          </div>
        )}
      </div>
    </div>
  )
}
