import { useEffect, useRef, useState } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

const SYNC_URL = import.meta.env.VITE_SYNC_URL ?? 'ws://localhost:1234'

export function useProvider(noteId: string) {
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  const [yText, setYText] = useState<Y.Text | null>(null)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    providerRef.current?.destroy()
    docRef.current?.destroy()

    const doc = new Y.Doc()
    docRef.current = doc

    const provider = new HocuspocusProvider({
      url: SYNC_URL,
      name: noteId,
      document: doc,
      onSynced: () => setSynced(true),
    })
    providerRef.current = provider
    setYText(doc.getText('content'))
    setSynced(false)

    return () => {
      provider.destroy()
      doc.destroy()
    }
  }, [noteId])

  return {
    yText,
    synced,
    awareness: (providerRef.current?.awareness ?? null) as Awareness | null,
    provider: providerRef.current,
  }
}
