import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor'
import MarkdownPreview from './components/MarkdownPreview'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import ProjectSwitcher from './components/ProjectSwitcher'
import ProjectSettings from './components/ProjectSettings'
import LinksPanel from './components/LinksPanel'
import NoteGraph from './components/NoteGraph'
import SearchModal from './components/SearchModal'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'
import { useImages } from './hooks/useImages'
import { useProjects } from './hooks/useProjects'
import { useProjectContext } from './contexts/ProjectContext'
import { Settings, Hexagon, PencilLine, BookOpen, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Project, ImageMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'
const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem('ws-token'))
  const [userName, setUserName] = useState<string>(() => sessionStorage.getItem('ws-name') ?? `User-${Math.random().toString(36).slice(2, 6)}`)
  const [userImage, setUserImage] = useState<string | null>(() => sessionStorage.getItem('ws-image'))
  const [showSettings, setShowSettings] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)

  const [pendingInviteToken] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/invite\/([a-f0-9]+)$/)
    return match?.[1] ?? null
  })

  const handleLogin = (token: string, name: string, image?: string | null) => {
    sessionStorage.setItem('ws-token', token)
    sessionStorage.setItem('ws-name', name)
    if (image) sessionStorage.setItem('ws-image', image)
    else sessionStorage.removeItem('ws-image')
    setAuthToken(token); setUserName(name); setUserImage(image ?? null)
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) {
      try {
        const redirectUrl = new URL(redirect)
        const apiOrigin = new URL(API).origin
        if (redirectUrl.origin === apiOrigin || redirectUrl.origin === window.location.origin) window.location.href = redirect
      } catch { /* ignore */ }
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token'); sessionStorage.removeItem('ws-name'); sessionStorage.removeItem('ws-image')
    setAuthToken(null); setUserImage(null)
  }

  useEffect(() => {
    if (!authToken) return
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (!redirect) return
    try {
      const redirectUrl = new URL(redirect)
      const apiOrigin = new URL(API).origin
      if (redirectUrl.origin !== apiOrigin) return
      fetch(`${API}/oauth/bridge`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: { bridge_token?: string } | null) => {
          if (data?.bridge_token) { redirectUrl.searchParams.set('bridge_token', data.bridge_token); window.location.href = redirectUrl.toString() }
        })
        .catch(() => {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (authToken) return
    fetch(`${API}/api/auth/get-session`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.session?.token && data?.user) handleLogin(data.session.token, data.user.name ?? data.user.email, data.user.image ?? null) })
      .catch(() => {})
  }, [])

  const { activeProject, setActiveProject, userRole } = useProjectContext()
  const { projects, refresh: refreshProjects } = useProjects(authToken)

  useEffect(() => {
    if (!authToken || !pendingInviteToken) return
    fetch(`${API}/api/invites/${pendingInviteToken}/join`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (data?.projectId) {
          window.history.replaceState(null, '', '/')
          await refreshProjects()
          setActiveProject(projects.find(p => p.id === data.projectId) ?? null)
        }
      })
      .catch(() => {})
  }, [authToken, pendingInviteToken])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageMeta | null>(null)
  const { notes, createNote, renameNote, deleteNote, moveNote } = useNotes(activeProject?.id ?? null, authToken)
  const { images, uploadImage, renameImage } = useImages(activeProject?.id ?? null, authToken)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  useEffect(() => { if (!activeProject && projects.length > 0) setActiveProject(projects[0]) }, [projects, activeProject, setActiveProject])
  useEffect(() => { setActiveId(null); setSelectedImage(null) }, [activeProject?.id])

  const isPopstateNav = useRef(false)
  useEffect(() => {
    if (!activeId || isPopstateNav.current) { isPopstateNav.current = false; return }
    history.pushState({ wsNoteId: activeId }, '')
  }, [activeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (activeProject) setShowSearch(s => !s) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProject])

  useEffect(() => {
    const onPopstate = (e: PopStateEvent) => {
      const noteId = (e.state as { wsNoteId?: string } | null)?.wsNoteId
      if (noteId) { isPopstateNav.current = true; setActiveId(noteId); setSelectedImage(null) }
    }
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [])

  useEffect(() => {
    if (!activeId && notes.length > 0 && notes[0].projectId === activeProject?.id) setActiveId(notes[0].id)
  }, [notes, activeId, activeProject?.id])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR, image: userImage })
  }, [awareness, userName, userImage])

  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor'
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  const handleWikilinkClick = useCallback((target: string) => {
    const idToNote = new Map(notes.map(n => [n.id, n]))
    const getFullPath = (note: typeof notes[0]): string => {
      const segments: string[] = [note.title]
      let cur = note
      while (cur.parentId) { const parent = idToNote.get(cur.parentId); if (!parent) break; segments.unshift(parent.title); cur = parent }
      return segments.join('/')
    }
    let existing = target.includes('/') ? notes.find(n => !n.isFolder && getFullPath(n) === target) : undefined
    if (!existing) existing = notes.find(n => !n.isFolder && n.title === target)
    if (!existing) existing = notes.find(n => n.aliases.some(a => a.toLowerCase() === target.toLowerCase()))
    if (existing) { setActiveId(existing.id); setSelectedImage(null) }
    else if (canEdit && activeProject) {
      const newTitle = target.includes('/') ? target.split('/').pop()! : target
      fetch(`${API}/api/projects/${activeProject.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ title: newTitle }),
      }).then(r => r.ok ? r.json() : null).then(n => { if (n?.id) { setActiveId(n.id); setSelectedImage(null) } }).catch(() => {})
    }
  }, [notes, canEdit, activeProject, authToken])

  if (!authToken) return <LoginPage onLogin={handleLogin} />

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="h-10 flex items-center bg-[#181825] border-b border-border px-3 gap-3 shrink-0">
          <span className="text-foreground font-bold shrink-0">Websidian</span>

          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            token={authToken}
            onSelect={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
            onRefreshProjects={refreshProjects}
          />

          {isOwnerOrAdmin && activeProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Project settings</TooltipContent>
            </Tooltip>
          )}

          {activeProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setShowGraph(true)}>
                  <Hexagon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Graph view</TooltipContent>
            </Tooltip>
          )}

          {activeId && canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setPreviewMode(m => !m)}>
                  {previewMode ? <PencilLine className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}</TooltipContent>
            </Tooltip>
          )}

          <PresenceBar awareness={awareness} />
          {!synced && activeId && <span className="text-muted-foreground text-xs">syncing…</span>}

          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={`w-7 h-7 ${showLinks ? 'text-primary' : 'text-muted-foreground'}`} onClick={() => setShowLinks(s => !s)}>
                  <PanelRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle links panel</TooltipContent>
            </Tooltip>
            {userImage && <img src={userImage} alt={userName} className="w-[22px] h-[22px] rounded-full object-cover" />}
            <span className="text-muted-foreground text-xs">{userName}</span>
            <Button variant="outline" size="sm" className="h-6 text-xs text-muted-foreground" onClick={handleLogout}>Sign out</Button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar column */}
          <div className="flex flex-col w-60 shrink-0 border-r border-border bg-background overflow-hidden">
            <Sidebar
              notes={notes}
              activeId={activeId}
              canEdit={canEdit}
              onSelect={id => { setActiveId(id); setSelectedImage(null) }}
              onNewNote={parentId => {
                if (!canEdit) return
                createNote('Untitled', { parentId }).then(note => { if (note?.id) { setActiveId(note.id); setSelectedImage(null) } })
                setPreviewMode(false)
              }}
              onNewFolder={parentId => { if (!canEdit) return; createNote('New Folder', { parentId, isFolder: true }) }}
              onRename={(id, title) => renameNote(id, title)}
              onDelete={id => { deleteNote(id); if (activeId === id) setActiveId(null) }}
              onMove={(id, parentId) => moveNote(id, parentId)}
              onUploadImage={uploadImage}
              images={images}
              selectedImageId={selectedImage?.id ?? null}
              onSelectImage={img => { setSelectedImage(img); setActiveId(null) }}
              onRenameImage={async (id, filename) => {
                const ok = await renameImage(id, filename)
                if (ok && selectedImage?.id === id) setSelectedImage({ ...selectedImage, filename })
              }}
            />
          </div>

          {/* Main content */}
          {selectedImage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
              <p className="text-muted-foreground text-xs mb-3">{selectedImage.filename}</p>
              <img
                src={`/api/projects/${selectedImage.projectId}/images/${selectedImage.id}`}
                alt={selectedImage.filename}
                className="max-w-full max-h-[80vh] rounded-md block"
              />
            </div>
          ) : activeId && yText ? (
            previewMode
              ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} images={images} />
              : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )}

          {/* Links panel */}
          <div
            className="overflow-hidden shrink-0 transition-[width] duration-200"
            style={{ width: showLinks ? 260 : 0 }}
          >
            <LinksPanel noteId={activeId} projectId={activeProject?.id ?? null} token={authToken} onSelect={id => { setActiveId(id); setSelectedImage(null) }} />
          </div>
        </div>

        {/* Modals */}
        {showSettings && activeProject && authToken && (
          <ProjectSettings project={activeProject} token={authToken} onClose={() => setShowSettings(false)}
            onUpdated={updates => setActiveProject({ ...activeProject, ...updates } as Project)} />
        )}
        {showGraph && activeProject && (
          <NoteGraph notes={notes} projectId={activeProject.id} token={authToken}
            onSelect={id => { setActiveId(id); setShowGraph(false) }} onClose={() => setShowGraph(false)} />
        )}
        {showSearch && activeProject && (
          <SearchModal projectId={activeProject.id} token={authToken} notes={notes}
            onSelect={id => { setActiveId(id); setSelectedImage(null); setShowSearch(false) }} onClose={() => setShowSearch(false)} />
        )}
      </div>
    </TooltipProvider>
  )
}
