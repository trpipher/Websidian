import { useEffect, useRef } from 'react'

export type SortField = 'title' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  by: SortField
  direction: SortDirection
}

interface Props {
  config: SortConfig
  anchorRect: DOMRect
  onChange: (config: SortConfig) => void
  onClose: () => void
}

const FIELDS: { field: SortField; label: string }[] = [
  { field: 'title',     label: 'Alphabetical' },
  { field: 'createdAt', label: 'Date created' },
  { field: 'updatedAt', label: 'Last edited'  },
]

export default function SortMenu({ config, anchorRect, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Position: below the anchor button, flush left; clamp if near right edge
  const top = anchorRect.bottom + 4
  const left = Math.min(anchorRect.left, window.innerWidth - 180)

  const handleSelect = (field: SortField) => {
    if (field === config.by) {
      // Toggle direction on current field
      onChange({ by: field, direction: config.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onChange({ by: field, direction: 'asc' })
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 1000,
        background: '#181825',
        border: '1px solid #313244',
        borderRadius: 6,
        padding: '8px 0',
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: 11, color: '#6c7086', padding: '0 12px 6px', fontWeight: 600, letterSpacing: '0.05em' }}>
        SORT BY
      </div>
      {FIELDS.map(({ field, label }) => {
        const isSelected = config.by === field
        return (
          <button
            key={field}
            onClick={() => handleSelect(field)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '5px 12px',
              cursor: 'pointer',
              color: isSelected ? '#cdd6f4' : '#a6adc8',
              fontSize: 13,
              gap: 8,
              textAlign: 'left',
            }}
          >
            <span style={{ width: 12, color: '#89b4fa', fontSize: 10 }}>
              {isSelected ? '●' : '○'}
            </span>
            <span style={{ flex: 1 }}>{label}</span>
            {isSelected && (
              <span style={{ color: '#6c7086', fontSize: 11 }}>
                {config.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
