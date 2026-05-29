import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'

interface AwarenessState {
  user?: { name: string; color: string }
}

interface Props {
  awareness: Awareness | null
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

  const users = Array.from(states.values())
    .map((s) => s.user)
    .filter(Boolean) as { name: string; color: string }[]

  if (users.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 12px', alignItems: 'center' }}>
      {users.map((u, i) => (
        <div
          key={i}
          title={u.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: u.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#fff',
            fontWeight: 700,
          }}
        >
          {u.name[0]?.toUpperCase()}
        </div>
      ))}
    </div>
  )
}
