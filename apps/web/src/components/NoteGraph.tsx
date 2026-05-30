import { useEffect, useState, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { NoteMeta, LinkEdge } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  notes: NoteMeta[]
  projectId: string
  token: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export default function NoteGraph({ notes, projectId, token, onSelect, onClose }: Props) {
  const [links, setLinks] = useState<LinkEdge[]>([])

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/graph`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setLinks)
      .catch(() => {})
  }, [projectId, token])

  // Derive content-based keys so graphData only gets a new reference when
  // nodes or links actually change — not on every 3-second poll
  const nodesKey = notes.map(n => `${n.id}:${n.title}`).join('\n')
  const linksKey = links.map(l => `${l.sourceId}>${l.targetId}`).join('\n')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graphData = useMemo(() => ({
    nodes: notes.map(n => ({ id: n.id, name: n.title })),
    links: links.map(l => ({ source: l.sourceId, target: l.targetId })),
  }), [nodesKey, linksKey])

  const handleClick = useCallback((node: { id?: string | number }) => {
    if (node.id) onSelect(String(node.id))
  }, [onSelect])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{ position: 'relative', background: '#1e1e2e', borderRadius: 8, overflow: 'hidden' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 14, zIndex: 1,
            background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 20,
          }}
        >
          ✕
        </button>
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="name"
          nodeColor={() => '#89b4fa'}
          linkColor={() => '#45475a'}
          backgroundColor="#1e1e2e"
          onNodeClick={handleClick}
          width={800}
          height={600}
        />
      </div>
    </div>
  )
}
