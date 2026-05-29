import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import type { NoteMeta } from '@websidian/shared'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'

const HARDCODED_NOTES: NoteMeta[] = [
  { id: 'note-1', path: 'Welcome.md', title: 'Welcome', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'note-2', path: 'Ideas.md', title: 'Ideas', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
]

function loadOrCreateDoc(noteId: string): Y.Doc {
  const doc = new Y.Doc()
  const stored = localStorage.getItem(`ydoc:${noteId}`)
  if (stored) {
    Y.applyUpdate(doc, Uint8Array.from(JSON.parse(stored)))
  }
  doc.on('update', () => {
    const state = Y.encodeStateAsUpdate(doc)
    localStorage.setItem(`ydoc:${noteId}`, JSON.stringify(Array.from(state)))
  })
  return doc
}

export default function App() {
  const [activeId, setActiveId] = useState<string>(HARDCODED_NOTES[0].id)
  const docRef = useRef<Y.Doc | null>(null)
  const [yText, setYText] = useState<Y.Text | null>(null)

  useEffect(() => {
    docRef.current?.destroy()
    const doc = loadOrCreateDoc(activeId)
    docRef.current = doc
    setYText(doc.getText('content'))
    return () => {
      doc.destroy()
      docRef.current = null
    }
  }, [activeId])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e2e' }}>
      <Sidebar notes={HARDCODED_NOTES} activeId={activeId} onSelect={setActiveId} />
      {yText && <Editor yText={yText} />}
    </div>
  )
}
