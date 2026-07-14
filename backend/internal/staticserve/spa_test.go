package staticserve_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/danny/collab-editor/backend/internal/staticserve"
)

func TestSPAServesAssetsAndFallsBack(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(`<div id="root"></div>`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte(`console.log(1)`), 0o644); err != nil {
		t.Fatal(err)
	}

	handler := staticserve.New(dir)

	asset := httptest.NewRecorder()
	handler.ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if asset.Code != http.StatusOK {
		t.Fatalf("asset status = %d", asset.Code)
	}
	if got := asset.Body.String(); got != `console.log(1)` {
		t.Fatalf("asset body = %q", got)
	}

	spa := httptest.NewRecorder()
	handler.ServeHTTP(spa, httptest.NewRequest(http.MethodGet, "/docs/abc", nil))
	if spa.Code != http.StatusOK {
		t.Fatalf("spa status = %d", spa.Code)
	}
	if got := spa.Body.String(); got != `<div id="root"></div>` {
		t.Fatalf("spa body = %q", got)
	}
}
