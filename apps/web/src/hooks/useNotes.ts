import { useState, useEffect, useCallback, useRef } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useNotes(projectId: string | null, token: string | null) {
  const [notes, setNotes] = useState<NoteMeta[]>([])
  // Always-current ref so in-flight fetches can detect a project switch
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  // Clear stale notes immediately when project changes so auto-select can't pick old notes
  useEffect(() => { setNotes([]) }, [projectId])

  const refresh = useCallback(async () => {
    if (!projectId) return
    const fetchingFor = projectId  // snapshot at call time
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API}/api/projects/${projectId}/notes`, { headers })
    // Discard results if the project changed while this fetch was in-flight
    if (res.ok && fetchingFor === projectIdRef.current) {
      setNotes(await res.json())
    }
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
  ): Promise<NoteMeta | null> => {
    if (!projectId || !token) return null
    const res = await fetch(`${API}/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title,
        parentId: options?.parentId ?? null,
        isFolder: options?.isFolder ?? false,
      }),
    })
    await refresh()
    return res.ok ? (await res.json() as NoteMeta) : null
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
  ) => {
    if (!projectId || !token) return
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, parentId } : n
    ))
    const res = await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parentId }),
    })
    if (!res.ok) {
      await refresh()
    }
  }, [projectId, token, authHeaders, refresh])

  return { notes, refresh, createNote, renameNote, deleteNote, moveNote }
}
