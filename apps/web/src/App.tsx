import { useState, useEffect, useCallback } from 'react'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import ProjectSwitcher from './components/ProjectSwitcher'
import ProjectSettings from './components/ProjectSettings'
import BacklinksPanel from './components/BacklinksPanel'
import NoteGraph from './components/NoteGraph'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'
import { useProjects } from './hooks/useProjects'
import { useProjectContext } from './contexts/ProjectContext'
import type { Project } from '@websidian/shared'

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
  const [showSettings, setShowSettings] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  // Invite token from URL path /invite/:token
  const [pendingInviteToken] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/invite\/([a-f0-9]+)$/)
    return match?.[1] ?? null
  })

  const handleLogin = (token: string, name: string, image?: string | null) => {
    sessionStorage.setItem('ws-token', token)
    sessionStorage.setItem('ws-name', name)
    if (image) sessionStorage.setItem('ws-image', image)
    else sessionStorage.removeItem('ws-image')
    setAuthToken(token)
    setUserName(name)
    setUserImage(image ?? null)
    // After OAuth authorize redirect, resume the flow
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) window.location.href = redirect
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token')
    sessionStorage.removeItem('ws-name')
    sessionStorage.removeItem('ws-image')
    setAuthToken(null)
    setUserImage(null)
  }

  // Handle OAuth callback: check for existing session after Discord redirect
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

  const { activeProject, setActiveProject, userRole } = useProjectContext()
  const { projects, createProject, refresh: refreshProjects } = useProjects(authToken)

  // Auto-join via invite link once authenticated
  useEffect(() => {
    if (!authToken || !pendingInviteToken) return
    fetch(`${API}/api/invites/${pendingInviteToken}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (data?.projectId) {
          window.history.replaceState(null, '', '/')
          await refreshProjects()
          // find and activate the joined project
          setActiveProject(projects.find(p => p.id === data.projectId) ?? null)
        }
      })
      .catch(() => {})
  }, [authToken, pendingInviteToken])
  const [activeId, setActiveId] = useState<string | null>(null)
  const { notes, createNote } = useNotes(activeProject?.id ?? null, authToken)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  // Auto-select first project on load
  useEffect(() => {
    if (!activeProject && projects.length > 0) setActiveProject(projects[0])
  }, [projects, activeProject, setActiveProject])

  // Reset active note when project changes
  useEffect(() => {
    setActiveId(null)
  }, [activeProject?.id])

  // Auto-select first note when notes load
  useEffect(() => {
    if (!activeId && notes.length > 0) setActiveId(notes[0].id)
  }, [notes, activeId])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR, image: userImage })
  }, [awareness, userName, userImage])

  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor'
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  const handleWikilinkClick = useCallback((title: string) => {
    const existing = notes.find(n => n.title === title)
    if (existing) {
      setActiveId(existing.id)
    } else if (canEdit && activeProject) {
      // create note then navigate to it
      fetch(`${API}/api/projects/${activeProject.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ path: `${title}.md`, title }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(n => { if (n?.id) setActiveId(n.id) })
        .catch(() => {})
    }
  }, [notes, canEdit, activeProject, authToken])

  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e2e' }}>
      <header style={{
        height: 40, display: 'flex', alignItems: 'center',
        background: '#181825', borderBottom: '1px solid #313244',
        padding: '0 12px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ color: '#cdd6f4', fontWeight: 700, flexShrink: 0 }}>Websidian</span>

        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          onSelect={p => { setActiveProject(p); setActiveId(null) }}
          onCreate={createProject}
        />

        {isOwnerOrAdmin && activeProject && (
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
            title="Project settings"
          >
            ⚙
          </button>
        )}

        {activeProject && (
          <button
            onClick={() => setShowGraph(true)}
            style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
            title="Graph view"
          >
            ⬡
          </button>
        )}

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
        <div style={{ display: 'flex', flexDirection: 'column', width: 240, flexShrink: 0, borderRight: '1px solid #313244', background: '#1e1e2e', overflow: 'hidden' }}>
          <Sidebar
            notes={notes}
            activeId={activeId}
            onSelect={setActiveId}
            onNewNote={canEdit ? () => createNote(`Untitled-${Date.now()}`) : undefined}
          />
          <BacklinksPanel
            noteId={activeId}
            projectId={activeProject?.id ?? null}
            token={authToken}
            onSelect={setActiveId}
          />
        </div>
        {activeId && yText
          ? <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
          : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c7086' }}>
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )
        }
      </div>

      {showSettings && activeProject && authToken && (
        <ProjectSettings
          project={activeProject}
          token={authToken}
          onClose={() => setShowSettings(false)}
          onUpdated={updates => setActiveProject({ ...activeProject, ...updates } as Project)}
        />
      )}

      {showGraph && activeProject && (
        <NoteGraph
          notes={notes}
          projectId={activeProject.id}
          token={authToken}
          onSelect={id => { setActiveId(id); setShowGraph(false) }}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  )
}
