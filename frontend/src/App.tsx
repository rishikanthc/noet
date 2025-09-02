import { useEffect, useMemo, useRef, useState, createContext, useContext } from 'react'
import Editor, { type EditorRef } from '@quill/Editor'
import './styles.css'

type Note = { id: number; title?: string; content?: string; createdAt?: string; updatedAt?: string }

type User = {
  id: number
  username: string
}

type AuthContextType = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // Check for existing token in localStorage
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
      // Validate token
      fetch('/api/auth/validate', {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setToken(savedToken)
          setUser(data.user)
        } else {
          localStorage.removeItem('auth_token')
        }
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
      })
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem('auth_token', data.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
  }

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/setup/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem('auth_token', data.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      isAuthenticated: !!token && !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function Registration() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 3) {
      setError('Password must be at least 3 characters')
      return
    }

    setLoading(true)
    setError('')

    const success = await register(username, password)
    if (success) {
      window.location.assign('/')
    } else {
      setError('Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-content">
        <h1>Create Admin Account</h1>
        <p style={{ marginBottom: '24px', color: '#666', textAlign: 'center', fontSize: '14px' }}>
          Set up your admin account to get started
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              placeholder="Enter your username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              placeholder="Confirm your password"
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')

    const success = await login(username, password)
    if (success) {
      window.location.assign('/')
    } else {
      setError('Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-content">
        <h1>Admin Login</h1>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ContextMenu({ x, y, onDelete, onClose }: { x: number; y: number; onDelete: () => void; onClose: () => void }) {
  useEffect(() => {
    const handleClickOutside = () => onClose()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div 
      className="context-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button 
        className="context-menu-item delete-item"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        Delete
      </button>
    </div>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-button confirm-button" onClick={onConfirm}>
            Delete
          </button>
          <button className="dialog-button cancel-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Home() {
  const { isAuthenticated, logout, token } = useAuth()
  const [creating, setCreating] = useState(false)
  const [posts, setPosts] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [intro, setIntro] = useState<string>('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; postId: number } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ postId: number; title: string } | null>(null)

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
      es.addEventListener('post-deleted', (ev: MessageEvent) => {
        if (cancelled) return
        try {
          const { id } = JSON.parse(ev.data)
          setPosts(prev => prev.filter(p => p.id !== id))
        } catch (e) {
          console.error('delete parse error', e)
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
    // Load intro text from API
    const loadIntro = async () => {
      try {
        const res = await fetch('/api/settings?key=introText')
        if (res.ok) {
          const data = await res.json()
          setIntro(data.value || '')
        }
      } catch (e) {
        console.error('Failed to load intro text:', e)
      }
    }
    loadIntro()
  }, [])

  const handleNewPost = async () => {
    if (creating || !isAuthenticated) return
    setCreating(true)
    try {
      const res = await fetch('/api/posts', { 
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
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

  const handleDeletePost = async (postId: number) => {
    if (!isAuthenticated || !token) return
    try {
      const res = await fetch(`/api/posts/${postId}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`)
      // Remove post from local state immediately for responsive UI
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (e) {
      console.error(e)
      alert('Failed to delete post')
    }
  }

  const handleRightClick = (e: React.MouseEvent, postId: number) => {
    if (!isAuthenticated) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, postId })
  }

  const handleDeleteClick = (postId: number, postTitle: string) => {
    setContextMenu(null)
    setConfirmDialog({ postId, title: postTitle })
  }

  const handleConfirmDelete = async () => {
    if (!confirmDialog) return
    await handleDeletePost(confirmDialog.postId)
    setConfirmDialog(null)
  }

  return (
    <div className="home-container">
      {isAuthenticated && (
        <>
          <button className="settings-link" onClick={() => window.location.assign('/settings')}>
            Settings
          </button>
          <button className="new-post-link" onClick={handleNewPost} disabled={creating}>
            New Post
          </button>
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </>
      )}
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
                  <a 
                    href={`/posts/${p.id}`} 
                    className="post-link"
                    onContextMenu={(e) => handleRightClick(e, p.id)}
                  >
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
      
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => {
            const post = posts.find(p => p.id === contextMenu.postId)
            const title = post?.title && post.title.trim() ? post.title : 'Untitled'
            handleDeleteClick(contextMenu.postId, title)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {confirmDialog && (
        <ConfirmDialog
          message={`Are you sure you want to delete "${confirmDialog.title}"?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}

function PostEditor({ id }: { id: string }) {
  const { isAuthenticated, token } = useAuth()
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
            editable={isAuthenticated}
            onChange={isAuthenticated ? (html) => {
              setContent(html)
              latestContentRef.current = html
              setDirty(true)
            } : undefined}
            onAutoSave={isAuthenticated ? async (html) => {
              try {
                const res = await fetch(`/api/posts/${id}`, {
                  method: 'PUT',
                  headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                  },
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
            } : undefined}
          />
        </div>
      </main>
    </div>
  )
}

function Settings() {
  const { isAuthenticated, token } = useAuth()
  const [text, setText] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=introText')
        if (res.ok) {
          const data = await res.json()
          setText(data.value || '')
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    if (!isAuthenticated || !token) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'introText', value: text })
      })
      if (!res.ok) throw new Error('Failed to save settings')
      window.location.assign('/')
    } catch (e) {
      console.error('Failed to save settings:', e)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="app-container settings-page">
        <main style={{ maxWidth: 800, margin: '0 auto' }}>
          <p>Access denied. Please log in to access settings.</p>
          <button onClick={() => window.location.assign('/admin')}>Go to Login</button>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container settings-page">
        <main style={{ maxWidth: 800, margin: '0 auto' }}>
          <p>Loading settings...</p>
        </main>
      </div>
    )
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
          disabled={saving}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ 
              background: '#fff', 
              border: '1px solid #d1d5db', 
              borderRadius: 8, 
              padding: '8px 12px', 
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={() => window.location.assign('/')} 
            disabled={saving}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#111', 
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  )
}

function AppContent() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [setupLoading, setSetupLoading] = useState(true)

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const match = useMemo(() => {
    const m = path.match(/^\/posts\/([A-Za-z0-9_-]+)$/)
    return m?.[1]
  }, [path])

  useEffect(() => {
    // Check if setup is needed on app start
    const checkSetupStatus = async () => {
      try {
        const res = await fetch('/api/setup/status')
        if (res.ok) {
          const data = await res.json()
          setNeedsSetup(data.needsSetup)
        }
      } catch (e) {
        console.error('Failed to check setup status:', e)
        // Assume setup is not needed if we can't check
        setNeedsSetup(false)
      } finally {
        setSetupLoading(false)
      }
    }
    
    checkSetupStatus()
  }, [])

  // Show loading while checking setup status
  if (setupLoading) {
    return (
      <div className="login-container">
        <div className="login-content">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Show registration page if setup is needed
  if (needsSetup) {
    return <Registration />
  }

  // Normal app routing
  if (path === '/admin') {
    return <Login />
  }
  if (match) {
    return <PostEditor id={match} />
  }
  if (path === '/settings') {
    return <Settings />
  }
  return <Home />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
