import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const rootElement = document.getElementById('root')!

if (rootElement.hasChildNodes()) {
  // SSR markup is for bots only; remove to avoid hydration mismatches
  rootElement.innerHTML = ''
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
