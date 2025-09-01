package main

import (
    "crypto/rand"
    "embed"
    "encoding/hex"
    "encoding/json"
    "log"
    "mime"
    "net/http"
    "path"
    "path/filepath"
    "strings"
    "sync"
    "time"
)

//go:embed static/*
var staticFS embed.FS

func main() {
    mux := http.NewServeMux()

    // Basic health and placeholder API
    mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    // Simple in-memory notes store
    type Note struct {
        ID        string    `json:"id"`
        Content   string    `json:"content"`
        CreatedAt time.Time `json:"createdAt"`
        UpdatedAt time.Time `json:"updatedAt"`
    }
    var (
        notesMu sync.RWMutex
        notes   = make(map[string]*Note)
    )

    // POST /api/notes -> create a new note
    mux.HandleFunc("/api/notes", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPost:
            // generate 16-byte random id as hex
            var b [16]byte
            if _, err := rand.Read(b[:]); err != nil {
                http.Error(w, "failed to generate id", http.StatusInternalServerError)
                return
            }
            id := hex.EncodeToString(b[:])
            now := time.Now()
            n := &Note{ID: id, Content: "", CreatedAt: now, UpdatedAt: now}
            notesMu.Lock()
            notes[id] = n
            notesMu.Unlock()
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusCreated)
            _ = json.NewEncoder(w).Encode(n)
            return
        case http.MethodGet:
            // Optional: list notes in future
            http.Error(w, "not implemented", http.StatusNotImplemented)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // GET /api/notes/{id}
    mux.HandleFunc("/api/notes/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        id := strings.TrimPrefix(r.URL.Path, "/api/notes/")
        if id == "" {
            http.NotFound(w, r)
            return
        }
        notesMu.RLock()
        n, ok := notes[id]
        notesMu.RUnlock()
        if !ok {
            http.NotFound(w, r)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(n)
    })

    // Serve embedded static frontend
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        p := r.URL.Path
        if p == "/" {
            // Serve index.html
            data, err := staticFS.ReadFile("static/index.html")
            if err != nil {
                http.Error(w, "index not found", http.StatusNotFound)
                return
            }
            w.Header().Set("Content-Type", "text/html; charset=utf-8")
            w.WriteHeader(http.StatusOK)
            _, _ = w.Write(data)
            return
        }

        // Clean and trim leading slash
        reqPath := strings.TrimPrefix(path.Clean(p), "/")
        // Prevent escaping out of static dir
        fp := filepath.Join("static", reqPath)
        data, err := staticFS.ReadFile(fp)
        if err != nil {
            // Fallback to SPA index.html for client-side routes
            index, ierr := staticFS.ReadFile("static/index.html")
            if ierr != nil {
                http.NotFound(w, r)
                return
            }
            w.Header().Set("Content-Type", "text/html; charset=utf-8")
            w.WriteHeader(http.StatusOK)
            _, _ = w.Write(index)
            return
        }
        if ctype := mime.TypeByExtension(filepath.Ext(fp)); ctype != "" {
            w.Header().Set("Content-Type", ctype)
        }
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write(data)
    })

    addr := ":8080"
    log.Printf("Noet server listening on %s", addr)
    log.Fatal(http.ListenAndServe(addr, mux))
}
