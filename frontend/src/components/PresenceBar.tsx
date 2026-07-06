import type { AwarenessUser } from '../hooks/useYjsDoc'

type PresenceBarProps = {
  users: AwarenessUser[]
}

export function PresenceBar({ users }: PresenceBarProps) {
  return (
    <div className="presence-bar" aria-label="Connected users">
      <span className="presence-bar__label">Online</span>
      {users.length === 0 ? (
        <span className="presence-bar__empty">Just you</span>
      ) : (
        <ul className="presence-bar__list">
          {users.map((user) => (
            <li key={user.clientId} className="presence-bar__user">
              <span
                className="presence-bar__avatar"
                style={{ backgroundColor: user.color }}
                aria-hidden
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="presence-bar__name">
                {user.name}
                {user.isLocal ? ' (you)' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
