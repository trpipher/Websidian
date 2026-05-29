import type { NoteMeta } from '@websidian/shared'

interface Props {
  notes: NoteMeta[]
  activeId: string | null
  onSelect: (id: string) => void
}

export default function Sidebar({ notes, activeId, onSelect }: Props) {
  return (
    <aside
      style={{
        width: 240,
        borderRight: '1px solid #333',
        padding: 12,
        background: '#1e1e2e',
        color: '#cdd6f4',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
        Notes
      </div>
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onSelect(note.id)}
          style={{
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            background: activeId === note.id ? '#313244' : 'transparent',
            marginBottom: 2,
            fontSize: 13,
          }}
        >
          {note.title}
        </div>
      ))}
    </aside>
  )
}
