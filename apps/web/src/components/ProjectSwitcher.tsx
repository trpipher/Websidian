import { useState } from 'react'
import type { Project } from '@websidian/shared'

interface Props {
  projects: Project[]
  activeProject: Project | null
  onSelect: (project: Project) => void
  onCreate: (name: string) => Promise<Project | null>
}

export default function ProjectSwitcher({ projects, activeProject, onSelect, onCreate }: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    const p = await onCreate(newName.trim())
    if (p) {
      setNewName('')
      setCreating(false)
      setOpen(false)
      onSelect(p)
    }
  }

  return (
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
              {p.isPublic && <span style={{ fontSize: 10, color: '#6c7086', marginLeft: 6 }}>public</span>}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #313244', marginTop: 6, paddingTop: 6 }}>
            {creating ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="Project name"
                  style={{
                    flex: 1, background: '#313244', border: 'none', borderRadius: 4,
                    color: '#cdd6f4', fontSize: 12, padding: '4px 6px',
                  }}
                />
                <button
                  onClick={handleCreate}
                  style={{ background: '#89b4fa', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
                >
                  Create
                </button>
              </div>
            ) : (
              <div
                onClick={() => setCreating(true)}
                style={{ color: '#89b4fa', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
              >
                + New project
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
