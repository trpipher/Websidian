import { useState } from 'react'
import type { Project } from '@websidian/shared'
import NewProjectModal from './NewProjectModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

interface Props {
  projects: Project[]
  activeProject: Project | null
  token: string | null
  onSelect: (project: Project) => void
  onRefreshProjects: () => void
}

export default function ProjectSwitcher({ projects, activeProject, token, onSelect, onRefreshProjects }: Props) {
  const [showModal, setShowModal] = useState(false)

  const handleProjectCreated = (project: Project) => {
    setShowModal(false)
    onRefreshProjects()
    onSelect(project)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 bg-transparent border border-border rounded px-2 py-0.5 text-foreground text-sm cursor-pointer hover:bg-card">
            {activeProject?.name ?? 'Select project'}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {projects.map(p => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => onSelect(p)}
              className={p.id === activeProject?.id ? 'text-primary bg-card' : ''}
            >
              {p.name}
              {!!p.isPublic && <span className="ml-2 text-[10px] text-muted-foreground">public</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowModal(true)} className="text-primary">
            + New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showModal && (
        <NewProjectModal token={token} onCreated={handleProjectCreated} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
