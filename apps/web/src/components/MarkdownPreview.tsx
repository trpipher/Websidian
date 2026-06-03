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
            h1({ children }) { return <h1>{processChildren(children, onWikilinkClick, imagesByName)}</h1> },
            h2({ children }) { return <h2>{processChildren(children, onWikilinkClick, imagesByName)}</h2> },
            h3({ children }) { return <h3>{processChildren(children, onWikilinkClick, imagesByName)}</h3> },
            h4({ children }) { return <h4>{processChildren(children, onWikilinkClick, imagesByName)}</h4> },
            h5({ children }) { return <h5>{processChildren(children, onWikilinkClick, imagesByName)}</h5> },
            h6({ children }) { return <h6>{processChildren(children, onWikilinkClick, imagesByName)}</h6> },
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
