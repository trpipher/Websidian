import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'

const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(
    () => sessionStorage.getItem('ws-token')
  )
  const [userName, setUserName] = useState<string>(
    () => sessionStorage.getItem('ws-name') ?? `User-${Math.random().toString(36).slice(2, 6)}`
  )

  const handleLogin = (token: string, name: string) => {
    sessionStorage.setItem('ws-token', token)
    sessionStorage.setItem('ws-name', name)
    setAuthToken(token)
    setUserName(name)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token')
    sessionStorage.removeItem('ws-name')
    setAuthToken(null)
  }

  const { notes, createNote } = useNotes()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  useEffect(() => {
    if (!activeId && notes.length > 0) setActiveId(notes[0].id)
  }, [notes, activeId])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR })
  }, [awareness, userName])

  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e2e' }}>
      <header style={{
        height: 40, display: 'flex', alignItems: 'center',
        background: '#181825', borderBottom: '1px solid #313244',
        padding: '0 12px', gap: 12,
      }}>
        <span style={{ color: '#cdd6f4', fontWeight: 700 }}>Websidian</span>
        <PresenceBar awareness={awareness} />
        {!synced && activeId && <span style={{ color: '#6c7086', fontSize: 12 }}>syncing…</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6c7086', fontSize: 12 }}>{userName}</span>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: '1px solid #313244', borderRadius: 4, color: '#6c7086', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
          >
            Sign out
          </button>
        </div>
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
