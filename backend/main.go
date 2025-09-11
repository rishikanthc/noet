package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
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
	
	// Setup graceful shutdown
	defer func() {
		if closeErr := app.Close(); closeErr != nil {
			slog.Error("Error closing app", "error", closeErr)
		}
	}()

	addr := ":8081"
	server := &http.Server{
		Addr:    addr,
		Handler: app.Handler(),
	}

	// Start server in a goroutine
	go func() {
		app.Logger.Info("Starting Noet server", "address", addr, "database", dbPath)
		slog.Info("Server starting up", "address", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	// Give outstanding requests 30 seconds to finish
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	slog.Info("Server exited")
}
