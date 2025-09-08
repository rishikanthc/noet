package main

import (
	"log"
	"log/slog"
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
	addr := ":8081"
	app.Logger.Info("Starting Noet server", "address", addr, "database", dbPath)
	slog.Info("Server starting up", "address", addr)
	log.Fatal(http.ListenAndServe(addr, app.Handler()))
}
