import { useRef, useState } from 'react'
import Editor, { type EditorRef } from '@quill/Editor'
import './styles.css'

export default function App() {
  const [content, setContent] = useState('<h1>Welcome to Quill Editor</h1><p>This is a demo of the extensible Tiptap-based editor library. Try editing this content!</p><h2>Formatting Features</h2><ul><li><strong>Bold text</strong> works perfectly</li><li><em>Italic text</em> is now enabled</li><li><mark>Highlighting</mark> is available too</li><li>Beautiful typography with Noto Sans and Space Grotesk fonts</li></ul><h3>Try These Shortcuts:</h3><ul><li><strong>Ctrl+B / Cmd+B</strong> for bold</li><li><strong>Ctrl+I / Cmd+I</strong> for italic</li><li><strong>Ctrl+Shift+H / Cmd+Shift+H</strong> for highlight</li><li>Type <code>==text==</code> for highlighting</li><li>Type <code>*text*</code> or <code>_text_</code> for italic</li></ul>')
  const editorRef = useRef<EditorRef>(null)

  return (
    <div className="app-container">
      <header>
        <h1>Quill Editor Demo</h1>
        <div className="demo-controls">
          <button onClick={() => editorRef.current?.focus()}>Focus Editor</button>
          <button onClick={() => setContent('')}>Clear</button>
          <button onClick={() => editorRef.current?.setContent('<p>Preset content</p>')}>Set Preset</button>
          <button onClick={() => alert(editorRef.current?.getContent() || '')}>Get HTML</button>
        </div>
      </header>
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
