import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type EditorRef } from '@quill/Editor'
import './styles.css'

type Note = { id: number; title?: string; content?: string; createdAt?: string; updatedAt?: string }

function Home() {
  const [creating, setCreating] = useState(false)
  const [posts, setPosts] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [intro, setIntro] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const sortNotes = (arr: Note[]) =>
      [...arr].sort((a, b) => {
        const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        if (bu !== au) return bu - au
        const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bc - ac
      })
    const upsert = (list: Note[], item: Note) => {
      const idx = list.findIndex(n => n.id === item.id)
      if (idx === -1) return sortNotes([item, ...list])
      const next = list.slice()
      next[idx] = { ...next[idx], ...item }
      return sortNotes(next)
    }

    // Fallback initial load in case SSE is blocked
    ;(async () => {
      try {
        const res = await fetch('/api/posts')
        if (res.ok) {
          const list = await res.json()
          if (!cancelled) setPosts(sortNotes(list))
        }
      } catch {}
    })()

    // Connect to SSE for live updates
    let es: EventSource | undefined
    try {
      es = new EventSource('/api/posts/stream')
      es.addEventListener('snapshot', (ev: MessageEvent) => {
        if (cancelled) return
        try {
          const list: Note[] = JSON.parse(ev.data)
          setPosts(sortNotes(list))
          setError(undefined)
        } catch (e) {
          console.error('snapshot parse error', e)
        } finally {
          setLoading(false)
        }
      })
      es.addEventListener('post-created', (ev: MessageEvent) => {
        if (cancelled) return
        try {
          const note: Note = JSON.parse(ev.data)
          setPosts(prev => upsert(prev, note))
        } catch (e) {
          console.error('create parse error', e)
        }
      })
      es.addEventListener('post-updated', (ev: MessageEvent) => {
        if (cancelled) return
        try {
          const note: Note = JSON.parse(ev.data)
          setPosts(prev => upsert(prev, note))
        } catch (e) {
          console.error('update parse error', e)
        }
      })
      es.onerror = (e) => {
        console.warn('SSE error', e)
      }
    } catch (e) {
      console.warn('SSE unavailable', e)
    }

    return () => {
      cancelled = true
      if (es) es.close()
    }
  }, [])

  useEffect(() => {
    // Load intro text from localStorage
    try {
      const v = localStorage.getItem('noet.introText') || ''
      setIntro(v)
    } catch {}
  }, [])

  const handleNewPost = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/posts', { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to create note: ${res.status}`)
      const note = await res.json()
      window.location.assign(`/posts/${note.id}`)
    } catch (e) {
      console.error(e)
      alert('Failed to create a new post')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="home-container">
      <button className="settings-link" onClick={() => window.location.assign('/settings')}>
        Settings
      </button>
      <button className="new-post-link" onClick={handleNewPost} disabled={creating}>
        New Post
      </button>
      <div className="home-content">
        {intro && intro.trim() && (
          <div className="intro-block">{intro}</div>
        )}
        <h1>All Posts</h1>
        {loading && <p>Loading…</p>}
        {error && <p>{error}</p>}
        {!loading && !error && (
          posts.length === 0 ? (
            <p>No posts yet. Click “New Post”.</p>
          ) : (
            <ul className="post-list">
              {posts.map(p => (
                <li key={p.id}>
                  <a href={`/posts/${p.id}`} className="post-link">
                    <span className="post-title">{p.title && p.title.trim() ? p.title : 'Untitled'}</span>
                    {p.updatedAt && (
                      <span className="post-meta">{new Date(p.updatedAt).toLocaleString()}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

function PostEditor({ id }: { id: string }) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|undefined>()
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef<EditorRef>(null)
  const latestContentRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`)
        if (!res.ok) throw new Error(`Failed to load note: ${res.status}`)
        const note = await res.json()
        if (!cancelled) {
          setContent(note.content || '')
          latestContentRef.current = note.content || ''
          setDirty(false)
        }
      } catch (e: any) {
        console.error(e)
        if (!cancelled) setError(e?.message || 'Failed to load note')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="app-container"><p>Loading…</p></div>
  if (error) return <div className="app-container"><p>{error}</p></div>

  return (
    <div className="app-container editor-page">
      {dirty && <div className="unsaved-indicator" aria-label="Unsaved changes" />}
      <main>
        <div className="editor-wrap">
          <button className="back-link" onClick={() => window.location.assign('/')}>Back</button>
          <Editor
            ref={editorRef}
            content={content}
            onChange={(html) => {
              setContent(html)
              latestContentRef.current = html
              setDirty(true)
            }}
            onAutoSave={async (html) => {
              try {
                const res = await fetch(`/api/posts/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: html })
                })
                if (!res.ok) throw new Error(`Failed to save note: ${res.status}`)
                // Only clear dirty if content hasn't changed since this save started
                if (latestContentRef.current === html) {
                  setDirty(false)
                }
              } catch (e) {
                console.error(e)
                // keep dirty = true so the dot stays visible
              }
            }}
          />
        </div>
      </main>
    </div>
  )
}

function Settings() {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    try {
      const v = localStorage.getItem('noet.introText') || ''
      setText(v)
    } catch {}
  }, [])

  const handleSave = () => {
    try {
      localStorage.setItem('noet.introText', text)
    } catch {}
    window.location.assign('/')
  }

  return (
    <div className="app-container settings-page">
      <main style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontWeight: 400, fontFamily: 'Inter, sans-serif' }}>Settings</h1>
        <label style={{ display: 'block', margin: '12px 0 6px', color: '#444' }}>Introduction text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{ width: '100%', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, padding: 10, boxSizing: 'border-box' }}
          placeholder="Write a short introduction to show on the homepage"
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Save</button>
          <button onClick={() => window.location.assign('/')} style={{ background: 'transparent', border: 'none', color: '#111', cursor: 'pointer' }}>Cancel</button>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const match = useMemo(() => {
    const m = path.match(/^\/posts\/([A-Za-z0-9_-]+)$/)
    return m?.[1]
  }, [path])

  if (match) {
    return <PostEditor id={match} />
  }
  if (path === '/settings') {
    return <Settings />
  }
  return <Home />
}
