import { useState, useEffect, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useNotes(projectId: string | null, token: string | null) {
  const [notes, setNotes] = useState<NoteMeta[]>([])

  const refresh = useCallback(async () => {
    if (!projectId) return
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API}/api/projects/${projectId}/notes`, { headers })
    if (res.ok) setNotes(await res.json())
  }, [projectId, token])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const createNote = useCallback(async (
    title: string,
    options?: { parentId?: string | null; isFolder?: boolean },
  ) => {
    if (!projectId || !token) return
    await fetch(`${API}/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        path: `${title.replace(/[^a-z0-9]+/gi, '-')}.md`,
        title,
        parentId: options?.parentId ?? null,
        isFolder: options?.isFolder ?? false,
      }),
    })
    await refresh()
  }, [projectId, token, authHeaders, refresh])

  const renameNote = useCallback(async (id: string, title: string) => {
    if (!projectId || !token) return
    await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    })
    await refresh()
  }, [projectId, token, authHeaders, refresh])

  const deleteNote = useCallback(async (id: string) => {
    if (!projectId || !token) return
    await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    await refresh()
  }, [projectId, token, refresh])

  const moveNote = useCallback(async (
    id: string,
    parentId: string | null,
    sortOrder: number,
  ) => {
    if (!projectId || !token) return
    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, parentId, sortOrder } : n
    ))
    const res = await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parentId, sortOrder }),
    })
    if (!res.ok) {
      // Revert on failure
      await refresh()
    }
  }, [projectId, token, authHeaders, refresh])

  return { notes, refresh, createNote, renameNote, deleteNote, moveNote }
}
