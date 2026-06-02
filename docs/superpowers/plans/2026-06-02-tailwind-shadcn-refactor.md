# Tailwind + Shadcn/ui Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline `style={{ }}` props in `apps/web` with Tailwind utility classes and adopt shadcn/ui Radix-backed primitives for interactive components.

**Architecture:** Install Tailwind v3 + shadcn/ui into the existing Vite/React app. Map Catppuccin Mocha colors to shadcn CSS variables. Delete five hand-rolled components (ContextMenu, SortMenu, SearchModal, NewProjectModal shell, ProjectSettings shell) and replace with shadcn primitives; refactor the remaining ten components to pure Tailwind classes.

**Tech Stack:** Tailwind CSS v3, shadcn/ui (Radix UI), lucide-react, @tailwindcss/typography, class-variance-authority, clsx, tailwind-merge

---

## File Map

**Deleted:**
- `apps/web/src/components/ContextMenu.tsx` — replaced by shadcn `ui/context-menu` used inline
- `apps/web/src/components/SortMenu.tsx` — replaced by shadcn `ui/dropdown-menu` inlined in Sidebar

**Created:**
- `apps/web/postcss.config.js`
- `apps/web/tailwind.config.js`
- `apps/web/components.json` — shadcn config
- `apps/web/src/index.css` — Catppuccin CSS vars + Tailwind directives
- `apps/web/src/lib/utils.ts` — `cn()` helper
- `apps/web/src/components/ui/` — shadcn-generated files (button, input, dialog, command, dropdown-menu, context-menu, switch, badge, scroll-area, separator, tooltip, tabs, label)

**Modified:**
- `apps/web/tsconfig.json` — add `@` path alias
- `apps/web/vite.config.ts` — add `resolve.alias` for `@`
- `apps/web/package.json` — add dependencies
- `apps/web/src/main.tsx` — import `index.css`
- All 12 remaining component files — inline styles → Tailwind

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add dependencies**

Run from the repo root:
```bash
pnpm --filter @websidian/web add tailwindcss@^3 autoprefixer postcss @tailwindcss/typography class-variance-authority clsx tailwind-merge lucide-react
pnpm --filter @websidian/web add -D @types/node
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter @websidian/web build 2>&1 | tail -5
```
Expected: still builds (no config yet, Tailwind not imported)

---

### Task 2: Config files

**Files:**
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/components.json`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/utils.ts`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Create `apps/web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 2: Create `apps/web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'ctp-mauve': '#cba6f7',
        'ctp-green': '#a6e3a1',
        'ctp-peach': '#fab387',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#cdd6f4',
            '--tw-prose-headings': '#cdd6f4',
            '--tw-prose-links': '#89b4fa',
            '--tw-prose-bold': '#cdd6f4',
            '--tw-prose-counters': '#6c7086',
            '--tw-prose-bullets': '#6c7086',
            '--tw-prose-hr': '#313244',
            '--tw-prose-quotes': '#6c7086',
            '--tw-prose-quote-borders': '#45475a',
            '--tw-prose-code': '#cdd6f4',
            '--tw-prose-pre-code': '#cdd6f4',
            '--tw-prose-pre-bg': '#181825',
            '--tw-prose-th-borders': '#313244',
            '--tw-prose-td-borders': '#313244',
            maxWidth: 'none',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '15px',
            lineHeight: '1.75',
            'pre': { borderRadius: '6px', padding: '12px 16px' },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            'code': { background: '#313244', borderRadius: '3px', padding: '1px 5px' },
            'table': { width: '100%' },
            'thead th': { background: '#181825' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

- [ ] **Step 3: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 4: Create `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background:           240 21% 15%;
    --foreground:           226 64% 88%;
    --card:                 237 16% 23%;
    --card-foreground:      226 64% 88%;
    --popover:              237 16% 23%;
    --popover-foreground:   226 64% 88%;
    --primary:              217 92% 76%;
    --primary-foreground:   240 21% 15%;
    --secondary:            237 16% 23%;
    --secondary-foreground: 226 64% 88%;
    --muted:                237 16% 23%;
    --muted-foreground:     233 10% 47%;
    --accent:               237 16% 23%;
    --accent-foreground:    226 64% 88%;
    --destructive:          343 81% 75%;
    --destructive-foreground: 240 21% 15%;
    --border:               237 16% 23%;
    --input:                237 16% 23%;
    --ring:                 217 92% 76%;
    --radius:               0.375rem;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: Create `apps/web/src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Update `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Update `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: process.env.VITE_API_URL ?? 'http://localhost:1235', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 8: Update `apps/web/src/main.tsx`** — add CSS import as first line

```tsx
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ProjectProvider } from './contexts/ProjectContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>
)
```

- [ ] **Step 9: Verify TypeScript resolves `@` alias**

```bash
pnpm --filter @websidian/web typecheck 2>&1 | head -20
```
Expected: errors only about missing `@/components/ui/*` (those come in Task 3), not about `@` being unresolvable.

---

### Task 3: Scaffold shadcn UI components

**Files:**
- Create: `apps/web/src/components/ui/` (13 component files)

- [ ] **Step 1: Run shadcn add for all required components**

```bash
cd apps/web && npx shadcn@latest add button input dialog command dropdown-menu context-menu switch badge scroll-area separator tooltip tabs label --overwrite
```

If the CLI asks for confirmation, answer yes. This generates files in `src/components/ui/`.

- [ ] **Step 2: Verify generated files exist**

```bash
ls apps/web/src/components/ui/
```
Expected output includes: `button.tsx`, `input.tsx`, `dialog.tsx`, `command.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `switch.tsx`, `badge.tsx`, `scroll-area.tsx`, `separator.tsx`, `tooltip.tsx`, `tabs.tsx`, `label.tsx`

- [ ] **Step 3: Verify build still passes**

```bash
pnpm --filter @websidian/web build 2>&1 | tail -5
```
Expected: builds successfully (components are generated but not yet used).

---

### Task 4: Refactor LoginPage.tsx

**Files:**
- Modify: `apps/web/src/components/LoginPage.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/LoginPage.tsx`**

```tsx
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
```

---

### Task 5: Refactor PresenceBar.tsx

**Files:**
- Modify: `apps/web/src/components/PresenceBar.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/PresenceBar.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'

interface AwarenessUser { name: string; color: string; image?: string | null }
interface AwarenessState { user?: AwarenessUser }
interface Props { awareness: Awareness | null }

function UserAvatar({ user }: { user: AwarenessUser }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!user.image && !imgFailed
  return (
    <div
      title={user.name}
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ border: `2px solid ${user.color}`, background: showImage ? '#1e1e2e' : user.color }}
    >
      {showImage ? (
        <img src={user.image!} alt={user.name} className="w-full h-full object-cover block" onError={() => setImgFailed(true)} />
      ) : (
        user.name[0]?.toUpperCase()
      )}
    </div>
  )
}

