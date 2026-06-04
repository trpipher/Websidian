// apps/web/src/components/MarkdownToolbar.tsx
import React from 'react'
import type { EditorView } from '@codemirror/view'
import { Bold, Italic, Heading1, Link, Code, Minus } from 'lucide-react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { Toolbar } from '@/components/ui/toolbar'
import { formatMarkdown, type FormatAction } from '@/lib/markdown-toolbar'

interface ToolbarItem { action: FormatAction; icon: React.ReactNode; label: string }

const ITEMS: ToolbarItem[] = [
  { action: 'bold',     icon: <Bold className="w-4 h-4" />,    label: 'Bold' },
  { action: 'italic',   icon: <Italic className="w-4 h-4" />,  label: 'Italic' },
  { action: 'heading',  icon: <Heading1 className="w-4 h-4" />, label: 'Heading' },
  { action: 'wikilink', icon: <span className="text-xs font-mono font-bold">[[</span>, label: 'Wikilink' },
  { action: 'link',     icon: <Link className="w-4 h-4" />,    label: 'Link' },
  { action: 'code',     icon: <Code className="w-4 h-4" />,    label: 'Code' },
  { action: 'divider',  icon: <Minus className="w-4 h-4" />,   label: 'Divider' },
]

interface Props { view: EditorView | null }

export default function MarkdownToolbar({ view }: Props) {
  const { isMobile, isTablet, isPortrait } = useBreakpoint()
  if (!view || (!isMobile && !(isTablet && isPortrait))) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-2 py-1 flex items-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Toolbar className="flex-1 justify-around">
        {ITEMS.map((item) => (
          <button
            key={item.action}
            aria-label={item.label}
            onPointerDown={e => {
              e.preventDefault()
              if (view) formatMarkdown(view, item.action)
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {item.icon}
          </button>
        ))}
      </Toolbar>
    </div>
  )
}
