package api

import "net/http"

// Register mounts REST routes on mux.
func Register(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("POST /api/session", h.handleSession)
	mux.HandleFunc("GET /api/me", h.handleMe)
	mux.HandleFunc("GET /api/documents", h.handleDocuments)
	mux.HandleFunc("POST /api/documents", h.handleDocuments)
	mux.HandleFunc("GET /api/documents/{id}", h.handleDocumentByID)
}
