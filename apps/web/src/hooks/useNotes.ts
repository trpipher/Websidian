import { useState, useEffect, useCallback, useRef } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useNotes(projectId: string | null, token: string | null) {
  const [notes, setNotes] = useState<NoteMeta[]>([])
  // Ref used by manual refresh to discard results if the project switched mid-flight
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  // Polling — AbortController ensures in-flight fetches from the old project are
  // cancelled synchronously in the cleanup, before they can overwrite cleared notes
  useEffect(() => {
    setNotes([])
    if (!projectId || !token) return

    const controller = new AbortController()
    const headers: HeadersInit = { Authorization: `Bearer ${token}` }

    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/notes`, {
          headers,
          signal: controller.signal,
        })
        if (res.ok) setNotes(await res.json())
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { /* network error, ignore */ }
      }
    }

    poll()
    const id = setInterval(poll, 3000)
    return () => { controller.abort(); clearInterval(id) }
  }, [projectId, token])

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  // Manual refresh after mutations — keeps a stale-ref check as a secondary guard
  const refresh = useCallback(async () => {
    if (!projectId || !token) return
    const fetchingFor = projectId
    const res = await fetch(`${API}/api/projects/${projectId}/notes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok && fetchingFor === projectIdRef.current) {
      setNotes(await res.json())
    }
  }, [projectId, token])

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
      headers: { Authorization: `Bearer ${token}` },
    })
    await refresh()
  }, [projectId, token, refresh])

  const moveNote = useCallback(async (id: string, parentId: string | null) => {
    if (!projectId || !token) return
    setNotes(prev => prev.map(n => n.id === id ? { ...n, parentId } : n))
    const res = await fetch(`${API}/api/projects/${projectId}/notes/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ parentId }),
    })
    if (!res.ok) await refresh()
  }, [projectId, token, authHeaders, refresh])

  const importNotes = useCallback(async (files: FileList): Promise<number> => {
    if (!projectId || !token) return 0
    const noteData = await Promise.all(
      Array.from(files).map(async file => ({
        path: file.name,
        content: await file.text(),
      }))
    )
    const res = await fetch(`${API}/api/projects/${projectId}/import/notes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ notes: noteData }),
    })
    await refresh()
    return res.ok ? noteData.length : 0
  }, [projectId, token, authHeaders, refresh])

  return { notes, refresh, createNote, renameNote, deleteNote, moveNote, importNotes }
}
