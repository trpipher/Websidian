import { useState } from 'react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props {
  onLogin: (token: string, name: string, image?: string | null) => void
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
      onLogin(token, data.user?.name ?? email, data.user?.image ?? null)
    } catch {
      setError('Network error — is the sync server running?')
    } finally {
      setLoading(false)
    }
  }

  const signInWithDiscord = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'discord', callbackURL: window.location.origin }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      } else {
        setError('Discord sign-in failed — no redirect URL returned')
        setLoading(false)
      }
    } catch {
      setError('Network error — is the sync server running?')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', marginBottom: 8,
    background: '#313244', border: 'none', borderRadius: 4,
    color: '#cdd6f4', fontSize: 14, boxSizing: 'border-box',
  }

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '8px 0',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700,
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e2e' }}>
      <div style={{ background: '#181825', padding: 32, borderRadius: 8, width: 320, color: '#cdd6f4' }}>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>Websidian</h2>

        <button
          onClick={signInWithDiscord}
          style={{ ...btnStyle, background: '#5865F2', color: '#fff', marginBottom: 16, opacity: loading ? 0.6 : 1 }}
        >
          Sign in with Discord
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#313244' }} />
          <span style={{ color: '#6c7086', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#313244' }} />
        </div>

        {mode === 'signup' && (
          <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)}
            style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        )}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={inputStyle} type="email" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={inputStyle} type="password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {error && <div style={{ color: '#f38ba8', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button onClick={submit} disabled={loading}
          style={{ ...btnStyle, background: '#89b4fa', color: '#1e1e2e', opacity: loading ? 0.6 : 1 }}>
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
