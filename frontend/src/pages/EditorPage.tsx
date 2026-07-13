import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { Editor } from '../components/Editor'
import { PresenceBar } from '../components/PresenceBar'
import { useRequireAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useYjsDoc } from '../hooks/useYjsDoc'
import { ApiError, getDocument, type Document } from '../lib/api'

type DocFetchState = {
  docId: string
  document: Document | null
  error: string | null
  loading: boolean
}

export function EditorPage() {
  const { id } = useParams()
  const { user, loading: authLoading } = useRequireAuth()
  const [fetchState, setFetchState] = useState<DocFetchState>({
    docId: '',
    document: null,
    error: null,
    loading: false,
  })

  const yjs = useYjsDoc(id ?? '', user?.username ?? '')
  const { status: onlineStatus, message: statusMessage } = useOnlineStatus(
    yjs?.connectionStatus,
    { reconnectAttempts: yjs?.reconnectAttempts },
  )

  useEffect(() => {
    if (!user || !id) return

    let cancelled = false

    getDocument(id)
      .then((doc) => {
        if (!cancelled) {
          setFetchState({ docId: id, document: doc, error: null, loading: false })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchState({
            docId: id,
            document: null,
            error:
              err instanceof ApiError && err.status === 404
                ? 'Document not found'
                : 'Failed to load document',
            loading: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [user, id])

  const document =
    fetchState.docId === id ? fetchState.document : null
  const loadError = fetchState.docId === id ? fetchState.error : null
  const loadingDoc = Boolean(user && id && fetchState.docId !== id)

  if (authLoading || !user) {
    return (
      <main className="page page--centered">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (!id) {
    return (
      <main className="page page--centered">
        <p className="form__error">Missing document id</p>
      </main>
    )
  }

  if (loadingDoc) {
    return (
      <main className="page page--centered">
        <p className="muted">Loading document…</p>
      </main>
    )
  }

  if (loadError || !document) {
    return (
      <main className="page page--centered">
        <p className="form__error">{loadError ?? 'Document not found'}</p>
        <Link className="button button--ghost" to="/docs">
          Back to documents
        </Link>
      </main>
    )
  }

  return (
    <div className="editor-page">
      <header className="editor-page__header">
        <div className="editor-page__title-row">
          <Link className="editor-page__back" to="/docs" aria-label="Back to documents">
            ←
          </Link>
          <h1 className="editor-page__title">{document.title}</h1>
        </div>
        {yjs ? <PresenceBar users={yjs.users} /> : null}
      </header>

      <ConnectionBanner status={onlineStatus} message={statusMessage} />

      <div className="editor-page__main">
        {yjs ? (
          <Editor ytext={yjs.ytext} awareness={yjs.awareness} synced={yjs.synced} />
        ) : (
          <div className="editor-shell editor-shell--loading">
            <div className="editor-loading">Connecting…</div>
          </div>
        )}
      </div>

      <footer
        className={`editor-page__status editor-page__status--${onlineStatus}`}
        aria-live="polite"
      >
        {statusMessage}
      </footer>
    </div>
  )
}
