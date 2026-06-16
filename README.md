# Collab Editor

Real-time collaborative text editor built with **Go (ygo)** on the backend and **React + Yjs** on the frontend.

## Repository layout

```
collab-editor/
├── backend/          Go HTTP server + ygo WebSocket provider
├── frontend/         Vite + React + TypeScript SPA
└── docker-compose.yml
```

## Prerequisites

- [Docker](https://www.docker.com/) (recommended for local dev)
- Or locally: Go 1.23+, Node.js 22+

## Quick start (Docker)

```bash
cd C:\Users\Danny\Documents\Projects\collab-editor
docker compose up --build
```

- Frontend dev server: http://localhost:5173
- Backend health check: http://localhost:8080/health
- WebSocket endpoint: `ws://localhost:8080/yjs/{roomId}` (proxied via Vite in dev)

## Local development (without Docker)

### Backend

```bash
cd backend
go mod download
go run ./cmd/server
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/yjs` to `http://localhost:8080`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend listen port |
| `DATABASE_PATH` | (future) | SQLite database file path |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` | Vite proxy target in dev |

## Next steps

This scaffold includes the monorepo structure. Upcoming work:

1. Yjs ↔ ygo sync spike
2. SQLite persistence + REST API
3. CodeMirror editor UI with awareness cursors
