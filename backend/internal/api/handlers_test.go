package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"

	"github.com/danny/collab-editor/backend/internal/api"
	"github.com/danny/collab-editor/backend/internal/auth"
	"github.com/danny/collab-editor/backend/internal/db"
)

func TestSessionAndDocumentsAPI(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	sessions := auth.NewManager([]byte("test-secret-key-32bytes!!"), false)
	handler := api.NewHandler(database, sessions)

	mux := http.NewServeMux()
	api.Register(mux, handler)
	server := httptest.NewServer(mux)
	defer server.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Jar: jar}

	// Create session
	body, _ := json.Marshal(map[string]string{"username": "alice"})
	resp, err := client.Post(server.URL+"/api/session", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("session status = %d", resp.StatusCode)
	}

	// /api/me
	req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/me", nil)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("me status = %d", resp.StatusCode)
	}

	// Create document
	body, _ = json.Marshal(map[string]string{"title": "My Doc"})
	resp, err = client.Post(server.URL+"/api/documents", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create doc status = %d", resp.StatusCode)
	}

	var doc struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	getReq, _ := http.NewRequest(http.MethodGet, server.URL+"/api/documents/"+doc.ID, nil)
	resp, err = client.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get doc status = %d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	// WS auth check via CanAccessRoom
	wsReq, _ := http.NewRequest(http.MethodGet, server.URL+"/yjs/"+doc.ID, nil)
	for _, c := range jar.Cookies(wsReq.URL) {
		wsReq.AddCookie(c)
	}
	if !handler.CanAccessRoom(wsReq, doc.ID) {
		t.Fatal("expected CanAccessRoom true for document owner")
	}
}

func TestWSAuthRejectsWithoutSession(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	handler := api.NewHandler(database, auth.NewManager([]byte("test-secret-key-32bytes!!"), false))
	req := httptest.NewRequest(http.MethodGet, "/yjs/some-room", nil)
	if handler.CanAccessRoom(req, "some-room") {
		t.Fatal("expected false without session")
	}
}
