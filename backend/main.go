package main

import (
    "log"
    "net/http"
    "os"
)

func main() {
    // Determine DB path: NOET_DB_PATH env or next to executable
    dbPath := os.Getenv("NOET_DB_PATH")
    if dbPath == "" {
        // default to file next to the running binary
        exe, err := os.Executable()
        if err == nil {
            dbPath = exe + ".db"
        } else {
            dbPath = "noet.db"
        }
    }

    app, err := NewApp(dbPath)
    if err != nil {
        log.Fatalf("failed to initialize app: %v", err)
    }
    addr := ":8080"
    log.Printf("Noet server listening on %s (db: %s)", addr, dbPath)
    log.Fatal(http.ListenAndServe(addr, app.Mux))
}
