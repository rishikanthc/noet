package main

import (
    "embed"
    "encoding/json"
    "log"
    "mime"
    "net/http"
    "path"
    "path/filepath"
    "strings"
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
            http.NotFound(w, r)
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

