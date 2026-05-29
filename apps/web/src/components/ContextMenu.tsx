import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  // Adjust position so menu doesn't overflow viewport
  const menuWidth = 180
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: adjustedX,
        background: '#181825',
        border: '1px solid #313244',
        borderRadius: 6,
        zIndex: 1000,
        minWidth: menuWidth,
        padding: '4px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            color: item.danger ? '#f38ba8' : '#cdd6f4',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#313244')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}
