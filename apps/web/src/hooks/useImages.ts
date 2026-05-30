import { useState, useEffect, useCallback, useRef } from 'react'
import type { ImageMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

export function useImages(projectId: string | null, token: string | null) {
  const [images, setImages] = useState<ImageMeta[]>([])
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  useEffect(() => {
    setImages([])
    if (!projectId || !token) return

    const controller = new AbortController()
    const headers: HeadersInit = { Authorization: `Bearer ${token}` }

    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/images`, {
          headers,
          signal: controller.signal,
        })
        if (res.ok) setImages(await res.json())
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { /* network error, ignore */ }
      }
    }

    poll()
    const id = setInterval(poll, 30_000)
    return () => { controller.abort(); clearInterval(id) }
  }, [projectId, token])

  const uploadImage = useCallback(async (file: File): Promise<ImageMeta | null> => {
    if (!projectId || !token) return null
    const fetchingFor = projectId
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/api/projects/${projectId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) return null
    const image = await res.json() as ImageMeta
    // Add to local state immediately; don't wait for next poll
    if (fetchingFor === projectIdRef.current) {
      setImages(prev => [image, ...prev])
    }
    return image
  }, [projectId, token])

  const renameImage = useCallback(async (imageId: string, filename: string): Promise<boolean> => {
    if (!projectId || !token) return false
    const res = await fetch(`${API}/api/projects/${projectId}/images/${imageId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    if (!res.ok) return false
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, filename } : img))
    return true
  }, [projectId, token])

  return { images, uploadImage, renameImage }
}
