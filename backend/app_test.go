package main

import (
    "encoding/json"
    "io"
    "net/http"
    "net/http/httptest"
    "os"
    "path/filepath"
    "strings"
    "testing"
)

func TestExtractTitleFromHTML(t *testing.T) {
    cases := []struct{ in, want string }{
        {"<h1>Hello</h1>", "Hello"},
        {"<h1>  Hello   World </h1>", "Hello World"},
        {"<div><h1>Title <em>Here</em></h1></div>", "Title Here"},
        {"<p>No h1</p>", ""},
        {"<h1 class='x'>Hi</h1>", "Hi"},
    }
    for _, c := range cases {
        if got := extractTitleFromHTML(c.in); got != c.want {
            t.Fatalf("extractTitle: got %q want %q", got, c.want)
        }
    }
}

func newTestApp(t *testing.T) *App {
    t.Helper()
    dir := t.TempDir()
    dbPath := filepath.Join(dir, "test.db")
    app, err := NewApp(dbPath)
    if err != nil {
        t.Fatalf("NewApp: %v", err)
    }
    return app
}

func TestCRUDHandlers(t *testing.T) {
    app := newTestApp(t)
    srv := httptest.NewServer(app.Mux)
    defer srv.Close()

    // Create
    resp, err := http.Post(srv.URL+"/api/posts", "application/json", nil)
    if err != nil {
        t.Fatalf("create: %v", err)
    }
    if resp.StatusCode != http.StatusCreated {
        t.Fatalf("create status: %d", resp.StatusCode)
    }
    var created Post
    if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
        t.Fatalf("decode create: %v", err)
    }
    _ = resp.Body.Close()
    if created.ID == 0 {
        t.Fatalf("expected non-zero id")
    }

    // List should include
    resp, err = http.Get(srv.URL + "/api/posts")
    if err != nil {
        t.Fatalf("list: %v", err)
    }
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("list status: %d", resp.StatusCode)
    }
    var list []Post
    if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
        t.Fatalf("decode list: %v", err)
    }
    _ = resp.Body.Close()
    if len(list) == 0 {
        t.Fatalf("list empty")
    }

    // Update content and auto title
    html := "<h1>My Title</h1><p>Body</p>"
    req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/posts/"+itoa(created.ID), strings.NewReader(`{"content":`+toJSON(html)+`}`))
    req.Header.Set("Content-Type", "application/json")
    resp, err = http.DefaultClient.Do(req)
    if err != nil {
        t.Fatalf("update: %v", err)
    }
    if resp.StatusCode != http.StatusOK {
        b, _ := io.ReadAll(resp.Body)
        t.Fatalf("update status: %d body=%s", resp.StatusCode, string(b))
    }
    var updated Post
    if err := json.NewDecoder(resp.Body).Decode(&updated); err != nil {
        t.Fatalf("decode update: %v", err)
    }
    _ = resp.Body.Close()
    if updated.Title == nil || *updated.Title != "My Title" {
        t.Fatalf("expected title 'My Title', got %#v", updated.Title)
    }
    if updated.Content != html {
        t.Fatalf("content mismatch")
    }

    // Read by id
    resp, err = http.Get(srv.URL + "/api/posts/" + itoa(created.ID))
    if err != nil {
        t.Fatalf("get: %v", err)
    }
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("get status: %d", resp.StatusCode)
    }
    var got Post
    if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
        t.Fatalf("decode get: %v", err)
    }
    _ = resp.Body.Close()
    if got.ID != created.ID {
        t.Fatalf("id mismatch")
    }

    // Delete
    req, _ = http.NewRequest(http.MethodDelete, srv.URL+"/api/posts/"+itoa(created.ID), nil)
    resp, err = http.DefaultClient.Do(req)
    if err != nil {
        t.Fatalf("delete: %v", err)
    }
    if resp.StatusCode != http.StatusNoContent {
        t.Fatalf("delete status: %d", resp.StatusCode)
    }
    _ = resp.Body.Close()

    // Get should 404
    resp, err = http.Get(srv.URL + "/api/posts/" + itoa(created.ID))
    if err != nil {
        t.Fatalf("get2: %v", err)
    }
    if resp.StatusCode != http.StatusNotFound {
        b, _ := io.ReadAll(resp.Body)
        t.Fatalf("expected 404, got %d body=%s", resp.StatusCode, string(b))
    }
}

// helpers for tests without strconv/json imports in test file
func itoa(n int64) string { return strconvItoa(int(n)) }

func strconvItoa(n int) string { return (func(i int) string { return fmtInt(i) })(n) }

func fmtInt(i int) string {
    // minimal implementation
    return strings.TrimLeft(strings.ReplaceAll(strings.ReplaceAll(fmt.Sprintf("%d", i), "+", ""), " ", ""), "+")
}

func toJSON(s string) string { b, _ := json.Marshal(s); return string(b) }

