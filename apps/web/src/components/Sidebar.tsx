import type { NoteMeta } from '@websidian/shared'

interface Props {
  notes: NoteMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewNote?: () => void
}

export default function Sidebar({ notes, activeId, onSelect, onNewNote }: Props) {
  return (
    <aside
      style={{
        padding: 12,
        color: '#cdd6f4',
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
        Notes
      </div>
      {onNewNote && <button
        onClick={onNewNote}
        style={{
          width: '100%',
          marginBottom: 8,
          padding: '4px 8px',
          background: '#313244',
          color: '#cdd6f4',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        + New Note
      </button>}
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
