import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor'
import MarkdownPreview from './components/MarkdownPreview'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import ProjectSwitcher from './components/ProjectSwitcher'
import ProjectSettings from './components/ProjectSettings'
import BacklinksPanel from './components/BacklinksPanel'
import NoteGraph from './components/NoteGraph'
import SearchModal from './components/SearchModal'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'
import { useImages } from './hooks/useImages'
import { useProjects } from './hooks/useProjects'
import { useProjectContext } from './contexts/ProjectContext'
import type { Project, ImageMeta } from '@websidian/shared'

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
  const [showSearch, setShowSearch] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)
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
    // After OAuth authorize redirect, resume the flow — validate origin before following
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) {
      try {
        const redirectUrl = new URL(redirect)
        const apiOrigin = new URL(API).origin
        if (redirectUrl.origin === apiOrigin || redirectUrl.origin === window.location.origin) {
          window.location.href = redirect
        }
      } catch { /* ignore malformed redirect URLs */ }
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token')
    sessionStorage.removeItem('ws-name')
    sessionStorage.removeItem('ws-image')
    setAuthToken(null)
    setUserImage(null)
  }

  // If already logged in and a ?redirect param is present, use bridge token to complete OAuth flow
  useEffect(() => {
    if (!authToken) return
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (!redirect) return
    try {
      const redirectUrl = new URL(redirect)
      const apiOrigin = new URL(API).origin
      if (redirectUrl.origin !== apiOrigin) return // only follow to sync server
      // POST to bridge endpoint (sends token in header, not URL) to get a one-time code
      fetch(`${API}/oauth/bridge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then((data: { bridge_token?: string } | null) => {
          if (data?.bridge_token) {
            redirectUrl.searchParams.set('bridge_token', data.bridge_token)
            window.location.href = redirectUrl.toString()
          }
        })
        .catch(() => {})
    } catch { /* ignore malformed redirect */ }
  }, [])

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
  const [selectedImage, setSelectedImage] = useState<ImageMeta | null>(null)
  const { notes, createNote, renameNote, deleteNote, moveNote } = useNotes(activeProject?.id ?? null, authToken)
  const { images, uploadImage } = useImages(activeProject?.id ?? null, authToken)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  // Auto-select first project on load
  useEffect(() => {
    if (!activeProject && projects.length > 0) setActiveProject(projects[0])
  }, [projects, activeProject, setActiveProject])

  // Reset active note and selected image when project changes
  useEffect(() => {
    setActiveId(null)
    setSelectedImage(null)
  }, [activeProject?.id])

  // Flag so the popstate handler can suppress the re-push that would happen when
  // setActiveId is called in response to a back navigation
  const isPopstateNav = useRef(false)

  // Push a history entry for every note opened so back button can return to it
  useEffect(() => {
    if (!activeId || isPopstateNav.current) {
      isPopstateNav.current = false
      return
    }
    history.pushState({ wsNoteId: activeId }, '')
  }, [activeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (activeProject) setShowSearch(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProject])

  // Intercept browser / mouse back button — navigate to previous note if available,
  // otherwise let the browser handle it (navigate away from the page)
  useEffect(() => {
    const onPopstate = (e: PopStateEvent) => {
      const noteId = (e.state as { wsNoteId?: string } | null)?.wsNoteId
      if (noteId) {
        isPopstateNav.current = true
        setActiveId(noteId)
        setSelectedImage(null)
      }
    }
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [])

  // Auto-select first note when notes load — guard ensures notes are from the current project
  useEffect(() => {
    if (!activeId && notes.length > 0 && notes[0].projectId === activeProject?.id) {
      setActiveId(notes[0].id)
    }
  }, [notes, activeId, activeProject?.id])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR, image: userImage })
  }, [awareness, userName, userImage])

  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor'
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  const handleWikilinkClick = useCallback((target: string) => {
    // Build id→note map for path resolution
    const idToNote = new Map(notes.map(n => [n.id, n]))
    const getFullPath = (note: typeof notes[0]): string => {
      const segments: string[] = [note.title]
      let cur = note
      while (cur.parentId) {
        const parent = idToNote.get(cur.parentId)
        if (!parent) break
        segments.unshift(parent.title)
        cur = parent
      }
      return segments.join('/')
    }

    // Path-qualified lookup first (e.g. "Folder/Note")
    let existing = target.includes('/')
      ? notes.find(n => !n.isFolder && getFullPath(n) === target)
      : undefined
    // Fall back to title lookup
    if (!existing) existing = notes.find(n => !n.isFolder && n.title === target)
    if (!existing) existing = notes.find(n => n.aliases.some(a => a.toLowerCase() === target.toLowerCase()))

    if (existing) {
      setActiveId(existing.id)
      setSelectedImage(null)
    } else if (canEdit && activeProject) {
      // Derive title from the last path segment for new-note creation
      const newTitle = target.includes('/') ? target.split('/').pop()! : target
      fetch(`${API}/api/projects/${activeProject.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ title: newTitle }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(n => { if (n?.id) { setActiveId(n.id); setSelectedImage(null) } })
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
          token={authToken}
          onSelect={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
          onRefreshProjects={refreshProjects}
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

        {activeId && canEdit && (
          <button
            onClick={() => setPreviewMode(m => !m)}
            style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
            title={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
          >
            {previewMode ? '✎ Edit' : '☰ Preview'}
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
            canEdit={canEdit}
            onSelect={id => { setActiveId(id); setSelectedImage(null) }}
            onNewNote={(parentId) => {
              if (!canEdit) return
              createNote('Untitled', { parentId }).then(note => {
                if (note?.id) { setActiveId(note.id); setSelectedImage(null) }
              })
              setPreviewMode(false)
            }}
            onNewFolder={(parentId) => {
              if (!canEdit) return
              createNote(`New Folder`, { parentId, isFolder: true })
            }}
            onRename={(id, title) => renameNote(id, title)}
            onDelete={(id) => {
              deleteNote(id)
              if (activeId === id) setActiveId(null)
            }}
            onMove={(id, parentId) => moveNote(id, parentId)}
            onUploadImage={uploadImage}
            images={images}
            selectedImageId={selectedImage?.id ?? null}
            onSelectImage={img => { setSelectedImage(img); setActiveId(null) }}
          />
          <BacklinksPanel
            noteId={activeId}
            projectId={activeProject?.id ?? null}
            token={authToken}
            onSelect={setActiveId}
          />
        </div>
        {selectedImage
          ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
              <div style={{ color: '#6c7086', fontSize: 12, marginBottom: 12 }}>{selectedImage.filename}</div>
              <img
                src={`/api/projects/${selectedImage.projectId}/images/${selectedImage.id}`}
                alt={selectedImage.filename}
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 6, display: 'block' }}
              />
            </div>
          )
          : activeId && yText
            ? (previewMode
                ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} images={images} />
                : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
              )
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

      {showSearch && activeProject && (
        <SearchModal
          projectId={activeProject.id}
          token={authToken}
          notes={notes}
          onSelect={id => { setActiveId(id); setSelectedImage(null); setShowSearch(false) }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
