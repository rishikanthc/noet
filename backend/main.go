package main

import (
    "crypto/rand"
    "embed"
    "encoding/hex"
    "encoding/json"
    "log"
    "mime"
    "net/http"
    "sort"
    "path"
    "path/filepath"
    "strings"
    "sync"
    "time"
)

// helper to extract first <h1> inner text from HTML
// naive but sufficient for simple titles without external deps
func extractTitleFromHTML(htmlStr string) string {
    lower := strings.ToLower(htmlStr)
    start := strings.Index(lower, "<h1")
    if start == -1 {
        return ""
    }
    // find end of opening tag '>'
    gt := strings.Index(lower[start:], ">")
    if gt == -1 {
        return ""
    }
    gtAbs := start + gt + 1
    // find closing tag
    endTag := strings.Index(lower[gtAbs:], "</h1>")
    if endTag == -1 {
        return ""
    }
    inner := htmlStr[gtAbs : gtAbs+endTag]
    // strip inner HTML tags crudely
    var b strings.Builder
    inTag := false
    for _, r := range inner {
        switch r {
        case '<':
            inTag = true
        case '>':
            inTag = false
        default:
            if !inTag {
                b.WriteRune(r)
            }
        }
    }
    title := strings.TrimSpace(b.String())
    // collapse whitespace
    title = strings.Join(strings.Fields(title), " ")
    return title
}

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
        Title     string    `json:"title"`
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
            n := &Note{ID: id, Title: "", Content: "", CreatedAt: now, UpdatedAt: now}
            notesMu.Lock()
            notes[id] = n
            notesMu.Unlock()
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusCreated)
            _ = json.NewEncoder(w).Encode(n)
            return
        case http.MethodGet:
            // List notes sorted by UpdatedAt desc (then CreatedAt desc)
            notesMu.RLock()
            list := make([]Note, 0, len(notes))
            for _, n := range notes {
                // copy value to avoid races if mutated later
                list = append(list, *n)
            }
            notesMu.RUnlock()
            // sort newest first
            if len(list) > 1 {
                sort.Slice(list, func(i, j int) bool {
                    if list[i].UpdatedAt.Equal(list[j].UpdatedAt) {
                        return list[i].CreatedAt.After(list[j].CreatedAt)
                    }
                    return list[i].UpdatedAt.After(list[j].UpdatedAt)
                })
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(list)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // GET/PUT /api/notes/{id}
    mux.HandleFunc("/api/notes/", func(w http.ResponseWriter, r *http.Request) {
        id := strings.TrimPrefix(r.URL.Path, "/api/notes/")
        if id == "" {
            http.NotFound(w, r)
            return
        }
        switch r.Method {
        case http.MethodGet:
            notesMu.RLock()
            n, ok := notes[id]
            notesMu.RUnlock()
            if !ok {
                http.NotFound(w, r)
                return
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(n)
            return
        case http.MethodPut:
            var payload struct {
                Content string `json:"content"`
            }
            if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
                http.Error(w, "invalid json", http.StatusBadRequest)
                return
            }
            now := time.Now()
            notesMu.Lock()
            n, ok := notes[id]
            if !ok {
                notesMu.Unlock()
                http.NotFound(w, r)
                return
            }
            n.Content = payload.Content
            n.Title = extractTitleFromHTML(payload.Content)
            n.UpdatedAt = now
            notesMu.Unlock()
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(n)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
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
