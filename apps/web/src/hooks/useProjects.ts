import { useState, useEffect, useCallback } from 'react'
import type { Project } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useProjects(token: string | null) {
  const [projects, setProjects] = useState<Project[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    const res = await fetch(`${API}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setProjects(await res.json())
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const createProject = useCallback(async (name: string, isPublic = false): Promise<Project | null> => {
    if (!token) return null
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, isPublic }),
    })
    if (!res.ok) return null
    const project = await res.json() as Project
    await refresh()
    return project
  }, [token, refresh])

  return { projects, refresh, createProject }
}
