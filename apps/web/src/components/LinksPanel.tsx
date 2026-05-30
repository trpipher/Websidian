import { useState, useEffect } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

type Tab = 'backlinks' | 'forwardlinks'

interface Props {
  noteId: string | null
  projectId: string | null
  token: string | null
  onSelect: (id: string) => void
}

export default function LinksPanel({ noteId, projectId, token, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('backlinks')
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([])
  const [forwardlinks, setForwardlinks] = useState<NoteMeta[]>([])

  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!noteId || !projectId) { setBacklinks([]); return }
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/backlinks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
  }, [noteId, projectId, token])

  useEffect(() => {
    if (!noteId || !projectId) { setForwardlinks([]); return }
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/forwardlinks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setForwardlinks)
      .catch(() => setForwardlinks([]))
  }, [noteId, projectId, token])

  const results = activeTab === 'backlinks' ? backlinks : forwardlinks
  const emptyLabel = activeTab === 'backlinks' ? 'No backlinks' : 'No forward links'

  return (
    <div style={{
      width: 260,
      height: '100%',
      borderLeft: '1px solid #313244',
      background: '#1e1e2e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #313244', flexShrink: 0 }}>
        {(['backlinks', 'forwardlinks'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '7px 4px',
              background: activeTab === tab ? '#313244' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #89b4fa' : '2px solid transparent',
              color: activeTab === tab ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'backlinks' ? 'Backlinks' : 'Forward Links'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!noteId ? (
          <div style={{ color: '#45475a', fontSize: 12, textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
            Open a note to see links
          </div>
        ) : results.length === 0 ? (
          <div style={{ color: '#45475a', fontSize: 12, textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
            {emptyLabel}
          </div>
        ) : (
          results.map(n => (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: '#bac2de',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#313244')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {n.title}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
