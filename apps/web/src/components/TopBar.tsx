// apps/web/src/components/TopBar.tsx
import { Settings, Hexagon, PencilLine, BookOpen, PanelRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ProjectSwitcher from './ProjectSwitcher'
import PresenceBar from './PresenceBar'
import type { Project } from '@websidian/shared'
import type { Awareness } from 'y-protocols/awareness'

interface Props {
  userName: string
  userImage: string | null
  activeProject: Project | null
  projects: Project[]
  token: string | null
  isOwnerOrAdmin: boolean
  canEdit: boolean
  activeId: string | null
  previewMode: boolean
  showLinks: boolean
  synced: boolean
  awareness: Awareness | null
  isMobile: boolean
  onOpenDrawer: () => void
  onSelectProject: (p: Project | null) => void
  onRefreshProjects: () => void
  onShowSettings: () => void
  onShowGraph: () => void
  onTogglePreview: () => void
  onToggleLinks: () => void
  onLogout: () => void
}

export default function TopBar({
  userName, userImage, activeProject, projects, token,
  isOwnerOrAdmin, canEdit, activeId, previewMode, showLinks, synced, awareness,
  isMobile, onOpenDrawer, onSelectProject, onRefreshProjects,
  onShowSettings, onShowGraph, onTogglePreview, onToggleLinks, onLogout,
}: Props) {
  return (
    <header className="h-10 flex items-center bg-[#181825] border-b border-border px-3 gap-3 shrink-0">
      {isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground shrink-0" onClick={onOpenDrawer}>
              <Menu className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open sidebar</TooltipContent>
        </Tooltip>
      )}

      {!isMobile && <span className="text-foreground font-bold shrink-0">Websidian</span>}

      {!isMobile && (
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          token={token}
          onSelect={onSelectProject}
          onRefreshProjects={onRefreshProjects}
        />
      )}

      {isMobile && activeProject && (
        <span className="text-foreground text-sm font-medium truncate flex-1">{activeProject.name}</span>
      )}

      {isOwnerOrAdmin && activeProject && !isMobile && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onShowSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Project settings</TooltipContent>
        </Tooltip>
      )}

      {activeProject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onShowGraph}>
              <Hexagon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Graph view</TooltipContent>
        </Tooltip>
      )}

      {activeId && canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onTogglePreview}>
              {previewMode ? <PencilLine className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}</TooltipContent>
        </Tooltip>
      )}

      {!isMobile && <PresenceBar awareness={awareness} />}
      {!isMobile && !synced && activeId && <span className="text-muted-foreground text-xs">syncing…</span>}

      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={`w-7 h-7 ${showLinks ? 'text-primary' : 'text-muted-foreground'}`} onClick={onToggleLinks}>
              <PanelRight className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle links panel</TooltipContent>
        </Tooltip>
        {!isMobile && userImage && <img src={userImage} alt={userName} className="w-[22px] h-[22px] rounded-full object-cover" />}
        {!isMobile && <span className="text-muted-foreground text-xs">{userName}</span>}
        <Button variant="outline" size="sm" className="h-6 text-xs text-muted-foreground" onClick={onLogout}>Sign out</Button>
      </div>
    </header>
  )
}
