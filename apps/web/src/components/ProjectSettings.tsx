import { useState, useEffect } from 'react'
import type { Project, ProjectMember, InviteInfo, ProjectRole } from '@websidian/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  project: Project
  token: string
  onClose: () => void
  onUpdated: (updates: Partial<Project>) => void
}

export default function ProjectSettings({ project, token, onClose, onUpdated }: Props) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [isPublic, setIsPublic] = useState(project.isPublic)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [invites, setInvites] = useState<InviteInfo[]>([])
  const [newInviteRole, setNewInviteRole] = useState<ProjectRole>('editor')

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const roles: ProjectRole[] = ['admin', 'editor', 'viewer']

  useEffect(() => {
    fetch(`${API}/api/projects/${project.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setMembers)
    fetch(`${API}/api/projects/${project.id}/invites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setInvites)
  }, [project.id, token])

  const saveGeneral = async () => {
    await fetch(`${API}/api/projects/${project.id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name, description, isPublic }),
    })
    onUpdated({ name, description, isPublic })
  }

  const changeMemberRole = async (userId: string, role: ProjectRole) => {
    await fetch(`${API}/api/projects/${project.id}/members/${userId}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ role }),
    })
    setMembers(ms => ms.map(m => m.userId === userId ? { ...m, role } : m))
  }

  const removeMember = async (userId: string) => {
    await fetch(`${API}/api/projects/${project.id}/members/${userId}`, { method: 'DELETE', headers: authHeaders })
    setMembers(ms => ms.filter(m => m.userId !== userId))
  }

  const createInvite = async () => {
    const res = await fetch(`${API}/api/projects/${project.id}/invites`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ role: newInviteRole }),
    })
    if (res.ok) {
      const newInvite = await res.json() as InviteInfo
      setInvites(i => [newInvite, ...i])
    }
  }

  const revokeInvite = async (inviteId: string) => {
    await fetch(`${API}/api/projects/${project.id}/invites/${inviteId}`, { method: 'DELETE', headers: authHeaders })
    setInvites(i => i.filter(x => x.id !== inviteId))
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-[#181825] border-border w-[540px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-4 pb-0 border-b border-border shrink-0">
          <DialogTitle className="text-foreground">{project.name} — Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="justify-start rounded-none border-b border-border bg-transparent px-4 h-auto pb-0 shrink-0">
            {(['general', 'members', 'invites'] as const).map(t => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-muted-foreground pb-2"
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="overflow-y-auto flex-1 p-5">
            <TabsContent value="general" className="mt-0 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Project name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="public" className="text-sm cursor-pointer">Public — anyone can view without logging in</Label>
              </div>
              <Button size="sm" onClick={saveGeneral} className="w-fit">Save changes</Button>
            </TabsContent>

            <TabsContent value="members" className="mt-0 flex flex-col gap-1">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-foreground">{m.userName}</span>
                  <div className="flex gap-2 items-center">
                    {m.role === 'owner' ? (
                      <span className="text-xs text-ctp-peach">Owner</span>
                    ) : (
                      <>
                        <select
                          value={m.role}
                          onChange={e => changeMemberRole(m.userId, e.target.value as ProjectRole)}
                          className="bg-card border-none text-foreground rounded text-xs px-1.5 py-1 focus:outline-none"
                        >
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <Button variant="ghost" size="sm" onClick={() => removeMember(m.userId)} className="text-destructive h-auto py-0.5 px-1.5 text-xs">Remove</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && <p className="text-muted-foreground text-sm">No members yet.</p>}
            </TabsContent>

            <TabsContent value="invites" className="mt-0 flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <select
                  value={newInviteRole}
                  onChange={e => setNewInviteRole(e.target.value as ProjectRole)}
                  className="bg-card border-none text-foreground rounded text-sm px-2 py-1.5 focus:outline-none"
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Button size="sm" onClick={createInvite}>Generate link</Button>
              </div>
              {invites.map(inv => (
                <div key={inv.id} className="bg-background rounded-md p-3">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Role: <span className="text-foreground">{inv.role}</span>
                    {' · '}Uses: {inv.useCount}{inv.maxUses ? `/${inv.maxUses}` : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-primary break-all">{window.location.origin}/invite/{inv.token}</code>
                    <Button variant="secondary" size="sm" className="text-xs shrink-0" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`)}>Copy</Button>
                    <Button variant="ghost" size="sm" className="text-destructive text-xs shrink-0" onClick={() => revokeInvite(inv.id)}>Revoke</Button>
                  </div>
                </div>
              ))}
              {invites.length === 0 && <p className="text-muted-foreground text-sm">No active invite links.</p>}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
