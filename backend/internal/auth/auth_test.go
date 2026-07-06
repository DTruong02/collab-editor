package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danny/collab-editor/backend/internal/auth"
)

func TestSessionRoundTrip(t *testing.T) {
	mgr := auth.NewManager([]byte("test-secret-key-32bytes!!"), false)

	rec := httptest.NewRecorder()
	mgr.SetSessionCookie(rec, "user-123")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, c := range rec.Result().Cookies() {
		req.AddCookie(c)
	}

	userID, err := mgr.UserIDFromRequest(req)
	if err != nil {
		t.Fatal(err)
	}
	if userID != "user-123" {
		t.Fatalf("userID = %q", userID)
	}
}

func TestSessionRejectsTamperedCookie(t *testing.T) {
	mgr := auth.NewManager([]byte("test-secret-key-32bytes!!"), false)

	rec := httptest.NewRecorder()
	mgr.SetSessionCookie(rec, "user-123")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, c := range rec.Result().Cookies() {
		c.Value = c.Value + "tamper"
		req.AddCookie(c)
	}

	if _, err := mgr.UserIDFromRequest(req); err == nil {
		t.Fatal("expected invalid session")
	}
}
