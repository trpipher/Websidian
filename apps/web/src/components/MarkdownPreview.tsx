import { useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { ImageMeta } from '@websidian/shared'

const FRONTMATTER_RE_CLIENT = /^---\r?\n([\s\S]*?)\r?\n---/

interface ParsedFrontmatter {
  tags: string[]
  aliases: string[]
  rest: Record<string, unknown>
}

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
      } else {
        result[key] = raw
      }
    }
    const toArr = (v: unknown) => Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []
    const { tags: rawTags, aliases: rawAliases, ...rest } = result
    return { tags: toArr(rawTags), aliases: toArr(rawAliases), rest }
  } catch {
    return null
  }
}

// Group 1: target (path or title); Group 2: optional alias/display text
const WIKILINK_RE = /\[\[([^\]\n\[|]+?)(?:\|([^\]\n\[]+))?\]\]/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i

interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick: (title: string) => void
  images: ImageMeta[]
}

function parseWikilinks(
  text: string,
  onClick: (title: string) => void,
  imagesByName: Map<string, ImageMeta>,
  baseKey: number = 0,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let count = 0
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const target = match[1]
    const alias = match[2] ?? null
    const isEmbed = match.index > 0 && text[match.index - 1] === '!'
    const startIdx = isEmbed ? match.index - 1 : match.index

    if (startIdx > last) parts.push(text.slice(last, startIdx))

    if (isEmbed && IMAGE_EXT_RE.test(target)) {
      const img = imagesByName.get(target)
      if (img) {
        parts.push(
          <img
            key={`img-${baseKey}-${count++}`}
            src={`/api/projects/${img.projectId}/images/${img.id}`}
            alt={alias ?? target}
            style={{ maxWidth: '100%', borderRadius: 4, display: 'block', margin: '0.5em 0' }}
          />
        )
      } else {
        parts.push(`![[${target}${alias ? `|${alias}` : ''}]]`)
      }
    } else {
      // Show alias if provided, otherwise show [[target]]
      const displayText = isEmbed
        ? `![[${target}${alias ? `|${alias}` : ''}]]`
        : (alias ?? target)
      parts.push(
        <span
          key={`wl-${baseKey}-${count++}`}
          onClick={() => onClick(target)}
          style={{ color: '#89b4fa', cursor: 'pointer', textDecoration: 'underline dotted' }}
        >
          {displayText}
        </span>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function MarkdownPreview({ yText, awareness: _awareness, onWikilinkClick, images }: Props) {
  const [content, setContent] = useState(() => yText.toString())

  const imagesByName = useMemo(
    () => new Map(images.map(img => [img.filename, img])),
    [images]
  )

  useEffect(() => {
    setContent(yText.toString())
    const handler = () => setContent(yText.toString())
    yText.observe(handler)
    return () => yText.unobserve(handler)
  }, [yText])

  const fm = parseFrontmatter(content)

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{
        padding: '24px 32px',
        color: '#cdd6f4',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 15,
        lineHeight: 1.75,
        maxWidth: 760,
        margin: '0 auto',
      }}>
      {fm && (
        <div style={{
          border: '1px solid #313244',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: 12,
          color: '#a6adc8',
        }}>
          {fm.tags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ minWidth: 60, color: '#6c7086' }}>tags</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {fm.tags.map(tag => (
                  <span key={tag} style={{
                    background: '#313244', color: '#cdd6f4',
                    borderRadius: 4, padding: '1px 6px', fontSize: 11,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          )}
          {fm.aliases.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ minWidth: 60, color: '#6c7086' }}>aliases</span>
              <span>{fm.aliases.join(', ')}</span>
            </div>
          )}
          {Object.entries(fm.rest).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ minWidth: 60, color: '#6c7086' }}>{key}</span>
              <span>{String(val)}</span>
            </div>
          ))}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        components={{
          p({ children }) {
            const processed = processChildren(children, onWikilinkClick, imagesByName)
            return <p style={{ marginBottom: '1em' }}>{processed}</p>
          },
          h1: ({ children }) => <h1 style={{ fontSize: '1.8em', fontWeight: 700, borderBottom: '1px solid #313244', paddingBottom: '0.3em', marginBottom: '0.8em', fontFamily: 'system-ui, sans-serif' }}>{processChildren(children, onWikilinkClick, imagesByName)}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '1.4em', fontWeight: 700, marginBottom: '0.6em', fontFamily: 'system-ui, sans-serif' }}>{processChildren(children, onWikilinkClick, imagesByName)}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.2em', fontWeight: 700, marginBottom: '0.5em', fontFamily: 'system-ui, sans-serif' }}>{processChildren(children, onWikilinkClick, imagesByName)}</h3>,
          pre: ({ children }) => (
            <pre style={{ background: '#181825', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', fontSize: '0.88em', marginBottom: '1em', fontFamily: 'monospace' }}>
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code style={{ background: '#313244', borderRadius: 3, padding: '1px 5px', fontSize: '0.88em', fontFamily: 'monospace' }}>
              {children}
            </code>
          ),
          blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #45475a', paddingLeft: 16, color: '#6c7086', margin: '0 0 1em 0' }}>{children}</blockquote>,
          ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: '1em' }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: '0.25em' }}>{processChildren(children, onWikilinkClick, imagesByName)}</li>,
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
    </div>
  )
}

function processChildren(
  children: React.ReactNode,
  onClick: (title: string) => void,
  imagesByName: Map<string, ImageMeta>,
): React.ReactNode {
  if (typeof children === 'string') {
    const parts = parseWikilinks(children, onClick, imagesByName)
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
  }
  if (Array.isArray(children)) {
    return <>{children.map((child, i) =>
      typeof child === 'string'
        ? <span key={`text-${i}`}>{parseWikilinks(child, onClick, imagesByName, i)}</span>
        : child
    )}</>
  }
  return children
}