export default function PresenceBar({ awareness }: Props) {
  const [states, setStates] = useState<Map<number, AwarenessState>>(new Map())

  useEffect(() => {
    if (!awareness) return
    const update = () => setStates(new Map(awareness.getStates() as Map<number, AwarenessState>))
    awareness.on('change', update)
    update()
    return () => awareness.off('change', update)
  }, [awareness])

  const users = Array.from(states.values()).map(s => s.user).filter(Boolean) as AwarenessUser[]
  if (users.length === 0) return null

  return (
    <div className="flex gap-1.5 items-center">
      {users.map((u, i) => <UserAvatar key={i} user={u} />)}
    </div>
  )
}
```

Note: `border` color comes from the dynamic awareness user color so it stays as an inline style — this is intentional and correct.

---

### Task 6: Refactor ProjectSwitcher.tsx

**Files:**
- Modify: `apps/web/src/components/ProjectSwitcher.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/ProjectSwitcher.tsx`**

```tsx
import { useState } from 'react'
import type { Project } from '@websidian/shared'
import NewProjectModal from './NewProjectModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

interface Props {
  projects: Project[]
  activeProject: Project | null
  token: string | null
  onSelect: (project: Project) => void
  onRefreshProjects: () => void
}

export default function ProjectSwitcher({ projects, activeProject, token, onSelect, onRefreshProjects }: Props) {
  const [showModal, setShowModal] = useState(false)

  const handleProjectCreated = (project: Project) => {
    setShowModal(false)
    onRefreshProjects()
    onSelect(project)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 bg-transparent border border-border rounded px-2 py-0.5 text-foreground text-sm cursor-pointer hover:bg-card">
            {activeProject?.name ?? 'Select project'}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {projects.map(p => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => onSelect(p)}
              className={p.id === activeProject?.id ? 'text-primary bg-card' : ''}
            >
              {p.name}
              {!!p.isPublic && <span className="ml-2 text-[10px] text-muted-foreground">public</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowModal(true)} className="text-primary">
            + New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showModal && (
        <NewProjectModal token={token} onCreated={handleProjectCreated} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
```

---

### Task 7: Refactor NewProjectModal.tsx

**Files:**
- Modify: `apps/web/src/components/NewProjectModal.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/NewProjectModal.tsx`**

```tsx
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
```

---

### Task 8: Refactor ProjectSettings.tsx

**Files:**
- Modify: `apps/web/src/components/ProjectSettings.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/ProjectSettings.tsx`**

```tsx
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
    if (res.ok) setInvites(i => [await res.json() as InviteInfo, ...i])
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
```

---

### Task 9: Replace SearchModal.tsx with shadcn Command

**Files:**
- Modify: `apps/web/src/components/SearchModal.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/SearchModal.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { NoteMeta } from '@websidian/shared'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from '@/components/ui/command'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface SearchResult {
  id: string
  title: string
  parentId: string | null
  matchType: 'fts' | 'tag' | 'alias' | string
}

interface Props {
  projectId: string
  token: string | null
  notes: NoteMeta[]
  onSelect: (id: string) => void
  onClose: () => void
}

function getFolderPath(notes: NoteMeta[], id: string): string {
  const noteMap = new Map(notes.map(n => [n.id, n]))
  const note = noteMap.get(id)
  if (!note?.parentId) return ''
  const segments: string[] = []
  let cur = noteMap.get(note.parentId)
  while (cur) { segments.unshift(cur.title); cur = cur.parentId ? noteMap.get(cur.parentId) : undefined }
  return segments.join(' / ')
}

export default function SearchModal({ projectId, token, notes, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/search?q=${encodeURIComponent(q)}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((data: SearchResult[]) => setResults(data))
      .catch(() => {})
  }, [projectId, token])

  const handleValueChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 150)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <CommandDialog open onOpenChange={open => !open && onClose()}>
      <CommandInput
        placeholder="Search notes, tags, aliases…"
        value={query}
        onValueChange={handleValueChange}
      />
      <CommandList>
        {query.trim() && results.length === 0 && <CommandEmpty>No results</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup>
            {results.map(r => {
              const folderPath = getFolderPath(notes, r.id)
              return (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => { onSelect(r.id); onClose() }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm text-foreground truncate">{r.title}</div>
                    {folderPath && <div className="text-[11px] text-muted-foreground mt-0.5">{folderPath}</div>}
                  </div>
                  {r.matchType !== 'fts' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 text-background font-medium ${r.matchType === 'tag' ? 'bg-ctp-green' : 'bg-primary'}`}>
                      {r.matchType}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
```

---

### Task 10: Delete SortMenu.tsx

**Files:**
- Delete: `apps/web/src/components/SortMenu.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm apps/web/src/components/SortMenu.tsx
```

The SortMenu logic moves inline into Sidebar.tsx in Task 13. The types (`SortField`, `SortDirection`, `SortConfig`) are redefined in Sidebar.tsx.

---

### Task 11: Delete ContextMenu.tsx

**Files:**
- Delete: `apps/web/src/components/ContextMenu.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm apps/web/src/components/ContextMenu.tsx
```

`ContextMenuItem` type and the ContextMenu component are no longer needed — SidebarItem and Sidebar use shadcn `<ContextMenu>` wrappers directly.

---

### Task 12: Refactor SidebarItem.tsx

**Files:**
- Modify: `apps/web/src/components/SidebarItem.tsx`

Key changes:
- Remove ContextMenu import (deleted), use shadcn context-menu
- Remove `menu` state (x/y position) — Radix handles positioning
- Remove inline `<style>` tag — use Tailwind `group` + `group-hover:opacity-100` for drag handle

- [ ] **Step 1: Rewrite `apps/web/src/components/SidebarItem.tsx`**

```tsx
import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { NoteMeta } from '@websidian/shared'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface Props {
  note: NoteMeta
  depth: number
  isActive: boolean
  isExpanded: boolean
  canEdit: boolean
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string, isFolder: boolean, childCount: number) => void
  onNewNote: (parentId: string) => void
  onNewFolder: (parentId: string) => void
  childCount: number
}

export default function SidebarItem({
  note, depth, isActive, isExpanded, canEdit,
  onSelect, onToggle, onRename, onDelete, onNewNote, onNewFolder, childCount,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: !canEdit,
  })

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== note.title) onRename(note.id, trimmed)
    setIsRenaming(false)
  }

  const startRename = () => {
    setRenameValue(note.title)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, paddingLeft: 8 + depth * 16 }}
          className={`group flex items-center px-2 py-1 rounded cursor-pointer mb-px text-[13px] text-foreground gap-0.5 select-none ${isActive ? 'bg-card' : 'hover:bg-card/50'}`}
          onClick={() => { if (!isRenaming) onSelect(note.id) }}
        >
          {note.isFolder ? (
            <span
              onClick={e => { e.stopPropagation(); onToggle(note.id) }}
              className="w-4 shrink-0 text-muted-foreground text-[10px] flex items-center justify-center"
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
              className="flex-1 bg-card border border-primary rounded-sm text-foreground text-[13px] px-1 py-px focus:outline-none"
            />
          ) : (
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => onSelect(note.id)}>
              {note.isFolder ? '📁 ' : ''}{note.title}
            </span>
          )}

          {canEdit && !isRenaming && (
            <span
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover:opacity-100 text-[#45475a] cursor-grab text-sm px-0.5 shrink-0"
            >
              ⠿
            </span>
          )}
        </div>
      </ContextMenuTrigger>

      {canEdit && (
        <ContextMenuContent>
          <ContextMenuItem onClick={startRename}>Rename</ContextMenuItem>
          {note.isFolder ? (
            <>
              <ContextMenuItem onClick={() => onNewNote(note.id)}>New note inside</ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(note.id)}>New folder inside</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onDelete(note.id, true, childCount)} className="text-destructive focus:text-destructive">
                Delete folder
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onClick={() => onDelete(note.id, false, 0)} className="text-destructive focus:text-destructive">
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
```


---

### Task 13: Refactor Sidebar.tsx

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`

Key changes:
- Remove `SortMenu` import and all SortMenu state/refs (`showSortMenu`, `sortAnchorRect`, `sortButtonRef`, `sortMenuJustClosed`, `handleSortButtonClick`, `handleCloseSortMenu`)
- Remove `ContextMenu` import and `imageMenu` state
- Inline sort dropdown with shadcn `DropdownMenu`
- Inline image context menu with shadcn `ContextMenu`
- Move `SortField`/`SortDirection`/`SortConfig` types here (SortMenu.tsx deleted)
- Replace all inline styles with Tailwind

- [ ] **Step 1: Rewrite `apps/web/src/components/Sidebar.tsx`**

Full replacement — this is a large file. Write exactly:

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import type { NoteMeta, ImageMeta } from '@websidian/shared'
import SidebarItem from './SidebarItem'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Image as ImageIcon } from 'lucide-react'

// ── Sort types (previously in SortMenu.tsx) ───────────────────────────────────
export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export interface SortConfig { by: SortField; direction: SortDirection }

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

const SORT_STORAGE_KEY = 'ws-sidebar-sort'
function loadSortConfig(): SortConfig {
  try { return JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? '') }
  catch { return { by: 'title', direction: 'asc' } }
}

// ── Tree helpers ──────────────────────────────────────────────────────────────
interface NoteNode extends NoteMeta { children: NoteNode[]; depth: number }

function buildTree(notes: NoteMeta[], sort: SortConfig): NoteNode[] {
  const map = new Map<string, NoteNode>()
  for (const n of notes) map.set(n.id, { ...n, children: [], depth: 0 })

  const sorter = (a: NoteNode, b: NoteNode) => {
    const folderFirst = (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0)
    if (folderFirst !== 0) return folderFirst
    const av = a[sort.by] ?? ''; const bv = b[sort.by] ?? ''
    const cmp = String(av).localeCompare(String(bv))
    return sort.direction === 'asc' ? cmp : -cmp
  }

  const roots: NoteNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  const assignDepth = (nodes: NoteNode[], depth: number) => {
    nodes.sort(sorter)
    for (const n of nodes) { n.depth = depth; assignDepth(n.children, depth + 1) }
  }
  roots.sort(sorter)
  assignDepth(roots, 0)
  return roots
}

function flattenVisible(nodes: NoteNode[], expanded: Set<string>): NoteNode[] {
  const result: NoteNode[] = []
  const visit = (node: NoteNode) => {
    result.push(node)
    if (node.isFolder && expanded.has(node.id)) node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

function getAncestorIds(notes: NoteMeta[], id: string): Set<string> {
  const map = new Map(notes.map(n => [n.id, n]))
  const ancestors = new Set<string>()
  let cur = map.get(id)
  while (cur?.parentId) { ancestors.add(cur.parentId); cur = map.get(cur.parentId) }
  return ancestors
}

function computeDropZone(overId: string, notes: NoteMeta[]): string | null {
  const note = notes.find(n => n.id === overId)
  return note?.isFolder ? note.id : (note?.parentId ?? null)
}

function countDescendants(notes: NoteMeta[], id: string): number {
  let count = 0
  const visit = (parentId: string) => {
    for (const n of notes) { if (n.parentId === parentId) { count++; if (n.isFolder) visit(n.id) } }
  }
  visit(id)
  return count
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  notes: NoteMeta[]
  activeId: string | null
  canEdit: boolean
  onSelect: (id: string) => void
  onNewNote: (parentId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, parentId: string | null) => void
  onUploadImage: (file: File) => Promise<ImageMeta | null>
  images: ImageMeta[]
  selectedImageId: string | null
  onSelectImage: (image: ImageMeta) => void
  onRenameImage: (id: string, filename: string) => void
}

export default function Sidebar({
  notes, activeId, canEdit,
  onSelect, onNewNote, onNewFolder, onRename, onDelete, onMove, onUploadImage,
  images, selectedImageId, onSelectImage, onRenameImage,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<string | null | undefined>(undefined)
  const lastDropZoneRef = useRef<string | null | undefined>(undefined)
  const overFolderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig)
  const [copiedImage, setCopiedImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [imageRenameValue, setImageRenameValue] = useState('')
  const imageRenameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeId) return
    const ancestors = getAncestorIds(notes, activeId)
    if (ancestors.size > 0) setExpanded(prev => new Set([...prev, ...ancestors]))
  }, [activeId, notes])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const handleDelete = useCallback((id: string, isFolder: boolean, childCount: number) => {
    if (isFolder && childCount > 0) {
      const note = notes.find(n => n.id === id)
      if (!window.confirm(`Delete "${note?.title}" and all ${childCount} items inside?`)) return
    }
    onDelete(id)
  }, [notes, onDelete])

  const handleSortChange = useCallback((config: SortConfig) => {
    setSortConfig(config)
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(config))
  }, [])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const image = await onUploadImage(file)
    if (image) {
      await navigator.clipboard.writeText(`![[${image.filename}]]`)
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2000)
    }
  }, [onUploadImage])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const tree = buildTree(notes, sortConfig)
  const visibleIds = flattenVisible(tree, expanded).map(n => n.id)

  const onDragStart = ({ active }: DragStartEvent) => setDraggingId(active.id as string)

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(undefined); lastDropZoneRef.current = undefined; return
    }
    const newZone = computeDropZone(over.id as string, notes)
    if (newZone !== lastDropZoneRef.current) {
      if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
      setDropZone(newZone); lastDropZoneRef.current = newZone
      if (newZone !== null && !expanded.has(newZone)) {
        overFolderTimer.current = setTimeout(() => {
          setExpanded(prev => new Set([...prev, newZone]))
          overFolderTimer.current = null
        }, 600)
      }
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null); setDropZone(undefined); lastDropZoneRef.current = undefined
    if (overFolderTimer.current) { clearTimeout(overFolderTimer.current); overFolderTimer.current = null }
    if (!over || active.id === over.id) return
    const draggedId = active.id as string
    const dragged = notes.find(n => n.id === draggedId)
    if (!dragged) return
    const targetId = computeDropZone(over.id as string, notes)
    if (dragged.isFolder && targetId !== null) {
      const desc = new Set<string>()
      const collectDesc = (id: string) => { for (const n of notes) { if (n.parentId === id) { desc.add(n.id); collectDesc(n.id) } } }
      collectDesc(draggedId)
      if (desc.has(targetId)) return
    }
    if ((dragged.parentId ?? null) === targetId) return
    onMove(draggedId, targetId)
  }

  const draggingNote = draggingId ? notes.find(n => n.id === draggingId) : null

  const renderNode = (node: NoteNode): React.ReactNode => {
    const isExpanded = expanded.has(node.id)
    const item = (
      <SidebarItem
        key={node.id}
        note={node}
        depth={node.depth}
        isActive={node.id === activeId}
        isExpanded={isExpanded}
        canEdit={canEdit}
        onSelect={onSelect}
        onToggle={toggle}
        onRename={onRename}
        onDelete={handleDelete}
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        childCount={countDescendants(notes, node.id)}
      />
    )
    if (!node.isFolder) return item
    return (
      <div
        key={`zone-${node.id}`}
        className={`rounded-md transition-colors ${dropZone === node.id ? 'bg-primary/10' : ''}`}
      >
        {item}
        {isExpanded && node.children.map(child => renderNode(child))}
      </div>
    )
  }

  return (
    <aside className="p-2 text-foreground flex-1 overflow-y-auto min-h-0">
      {/* Notes header row */}
      <div className="flex items-center mb-2 px-1">
        <span className="font-bold text-[13px] text-muted-foreground flex-1">Notes</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="bg-none border-none text-muted-foreground cursor-pointer text-sm px-1 py-px leading-none hover:text-foreground"
              title="Sort notes"
              aria-label="Sort notes"
            >
              ⇅
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground tracking-wide">SORT BY</DropdownMenuLabel>
            {SORT_FIELDS.map(({ field, label }) => (
              <DropdownMenuItem
                key={field}
                onClick={() => handleSortChange({
                  by: field,
                  direction: sortConfig.by === field
                    ? (sortConfig.direction === 'asc' ? 'desc' : 'asc')
                    : 'asc',
                })}
                className="flex items-center gap-2 text-[13px]"
              >
                <span className="w-3 text-primary text-[10px]">{sortConfig.by === field ? '●' : '○'}</span>
                <span className="flex-1">{label}</span>
                {sortConfig.by === field && (
                  <span className="text-muted-foreground text-[11px]">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Action buttons */}
      {canEdit && (
        <>
          <div className="flex gap-1 mb-1">
            <button onClick={() => onNewNote(null)} className="flex-1 py-0.5 px-1.5 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80">+ Note</button>
            <button onClick={() => onNewFolder(null)} className="flex-1 py-0.5 px-1.5 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80">+ Folder</button>
          </div>
          <div className="mb-2 flex items-center gap-1.5">
            <button onClick={() => imageInputRef.current?.click()} className="py-0.5 px-2 bg-card text-foreground border-none rounded cursor-pointer text-[11px] hover:bg-card/80">+ Image</button>
            {copiedImage && <span className="text-[11px] text-ctp-green">Copied!</span>}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </>
      )}

      {/* Note tree */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds}>
          {tree.map(node => renderNode(node))}
        </SortableContext>
        <DragOverlay>
          {draggingNote && (
            <div className="px-2 py-1 rounded bg-card text-foreground text-[13px] opacity-90 border border-[#45475a]">
              {draggingNote.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Images section */}
      {images.length > 0 && (
        <div className="mt-3">
          <div className="px-1 mb-1">
            <span className="font-bold text-[13px] text-muted-foreground">Images</span>
          </div>
          {images.map(img => {
            const isRenaming = renamingImageId === img.id
            const commitImageRename = () => {
              const trimmed = imageRenameValue.trim()
              if (trimmed && trimmed !== img.filename) onRenameImage(img.id, trimmed)
              setRenamingImageId(null)
            }
            const startRename = () => {
              setImageRenameValue(img.filename)
              setRenamingImageId(img.id)
              setTimeout(() => imageRenameInputRef.current?.select(), 10)
            }
            return (
              <ContextMenu key={img.id}>
                <ContextMenuTrigger asChild>
                  <div
                    onClick={() => { if (!isRenaming) onSelectImage(img) }}
                    className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-[13px] text-foreground overflow-hidden ${selectedImageId === img.id ? 'bg-card' : 'hover:bg-card/50'}`}
                    title={img.filename}
                  >
                    <ImageIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    {isRenaming ? (
                      <input
                        ref={imageRenameInputRef}
                        value={imageRenameValue}
                        onChange={e => setImageRenameValue(e.target.value)}
                        onBlur={commitImageRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitImageRename()
                          if (e.key === 'Escape') setRenamingImageId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        className="flex-1 bg-card border border-primary rounded-sm text-foreground text-[13px] px-1 py-px focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{img.filename}</span>
                    )}
                  </div>
                </ContextMenuTrigger>
                {canEdit && (
                  <ContextMenuContent>
                    <ContextMenuItem onClick={startRename}>Rename</ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            )
          })}
        </div>
      )}
    </aside>
  )
}
```

---

### Task 14: Refactor LinksPanel.tsx

**Files:**
- Modify: `apps/web/src/components/LinksPanel.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/LinksPanel.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { NoteMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'
type Tab = 'backlinks' | 'forwardlinks'

interface Props {
  noteId: string | null
  projectId: string | null
  token: string | null
  onSelect: (id: string) => void
}

export default function LinksPanel({ noteId, projectId, token, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('backlinks')
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([])
  const [forwardlinks, setForwardlinks] = useState<NoteMeta[]>([])

  useEffect(() => {
    if (!noteId || !projectId) { setBacklinks([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const controller = new AbortController()
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/backlinks`, { headers, signal: controller.signal })
      .then(r => r.ok ? r.json() : []).then(setBacklinks)
      .catch(err => { if (err.name !== 'AbortError') setBacklinks([]) })
    return () => controller.abort()
  }, [noteId, projectId, token])

  useEffect(() => {
    if (!noteId || !projectId) { setForwardlinks([]); return }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const controller = new AbortController()
    fetch(`${API}/api/projects/${projectId}/notes/${noteId}/forwardlinks`, { headers, signal: controller.signal })
      .then(r => r.ok ? r.json() : []).then(setForwardlinks)
      .catch(err => { if (err.name !== 'AbortError') setForwardlinks([]) })
    return () => controller.abort()
  }, [noteId, projectId, token])

  const results = activeTab === 'backlinks' ? backlinks : forwardlinks
  const emptyLabel = activeTab === 'backlinks' ? 'No backlinks' : 'No forward links'

  return (
    <div className="w-[260px] h-full border-l border-border bg-background flex flex-col overflow-hidden">
      <div className="flex border-b border-border shrink-0">
        {(['backlinks', 'forwardlinks'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 px-1 border-b-2 text-[11px] cursor-pointer bg-transparent border-x-0 border-t-0 transition-colors ${
              activeTab === tab
                ? 'border-b-primary text-foreground font-semibold bg-card'
                : 'border-b-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'backlinks' ? 'Backlinks' : 'Forward Links'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {!noteId ? (
          <p className="text-[#45475a] text-xs text-center mt-8 px-4">Open a note to see links</p>
        ) : results.length === 0 ? (
          <p className="text-[#45475a] text-xs text-center mt-8 px-4">{emptyLabel}</p>
        ) : (
          results.map(n => (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              className="px-3 py-1.5 cursor-pointer text-xs text-[#bac2de] whitespace-nowrap overflow-hidden text-ellipsis hover:bg-card"
            >
              {n.title}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

---

### Task 15: Refactor MarkdownPreview.tsx

**Files:**
- Modify: `apps/web/src/components/MarkdownPreview.tsx`

Key change: wrap content in `prose` from typography plugin. Custom component overrides use Tailwind classes instead of inline styles. The `processChildren` / `parseWikilinks` logic is unchanged.

- [ ] **Step 1: Rewrite `apps/web/src/components/MarkdownPreview.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { ImageMeta } from '@websidian/shared'

const FRONTMATTER_RE_CLIENT = /^---\r?\n([\s\S]*?)\r?\n---/

interface ParsedFrontmatter { tags: string[]; aliases: string[]; rest: Record<string, unknown> }

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = FRONTMATTER_RE_CLIENT.exec(content)
  if (!match) return null
  try {
    const lines = match[1].split('\n')
    const result: Record<string, unknown> = {}
    for (const line of lines) {
      const colon = line.indexOf(':')
      if (colon === -1) continue
      const key = line.slice(0, colon).trim()
      const raw = line.slice(colon + 1).trim()
      if (raw.startsWith('[') && raw.endsWith(']')) {
        result[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      } else { result[key] = raw }
    }
    const toArr = (v: unknown) => Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []
    const { tags: rawTags, aliases: rawAliases, ...rest } = result
    return { tags: toArr(rawTags), aliases: toArr(rawAliases), rest }
  } catch { return null }
}

const WIKILINK_RE = /\[\[([^\]\n\[|]+?)(?:\|([^\]\n\[]+))?\]\]/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i

interface Props { yText: Y.Text; awareness: Awareness | null; onWikilinkClick: (title: string) => void; images: ImageMeta[] }

function parseWikilinks(text: string, onClick: (title: string) => void, imagesByName: Map<string, ImageMeta>, baseKey = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0; let count = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const target = match[1]; const alias = match[2] ?? null
    const isEmbed = match.index > 0 && text[match.index - 1] === '!'
    const startIdx = isEmbed ? match.index - 1 : match.index
    if (startIdx > last) parts.push(text.slice(last, startIdx))
    if (isEmbed && IMAGE_EXT_RE.test(target)) {
      const img = imagesByName.get(target)
      if (img) {
        parts.push(<img key={`img-${baseKey}-${count++}`} src={`/api/projects/${img.projectId}/images/${img.id}`} alt={alias ?? target} className="max-w-full rounded block my-2" />)
      } else { parts.push(`![[${target}${alias ? `|${alias}` : ''}]]`) }
    } else {
      const displayText = isEmbed ? `![[${target}${alias ? `|${alias}` : ''}]]` : (alias ?? target)
      parts.push(<span key={`wl-${baseKey}-${count++}`} onClick={() => onClick(target)} className="text-primary cursor-pointer underline decoration-dotted">{displayText}</span>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function MarkdownPreview({ yText, awareness: _awareness, onWikilinkClick, images }: Props) {
  const [content, setContent] = useState(() => yText.toString())
  const imagesByName = useMemo(() => new Map(images.map(img => [img.filename, img])), [images])

  useEffect(() => {
    setContent(yText.toString())
    const handler = () => setContent(yText.toString())
    yText.observe(handler)
    return () => yText.unobserve(handler)
  }, [yText])

  const fm = parseFrontmatter(content)

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="prose max-w-[760px] mx-auto px-8 py-6">
        {fm && (
          <div className="border border-border rounded-md p-3 mb-3 text-xs text-[#a6adc8] not-prose">
            {fm.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="min-w-[60px] text-muted-foreground">tags</span>
                <div className="flex gap-1 flex-wrap">
                  {fm.tags.map(tag => <span key={tag} className="bg-card text-foreground rounded px-1.5 py-px text-[11px]">{tag}</span>)}
                </div>
              </div>
            )}
            {fm.aliases.length > 0 && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="min-w-[60px] text-muted-foreground">aliases</span>
                <span>{fm.aliases.join(', ')}</span>
              </div>
            )}
            {Object.entries(fm.rest).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 mb-1">
                <span className="min-w-[60px] text-muted-foreground">{key}</span>
                <span>{String(val)}</span>
              </div>
            ))}
          </div>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          components={{
            p({ children }) { return <p>{processChildren(children, onWikilinkClick, imagesByName)}</p> },
            li({ children }) { return <li>{processChildren(children, onWikilinkClick, imagesByName)}</li> },
            th({ children }) { return <th>{processChildren(children, onWikilinkClick, imagesByName)}</th> },
            td({ children }) { return <td>{processChildren(children, onWikilinkClick, imagesByName)}</td> },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function processChildren(children: React.ReactNode, onClick: (title: string) => void, imagesByName: Map<string, ImageMeta>): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick, imagesByName)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) => typeof child === 'string' ? <span key={`text-${i}`}>{parseWikilinks(child, onClick, imagesByName, i)}</span> : child)}</>
  }
  return children
}
```

---

### Task 16: Refactor NoteGraph.tsx

**Files:**
- Modify: `apps/web/src/components/NoteGraph.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/NoteGraph.tsx`**

```tsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import type { NoteMeta, LinkEdge } from '@websidian/shared'
import { X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'

interface Props { notes: NoteMeta[]; projectId: string; token: string | null; onSelect: (id: string) => void; onClose: () => void }

export default function NoteGraph({ notes, projectId, token, onSelect, onClose }: Props) {
  const [links, setLinks] = useState<LinkEdge[]>([])

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/projects/${projectId}/notes/graph`, { headers })
      .then(r => r.ok ? r.json() : []).then(setLinks).catch(() => {})
  }, [projectId, token])

  const nodesKey = notes.map(n => `${n.id}:${n.title}`).join('\n')
  const linksKey = links.map(l => `${l.sourceId}>${l.targetId}`).join('\n')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graphData = useMemo(() => {
    const nodeIds = new Set(notes.map(n => n.id))
    const validLinks = links.filter(l => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId))
    const linkCount = new Map<string, number>()
    for (const l of validLinks) {
      linkCount.set(l.sourceId, (linkCount.get(l.sourceId) ?? 0) + 1)
      linkCount.set(l.targetId, (linkCount.get(l.targetId) ?? 0) + 1)
    }
    return {
      nodes: notes.map(n => ({ id: n.id, name: n.title, val: 3 + (linkCount.get(n.id) ?? 0) * 0.66 })),
      links: validLinks.map(l => ({ source: l.sourceId, target: l.targetId })),
    }
  }, [nodesKey, linksKey])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-400).distanceMax(150)
    fg.d3Force('center')?.strength(0.1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('collide', forceCollide((node: any) => Math.sqrt((node.val ?? 1) * 4) + 25))
    fg.d3ReheatSimulation()
  }, [graphData])

  const handleClick = useCallback((node: { id?: string | number }) => {
    if (node.id) onSelect(String(node.id))
  }, [onSelect])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300]">
      <div className="relative bg-background rounded-lg overflow-hidden">
        <button onClick={onClose} className="absolute top-2.5 right-3.5 z-10 bg-none border-none text-muted-foreground cursor-pointer hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={() => '#89b4fa'}
          nodeRelSize={4}
          linkColor={() => '#45475a'}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          backgroundColor="#1e1e2e"
          onNodeClick={handleClick}
          cooldownTicks={400}
          warmupTicks={50}
          width={1000}
          height={700}
        />
      </div>
    </div>
  )
}
```

---

### Task 17: Refactor Editor.tsx

**Files:**
- Modify: `apps/web/src/components/Editor.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/components/Editor.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { type Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { buildExtensions } from '../lib/codemirror'

interface Props { yText: Y.Text; awareness: Awareness | null; onWikilinkClick?: (title: string) => void }

export default function Editor({ yText, awareness, onWikilinkClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const undoManager = new Y.UndoManager(yText)
    let view: EditorView
    try {
      view = new EditorView({
        state: EditorState.create({
          doc: yText.toString(),
          extensions: [
            ...buildExtensions(onWikilinkClick),
            yCollab(yText, awareness, { undoManager }),
            keymap.of(yUndoManagerKeymap),
          ],
        }),
        parent: containerRef.current,
      })
    } catch (e) { undoManager.destroy(); throw e }
    viewRef.current = view
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(view as any).dispatch = () => {}
      view.destroy()
      viewRef.current = null
      undoManager.destroy()
    }
  }, [yText, awareness])

  return <div ref={containerRef} className="flex-1 h-full overflow-auto" />
}
```

---

### Task 18: Refactor App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/App.tsx`**

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor'
import MarkdownPreview from './components/MarkdownPreview'
import Sidebar from './components/Sidebar'
import PresenceBar from './components/PresenceBar'
import LoginPage from './components/LoginPage'
import ProjectSwitcher from './components/ProjectSwitcher'
import ProjectSettings from './components/ProjectSettings'
import LinksPanel from './components/LinksPanel'
import NoteGraph from './components/NoteGraph'
import SearchModal from './components/SearchModal'
import { useProvider } from './hooks/useProvider'
import { useNotes } from './hooks/useNotes'
import { useImages } from './hooks/useImages'
import { useProjects } from './hooks/useProjects'
import { useProjectContext } from './contexts/ProjectContext'
import { Settings, Hexagon, PencilLine, BookOpen, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Project, ImageMeta } from '@websidian/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:1235'
const USER_COLORS = ['#f38ba8', '#89b4fa', '#a6e3a1', '#fab387', '#cba6f7']
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem('ws-token'))
  const [userName, setUserName] = useState<string>(() => sessionStorage.getItem('ws-name') ?? `User-${Math.random().toString(36).slice(2, 6)}`)
  const [userImage, setUserImage] = useState<string | null>(() => sessionStorage.getItem('ws-image'))
  const [showSettings, setShowSettings] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)

  const [pendingInviteToken] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/invite\/([a-f0-9]+)$/)
    return match?.[1] ?? null
  })

  const handleLogin = (token: string, name: string, image?: string | null) => {
    sessionStorage.setItem('ws-token', token)
    sessionStorage.setItem('ws-name', name)
    if (image) sessionStorage.setItem('ws-image', image)
    else sessionStorage.removeItem('ws-image')
    setAuthToken(token); setUserName(name); setUserImage(image ?? null)
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) {
      try {
        const redirectUrl = new URL(redirect)
        const apiOrigin = new URL(API).origin
        if (redirectUrl.origin === apiOrigin || redirectUrl.origin === window.location.origin) window.location.href = redirect
      } catch { /* ignore */ }
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('ws-token'); sessionStorage.removeItem('ws-name'); sessionStorage.removeItem('ws-image')
    setAuthToken(null); setUserImage(null)
  }

  useEffect(() => {
    if (!authToken) return
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (!redirect) return
    try {
      const redirectUrl = new URL(redirect)
      const apiOrigin = new URL(API).origin
      if (redirectUrl.origin !== apiOrigin) return
      fetch(`${API}/oauth/bridge`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: { bridge_token?: string } | null) => {
          if (data?.bridge_token) { redirectUrl.searchParams.set('bridge_token', data.bridge_token); window.location.href = redirectUrl.toString() }
        })
        .catch(() => {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (authToken) return
    fetch(`${API}/api/auth/get-session`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.session?.token && data?.user) handleLogin(data.session.token, data.user.name ?? data.user.email, data.user.image ?? null) })
      .catch(() => {})
  }, [])

  const { activeProject, setActiveProject, userRole } = useProjectContext()
  const { projects, createProject: _cp, refresh: refreshProjects } = useProjects(authToken)

  useEffect(() => {
    if (!authToken || !pendingInviteToken) return
    fetch(`${API}/api/invites/${pendingInviteToken}/join`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (data?.projectId) {
          window.history.replaceState(null, '', '/')
          await refreshProjects()
          setActiveProject(projects.find(p => p.id === data.projectId) ?? null)
        }
      })
      .catch(() => {})
  }, [authToken, pendingInviteToken])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageMeta | null>(null)
  const { notes, createNote, renameNote, deleteNote, moveNote } = useNotes(activeProject?.id ?? null, authToken)
  const { images, uploadImage, renameImage } = useImages(activeProject?.id ?? null, authToken)
  const { yText, synced, awareness } = useProvider(activeId, authToken)

  useEffect(() => { if (!activeProject && projects.length > 0) setActiveProject(projects[0]) }, [projects, activeProject, setActiveProject])
  useEffect(() => { setActiveId(null); setSelectedImage(null) }, [activeProject?.id])

  const isPopstateNav = useRef(false)
  useEffect(() => {
    if (!activeId || isPopstateNav.current) { isPopstateNav.current = false; return }
    history.pushState({ wsNoteId: activeId }, '')
  }, [activeId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (activeProject) setShowSearch(s => !s) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProject])

  useEffect(() => {
    const onPopstate = (e: PopStateEvent) => {
      const noteId = (e.state as { wsNoteId?: string } | null)?.wsNoteId
      if (noteId) { isPopstateNav.current = true; setActiveId(noteId); setSelectedImage(null) }
    }
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [])

  useEffect(() => {
    if (!activeId && notes.length > 0 && notes[0].projectId === activeProject?.id) setActiveId(notes[0].id)
  }, [notes, activeId, activeProject?.id])

  useEffect(() => {
    if (!awareness) return
    awareness.setLocalStateField('user', { name: userName, color: USER_COLOR, image: userImage })
  }, [awareness, userName, userImage])

  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor'
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  const handleWikilinkClick = useCallback((target: string) => {
    const idToNote = new Map(notes.map(n => [n.id, n]))
    const getFullPath = (note: typeof notes[0]): string => {
      const segments: string[] = [note.title]
      let cur = note
      while (cur.parentId) { const parent = idToNote.get(cur.parentId); if (!parent) break; segments.unshift(parent.title); cur = parent }
      return segments.join('/')
    }
    let existing = target.includes('/') ? notes.find(n => !n.isFolder && getFullPath(n) === target) : undefined
    if (!existing) existing = notes.find(n => !n.isFolder && n.title === target)
    if (!existing) existing = notes.find(n => n.aliases.some(a => a.toLowerCase() === target.toLowerCase()))
    if (existing) { setActiveId(existing.id); setSelectedImage(null) }
    else if (canEdit && activeProject) {
      const newTitle = target.includes('/') ? target.split('/').pop()! : target
      fetch(`${API}/api/projects/${activeProject.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ title: newTitle }),
      }).then(r => r.ok ? r.json() : null).then(n => { if (n?.id) { setActiveId(n.id); setSelectedImage(null) } }).catch(() => {})
    }
  }, [notes, canEdit, activeProject, authToken])

  if (!authToken) return <LoginPage onLogin={handleLogin} />

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="h-10 flex items-center bg-[#181825] border-b border-border px-3 gap-3 shrink-0">
          <span className="text-foreground font-bold shrink-0">Websidian</span>

          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            token={authToken}
            onSelect={p => { setActiveProject(p); setActiveId(null); setPreviewMode(true) }}
            onRefreshProjects={refreshProjects}
          />

          {isOwnerOrAdmin && activeProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Project settings</TooltipContent>
            </Tooltip>
          )}

          {activeProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setShowGraph(true)}>
                  <Hexagon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Graph view</TooltipContent>
            </Tooltip>
          )}

          {activeId && canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={() => setPreviewMode(m => !m)}>
                  {previewMode ? <PencilLine className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}</TooltipContent>
            </Tooltip>
          )}

          <PresenceBar awareness={awareness} />
          {!synced && activeId && <span className="text-muted-foreground text-xs">syncing…</span>}

          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={`w-7 h-7 ${showLinks ? 'text-primary' : 'text-muted-foreground'}`} onClick={() => setShowLinks(s => !s)}>
                  <PanelRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle links panel</TooltipContent>
            </Tooltip>
            {userImage && <img src={userImage} alt={userName} className="w-[22px] h-[22px] rounded-full object-cover" />}
            <span className="text-muted-foreground text-xs">{userName}</span>
            <Button variant="outline" size="sm" className="h-6 text-xs text-muted-foreground" onClick={handleLogout}>Sign out</Button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar column */}
          <div className="flex flex-col w-60 shrink-0 border-r border-border bg-background overflow-hidden">
            <Sidebar
              notes={notes}
              activeId={activeId}
              canEdit={canEdit}
              onSelect={id => { setActiveId(id); setSelectedImage(null) }}
              onNewNote={parentId => {
                if (!canEdit) return
                createNote('Untitled', { parentId }).then(note => { if (note?.id) { setActiveId(note.id); setSelectedImage(null) } })
                setPreviewMode(false)
              }}
              onNewFolder={parentId => { if (!canEdit) return; createNote('New Folder', { parentId, isFolder: true }) }}
              onRename={(id, title) => renameNote(id, title)}
              onDelete={id => { deleteNote(id); if (activeId === id) setActiveId(null) }}
              onMove={(id, parentId) => moveNote(id, parentId)}
              onUploadImage={uploadImage}
              images={images}
              selectedImageId={selectedImage?.id ?? null}
              onSelectImage={img => { setSelectedImage(img); setActiveId(null) }}
              onRenameImage={async (id, filename) => {
                const ok = await renameImage(id, filename)
                if (ok && selectedImage?.id === id) setSelectedImage({ ...selectedImage, filename })
              }}
            />
          </div>

          {/* Main content */}
          {selectedImage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
              <p className="text-muted-foreground text-xs mb-3">{selectedImage.filename}</p>
              <img
                src={`/api/projects/${selectedImage.projectId}/images/${selectedImage.id}`}
                alt={selectedImage.filename}
                className="max-w-full max-h-[80vh] rounded-md block"
              />
            </div>
          ) : activeId && yText ? (
            previewMode
              ? <MarkdownPreview yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} images={images} />
              : <Editor yText={yText} awareness={awareness} onWikilinkClick={handleWikilinkClick} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              {!activeProject ? 'Select or create a project' : notes.length === 0 ? 'Create your first note' : 'Select a note'}
            </div>
          )}

          {/* Links panel */}
          <div
            className="overflow-hidden shrink-0 transition-[width] duration-200"
            style={{ width: showLinks ? 260 : 0 }}
          >
            <LinksPanel noteId={activeId} projectId={activeProject?.id ?? null} token={authToken} onSelect={id => { setActiveId(id); setSelectedImage(null) }} />
          </div>
        </div>

        {/* Modals */}
        {showSettings && activeProject && authToken && (
          <ProjectSettings project={activeProject} token={authToken} onClose={() => setShowSettings(false)}
            onUpdated={updates => setActiveProject({ ...activeProject, ...updates } as Project)} />
        )}
        {showGraph && activeProject && (
          <NoteGraph notes={notes} projectId={activeProject.id} token={authToken}
            onSelect={id => { setActiveId(id); setShowGraph(false) }} onClose={() => setShowGraph(false)} />
        )}
        {showSearch && activeProject && (
          <SearchModal projectId={activeProject.id} token={authToken} notes={notes}
            onSelect={id => { setActiveId(id); setSelectedImage(null); setShowSearch(false) }} onClose={() => setShowSearch(false)} />
        )}
      </div>
    </TooltipProvider>
  )
}
```

---

### Task 19: Build verification and commit

**Files:** None created/modified — verification only

- [ ] **Step 1: Run TypeScript check**

```bash
pnpm --filter @websidian/web typecheck 2>&1
```
Expected: no errors. If there are errors, fix them before proceeding.

- [ ] **Step 2: Run production build**

```bash
pnpm --filter @websidian/web build 2>&1 | tail -10
```
Expected: `✓ built in Xs` with no TypeScript errors. Chunk size warnings are acceptable.

- [ ] **Step 3: Commit everything**

```bash
git add apps/web/ && git commit -m "$(cat <<'EOF'
feat(web): migrate to Tailwind CSS + shadcn/ui

Replaces all inline style={{ }} props with Tailwind utility classes.
Adopts shadcn/ui Radix-backed primitives for ContextMenu, SortMenu
(now inline DropdownMenu in Sidebar), SearchModal (CommandDialog),
NewProjectModal and ProjectSettings (Dialog). Catppuccin Mocha theme
mapped to shadcn CSS variables. Lucide icons replace emoji/Unicode.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

```bash
git push origin master
```
