# Multi-stage single-container build: Vite SPA + Go server on :8080.
# Persistent SQLite lives on a volume mounted at /data.

# --- Frontend ---
FROM node:22-alpine AS frontend

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Backend ---
FROM golang:1.25-alpine AS backend

WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

# --- Runtime ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates \
	&& adduser -D -H -u 1000 appuser \
	&& mkdir -p /data /app/static \
	&& chown -R appuser:appuser /data /app

WORKDIR /app

COPY --from=backend /server /app/server
COPY --from=frontend /frontend/dist /app/static

ENV PORT=8080 \
	DATABASE_PATH=/data/collab.db \
	STATIC_DIR=/app/static \
	COOKIE_SECURE=false

USER appuser

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1:${PORT:-8080}/health >/dev/null || exit 1

CMD ["/app/server"]
