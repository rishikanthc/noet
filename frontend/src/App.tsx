import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type EditorRef } from '@quill/Editor'
import './styles.css'

function Home() {
  const [creating, setCreating] = useState(false)

  const handleNewPost = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/notes', { method: 'POST' })
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
      <button className="new-post-link" onClick={handleNewPost} disabled={creating}>
        New Post
      </button>
    </div>
  )
}

function PostEditor({ id }: { id: string }) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|undefined>()
  const editorRef = useRef<EditorRef>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/notes/${id}`)
        if (!res.ok) throw new Error(`Failed to load note: ${res.status}`)
        const note = await res.json()
        if (!cancelled) setContent(note.content || '')
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
    <div className="app-container">
      <main>
        <Editor
          ref={editorRef}
          content={content}
          onChange={setContent}
          style={{ maxWidth: 900, margin: '0 auto' }}
        />
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
  return <Home />
}
