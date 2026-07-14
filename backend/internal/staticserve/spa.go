package staticserve

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// SPA serves files from root and falls back to index.html for client-side routes.
type SPA struct {
	root string
	fs   http.Handler
}

// New returns an HTTP handler rooted at dir. dir must contain index.html.
func New(dir string) *SPA {
	return &SPA{
		root: dir,
		fs:   http.FileServer(http.Dir(dir)),
	}
}

func (s *SPA) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rel := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
	if rel == "." {
		rel = ""
	}
	full := filepath.Join(s.root, rel)

	info, err := os.Stat(full)
	if err == nil && !info.IsDir() {
		s.fs.ServeHTTP(w, r)
		return
	}
	if err == nil && info.IsDir() {
		index := filepath.Join(full, "index.html")
		if _, err := os.Stat(index); err == nil {
			http.ServeFile(w, r, index)
			return
		}
	}

	http.ServeFile(w, r, filepath.Join(s.root, "index.html"))
}
