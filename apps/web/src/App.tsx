import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'
const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(
    () => sessionStorage.getItem('ws-token')
  )
  const [userName, setUserName] = useState<string>(
    () => sessionStorage.getItem('ws-name') ?? `User-${Math.random().toString(36).slice(2, 6)}`
  )
  const [userImage, setUserImage] = useState<string | null>(
    () => sessionStorage.getItem('ws-image')
  )

  const handleLogin = (token: string, name: string, image?: string | null) => {
    sessionStorage.setItem('ws-token', token)
    sessionStorage.setItem('ws-name', name)
    if (image) sessionStorage.setItem('ws-image', image)
    else sessionStorage.removeItem('ws-image')
    setAuthToken(token)
    setUserName(name)
    setUserImage(image ?? null)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token')
    sessionStorage.removeItem('ws-name')
    sessionStorage.removeItem('ws-image')
    setAuthToken(null)
    setUserImage(null)
  }

  // Handle OAuth callback: on mount check for an existing session (e.g. after Discord redirect)
  useEffect(() => {
    if (authToken) return
    fetch(`${API}/api/auth/get-session`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.session?.token && data?.user) {
          handleLogin(data.session.token, data.user.name ?? data.user.email, data.user.image ?? null)
        }
      })
      .catch(() => {})
  }, [])

  const { notes, createNote } = useNotes()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  useEffect(() => {
    if (!activeId && notes.length > 0) setActiveId(notes[0].id)
  }, [notes, activeId])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR, image: userImage })
  }, [awareness, userName, userImage])

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
          {userImage && (
            <img src={userImage} alt={userName} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
          )}
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
