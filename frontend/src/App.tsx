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

function Header({ siteTitle, isAuthenticated, onLogout, onNewPost, onSettings, creating, showBack, onBack, latestPostId }: {
  siteTitle: string
  isAuthenticated: boolean
  onLogout: () => void
  onNewPost: () => void
  onSettings: () => void
  creating: boolean
  showBack?: boolean
  onBack?: () => void
  latestPostId?: number
}) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  return (
    <header className="site-header">
      <div className="site-header-content">
        <a href="/" className={`site-title ${!siteTitle ? 'empty' : ''}`}>
          {siteTitle || 'Untitled Site'}
        </a>
        <div className="header-actions" role="navigation" aria-label="Primary">
          <a className={`header-button ${path === '/' ? 'active' : ''}`} href="/">Home</a>
          <a className={`header-button ${/^\/posts\//.test(path) ? 'active' : ''}`} href={latestPostId ? `/posts/${latestPostId}` : '/'}>Post</a>
          <a className={`header-button ${path === '/archive' ? 'active' : ''}`} href="/archive">Archive</a>
          <a className="header-button" href="/rss.xml">RSS</a>
          {showBack && onBack && (
            <button className="header-button" onClick={onBack}>
              ← Back
            </button>
          )}
          {isAuthenticated && (
            <>
              <button className="header-button" onClick={onSettings}>
                Settings
              </button>
              <button className="header-button" onClick={onNewPost} disabled={creating}>
                {creating ? 'Creating...' : 'New Post'}
              </button>
              <button className="header-button" onClick={onLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
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
  const [siteTitle, setSiteTitle] = useState<string>('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; postId: number } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ postId: number; title: string } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'h') window.location.assign('/')
      if (k === 'p' && posts[0]?.id != null) window.location.assign(`/posts/${posts[0].id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [posts])

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
    // Load settings from API
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setIntro(data.introText || '')
          setSiteTitle(data.siteTitle || '')
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
    loadSettings()
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
      <Header 
        siteTitle={siteTitle}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        onNewPost={handleNewPost}
        onSettings={() => window.location.assign('/settings')}
        creating={creating}
        latestPostId={posts[0]?.id}
      />
      <div className="home-content">
        <p className="intro-text">{(intro && intro.trim()) ? intro : 'A text‑only blog about design, systems, and quiet craft.'}</p>
        <h1>Latest</h1>
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
                    className="post-link group"
                    onContextMenu={(e) => handleRightClick(e, p.id)}
                  >
                    <span className="post-title group-underline">{p.title && p.title.trim() ? p.title : 'Untitled'}</span>
                    {p.updatedAt && (
                      <span className="post-meta">— {new Date(p.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )
        )}

        {/* Archive link */}
        <div style={{ marginTop: 24, fontSize: 14 }}>
          <a className="header-button" href="/archive">View the full archive →</a>
        </div>
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
  const { isAuthenticated, token, logout } = useAuth()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|undefined>()
  const [dirty, setDirty] = useState(false)
  const [siteTitle, setSiteTitle] = useState<string>('')
  const editorRef = useRef<EditorRef>(null)
  const latestContentRef = useRef<string>('')

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!token) {
      throw new Error('Not authenticated')
    }

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${errorText}`)
    }

    const data = await response.json()
    return data.url
  }

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

  useEffect(() => {
    // Load site title
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSiteTitle(data.siteTitle || '')
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
    loadSettings()
  }, [])

  const handleNewPost = async () => {
    if (!isAuthenticated) return
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
    }
  }

  if (loading) return <div className="app-container"><p>Loading…</p></div>
  if (error) return <div className="app-container"><p>{error}</p></div>

  return (
    <div className="app-container editor-page">
      <Header 
        siteTitle={siteTitle}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        onNewPost={handleNewPost}
        onSettings={() => window.location.assign('/settings')}
        creating={false}
        latestPostId={parseInt(id, 10)}
      />
      {dirty && <div className="unsaved-indicator" aria-label="Unsaved changes" />}
      <main>
        <div className="editor-wrap">
          <Editor
            ref={editorRef}
            content={content}
            editable={isAuthenticated}
            onChange={isAuthenticated ? (html) => {
              setContent(html)
              latestContentRef.current = html
              setDirty(true)
            } : undefined}
            onImageUpload={isAuthenticated ? handleImageUpload : undefined}
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
  const { isAuthenticated, token, logout } = useAuth()
  const [introText, setIntroText] = useState<string>('')
  const [siteTitle, setSiteTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load all settings
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setIntroText(data.introText || '')
          setSiteTitle(data.siteTitle || '')
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
      console.log('Saving settings...', { introText, siteTitle })
      
      // Save introduction text
      console.log('Saving intro text...')
      const introRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'introText', value: introText })
      })
      
      if (!introRes.ok) {
        const errorText = await introRes.text()
        console.error('Failed to save intro text:', introRes.status, errorText)
        throw new Error(`Failed to save introduction text: ${introRes.status} - ${errorText}`)
      }
      
      const introResult = await introRes.json()
      console.log('Intro text saved successfully:', introResult)
      
      // Save site title
      console.log('Saving site title...')
      const titleRes = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'siteTitle', value: siteTitle })
      })
      
      if (!titleRes.ok) {
        const errorText = await titleRes.text()
        console.error('Failed to save site title:', titleRes.status, errorText)
        throw new Error(`Failed to save site title: ${titleRes.status} - ${errorText}`)
      }
      
      const titleResult = await titleRes.json()
      console.log('Site title saved successfully:', titleResult)
      
      console.log('All settings saved successfully, redirecting...')
      window.location.assign('/')
    } catch (e) {
      console.error('Save settings error:', e)
      // Show a more user-friendly message since the data is actually being saved
      if (e.message && (e.message.includes('Failed to save') || e.message.includes('fetch'))) {
        alert('Settings may have been saved with warnings. Please refresh the page to verify.')
      } else {
        alert(`Failed to save settings: ${e.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleNewPost = async () => {
    if (!isAuthenticated) return
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
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="app-container settings-page">
        <Header 
          siteTitle={siteTitle}
          isAuthenticated={false}
          onLogout={logout}
          onNewPost={handleNewPost}
          onSettings={() => {}}
          creating={false}
        />
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
          <p>Access denied. Please log in to access settings.</p>
          <button onClick={() => window.location.assign('/admin')}>Go to Login</button>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container settings-page">
        <Header 
          siteTitle={siteTitle}
          isAuthenticated={isAuthenticated}
          onLogout={logout}
          onNewPost={handleNewPost}
          onSettings={() => {}}
          creating={false}
        />
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
          <p>Loading settings...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-container settings-page">
      <Header 
        siteTitle={siteTitle}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        onNewPost={handleNewPost}
        onSettings={() => {}}
        creating={false}
        latestPostId={undefined}
      />
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontWeight: 400, fontFamily: 'Inter, sans-serif' }}>Settings</h1>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', margin: '12px 0 6px', color: '#444' }}>Site title</label>
          <input
            type="text"
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            style={{ 
              width: '100%', 
              fontFamily: 'Inter, system-ui, sans-serif', 
              fontSize: 14, 
              padding: 10, 
              boxSizing: 'border-box',
              border: '1px solid #d1d5db',
              borderRadius: 6
            }}
            placeholder="Enter your site title"
            disabled={saving}
          />
        </div>

        <div>
          <label style={{ display: 'block', margin: '12px 0 6px', color: '#444' }}>Introduction text</label>
          <textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            rows={6}
            style={{ 
              width: '100%', 
              fontFamily: 'Inter, system-ui, sans-serif', 
              fontSize: 14, 
              padding: 10, 
              boxSizing: 'border-box',
              border: '1px solid #d1d5db',
              borderRadius: 6
            }}
            placeholder="Write a short introduction to show on the homepage"
            disabled={saving}
          />
        </div>
        
        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
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
  if (path === '/archive') {
    return <Archive />
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

function Archive() {
  const { isAuthenticated, logout, token } = useAuth()
  const [posts, setPosts] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [siteTitle, setSiteTitle] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/posts')
        if (res.ok) {
          const list: Note[] = await res.json()
          const sorted = [...list].sort((a, b) => {
            const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
            const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
            return bu - au
          })
          setPosts(sorted)
        } else {
          setError('Failed to load posts')
        }
      } catch (e) {
        setError('Failed to load posts')
      } finally {
        setLoading(false)
      }
    }
    const loadTitle = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSiteTitle(data.siteTitle || '')
        }
      } catch {}
    }
    load()
    loadTitle()
  }, [])

  return (
    <div className="home-container">
      <Header 
        siteTitle={siteTitle}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        onNewPost={() => {}}
        onSettings={() => window.location.assign('/settings')}
        creating={false}
      />
      <div className="home-content">
        <h1>Archive</h1>
        {loading && <p>Loading…</p>}
        {error && <p>{error}</p>}
        {!loading && !error && (
          posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            <ul className="post-list">
              {posts.map(p => (
                <li key={p.id}>
                  <a href={`/posts/${p.id}`} className="post-link">
                    <span className="post-title">{p.title && p.title.trim() ? p.title : 'Untitled'}</span>
                    {p.updatedAt && (
                      <span className="post-meta">— {new Date(p.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
