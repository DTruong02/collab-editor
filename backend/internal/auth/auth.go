package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	cookieName     = "session"
	sessionMaxAge  = 30 * 24 * time.Hour
	sessionVersion = "v1"
)

var (
	ErrNoSession       = errors.New("no session")
	ErrInvalidSession  = errors.New("invalid session")
	ErrExpiredSession  = errors.New("expired session")
	ErrMissingUsername = errors.New("username required")
)

// Manager signs and validates HttpOnly session cookies.
type Manager struct {
	secret []byte
	secure bool
}

// NewManager creates a session manager. secret must be at least 16 bytes.
func NewManager(secret []byte, secure bool) *Manager {
	return &Manager{secret: secret, secure: secure}
}

// SetSessionCookie issues a signed session cookie for userID.
func (m *Manager) SetSessionCookie(w http.ResponseWriter, userID string) {
	exp := time.Now().Add(sessionMaxAge).Unix()
	payload := fmt.Sprintf("%s:%d:%s", sessionVersion, exp, userID)
	sig := m.sign(payload)
	value := payload + ":" + sig

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   m.secure,
		MaxAge:   int(sessionMaxAge / time.Second),
	})
}

// ClearSessionCookie removes the session cookie.
func (m *Manager) ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

// UserIDFromRequest returns the authenticated user id from the session cookie.
func (m *Manager) UserIDFromRequest(r *http.Request) (string, error) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return "", ErrNoSession
	}
	return m.parseSession(cookie.Value)
}

func (m *Manager) parseSession(value string) (string, error) {
	idx := strings.LastIndex(value, ":")
	if idx <= 0 {
		return "", ErrInvalidSession
	}

	payload := value[:idx]
	gotSig := value[idx+1:]
	if !hmac.Equal([]byte(gotSig), []byte(m.sign(payload))) {
		return "", ErrInvalidSession
	}

	parts := strings.SplitN(payload, ":", 3)
	if len(parts) != 3 || parts[0] != sessionVersion {
		return "", ErrInvalidSession
	}

	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return "", ErrInvalidSession
	}
	if time.Now().Unix() > exp {
		return "", ErrExpiredSession
	}

	return parts[2], nil
}

func (m *Manager) sign(payload string) string {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

// RequireAuth wraps a handler and responds 401 when the session is missing or invalid.
func (m *Manager) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, err := m.UserIDFromRequest(r); err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}
