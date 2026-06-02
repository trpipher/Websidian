import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'

interface AwarenessUser { name: string; color: string; image?: string | null }
interface AwarenessState { user?: AwarenessUser }
interface Props { awareness: Awareness | null }

function UserAvatar({ user }: { user: AwarenessUser }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!user.image && !imgFailed
  return (
    <div
      title={user.name}
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ border: `2px solid ${user.color}`, background: showImage ? '#1e1e2e' : user.color }}
    >
      {showImage ? (
        <img src={user.image!} alt={user.name} className="w-full h-full object-cover block" onError={() => setImgFailed(true)} />
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

  const users = Array.from(states.values()).map(s => s.user).filter(Boolean) as AwarenessUser[]
  if (users.length === 0) return null

  return (
    <div className="flex gap-1.5 items-center">
      {users.map((u, i) => <UserAvatar key={i} user={u} />)}
    </div>
  )
}
