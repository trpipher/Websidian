import { useState } from 'react'
import type { Project } from '@websidian/shared'
import { readVault } from '../lib/vaultImport'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  token: string | null
  onCreated: (project: Project) => void
  onClose: () => void
}

type Step = 'form' | 'importing' | 'error'

export default function NewProjectModal({ token, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [notesTotal, setNotesTotal] = useState(0)
  const [notesDone, setNotesDone] = useState(false)
  const [imagesTotal, setImagesTotal] = useState(0)
  const [imagesDone, setImagesDone] = useState(0)

  const supportsFilePicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  const handlePickVault = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
      setVaultHandle(handle)
    } catch {
      // User cancelled or permission denied — do nothing
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !token) return
    setStep('importing')
    setErrorMsg('')

    // Step 1: Create project
    const projRes = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!projRes.ok) {
      setErrorMsg('Failed to create project.')
      setStep('error')
      return
    }
    const project = await projRes.json() as Project

    if (vaultHandle) {
      // Step 2: Read vault from disk
      const vaultData = await readVault(vaultHandle)
      setNotesTotal(vaultData.notes.length)

      if (vaultData.notes.length > 0) {
        // Step 3: Batch import notes
        const importRes = await fetch(`${API}/api/projects/${project.id}/import/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notes: vaultData.notes }),
        })
        if (!importRes.ok) {
          setErrorMsg('Project created but notes import failed. You can add notes manually.')
          setStep('error')
          onCreated(project)
          return
        }
      }
      setNotesDone(true)

      // Step 4: Upload images one by one
      setImagesTotal(vaultData.images.length)
      for (const { file } of vaultData.images) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`${API}/api/projects/${project.id}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }).catch(() => {})
        setImagesDone(d => d + 1)
      }
    }

    onCreated(project)
  }

  const inputStyle = {
    flex: 1, background: '#313244', border: 'none', borderRadius: 4,
    color: '#cdd6f4', fontSize: 13, padding: '6px 8px', outline: 'none',
  } as const

  const btnPrimary = {
    background: '#89b4fa', border: 'none', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, padding: '5px 14px', color: '#1e1e2e', fontWeight: 600,
  } as const

  const btnSecondary = {
    background: '#313244', border: 'none', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, padding: '5px 14px', color: '#cdd6f4',
  } as const

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
      }}
    >
      <div style={{
        background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8,
        padding: 24, minWidth: 340, maxWidth: 480, width: '100%',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#cdd6f4', marginBottom: 18 }}>
          New Project
        </div>

        {(step === 'form' || step === 'error') && (
          <>
            <div style={{ marginBottom: 12 }}>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
                placeholder="Project name"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {supportsFilePicker && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 6 }}>
                  Import from Obsidian vault (optional)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={handlePickVault} style={btnSecondary}>
                    Choose folder
                  </button>
                  {vaultHandle && (
                    <span style={{ fontSize: 12, color: '#a6e3a1' }}>
                      📁 {vaultHandle.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {step === 'error' && (
              <div style={{ color: '#f38ba8', fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreate} disabled={!name.trim()} style={{
                ...btnPrimary,
                opacity: name.trim() ? 1 : 0.4,
                cursor: name.trim() ? 'pointer' : 'default',
              }}>
                {vaultHandle ? 'Create & Import' : 'Create'}
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={{ fontSize: 13, color: '#cdd6f4', lineHeight: 2 }}>
            <div>Creating project… ✓</div>
            {notesTotal > 0 && (
              <div>
                Importing notes… {notesDone ? '✓' : `(${notesTotal} notes)`}
              </div>
            )}
            {notesDone && imagesTotal > 0 && (
              <div>
                Uploading images… {imagesDone >= imagesTotal
                  ? '✓'
                  : `(${imagesDone} / ${imagesTotal})`}
              </div>
            )}
            {notesDone && (imagesTotal === 0 || imagesDone >= imagesTotal) && (
              <div style={{ color: '#a6e3a1' }}>Done ✓</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
