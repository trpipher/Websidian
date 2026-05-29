import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Project, ProjectRole } from '@websidian/shared'

interface ProjectContextValue {
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  userRole: ProjectRole | null
}

const ProjectContext = createContext<ProjectContextValue>({
  activeProject: null,
  setActiveProject: () => {},
  userRole: null,
})

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  return (
    <ProjectContext.Provider value={{
      activeProject,
      setActiveProject,
      userRole: (activeProject?.role ?? null) as ProjectRole | null,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  return useContext(ProjectContext)
}
