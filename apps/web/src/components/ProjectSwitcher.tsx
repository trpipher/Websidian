import { useState } from 'react'
import type { Project } from '@websidian/shared'
import NewProjectModal from './NewProjectModal'

interface Props {
  projects: Project[]
  activeProject: Project | null
  token: string | null
  onSelect: (project: Project) => void
  onRefreshProjects: () => void
}

export default function ProjectSwitcher({ projects, activeProject, token, onSelect, onRefreshProjects }: Props) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const handleProjectCreated = (project: Project) => {
    setShowModal(false)
    setOpen(false)
    onRefreshProjects()
    onSelect(project)
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'transparent',
            border: '1px solid #313244',
            borderRadius: 4,
            color: '#cdd6f4',
            cursor: 'pointer',
            fontSize: 13,
            padding: '2px 8px',
          }}
        >
          {activeProject?.name ?? 'Select project'} ▾
        </button>

        {open && (
          <div style={{
            position: 'absolute',
            top: 32,
            left: 0,
            background: '#181825',
            border: '1px solid #313244',
            borderRadius: 6,
            minWidth: 200,
            zIndex: 100,
            padding: 8,
          }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false) }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: p.id === activeProject?.id ? '#89b4fa' : '#cdd6f4',
                  background: p.id === activeProject?.id ? '#313244' : 'transparent',
                }}
              >
                {p.name}
                {!!p.isPublic && <span style={{ fontSize: 10, color: '#6c7086', marginLeft: 6 }}>public</span>}
              </div>
            ))}

            <div style={{ borderTop: '1px solid #313244', marginTop: 6, paddingTop: 6 }}>
              <div
                onClick={() => { setShowModal(true); setOpen(false) }}
                style={{ color: '#89b4fa', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
              >
                + New project
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          token={token}
          onCreated={handleProjectCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
