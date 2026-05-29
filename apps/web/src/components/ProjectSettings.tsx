import { useState, useEffect } from 'react'
import type { Project, ProjectMember, InviteInfo, ProjectRole } from '@websidian/shared'

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
  const [tab, setTab] = useState<'general' | 'members' | 'invites'>('general')
  const [newInviteRole, setNewInviteRole] = useState<ProjectRole>('editor')

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch(`${API}/api/projects/${project.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setMembers)
    fetch(`${API}/api/projects/${project.id}/invites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setInvites)
  }, [project.id, token])

  const saveGeneral = async () => {
    await fetch(`${API}/api/projects/${project.id}`, {
      method: 'PATCH', headers: authHeaders,
      body: JSON.stringify({ name, description, isPublic }),
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

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '6px 16px', cursor: 'pointer', fontSize: 13, background: 'none', border: 'none',
    borderBottom: tab === t ? '2px solid #89b4fa' : '2px solid transparent',
    color: tab === t ? '#89b4fa' : '#6c7086',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: '#313244', border: 'none',
    borderRadius: 4, color: '#cdd6f4', fontSize: 14, boxSizing: 'border-box', marginTop: 4,
  }

  const roles: ProjectRole[] = ['admin', 'editor', 'viewer']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#181825', borderRadius: 8, width: 540, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', color: '#cdd6f4',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #313244' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{project.name} — Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #313244', paddingLeft: 4 }}>
          {(['general', 'members', 'invites'] as const).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, color: '#6c7086' }}>
                Project name
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: '#6c7086' }}>
                Description
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  style={{ ...inputStyle, resize: 'vertical' as const }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                Public — anyone can view notes without logging in
              </label>
              <button onClick={saveGeneral}
                style={{ padding: '7px 16px', background: '#89b4fa', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, color: '#1e1e2e', width: 'fit-content' }}>
                Save changes
              </button>
            </div>
          )}

          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid #313244' }}>
                  <span style={{ fontSize: 13 }}>{m.userName}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.role === 'owner' ? (
                      <span style={{ fontSize: 12, color: '#fab387' }}>Owner</span>
                    ) : (
                      <>
                        <select value={m.role} onChange={e => changeMemberRole(m.userId, e.target.value as ProjectRole)}
                          style={{ background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 4, fontSize: 12, padding: '3px 6px' }}>
                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => removeMember(m.userId)}
                          style={{ background: 'none', border: 'none', color: '#f38ba8', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && <div style={{ color: '#6c7086', fontSize: 13 }}>No members yet.</div>}
            </div>
          )}

          {tab === 'invites' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={newInviteRole} onChange={e => setNewInviteRole(e.target.value as ProjectRole)}
                  style={{ background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 4, fontSize: 13, padding: '5px 8px' }}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={createInvite}
                  style={{ padding: '5px 14px', background: '#89b4fa', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: '#1e1e2e', fontWeight: 600 }}>
                  Generate link
                </button>
              </div>
              {invites.map(inv => (
                <div key={inv.id} style={{ background: '#1e1e2e', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 6 }}>
                    Role: <span style={{ color: '#cdd6f4' }}>{inv.role}</span>
                    {' · '}Uses: {inv.useCount}{inv.maxUses ? `/${inv.maxUses}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontSize: 11, color: '#89b4fa', wordBreak: 'break-all' as const }}>
                      {window.location.origin}/invite/{inv.token}
                    </code>
                    <button onClick={() => copyLink(inv.token)}
                      style={{ background: '#313244', border: 'none', borderRadius: 4, color: '#cdd6f4', cursor: 'pointer', fontSize: 11, padding: '3px 10px', flexShrink: 0 }}>
                      Copy
                    </button>
                    <button onClick={() => revokeInvite(inv.id)}
                      style={{ background: 'none', border: 'none', color: '#f38ba8', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
              {invites.length === 0 && <div style={{ color: '#6c7086', fontSize: 13 }}>No active invite links.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
