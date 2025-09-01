package main

import (
    "database/sql"
    "embed"
    "encoding/json"
    "errors"
    "fmt"
    "mime"
    "net/http"
    "path"
    "path/filepath"
    "strings"
    "sync"
    "time"

    _ "modernc.org/sqlite"
)

//go:embed static/*
var staticFS embed.FS

type App struct {
    DB  *sql.DB
    Mux *http.ServeMux

    // SSE
    clientsMu    sync.Mutex
    clients      map[int]chan string
    nextClientID int
}

type Post struct {
    ID        int64     `json:"id"`
    Title     *string   `json:"title,omitempty"`
    Content   string    `json:"content"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

func NewApp(dbPath string) (*App, error) {
    db, err := sql.Open("sqlite", dbPath)
    if err != nil {
        return nil, err
    }
    // Pragmas for reliability
    if _, err := db.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`); err != nil {
        return nil, err
    }
    if err := initSchema(db); err != nil {
        return nil, err
    }

    a := &App{DB: db, Mux: http.NewServeMux(), clients: make(map[int]chan string)}
    a.routes()
    return a, nil
}

func initSchema(db *sql.DB) error {
    _, err := db.Exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
`)
    return err
}

// helper to extract first <h1> inner text from HTML
func extractTitleFromHTML(htmlStr string) string {
    lower := strings.ToLower(htmlStr)
    start := strings.Index(lower, "<h1")
    if start == -1 {
        return ""
    }
    gt := strings.Index(lower[start:], ">")
    if gt == -1 {
        return ""
    }
    gtAbs := start + gt + 1
    endTag := strings.Index(lower[gtAbs:], "</h1>")
    if endTag == -1 {
        return ""
    }
    inner := htmlStr[gtAbs : gtAbs+endTag]
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
    title = strings.Join(strings.Fields(title), " ")
    return title
}

func (a *App) routes() {
    mux := a.Mux
    // Health
    mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    // Posts collection: POST(create) and GET(list)
    mux.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPost:
            now := time.Now()
            res, err := a.DB.Exec(`INSERT INTO posts(title, content, created_at, updated_at) VALUES(NULL, '', ?, ?)`, now, now)
            if err != nil {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            id, _ := res.LastInsertId()
            p := Post{ID: id, Title: nil, Content: "", CreatedAt: now, UpdatedAt: now}
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusCreated)
            _ = json.NewEncoder(w).Encode(p)
            go a.broadcast("post-created", p)
            return
        case http.MethodGet:
            rows, err := a.DB.Query(`SELECT id, title, content, created_at, updated_at FROM posts ORDER BY updated_at DESC, created_at DESC`)
            if err != nil {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            defer rows.Close()
            var list []Post
            for rows.Next() {
                var p Post
                var title sql.NullString
                if err := rows.Scan(&p.ID, &title, &p.Content, &p.CreatedAt, &p.UpdatedAt); err != nil {
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                if title.Valid {
                    t := title.String
                    p.Title = &t
                }
                list = append(list, p)
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(list)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // Individual post: GET/PUT/DELETE
    mux.HandleFunc("/api/posts/", func(w http.ResponseWriter, r *http.Request) {
        idStr := strings.TrimPrefix(r.URL.Path, "/api/posts/")
        if idStr == "" {
            http.NotFound(w, r)
            return
        }
        switch r.Method {
        case http.MethodGet:
            p, err := a.getPost(idStr)
            if err != nil {
                if errors.Is(err, sql.ErrNoRows) {
                    http.NotFound(w, r)
                } else {
                    http.Error(w, "db error", http.StatusInternalServerError)
                }
                return
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(p)
            return
        case http.MethodPut:
            var payload struct{ Content string `json:"content"` }
            if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
                http.Error(w, "invalid json", http.StatusBadRequest)
                return
            }
            title := extractTitleFromHTML(payload.Content)
            var titlePtr *string
            if strings.TrimSpace(title) != "" {
                titlePtr = &title
            }
            now := time.Now()
            // update
            _, err := a.DB.Exec(`UPDATE posts SET title = ?, content = ?, updated_at = ? WHERE id = ?`, titlePtr, payload.Content, now, idStr)
            if err != nil {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            p, err := a.getPost(idStr)
            if err != nil {
                if errors.Is(err, sql.ErrNoRows) {
                    http.NotFound(w, r)
                } else {
                    http.Error(w, "db error", http.StatusInternalServerError)
                }
                return
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(p)
            go a.broadcast("post-updated", p)
            return
        case http.MethodDelete:
            _, err := a.DB.Exec(`DELETE FROM posts WHERE id = ?`, idStr)
            if err != nil {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            w.WriteHeader(http.StatusNoContent)
            go a.broadcast("post-deleted", map[string]string{"id": idStr})
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // SSE stream
    mux.HandleFunc("/api/posts/stream", func(w http.ResponseWriter, r *http.Request) {
        flusher, ok := w.(http.Flusher)
        if !ok {
            http.Error(w, "streaming unsupported", http.StatusInternalServerError)
            return
        }
        w.Header().Set("Content-Type", "text/event-stream")
        w.Header().Set("Cache-Control", "no-cache")
        w.Header().Set("Connection", "keep-alive")

        ch := make(chan string, 16)
        id := a.addClient(ch)
        defer a.removeClient(id)

        // snapshot
        rows, err := a.DB.Query(`SELECT id, title, content, created_at, updated_at FROM posts ORDER BY updated_at DESC, created_at DESC`)
        if err == nil {
            var list []Post
            for rows.Next() {
                var p Post
                var title sql.NullString
                if err := rows.Scan(&p.ID, &title, &p.Content, &p.CreatedAt, &p.UpdatedAt); err == nil {
                    if title.Valid {
                        t := title.String
                        p.Title = &t
                    }
                    list = append(list, p)
                }
            }
            _ = rows.Close()
            b, _ := json.Marshal(list)
            _, _ = w.Write([]byte(fmt.Sprintf("event: snapshot\ndata: %s\n\n", string(b))))
            flusher.Flush()
        }

        ticker := time.NewTicker(30 * time.Second)
        defer ticker.Stop()
        ctx := r.Context()
        for {
            select {
            case msg, ok := <-ch:
                if !ok {
                    return
                }
                _, _ = w.Write([]byte(msg))
                flusher.Flush()
            case <-ticker.C:
                _, _ = w.Write([]byte("event: ping\ndata: {}\n\n"))
                flusher.Flush()
            case <-ctx.Done():
                return
            }
        }
    })

    // Static files
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        p := r.URL.Path
        if p == "/" {
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
        reqPath := strings.TrimPrefix(path.Clean(p), "/")
        fp := filepath.Join("static", reqPath)
        data, err := staticFS.ReadFile(fp)
        if err != nil {
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
}

func (a *App) addClient(ch chan string) int {
    a.clientsMu.Lock()
    defer a.clientsMu.Unlock()
    id := a.nextClientID
    a.nextClientID++
    a.clients[id] = ch
    return id
}

func (a *App) removeClient(id int) {
    a.clientsMu.Lock()
    ch := a.clients[id]
    delete(a.clients, id)
    a.clientsMu.Unlock()
    if ch != nil {
        close(ch)
    }
}

func (a *App) broadcast(event string, v any) {
    b, _ := json.Marshal(v)
    msg := fmt.Sprintf("event: %s\ndata: %s\n\n", event, string(b))
    a.clientsMu.Lock()
    for _, ch := range a.clients {
        select {
        case ch <- msg:
        default:
        }
    }
    a.clientsMu.Unlock()
}

func (a *App) getPost(idStr string) (Post, error) {
    var p Post
    var title sql.NullString
    row := a.DB.QueryRow(`SELECT id, title, content, created_at, updated_at FROM posts WHERE id = ?`, idStr)
    err := row.Scan(&p.ID, &title, &p.Content, &p.CreatedAt, &p.UpdatedAt)
    if err != nil {
        return Post{}, err
    }
    if title.Valid {
        t := title.String
        p.Title = &t
    }
    return p, nil
}
