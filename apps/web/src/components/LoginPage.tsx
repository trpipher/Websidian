import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
      if (!res.ok) { setError((await res.text()) || 'Something went wrong'); return }
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
        body: JSON.stringify({
          provider: 'discord',
          callbackURL: window.location.href.includes('?redirect=')
            ? window.location.href
            : window.location.origin,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data?.url) { window.location.href = data.url }
      else { setError('Discord sign-in failed — no redirect URL returned'); setLoading(false) }
    } catch {
      setError('Network error — is the sync server running?')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="bg-[#181825] p-8 rounded-lg w-80 text-foreground">
        <h2 className="mt-0 mb-6 text-xl font-bold">Websidian</h2>

        <Button
          onClick={signInWithDiscord}
          disabled={loading}
          className="w-full mb-4 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold"
        >
          Sign in with Discord
        </Button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted-foreground text-xs">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {mode === 'signup' && (
          <Input
            placeholder="Display name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="mb-2"
          />
        )}
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="mb-2"
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="mb-2"
        />
        {error && <p className="text-destructive text-xs mb-2">{error}</p>}

        <Button
          onClick={submit}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold"
        >
          {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
          className="w-full mt-2 text-primary"
        >
          {mode === 'signin' ? 'Create account' : 'Already have an account'}
        </Button>
      </div>
    </div>
  )
}
