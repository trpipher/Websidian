import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor'
import MarkdownPreview from './components/MarkdownPreview'
import Sidebar from './components/Sidebar'
import LoginPage from './components/LoginPage'
import ProjectSettings from './components/ProjectSettings'
import LinksPanel from './components/LinksPanel'
import NoteGraph from './components/NoteGraph'
import SearchModal from './components/SearchModal'
import TopBar from './components/TopBar'
import AppLayout from './components/AppLayout'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'
import { useImages } from './hooks/useImages'
import { useProjects } from './hooks/useProjects'
import { useProjectContext } from './contexts/ProjectContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { readVault, readVaultFromFileList } from './lib/vaultImport'
import type { Project, ImageMeta } from '@websidian/shared'
import { type EditorView } from '@codemirror/view'
import MarkdownToolbar from './components/MarkdownToolbar'
import { useBreakpoint } from './hooks/useBreakpoint'

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const { isMobile, isTablet, isPortrait } = useBreakpoint()
  const useDrawer = isMobile || (isTablet && isPortrait)
  const showMobileToolbar = isMobile || (isTablet && isPortrait)

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
  const { notes, createNote, renameNote, deleteNote, moveNote, importNotes } = useNotes(activeProject?.id ?? null, authToken)
  const { images, uploadImage, renameImage, deleteImage } = useImages(activeProject?.id ?? null, authToken)
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
        <TopBar
          userName={userName}
          userImage={userImage}
          activeProject={activeProject}
          projects={projects}
          token={authToken}
          isOwnerOrAdmin={isOwnerOrAdmin}
          canEdit={canEdit}
          activeId={activeId}
          previewMode={previewMode}
          showLinks={showLinks}
          synced={synced}
          awareness={awareness}
          isMobile={useDrawer}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onSelectProject={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
          onRefreshProjects={refreshProjects}
          onShowSettings={() => setShowSettings(true)}
          onShowGraph={() => setShowGraph(true)}
          onTogglePreview={() => setPreviewMode(m => !m)}
          onToggleLinks={() => setShowLinks(s => !s)}
          onLogout={handleLogout}
        />

        <AppLayout
          sidebar={
            <Sidebar
              notes={notes}
              activeId={activeId}
              canEdit={canEdit}
              onSelect={id => { setActiveId(id); setSelectedImage(null); setIsDrawerOpen(false) }}
              onNewNote={parentId => {
                if (!canEdit) return
                createNote('Untitled', { parentId }).then(note => { if (note?.id) { setActiveId(note.id); setSelectedImage(null) } })
                setPreviewMode(false)
                setIsDrawerOpen(false)
              }}
              onNewFolder={parentId => { if (!canEdit) return; createNote('New Folder', { parentId, isFolder: true }) }}
              onRename={(id, title) => renameNote(id, title)}
              onDelete={id => { deleteNote(id); if (activeId === id) setActiveId(null) }}
              onMove={(id, parentId, sortOrder) => moveNote(id, parentId, sortOrder)}
              onUploadImage={uploadImage}
              onImportNotes={importNotes}
              onImportVault={async source => {
                if (!activeProject || !authToken) return { notes: 0, images: 0 }
                const vault = source instanceof FileList
                  ? await readVaultFromFileList(source)
                  : await readVault(source)

                let importedNotes = 0
                if (vault.notes.length > 0) {
                  const res = await fetch(`${API}/api/projects/${activeProject.id}/import/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ notes: vault.notes }),
                  })
                  if (res.ok) importedNotes = vault.notes.filter(n => !n.isFolder).length
                }

                let importedImages = 0
                for (const { file } of vault.images) {
                  const fd = new FormData()
                  fd.append('file', file)
                  const res = await fetch(`${API}/api/projects/${activeProject.id}/images`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: fd,
                  })
                  if (res.ok) importedImages++
                }

                return { notes: importedNotes, images: importedImages }
              }}
              images={images}
              selectedImageId={selectedImage?.id ?? null}
              onSelectImage={img => { setSelectedImage(img); setActiveId(null) }}
              onRenameImage={async (id, filename) => {
                const ok = await renameImage(id, filename)
                if (ok && selectedImage?.id === id) setSelectedImage({ ...selectedImage, filename })
              }}
              onDeleteImage={async (id) => {
                const ok = await deleteImage(id)
                if (ok && selectedImage?.id === id) setSelectedImage(null)
                return ok
              }}
            />
          }
          linksPanel={
            <LinksPanel
              noteId={activeId}
              projectId={activeProject?.id ?? null}
              token={authToken}
              onSelect={id => { setActiveId(id); setSelectedImage(null) }}
            />
          }
          showLinks={showLinks}
          isDrawerOpen={isDrawerOpen}
          onCloseDrawer={() => setIsDrawerOpen(false)}
        >
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
              : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} onReady={setEditorView} className={showMobileToolbar ? 'pb-14' : ''} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )}
        </AppLayout>

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

        <MarkdownToolbar view={editorView} />
      </div>
    </TooltipProvider>
  )
}
