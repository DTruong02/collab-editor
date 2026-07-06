import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, getMe, type User } from '../lib/api'

export function useRequireAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 401) {
          navigate('/')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return { user, loading }
}
