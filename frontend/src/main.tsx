import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import { queryClient } from './lib/queryClient'
import { postsQueryKeys } from './hooks/usePostsQuery'

declare global {
  interface Window {
    __NOET_PRELOADED__?: Record<string, unknown>
  }
}

const container = document.getElementById('root')!
const preloadedScript = document.getElementById('__NOET_DATA__')

if (preloadedScript?.textContent) {
  try {
    const data = JSON.parse(preloadedScript.textContent)
    window.__NOET_PRELOADED__ = data

    if (data.settings) {
      queryClient.setQueryData(['settings'], data.settings)
    }

    if (Array.isArray(data.posts)) {
      queryClient.setQueryData(postsQueryKeys.list(false), data.posts)
      queryClient.setQueryData(postsQueryKeys.list(true), data.posts)
    }

    if (data.post && typeof data.post.id !== 'undefined') {
      const detailKey = postsQueryKeys.detail(String(data.post.id))
      queryClient.setQueryData(detailKey, data.post)
    }

    preloadedScript.remove()
  } catch (error) {
    console.error('Failed to parse preloaded data', error)
  }
}

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
