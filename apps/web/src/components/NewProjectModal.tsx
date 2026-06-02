import { useState, useRef } from 'react'
import type { Project } from '@websidian/shared'
import { readVault, readVaultFromFileList } from '../lib/vaultImport'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [fileList, setFileList] = useState<FileList | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [notesTotal, setNotesTotal] = useState(0)
  const [notesDone, setNotesDone] = useState(false)
  const [imagesTotal, setImagesTotal] = useState(0)
  const [imagesDone, setImagesDone] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const vaultName = vaultHandle?.name
    ?? (fileList ? fileList[0]?.webkitRelativePath.split('/')[0] : null)

  const handlePickVault = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
        setVaultHandle(handle); setFileList(null); setErrorMsg('')
      } catch { /* user cancelled */ }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileList(e.target.files); setVaultHandle(null); setErrorMsg('')
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !token) return
    setStep('importing')
    const projRes = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!projRes.ok) { setErrorMsg('Failed to create project.'); setStep('error'); return }
    const project = await projRes.json() as Project

    if (vaultHandle || fileList) {
      const vaultData = vaultHandle ? await readVault(vaultHandle) : await readVaultFromFileList(fileList!)
      setNotesTotal(vaultData.notes.length)
      if (vaultData.notes.length > 0) {
        const importRes = await fetch(`${API}/api/projects/${project.id}/import/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ notes: vaultData.notes }),
        })
        if (!importRes.ok) { setErrorMsg('Notes import failed.'); setStep('error'); onCreated(project); return }
      }
      setNotesDone(true)
      setImagesTotal(vaultData.images.length)
      for (const { file } of vaultData.images) {
        const fd = new FormData(); fd.append('file', file)
        await fetch(`${API}/api/projects/${project.id}/images`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        }).catch(() => {})
        setImagesDone(d => d + 1)
      }
    }
    if (vaultHandle || fileList) await new Promise(r => setTimeout(r, 800))
    onCreated(project)
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-background border-border w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Project</DialogTitle>
        </DialogHeader>

        {(step === 'form' || step === 'error') && (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
              placeholder="Project name"
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Import from Obsidian vault (optional)</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handlePickVault}>Choose folder</Button>
                {vaultName && <span className="text-xs text-ctp-green">📁 {vaultName}</span>}
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}
                // @ts-expect-error webkitdirectory not in React types
                webkitdirectory="true" />
            </div>
            {step === 'error' && <p className="text-destructive text-xs">{errorMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" disabled={!name.trim()} onClick={handleCreate}>
                {vaultHandle || fileList ? 'Create & Import' : 'Create'}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-sm text-foreground leading-loose">
            <div>Creating project… ✓</div>
            {notesTotal > 0 && <div>Importing notes… {notesDone ? '✓' : `(${notesTotal} notes)`}</div>}
            {notesDone && imagesTotal > 0 && (
              <div>Uploading images… {imagesDone >= imagesTotal ? '✓' : `(${imagesDone} / ${imagesTotal})`}</div>
            )}
            {notesDone && (imagesTotal === 0 || imagesDone >= imagesTotal) && (
              <div className="text-ctp-green">Done ✓</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
