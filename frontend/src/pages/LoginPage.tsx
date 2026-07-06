import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, createSession, getMe } from '../lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false

    getMe()
      .then(() => {
        if (!cancelled) navigate('/docs', { replace: true })
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Enter a username')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await createSession(trimmed)
      navigate('/docs', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError ? 'Could not sign in. Try again.' : 'Unexpected error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="page page--centered">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="page page--narrow">
      <div className="card">
        <h1>Collab Editor</h1>
        <p className="lede">Sign in with a username to create and edit shared documents.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="form__label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="form__input"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="alice"
            disabled={submitting}
          />
          {error ? <p className="form__error">{error}</p> : null}
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
