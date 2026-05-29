import { useState, useEffect } from 'react'
import type { NoteMeta } from '@websidian/shared'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import { useProvider } from './hooks/useProvider'

const HARDCODED_NOTES: NoteMeta[] = [
  { id: 'note-1', path: 'Welcome.md', title: 'Welcome', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'note-2', path: 'Ideas.md', title: 'Ideas', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
]

const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_NAME = `User-${Math.random().toString(36).slice(2, 6)}`
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const [activeId, setActiveId] = useState<string>(HARDCODED_NOTES[0].id)
  const { yText, synced, awareness } = useProvider(activeId)

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: USER_NAME, color: USER_COLOR })
  }, [awareness])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e2e' }}>
      <header
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          background: '#181825',
          borderBottom: '1px solid #313244',
          padding: '0 12px',
          gap: 12,
        }}
      >
        <span style={{ color: '#cdd6f4', fontWeight: 700 }}>Websidian</span>
        <PresenceBar awareness={awareness} />
        {!synced && <span style={{ color: '#6c7086', fontSize: 12 }}>syncing…</span>}
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar notes={HARDCODED_NOTES} activeId={activeId} onSelect={setActiveId} />
        {yText && <Editor yText={yText} awareness={awareness} />}
      </div>
    </div>
  )
}
