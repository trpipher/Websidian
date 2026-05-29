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

  const createNote = useCallback(async (title: string) => {
    if (!projectId || !token) return
    await fetch(`${API}/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: `${title}.md`, title }),
    })
    await refresh()
  }, [projectId, token, refresh])

  return { notes, refresh, createNote }
}
