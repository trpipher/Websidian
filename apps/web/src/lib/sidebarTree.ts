// apps/web/src/lib/sidebarTree.ts
import type { NoteMeta } from '@websidian/shared'

export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export interface SortConfig { by: SortField; direction: SortDirection }
export interface NoteNode extends NoteMeta { children: NoteNode[]; depth: number }

export const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

export const SORT_STORAGE_KEY = 'ws-sidebar-sort'

export function loadSortConfig(): SortConfig {
  try { return JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? '') }
  catch { return { by: 'title', direction: 'asc' } }
}

export function buildTree(notes: NoteMeta[], sort: SortConfig): NoteNode[] {
  const map = new Map<string, NoteNode>()
  for (const n of notes) map.set(n.id, { ...n, children: [], depth: 0 })

  const sorter = (a: NoteNode, b: NoteNode) => {
    const folderFirst = (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0)
    if (folderFirst !== 0) return folderFirst
    const av = a[sort.by] ?? ''; const bv = b[sort.by] ?? ''
    const cmp = String(av).localeCompare(String(bv))
    return sort.direction === 'asc' ? cmp : -cmp
  }

  const roots: NoteNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  const assignDepth = (nodes: NoteNode[], depth: number) => {
    nodes.sort(sorter)
    for (const n of nodes) { n.depth = depth; assignDepth(n.children, depth + 1) }
  }
  roots.sort(sorter)
  assignDepth(roots, 0)
  return roots
}

export function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  const visit = (node: NoteNode) => {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

export function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const map = new Map(notes.map(n => [n.id, n]))
  const ancestors = new Set<string>()
  let cur = map.get(id)
  while (cur?.parentId) { ancestors.add(cur.parentId); cur = map.get(cur.parentId) }
  return ancestors
}

export function computeDropZone(overId: string, notes: NoteMeta[]): string | null {
  const note = notes.find(n => n.id === overId)
  return note?.isFolder ? note.id : (note?.parentId ?? null)
}

export function countDescendants(notes: NoteMeta[], id: string): number {
  let count = 0
  const visit = (parentId: string) => {
    for (const n of notes) { if (n.parentId === parentId) { count++; if (n.isFolder) visit(n.id) } }
  }
  visit(id)
  return count
}
