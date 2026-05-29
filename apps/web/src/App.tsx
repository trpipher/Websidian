import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'

const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_NAME = `User-${Math.random().toString(36).slice(2, 6)}`
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const { notes, createNote } = useNotes()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { yText, synced, awareness } = useProvider(activeId ?? 'no-note')

  useEffect(() => {
    if (!activeId && notes.length > 0) setActiveId(notes[0].id)
  }, [notes, activeId])

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
        <Sidebar
          notes={notes}
          activeId={activeId}
          onSelect={setActiveId}
          onNewNote={() => createNote(`Untitled-${Date.now()}`)}
        />
        {activeId && yText && <Editor yText={yText} awareness={awareness} />}
        {!activeId && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c7086' }}>
            Create or select a note
          </div>
        )}
      </div>
    </div>
  )
}
