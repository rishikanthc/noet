package main

import (
    "crypto/rand"
    "crypto/sha256"
    "database/sql"
    "embed"
    "encoding/base64"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "mime"
    "net/http"
    "os"
    "path"
    "path/filepath"
    "strings"
    "sync"
    "time"

    _ "modernc.org/sqlite"
    "golang.org/x/crypto/bcrypt"
    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
)

//go:embed static/*
var staticFS embed.FS

type App struct {
    DB        *sql.DB
    Mux       *http.ServeMux
    JWTSecret []byte

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

type User struct {
    ID           int64     `json:"id"`
    Username     string    `json:"username"`
    PasswordHash string    `json:"-"`
    CreatedAt    time.Time `json:"createdAt"`
}

type Attachment struct {
    ID        int64     `json:"id"`
    Filename  string    `json:"filename"`
    OriginalName string `json:"originalName"`
    MimeType  string    `json:"mimeType"`
    Size      int64     `json:"size"`
    CreatedAt time.Time `json:"createdAt"`
}

type Claims struct {
    UserID   int64  `json:"user_id"`
    Username string `json:"username"`
    jwt.RegisteredClaims
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

    // Get or generate persistent JWT secret
    jwtSecret, err := getOrCreateJWTSecret(db)
    if err != nil {
        return nil, fmt.Errorf("failed to get JWT secret: %v", err)
    }

    a := &App{
        DB:        db, 
        Mux:       http.NewServeMux(), 
        JWTSecret: jwtSecret,
        clients:   make(map[int]chan string),
    }
    
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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`)
    return err
}

func getOrCreateJWTSecret(db *sql.DB) ([]byte, error) {
    var secretStr string
    err := db.QueryRow(`SELECT value FROM settings WHERE key = 'jwt_secret'`).Scan(&secretStr)
    
    if err == sql.ErrNoRows {
        // Generate new secret
        secret := make([]byte, 32)
        if _, err := rand.Read(secret); err != nil {
            return nil, err
        }
        
        secretStr = base64.StdEncoding.EncodeToString(secret)
        
        // Store in database
        _, err = db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES ('jwt_secret', ?, ?)`, 
            secretStr, time.Now())
        if err != nil {
            return nil, err
        }
        
        return secret, nil
    } else if err != nil {
        return nil, err
    }
    
    // Decode existing secret
    return base64.StdEncoding.DecodeString(secretStr)
}

