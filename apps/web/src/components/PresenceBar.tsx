import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'

interface AwarenessUser {
  name: string
  color: string
  image?: string | null
}

interface AwarenessState {
  user?: AwarenessUser
}

interface Props {
  awareness: Awareness | null
}

function UserAvatar({ user }: { user: AwarenessUser }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!user.image && !imgFailed

  return (
    <div
      title={user.name}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: `2px solid ${user.color}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#fff',
        fontWeight: 700,
        background: showImage ? '#1e1e2e' : user.color,
        flexShrink: 0,
      }}
    >
      {showImage ? (
        <img
          src={user.image!}
          alt={user.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
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

  const users = Array.from(states.values())
    .map((s) => s.user)
    .filter(Boolean) as AwarenessUser[]

  if (users.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {users.map((u, i) => (
        <UserAvatar key={i} user={u} />
      ))}
    </div>
  )
}
