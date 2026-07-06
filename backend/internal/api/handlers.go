package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danny/collab-editor/backend/internal/auth"
	"github.com/danny/collab-editor/backend/internal/db"
)

// Handler serves REST endpoints for sessions and documents.
type Handler struct {
	db   *db.DB
	auth *auth.Manager
}

// NewHandler returns an API handler wired to the database and session manager.
func NewHandler(database *db.DB, sessions *auth.Manager) *Handler {
	return &Handler{db: database, auth: sessions}
}

type userJSON struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

type documentJSON struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type sessionRequest struct {
	Username string `json:"username"`
}

type createDocumentRequest struct {
	Title string `json:"title"`
}

func (h *Handler) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body sessionRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(body.Username)
	if username == "" {
		http.Error(w, "username required", http.StatusBadRequest)
		return
	}

	user, err := h.db.UpsertUser(username)
	if err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	h.auth.SetSessionCookie(w, user.ID)
	writeJSON(w, http.StatusOK, toUserJSON(user))
}

func (h *Handler) handleMe(w http.ResponseWriter, r *http.Request) {
	userID, err := h.auth.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.db.GetUserByID(userID)
	if err != nil {
		http.Error(w, "failed to load user", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	writeJSON(w, http.StatusOK, toUserJSON(user))
}

func (h *Handler) handleDocuments(w http.ResponseWriter, r *http.Request) {
	userID, err := h.auth.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodGet:
		docs, err := h.db.ListDocumentsByOwner(userID)
		if err != nil {
			http.Error(w, "failed to list documents", http.StatusInternalServerError)
			return
		}
		if docs == nil {
			docs = []db.Document{}
		}
		out := make([]documentJSON, len(docs))
		for i := range docs {
			out[i] = toDocumentJSON(&docs[i])
		}
		writeJSON(w, http.StatusOK, out)

	case http.MethodPost:
		var body createDocumentRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, "title required", http.StatusBadRequest)
			return
		}

		doc, err := h.db.CreateDocument(userID, title)
		if err != nil {
			http.Error(w, "failed to create document", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, toDocumentJSON(doc))

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleDocumentByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.auth.UserIDFromRequest(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	doc, err := h.db.GetDocument(id)
	if err != nil {
		http.Error(w, "failed to load document", http.StatusInternalServerError)
		return
	}
	if doc == nil || doc.OwnerID != userID {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, toDocumentJSON(doc))
}

// CanAccessRoom reports whether the request has a valid session and owns the room document.
func (h *Handler) CanAccessRoom(r *http.Request, room string) bool {
	userID, err := h.auth.UserIDFromRequest(r)
	if err != nil {
		return false
	}
	ok, err := h.db.UserOwnsDocument(userID, room)
	return err == nil && ok
}

func toUserJSON(user *db.User) userJSON {
	return userJSON{
		ID:        user.ID,
		Username:  user.Username,
		CreatedAt: user.CreatedAt,
	}
}

func toDocumentJSON(doc *db.Document) documentJSON {
	return documentJSON{
		ID:        doc.ID,
		Title:     doc.Title,
		CreatedAt: doc.CreatedAt,
		UpdatedAt: doc.UpdatedAt,
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// IsUnauthorized reports whether err is a session validation error.
func IsUnauthorized(err error) bool {
	return errors.Is(err, auth.ErrNoSession) ||
		errors.Is(err, auth.ErrInvalidSession) ||
		errors.Is(err, auth.ErrExpiredSession)
}
