import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DocCard } from '../components/DocCard'
import { useRequireAuth } from '../hooks/useAuth'
import { createDocument, listDocuments, type Document } from '../lib/api'

export function DocListPage() {
  const { user, loading } = useRequireAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    listDocuments()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load documents')
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Enter a document title')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const doc = await createDocument(trimmed)
      setDocuments((prev) => [doc, ...prev])
      setTitle('')
    } catch {
      setError('Failed to create document')
    } finally {
      setCreating(false)
    }
  }

  if (loading || !user) {
    return (
      <main className="page page--centered">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Documents</h1>
          <p className="lede">
            Signed in as <strong>{user.username}</strong>
          </p>
        </div>
        <Link className="button button--ghost" to="/">
          Switch user
        </Link>
      </header>

      <section className="card">
        <h2 className="section-title">New document</h2>
        <form className="form form--inline" onSubmit={handleCreate}>
          <input
            className="form__input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled document"
            disabled={creating}
          />
          <button className="button button--primary" type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {error ? <p className="form__error">{error}</p> : null}
      </section>

      <section className="doc-list">
        <h2 className="section-title">Your documents</h2>
        {loadingDocs ? (
          <p className="muted">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="muted">No documents yet. Create one above.</p>
        ) : (
          <div className="doc-list__grid">
            {documents.map((doc) => (
              <DocCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
