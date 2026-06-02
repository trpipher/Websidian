import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import type { NoteMeta, LinkEdge } from '@websidian/shared'
import { X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props { notes: NoteMeta[]; projectId: string; token: string | null; onSelect: (id: string) => void; onClose: () => void }

export default function NoteGraph({ notes, projectId, token, onSelect, onClose }: Props) {
  const [links, setLinks] = useState<LinkEdge[]>([])

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/graph`, { headers })
      .then(r => r.ok ? r.json() : []).then(setLinks).catch(() => {})
  }, [projectId, token])

  const nodesKey = notes.map(n => `${n.id}:${n.title}`).join('\n')
  const linksKey = links.map(l => `${l.sourceId}>${l.targetId}`).join('\n')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graphData = useMemo(() => {
    const nodeIds = new Set(notes.map(n => n.id))
    const validLinks = links.filter(l => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId))
    const linkCount = new Map<string, number>()
    for (const l of validLinks) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1)
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1)
    }
    return {
      nodes: notes.map(n => ({ id: n.id, name: n.title, val: 3 + (linkCount.get(n.id) ?? 0) * 0.66 })),
      links: validLinks.map(l => ({ source: l.sourceId, target: l.targetId })),
    }
  }, [nodesKey, linksKey])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-400).distanceMax(150)
    fg.d3Force('center')?.strength(0.1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('collide', forceCollide((node: any) => Math.sqrt((node.val ?? 1) * 4) + 25))
    fg.d3ReheatSimulation()
  }, [graphData])

  const handleClick = useCallback((node: { id?: string | number }) => {
    if (node.id) onSelect(String(node.id))
  }, [onSelect])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300]">
      <div className="relative bg-background rounded-lg overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2.5 right-3.5 z-10 bg-transparent border-none text-muted-foreground cursor-pointer hover:text-foreground"
        >
          <X className="w-5 h-5" />
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
