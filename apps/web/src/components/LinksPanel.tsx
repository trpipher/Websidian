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

  useEffect(() => {
    if (!noteId || !projectId) { setBacklinks([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const controller = new AbortController()
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/backlinks`, { headers, signal: controller.signal })
      .then(r => r.ok ? r.json() : []).then(setBacklinks)
      .catch(err => { if (err.name !== 'AbortError') setBacklinks([]) })
    return () => controller.abort()
  }, [noteId, projectId, token])

  useEffect(() => {
    if (!noteId || !projectId) { setForwardlinks([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const controller = new AbortController()
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/forwardlinks`, { headers, signal: controller.signal })
      .then(r => r.ok ? r.json() : []).then(setForwardlinks)
      .catch(err => { if (err.name !== 'AbortError') setForwardlinks([]) })
    return () => controller.abort()
  }, [noteId, projectId, token])

  const results = activeTab === 'backlinks' ? backlinks : forwardlinks
  const emptyLabel = activeTab === 'backlinks' ? 'No backlinks' : 'No forward links'

  return (
    <div className="w-[260px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
      <div className="flex border-b border-border shrink-0">
        {(['backlinks', 'forwardlinks'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 px-1 border-b-2 text-[11px] cursor-pointer bg-transparent border-x-0 border-t-0 transition-colors ${
              activeTab === tab
                ? 'border-b-primary text-foreground font-semibold bg-card'
                : 'border-b-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'backlinks' ? 'Backlinks' : 'Forward Links'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {!noteId ? (
          <p className="text-[#45475a] text-xs text-center mt-8 px-4">Open a note to see links</p>
        ) : results.length === 0 ? (
          <p className="text-[#45475a] text-xs text-center mt-8 px-4">{emptyLabel}</p>
        ) : (
          results.map(n => (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              className="px-3 py-1.5 cursor-pointer text-xs text-[#bac2de] whitespace-nowrap overflow-hidden text-ellipsis hover:bg-card"
            >
              {n.title}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