func (a *App) createRefreshToken(userID int64) (string, error) {
    // Generate random refresh token
    tokenBytes := make([]byte, 32)
    if _, err := rand.Read(tokenBytes); err != nil {
        return "", err
    }
    
    refreshToken := base64.URLEncoding.EncodeToString(tokenBytes)
    tokenHash := sha256.Sum256([]byte(refreshToken))
    
    // Clean up expired tokens for this user
    _, _ = a.DB.Exec(`DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?`, userID, time.Now())
    
    // Store in database (30 days expiry)
    expiresAt := time.Now().Add(30 * 24 * time.Hour)
    _, err := a.DB.Exec(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`, 
        userID, base64.StdEncoding.EncodeToString(tokenHash[:]), expiresAt, time.Now())
    if err != nil {
        return "", err
    }
    
    return refreshToken, nil
}

func (a *App) validateRefreshToken(refreshToken string) (int64, error) {
    tokenHash := sha256.Sum256([]byte(refreshToken))
    tokenHashStr := base64.StdEncoding.EncodeToString(tokenHash[:])
    
    var userID int64
    err := a.DB.QueryRow(`SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?`, 
        tokenHashStr, time.Now()).Scan(&userID)
    if err != nil {
        return 0, err
    }
    
    return userID, nil
}

func (a *App) revokeRefreshToken(refreshToken string) error {
    tokenHash := sha256.Sum256([]byte(refreshToken))
    tokenHashStr := base64.StdEncoding.EncodeToString(tokenHash[:])
    
    _, err := a.DB.Exec(`DELETE FROM refresh_tokens WHERE token_hash = ?`, tokenHashStr)
    return err
}

func (a *App) hasAnyUsers() (bool, error) {
    var count int
    err := a.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count)
    if err != nil {
        return false, err
    }
    return count > 0, nil
}

func (a *App) createUser(username, password string) (*User, error) {
    // Check if any users already exist
    hasUsers, err := a.hasAnyUsers()
    if err != nil {
        return nil, err
    }
    if hasUsers {
        return nil, errors.New("user registration is not allowed - user already exists")
    }
    
    // Hash password
    passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return nil, err
    }
    
    // Insert user
    res, err := a.DB.Exec(`INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`, 
        username, string(passwordHash), time.Now())
    if err != nil {
        return nil, err
    }
    
    id, err := res.LastInsertId()
    if err != nil {
        return nil, err
    }
    
    return &User{
        ID:       id,
        Username: username,
        CreatedAt: time.Now(),
    }, nil
}

func (a *App) authenticateUser(username, password string) (*User, error) {
    var user User
    row := a.DB.QueryRow(`SELECT id, username, password_hash, created_at FROM users WHERE username = ?`, username)
    err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt)
    if err != nil {
        return nil, err
    }
    
    err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
    if err != nil {
        return nil, err
    }
    
    return &user, nil
}

func (a *App) generateJWT(user *User) (string, error) {
    claims := Claims{
        UserID:   user.ID,
        Username: user.Username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7 days
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(a.JWTSecret)
}

func (a *App) validateJWT(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return a.JWTSecret, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    
    return nil, errors.New("invalid token")
}

func (a *App) requireAuth(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenString == authHeader {
            http.Error(w, "invalid authorization header", http.StatusUnauthorized)
            return
        }
        
        _, err := a.validateJWT(tokenString)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }
        
        next(w, r)
    }
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

func (a *App) ensureUploadsDir() error {
    uploadsDir := "uploads"
    if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
        return os.MkdirAll(uploadsDir, 0755)
    }
    return nil
}

func (a *App) saveAttachment(file io.Reader, originalFilename, mimeType string, size int64) (*Attachment, error) {
    // Generate unique filename
    ext := filepath.Ext(originalFilename)
    filename := uuid.New().String() + ext
    
    // Ensure uploads directory exists
    if err := a.ensureUploadsDir(); err != nil {
        return nil, fmt.Errorf("failed to create uploads directory: %v", err)
    }
    
    // Save file to disk
    filepath := filepath.Join("uploads", filename)
    outFile, err := os.Create(filepath)
    if err != nil {
        return nil, fmt.Errorf("failed to create file: %v", err)
    }
    defer outFile.Close()
    
    _, err = io.Copy(outFile, file)
    if err != nil {
        os.Remove(filepath) // Clean up on error
        return nil, fmt.Errorf("failed to save file: %v", err)
    }
    
    // Save metadata to database
    now := time.Now()
    result, err := a.DB.Exec(`
        INSERT INTO attachments (filename, original_name, mime_type, size, created_at) 
        VALUES (?, ?, ?, ?, ?)
    `, filename, originalFilename, mimeType, size, now)
    if err != nil {
        os.Remove(filepath) // Clean up on error
        return nil, fmt.Errorf("failed to save metadata: %v", err)
    }
    
    id, err := result.LastInsertId()
    if err != nil {
        return nil, err
    }
    
    return &Attachment{
        ID:           id,
        Filename:     filename,
        OriginalName: originalFilename,
        MimeType:     mimeType,
        Size:         size,
        CreatedAt:    now,
    }, nil
}

func (a *App) getAttachment(filename string) (*Attachment, error) {
    var attachment Attachment
    row := a.DB.QueryRow(`
        SELECT id, filename, original_name, mime_type, size, created_at 
        FROM attachments WHERE filename = ?
    `, filename)
    
    err := row.Scan(&attachment.ID, &attachment.Filename, &attachment.OriginalName, 
                   &attachment.MimeType, &attachment.Size, &attachment.CreatedAt)
    if err != nil {
        return nil, err
    }
    
    return &attachment, nil
}

func isValidImageMimeType(mimeType string) bool {
    validTypes := []string{
        "image/jpeg",
        "image/jpg", 
        "image/png",
        "image/gif",
        "image/webp",
    }
    
    for _, validType := range validTypes {
        if mimeType == validType {
            return true
        }
    }
    return false
}

func (a *App) routes() {
    mux := a.Mux
    // Health
    mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    // Check if setup is needed
    mux.HandleFunc("/api/setup/status", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        hasUsers, err := a.hasAnyUsers()
        if err != nil {
            http.Error(w, "database error", http.StatusInternalServerError)
            return
        }
        
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]bool{
            "needsSetup": !hasUsers,
        })
    })

    // User registration (only allowed if no users exist)
    mux.HandleFunc("/api/setup/register", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        var payload struct {
            Username string `json:"username"`
            Password string `json:"password"`
        }
        
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid json", http.StatusBadRequest)
            return
        }
        
        if payload.Username == "" || payload.Password == "" {
            http.Error(w, "username and password are required", http.StatusBadRequest)
            return
        }
        
        if len(payload.Password) < 3 {
            http.Error(w, "password must be at least 3 characters", http.StatusBadRequest)
            return
        }
        
        user, err := a.createUser(payload.Username, payload.Password)
        if err != nil {
            if err.Error() == "user registration is not allowed - user already exists" {
                http.Error(w, "registration not allowed", http.StatusForbidden)
            } else {
                http.Error(w, "failed to create user", http.StatusInternalServerError)
            }
            return
        }
        
        token, err := a.generateJWT(user)
        if err != nil {
            http.Error(w, "failed to generate token", http.StatusInternalServerError)
            return
        }
        
        refreshToken, err := a.createRefreshToken(user.ID)
        if err != nil {
            http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
            return
        }
        
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
            "token": token,
            "refreshToken": refreshToken,
            "user": map[string]interface{}{
                "id": user.ID,
                "username": user.Username,
            },
        })
    })

    // Auth endpoints
    mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        var payload struct {
            Username string `json:"username"`
            Password string `json:"password"`
        }
        
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid json", http.StatusBadRequest)
            return
        }
        
        user, err := a.authenticateUser(payload.Username, payload.Password)
        if err != nil {
            http.Error(w, "invalid credentials", http.StatusUnauthorized)
            return
        }
        
        token, err := a.generateJWT(user)
        if err != nil {
            http.Error(w, "failed to generate token", http.StatusInternalServerError)
            return
        }
        
        refreshToken, err := a.createRefreshToken(user.ID)
        if err != nil {
            http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
            return
        }
        
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
            "token": token,
            "refreshToken": refreshToken,
            "user": map[string]interface{}{
                "id": user.ID,
                "username": user.Username,
            },
        })
    })

    mux.HandleFunc("/api/auth/validate", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenString == authHeader {
            http.Error(w, "invalid authorization header", http.StatusUnauthorized)
            return
        }
        
        claims, err := a.validateJWT(tokenString)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }
        
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
            "valid": true,
            "user": map[string]interface{}{
                "id": claims.UserID,
                "username": claims.Username,
            },
        })
    })

    // Token refresh endpoint
    mux.HandleFunc("/api/auth/refresh", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        var payload struct {
            RefreshToken string `json:"refreshToken"`
        }
        
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid json", http.StatusBadRequest)
            return
        }
        
        if payload.RefreshToken == "" {
            http.Error(w, "refresh token required", http.StatusBadRequest)
            return
        }
        
        // Validate refresh token
        userID, err := a.validateRefreshToken(payload.RefreshToken)
        if err != nil {
            http.Error(w, "invalid refresh token", http.StatusUnauthorized)
            return
        }
        
        // Get user
        var user User
        row := a.DB.QueryRow(`SELECT id, username, created_at FROM users WHERE id = ?`, userID)
        err = row.Scan(&user.ID, &user.Username, &user.CreatedAt)
        if err != nil {
            http.Error(w, "user not found", http.StatusUnauthorized)
            return
        }
        
        // Generate new tokens
        newToken, err := a.generateJWT(&user)
        if err != nil {
            http.Error(w, "failed to generate token", http.StatusInternalServerError)
            return
        }
        
        newRefreshToken, err := a.createRefreshToken(user.ID)
        if err != nil {
            http.Error(w, "failed to generate refresh token", http.StatusInternalServerError)
            return
        }
        
        // Revoke old refresh token
        _ = a.revokeRefreshToken(payload.RefreshToken)
        
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
            "token": newToken,
            "refreshToken": newRefreshToken,
            "user": map[string]interface{}{
                "id": user.ID,
                "username": user.Username,
            },
        })
    })

    // Posts collection: POST(create) and GET(list)
    mux.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPost:
            // Protect post creation
            a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
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
            })(w, r)
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
            // Protect post updates
            a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
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
            })(w, r)
            return
        case http.MethodDelete:
            // Protect post deletion
            a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
                _, err := a.DB.Exec(`DELETE FROM posts WHERE id = ?`, idStr)
                if err != nil {
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                w.WriteHeader(http.StatusNoContent)
                go a.broadcast("post-deleted", map[string]string{"id": idStr})
            })(w, r)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // Settings endpoints
    mux.HandleFunc("/api/settings", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            // Get all settings or specific setting by key query param
            key := r.URL.Query().Get("key")
            if key != "" {
                // Get specific setting
                var value string
                err := a.DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
                if err != nil {
                    if errors.Is(err, sql.ErrNoRows) {
                        w.Header().Set("Content-Type", "application/json")
                        _ = json.NewEncoder(w).Encode(map[string]string{"value": ""})
                        return
                    }
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                w.Header().Set("Content-Type", "application/json")
                _ = json.NewEncoder(w).Encode(map[string]string{"value": value})
                return
            }
            // Get all settings
            rows, err := a.DB.Query(`SELECT key, value FROM settings`)
            if err != nil {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            defer rows.Close()
            settings := make(map[string]string)
            for rows.Next() {
                var k, v string
                if err := rows.Scan(&k, &v); err != nil {
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                settings[k] = v
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(settings)
            return
        case http.MethodPut:
            // Protect settings updates
            a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
                var payload struct {
                    Key   string `json:"key"`
                    Value string `json:"value"`
                }
                if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
                    http.Error(w, "invalid json", http.StatusBadRequest)
                    return
                }
                if payload.Key == "" {
                    http.Error(w, "key is required", http.StatusBadRequest)
                    return
                }
                now := time.Now()
                _, err := a.DB.Exec(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, payload.Key, payload.Value, now)
                if err != nil {
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                w.Header().Set("Content-Type", "application/json")
                _ = json.NewEncoder(w).Encode(map[string]string{"key": payload.Key, "value": payload.Value})
            })(w, r)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
    })

    // Image upload endpoint
    mux.HandleFunc("/api/uploads", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        // Protect upload endpoint
        a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
            // Parse multipart form
            err := r.ParseMultipartForm(10 << 20) // 10MB max
            if err != nil {
                http.Error(w, "failed to parse form", http.StatusBadRequest)
                return
            }
            
            file, handler, err := r.FormFile("file")
            if err != nil {
                http.Error(w, "no file provided", http.StatusBadRequest)
                return
            }
            defer file.Close()
            
            // Validate mime type
            contentType := handler.Header.Get("Content-Type")
            if contentType == "" {
                contentType = mime.TypeByExtension(filepath.Ext(handler.Filename))
            }
            
            if !isValidImageMimeType(contentType) {
                http.Error(w, "invalid file type - only images are allowed", http.StatusBadRequest)
                return
            }
            
            // Save attachment
            attachment, err := a.saveAttachment(file, handler.Filename, contentType, handler.Size)
            if err != nil {
                http.Error(w, fmt.Sprintf("failed to save file: %v", err), http.StatusInternalServerError)
                return
            }
            
            // Return attachment info with URL
            response := map[string]interface{}{
                "id":           attachment.ID,
                "filename":     attachment.Filename,
                "originalName": attachment.OriginalName,
                "mimeType":     attachment.MimeType,
                "size":         attachment.Size,
                "url":          fmt.Sprintf("/api/uploads/%s", attachment.Filename),
                "createdAt":    attachment.CreatedAt,
            }
            
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusCreated)
            _ = json.NewEncoder(w).Encode(response)
        })(w, r)
    })

    // Serve uploaded files
    mux.HandleFunc("/api/uploads/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        filename := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
        if filename == "" {
            http.NotFound(w, r)
            return
        }
        
        // Get attachment metadata
        attachment, err := a.getAttachment(filename)
        if err != nil {
            if errors.Is(err, sql.ErrNoRows) {
                http.NotFound(w, r)
            } else {
                http.Error(w, "database error", http.StatusInternalServerError)
            }
            return
        }
        
        // Serve file
        filepath := filepath.Join("uploads", filename)
        if _, err := os.Stat(filepath); os.IsNotExist(err) {
            http.NotFound(w, r)
            return
        }
        
        w.Header().Set("Content-Type", attachment.MimeType)
        w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", attachment.OriginalName))
        http.ServeFile(w, r, filepath)
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

    // About Me endpoints
    mux.HandleFunc("/api/about", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            // Get about me content and enabled status
            var aboutContent, aboutEnabled string
            
            // Get content
            err := a.DB.QueryRow(`SELECT value FROM settings WHERE key = 'aboutContent'`).Scan(&aboutContent)
            if err != nil && !errors.Is(err, sql.ErrNoRows) {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            
            // Get enabled status
            err = a.DB.QueryRow(`SELECT value FROM settings WHERE key = 'aboutEnabled'`).Scan(&aboutEnabled)
            if err != nil && !errors.Is(err, sql.ErrNoRows) {
                http.Error(w, "db error", http.StatusInternalServerError)
                return
            }
            
            // Default to disabled if not set
            if aboutEnabled == "" {
                aboutEnabled = "false"
            }
            
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "content": aboutContent,
                "enabled": aboutEnabled == "true",
            })
            return
        case http.MethodPut:
            // Protect about me updates
            a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
                var payload struct{ Content string `json:"content"` }
                if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
                    http.Error(w, "invalid json", http.StatusBadRequest)
                    return
                }
                
                now := time.Now()
                _, err := a.DB.Exec(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('aboutContent', ?, ?)`, 
                    payload.Content, now)
                if err != nil {
                    http.Error(w, "db error", http.StatusInternalServerError)
                    return
                }
                
                w.Header().Set("Content-Type", "application/json")
                _ = json.NewEncoder(w).Encode(map[string]interface{}{
                    "content": payload.Content,
                })
            })(w, r)
            return
        default:
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
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
