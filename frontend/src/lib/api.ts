const API_BASE = '/api'

export type User = {
  id: string
  username: string
  created_at: string
}

export type Document = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${response.status}`)
  }

  return response
}

export async function createSession(username: string): Promise<User> {
  const response = await apiFetch('/session', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
  return response.json()
}

export async function getMe(): Promise<User> {
  const response = await apiFetch('/me')
  return response.json()
}

export async function listDocuments(): Promise<Document[]> {
  const response = await apiFetch('/documents')
  return response.json()
}

export async function createDocument(title: string): Promise<Document> {
  const response = await apiFetch('/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  return response.json()
}

export async function getDocument(id: string): Promise<Document> {
  const response = await apiFetch(`/documents/${encodeURIComponent(id)}`)
  return response.json()
}

export function wsUrl(roomId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/yjs/${encodeURIComponent(roomId)}`
}
