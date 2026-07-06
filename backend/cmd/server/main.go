package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/danny/collab-editor/backend/internal/api"
	"github.com/danny/collab-editor/backend/internal/auth"
	"github.com/danny/collab-editor/backend/internal/db"
	"github.com/danny/collab-editor/backend/internal/persistence"
	"github.com/reearth/ygo/provider/websocket"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "collab.db"
	}

	database, err := db.Open(dbPath)
	if err != nil {
		slog.Error("database open failed", "error", err, "path", dbPath)
		os.Exit(1)
	}
	defer database.Close()

	secret := sessionSecret()
	sessions := auth.NewManager(secret, os.Getenv("COOKIE_SECURE") == "true")
	persist := persistence.NewSQLiteAdapter(database)
	apiHandler := api.NewHandler(database, sessions)

	wsServer := websocket.NewServerWithPersistence(persist)
	wsServer.AllowedOrigins = allowedOrigins()
	wsServer.AuthFunc = func(r *http.Request) bool {
		room := r.PathValue("room")
		if room == "" {
			room = path.Base(r.URL.Path)
		}
		return apiHandler.CanAccessRoom(r, room)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	api.Register(mux, apiHandler)
	mux.Handle("/yjs/{room}", wsServer)

	addr := ":" + port
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("server listening", "addr", addr, "database", dbPath, "allowed_origins", wsServer.AllowedOrigins)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := wsServer.Shutdown(ctx); err != nil {
		slog.Error("websocket shutdown failed", "error", err)
	}
	if err := server.Shutdown(ctx); err != nil {
		slog.Error("http shutdown failed", "error", err)
	}

	slog.Info("server stopped")
}

func allowedOrigins() []string {
	if raw := os.Getenv("ALLOWED_ORIGINS"); raw != "" {
		parts := strings.Split(raw, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if o := strings.TrimSpace(p); o != "" {
				out = append(out, o)
			}
		}
		return out
	}
	// Vite dev server origin; browser WS requests come from :5173 while API/WS is on :8080.
	return []string{"http://localhost:5173"}
}

func sessionSecret() []byte {
	if raw := os.Getenv("SESSION_SECRET"); raw != "" {
		return []byte(raw)
	}

	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		slog.Error("session secret generation failed", "error", err)
		os.Exit(1)
	}
	secret := []byte(hex.EncodeToString(buf))
	slog.Warn("SESSION_SECRET not set; using ephemeral secret (sessions reset on restart)")
	return secret
}
