import { useEffect, useState } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  noteId: string | null
  projectId: string | null
  token: string | null
  onSelect: (id: string) => void
}

export default function BacklinksPanel({ noteId, projectId, token, onSelect }: Props) {
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([])

  useEffect(() => {
    if (!noteId || !projectId) { setBacklinks([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/backlinks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
  }, [noteId, projectId, token])

  if (backlinks.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid #313244', padding: '10px 12px', color: '#cdd6f4', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Linked mentions</div>
      {backlinks.map(n => (
        <div
          key={n.id}
          onClick={() => onSelect(n.id)}
          style={{ cursor: 'pointer', padding: '2px 0', color: '#bac2de' }}
        >
          {n.title}
        </div>
      ))}
    </div>
  )
}
