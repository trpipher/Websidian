import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
}

function parseWikilinks(text: string, onClick: (title: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const title = match[1]
    parts.push(
      <span
        key={match.index}
        onClick={() => onClick(title)}
        style={{ color: '#89b4fa', cursor: 'pointer', textDecoration: 'underline dotted' }}
      >
        {`[[${title}]]`}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function MarkdownPreview({ yText, onWikilinkClick }: Props) {
  const [content, setContent] = useState(() => yText.toString())

  useEffect(() => {
    const handler = () => setContent(yText.toString())
    yText.observe(handler)
    return () => yText.unobserve(handler)
  }, [yText])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 32px',
      color: '#cdd6f4',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 15,
      lineHeight: 1.75,
      maxWidth: 760,
      alignSelf: 'flex-start',
      width: '100%',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            const processed = processChildren(children, onWikilinkClick)
            return <p style={{ marginBottom: '1em' }}>{processed}</p>
          },
          h1: ({ children }) => <h1 style={{ fontSize: '1.8em', fontWeight: 700, borderBottom: '1px solid #313244', paddingBottom: '0.3em', marginBottom: '0.8em', fontFamily: 'system-ui, sans-serif' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '1.4em', fontWeight: 700, marginBottom: '0.6em', fontFamily: 'system-ui, sans-serif' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.2em', fontWeight: 700, marginBottom: '0.5em', fontFamily: 'system-ui, sans-serif' }}>{children}</h3>,
          code({ children, className }: { children?: React.ReactNode; className?: string }) {
            const isBlock = Boolean(className)
            return isBlock
              ? <pre style={{ background: '#181825', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', fontSize: '0.88em', marginBottom: '1em' }}><code style={{ fontFamily: 'monospace' }}>{children}</code></pre>
              : <code style={{ background: '#313244', borderRadius: 3, padding: '1px 5px', fontSize: '0.88em', fontFamily: 'monospace' }}>{children}</code>
          },
          blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #45475a', paddingLeft: 16, color: '#6c7086', margin: '0 0 1em 0' }}>{children}</blockquote>,
          ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '0.25em' }}>{children}</li>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#89b4fa' }}>{children}</a>,
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #313244', margin: '1.5em 0' }} />,
          table: ({ children }) => <table style={{ borderCollapse: 'collapse', marginBottom: '1em', width: '100%' }}>{children}</table>,
          th: ({ children }) => <th style={{ border: '1px solid #313244', padding: '6px 12px', background: '#181825', textAlign: 'left' }}>{children}</th>,
          td: ({ children }) => <td style={{ border: '1px solid #313244', padding: '6px 12px' }}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function processChildren(children: React.ReactNode, onClick: (title: string) => void): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) =>
      typeof child === 'string'
        ? <span key={i}>{parseWikilinks(child, onClick)}</span>
        : child
    )}</>
  }
  return children
}
