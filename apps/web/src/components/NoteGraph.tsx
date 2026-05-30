import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
  const graphData = useMemo(() => {
    const nodeIds = new Set(notes.map(n => n.id))
    // Only keep links where both endpoints exist — avoids "node not found" crash
    const validLinks = links.filter(l => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId))
    // Count total connections (in + out) per node so heavily-linked nodes render larger
    const linkCount = new Map<string, number>()
    for (const l of validLinks) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1)
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1)
    }
    return {
      nodes: notes.map(n => ({ id: n.id, name: n.title, val: 1 + (linkCount.get(n.id) ?? 0) })),
      links: validLinks.map(l => ({ source: l.sourceId, target: l.targetId })),
    }
  }, [nodesKey, linksKey])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  // Re-tune forces whenever graph data changes
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-600).distanceMax(400)
    fg.d3Force('link')?.distance(150).iterations(3)
    fg.d3Force('center')?.strength(0.05)
    fg.d3ReheatSimulation()
  }, [graphData])

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
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={() => '#89b4fa'}
          nodeRelSize={4}
          linkColor={() => '#45475a'}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          backgroundColor="#1e1e2e"
          onNodeClick={handleClick}
          cooldownTicks={400}
          warmupTicks={50}
          width={1000}
          height={700}
        />
      </div>
    </div>
  )
}
