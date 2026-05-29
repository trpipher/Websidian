import { useState } from 'react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  onLogin: (token: string, name: string) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    setLoading(true)
    const endpoint = mode === 'signin'
      ? '/api/auth/sign-in/email'
      : '/api/auth/sign-up/email'

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || email }),
        credentials: 'include',
      })

      if (!res.ok) {
        const body = await res.text()
        setError(body || 'Something went wrong')
        return
      }

      const data = await res.json()
      const token = data.token ?? data.session?.token
      if (!token) { setError('Auth succeeded but no token received'); return }
      const userName = data.user?.name ?? email
      onLogin(token, userName)
    } catch (e) {
      setError('Network error — is the sync server running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', marginBottom: 8,
    background: '#313244', border: 'none', borderRadius: 4,
    color: '#cdd6f4', fontSize: 14, boxSizing: 'border-box',
  }

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '8px 0', background: '#89b4fa',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
    opacity: loading ? 0.6 : 1,
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e2e' }}>
      <div style={{ background: '#181825', padding: 32, borderRadius: 8, width: 320, color: '#cdd6f4' }}>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>Websidian</h2>
        {mode === 'signup' && (
          <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)}
            style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        )}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={inputStyle} type="email" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={inputStyle} type="password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {error && <div style={{ color: '#f38ba8', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button onClick={submit} disabled={loading} style={btnStyle}>
          {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
          style={{ ...btnStyle, background: 'transparent', color: '#89b4fa', marginTop: 8 }}>
          {mode === 'signin' ? 'Create account' : 'Already have an account'}
        </button>
      </div>
    </div>
  )
}
