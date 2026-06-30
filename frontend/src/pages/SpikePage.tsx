import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yjsWsBaseUrl } from '../lib/wsUrl'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

type AwarenessUser = {
  name: string
  color: string
}

function roomFromLocation(): string {
  const params = new URLSearchParams(window.location.search)
  const queryRoom = params.get('room')
  if (queryRoom) return queryRoom

  const hashRoom = window.location.hash.slice(1)
  return hashRoom || 'default'
}

function randomUser(): AwarenessUser {
  return {
    name: `User-${Math.floor(Math.random() * 9000) + 1000}`,
    color: `hsl(${Math.floor(Math.random() * 360)},70%,55%)`,
  }
}

function applyTextDiff(
  ydoc: Y.Doc,
  ytext: Y.Text,
  prev: string,
  next: string,
): void {
  let start = 0
  const minLen = Math.min(prev.length, next.length)
  while (start < minLen && prev[start] === next[start]) start++

  let endOld = prev.length
  let endNew = next.length
  while (
    endOld > start &&
    endNew > start &&
    prev[endOld - 1] === next[endNew - 1]
  ) {
    endOld--
    endNew--
  }

  ydoc.transact(() => {
    if (endOld > start) ytext.delete(start, endOld - start)
    if (endNew > start) ytext.insert(start, next.slice(start, endNew))
  })
}

export function SpikePage() {
  const room = roomFromLocation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const ytextRef = useRef<Y.Text | null>(null)
  const prevValueRef = useRef('')
  const ignoreInputRef = useRef(false)

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting')
  const [synced, setSynced] = useState(false)
  const [users, setUsers] = useState<AwarenessUser[]>([])
  const [localUser] = useState(randomUser)

  useEffect(() => {
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    ydocRef.current = ydoc
    ytextRef.current = ytext

    const provider = new WebsocketProvider(yjsWsBaseUrl(), room, ydoc, {
      connect: true,
    })
    const { awareness } = provider

    awareness.setLocalStateField('user', localUser)

    const renderUsers = () => {
      const states = Array.from(awareness.getStates().values())
      setUsers(
        states
          .filter((s): s is { user: AwarenessUser } => Boolean(s?.user))
          .map((s) => s.user),
      )
    }

    const onYtextChange = () => {
      const textarea = textareaRef.current
      if (!textarea || ignoreInputRef.current) return

      const newVal = ytext.toString()
      if (newVal === textarea.value) return

      const sel = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      }
      textarea.value = newVal
      const len = newVal.length
      textarea.setSelectionRange(
        Math.min(sel.start, len),
        Math.min(sel.end, len),
      )
      prevValueRef.current = newVal
    }

    ytext.observe(onYtextChange)

    provider.on('status', ({ status }) => {
      setConnectionStatus(status === 'connected' ? 'connected' : 'disconnected')
    })

    provider.on('sync', (isSynced) => {
      setSynced(isSynced)
      if (isSynced) {
        const value = ytext.toString()
        prevValueRef.current = value
        const textarea = textareaRef.current
        if (textarea) textarea.value = value
      }
    })

    awareness.on('change', renderUsers)
    renderUsers()

    return () => {
      awareness.off('change', renderUsers)
      ytext.unobserve(onYtextChange)
      provider.destroy()
      ydoc.destroy()
      ydocRef.current = null
      ytextRef.current = null
    }
  }, [room, localUser])

  const handleInput = () => {
    const textarea = textareaRef.current
    const ydoc = ydocRef.current
    const ytext = ytextRef.current
    if (!textarea || !ydoc || !ytext) return

    const newValue = textarea.value
    const prevValue = prevValueRef.current

    ignoreInputRef.current = true
    applyTextDiff(ydoc, ytext, prevValue, newValue)
    ignoreInputRef.current = false
    prevValueRef.current = newValue
  }

  const spikeUrl = `${window.location.origin}/spike?room=${encodeURIComponent(room)}`

  return (
    <main className="spike-page">
      <header className="spike-header">
        <span className="spike-logo">collab-editor spike</span>
        <span className="spike-separator">·</span>
        <span className="spike-room-label">
          room: <strong>{room}</strong>
        </span>
        <span className="spike-spacer" />
        <span
          className={`spike-status spike-status--${connectionStatus}`}
          aria-live="polite"
        >
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'connecting'
              ? 'Connecting…'
              : 'Disconnected'}
          {synced ? ' · synced' : ''}
        </span>
      </header>

      <div className="spike-users">
        <span className="spike-users-label">Online:</span>
        {users.length === 0 ? (
          <span>none</span>
        ) : (
          users.map((user) => (
            <span
              key={user.name}
              className="spike-user-badge"
              style={{ color: user.color }}
            >
              {user.name}
            </span>
          ))
        )}
      </div>

      <div className="spike-editor-wrapper">
        <textarea
          ref={textareaRef}
          className="spike-editor"
          placeholder="Type here — open a second tab at the same URL to sync…"
          onInput={handleInput}
          disabled={!synced}
        />
      </div>

      <p className="spike-hint">
        Open two tabs at <code>{spikeUrl}</code> to validate Yjs ↔ ygo sync.
      </p>
    </main>
  )
}
