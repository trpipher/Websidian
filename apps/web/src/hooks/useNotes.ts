import { useState, useEffect, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useNotes() {
  const [notes, setNotes] = useState<NoteMeta[]>([])

  const refresh = useCallback(async () => {
    const res = await fetch(`${API}/api/notes`)
    setNotes(await res.json())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createNote = useCallback(async (title: string) => {
    await fetch(`${API}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `${title}.md`, title }),
    })
    await refresh()
  }, [refresh])

  return { notes, refresh, createNote }
}
